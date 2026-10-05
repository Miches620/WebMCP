import { createServer } from "http";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { loadStageBlock } from "./context/stage_loader.mjs";
import { resolveProfiles } from "./profiles/registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = __dirname;
const PORT = 3000;
const STAGE_FILE = join(__dirname, "context", "ProjectStage.md");

// Se lee en cada uso (no se cachea): si ProjectStage.md cambia, la corrida
// siguiente usa la versión nueva y el sha256 del log lo deja registrado.
// Falla fuerte si falta la etapa o el criterio.
function currentStage() {
  const s = loadStageBlock(STAGE_FILE);
  if (!s.stage || !s.criterion)
    throw new Error("ProjectStage: el bloque operativo no trae ETAPA o criterio de pertenencia");
  return s;
}

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
};

async function getBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // === API INTENT FORGE v0.3 (plantilla + clasificación acotada) ===
  // La lógica vive en intent_brief.mjs (testeable sin LLM): numera las líneas
  // que escribió el usuario, le pide a Qwen un ítem tipado por cada una y
  // reintenta si alguna línea queda sin destino. Acá solo va la llamada a
  // LM Studio y la escritura de archivos/evidencia.
  // intent_forge_v02.ps1 quedó desactualizado (v0.2): no lo usa el pipeline.
  if (req.method === "POST" && req.url === "/api/intent-forge") {
    try {
      const { conversation, iteration, profiles } = await getBody(req);
      // Tipo de proyecto (profiles, 05/10): lo elige Miche en la UI. Falla
      // antes de llamar al modelo si falta o no existe.
      resolveProfiles(profiles);
      const { runIntentForge, BRIEF_VERSION } = await import("./intent_brief.mjs");
      const calls = [];
      const callModel = async (messages) => {
        const lmRes = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "qwen2.5-7b-instruct", messages, temperature: 0.2 }),
        });
        if (!lmRes.ok)
          throw new Error(`LM Studio ${lmRes.status}: ${(await lmRes.text()).slice(0, 800)}`);
        const content = (await lmRes.json()).choices?.[0]?.message?.content || "";
        calls.push({ messages: messages.map((m) => ({ ...m })), content });
        return content;
      };
      const r = await runIntentForge(conversation || [], { callModel });
      console.log(
        `[INTENT_FORGE] iter ${iteration} ${r.status} líneas=${r.lines.length} llamadas=${calls.length}` +
          (r.status === "COMPLETE" ? ` ítems=${r.refined.brief.items.length} auto=${r.auto_added.length} compuestas=${r.compound.length}` : ` faltantes=${(r.faltantes || []).length}`),
      );

      // Evidencia de cada turno (líneas, salidas crudas, reintentos).
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const evDir = join(STATIC_DIR, "evidence", "intent_forge");
      await mkdir(evDir, { recursive: true });
      await writeFile(
        join(evDir, `${stamp}_iter${iteration}.json`),
        JSON.stringify({ version: BRIEF_VERSION, iteration, status: r.status, lines: r.lines, attempts: r.attempts || [], auto_added: r.auto_added || [], refined_prompt: r.refined || null, calls }, null, 2),
      );

      let refined_prompt = null;
      if (r.status === "COMPLETE") {
        refined_prompt = r.refined;
        // La etapa la declara Miche (ProjectStage.md), nunca el modelo.
        refined_prompt.project_stage = currentStage().stage;
        // El tipo de proyecto también lo declara Miche (selector de la UI).
        refined_prompt.profiles = profiles;
        await writeFile(
          join(STATIC_DIR, "refined_prompt.json"),
          JSON.stringify({ status: "COMPLETE", refined_prompt }, null, 2),
        );
        await writeFile(
          join(STATIC_DIR, "answer_key_requirements.json"),
          JSON.stringify(refined_prompt.features.map((f, i) => ({ id: `R${i + 1}`, text: f })), null, 2),
        );
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          iteration,
          // COMPLETE: marcador fijo con "status":"COMPLETE" (numberLines lo usa
          // para marcar el próximo mensaje del usuario como [ajuste]).
          assistantMessage: r.status === "COMPLETE" ? JSON.stringify({ status: "COMPLETE", project_name: r.refined.project_name }) : r.question,
          askedBy: r.by || null,
          // Viajan en el historial (script.js los guarda con la pregunta) para
          // recordarle al entrevistador lo que detectó y no preguntó.
          faltantes: r.faltantes || [],
          isComplete: r.status === "COMPLETE",
          refined_prompt,
          auto_added: r.auto_added || [],
          rawOutput: calls.at(-1)?.content || "",
        }),
      );
    } catch (e) {
      console.error(`[INTENT_FORGE] FAIL ${e.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === API APPROVE INTENT - FIX ===
  if (req.method === "POST" && req.url === "/api/approve-intent") {
    try {
      const { refined_prompt } = await getBody(req);
      if (!refined_prompt) throw new Error("No refined_prompt");
      resolveProfiles(refined_prompt.profiles); // sin tipo de proyecto no se aprueba
      await writeFile(
        join(STATIC_DIR, "refined_prompt.json"),
        JSON.stringify(refined_prompt, null, 2),
      );
      await writeFile(
        join(STATIC_DIR, "answer_key_requirements.json"),
        JSON.stringify(
          refined_prompt.features.map((f, i) => ({ id: `R${i + 1}`, text: f })),
          null,
          2,
        ),
      );
      console.log(
        `[INTENT] approve-intent -> ${refined_prompt.features.length} features guardadas`,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ ok: true, features: refined_prompt.features.length }),
      );
    } catch (e) {
      console.error(`[APPROVE] FAIL ${e.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === API VERSION: BUILD_ID de script.js tal como está en disco ===
  if (req.method === "GET" && req.url === "/api/version") {
    const src = await readFile(join(STATIC_DIR, "script.js"), "utf8").catch(() => "");
    const build = (src.match(/const BUILD_ID = "([^"]+)"/) || [])[1] || null;
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ build }));
    return;
  }

  // === API STAGE: etapa vigente + criterio para TechLeader ===
  if (req.method === "GET" && req.url === "/api/stage") {
    try {
      const s = currentStage();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ stage: s.stage, criterion: s.criterion, sha256: s.sha256 }));
    } catch (e) {
      console.error(`[STAGE] ${e.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === API CHEQUEO DE ETAPA DEL PLAN (antes de atomizar) ===
  if (req.method === "POST" && req.url === "/api/stage-check") {
    try {
      const { brief, fases } = await getBody(req);
      const { runPlanStageCheck } = await import("./plan_stage_check.mjs");
      const logs = [];
      const result = await runPlanStageCheck(brief, fases, {
        model: "qwen2.5-7b-instruct",
        stageFile: STAGE_FILE,
        logCallback: (m) => logs.push(m),
      });
      console.log(
        `[STAGE_CHECK] ${result.stage} flagged=${result.flagged.length}/${fases.length} schema_complete=${result.schema_complete}`,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...result, logs }));
    } catch (e) {
      console.error(`[STAGE_CHECK] ${e.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === API TERM LABEL: Miche etiqueta un aviso de cobertura ===
  if (req.method === "POST" && req.url === "/api/term-label") {
    try {
      const { review_id, requirement_id, label } = await getBody(req);
      if (!/^[\w-]+$/.test(review_id || "")) throw new Error("review_id inválido");
      if (!["hueco_real", "falso_aviso", null].includes(label ?? null)) throw new Error("label inválido");
      const f = join(STATIC_DIR, "evidence", "term_coverage", `${review_id}.json`);
      const data = JSON.parse(await readFile(f, "utf8"));
      if (label) data.labels[requirement_id] = { label, at: new Date().toISOString() };
      else delete data.labels[requirement_id];
      await writeFile(f, JSON.stringify(data, null, 2));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === API COMPLETENESS V3 ===
  if (req.method === "POST" && req.url === "/api/completeness-review") {
    try {
      const { prompt, atomicTasks } = await getBody(req);
      let requirements = null;
      const akPath = join(STATIC_DIR, "answer_key_requirements.json");
      const refPath = join(STATIC_DIR, "refined_prompt.json");
      if (existsSync(akPath)) {
        try {
          requirements = JSON.parse(await readFile(akPath, "utf8"));
        } catch {}
      }
      if (!requirements && existsSync(refPath)) {
        try {
          const refined = JSON.parse(await readFile(refPath, "utf8"));
          const feats =
            refined.refined_prompt?.features || refined.features || [];
          if (feats.length)
            requirements = feats.map((f, i) => ({ id: `R${i + 1}`, text: f }));
        } catch {}
      }
      if (!requirements) requirements = [{ id: "R1", text: prompt }];

      const { runCompletenessReview } =
        await import("./completeness_reviewer3.mjs");
      const logs = [];
      const result = await runCompletenessReview(prompt, atomicTasks, {
        requirements,
        model: "qwen2.5-7b-instruct",
        logCallback: (m) => logs.push(m),
      });
      // Aviso determinista de cobertura por palabras (no bloquea). Cada
      // revisión se guarda en evidence/term_coverage/ para etiquetarla después.
      let term_coverage = null;
      try {
        const { termCoverage, TERM_COVERAGE_VERSION } = await import("./term_coverage_check.mjs");
        const items = termCoverage(requirements, atomicTasks);
        const review_id = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const dir = join(STATIC_DIR, "evidence", "term_coverage");
        await mkdir(dir, { recursive: true });
        await writeFile(
          join(dir, `${review_id}.json`),
          JSON.stringify({ version: TERM_COVERAGE_VERSION, review_id, requirements, tasks: atomicTasks.map(({ id, task, description }) => ({ id, task, description })), items, labels: {} }, null, 2),
        );
        term_coverage = { review_id, version: TERM_COVERAGE_VERSION, items };
      } catch (e) {
        logs.push(`term_coverage: ERROR ${e.message}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...result, logs, term_coverage }));
    } catch (e) {
      console.error(`[COMPLETENESS] ${e.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message, stack: e.stack }));
    }
    return;
  }

  // === STATIC FILES ===
  let filePath =
    req.url === "/"
      ? join(STATIC_DIR, "index.html")
      : join(STATIC_DIR, req.url.split("?")[0]);
  if (!existsSync(filePath) || filePath.includes("..")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found", path: req.url }));
    return;
  }
  const ext = extname(filePath);
  const mime = MIME[ext] || "text/plain";
  const data = await readFile(filePath);
  // no-store: que el navegador nunca use una copia vieja de script.js o
  // de los módulos que importa.
  res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
  res.end(data);
});

server.listen(PORT, () =>
  console.log(`\n✅ MicheLab v0.2 corriendo en http://localhost:${PORT}\n`),
);
