import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { loadStageBlock } from "./context/stage_loader.mjs";

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

  // === API INTENT FORGE ===
  if (req.method === "POST" && req.url === "/api/intent-forge") {
    try {
      const { prompt, conversation, iteration } = await getBody(req);
      console.log(
        `[INTENT_FORGE] iter ${iteration} -> ${prompt?.substring(0, 100)}`,
      );

      // Este es el ÚNICO system prompt de Intent Forge que corre en vivo.
      // intent_forge_v02.ps1 (en la raíz de webmcp) tiene una versión
      // parecida pero DISTINTA, pensada para correr sola desde una terminal
      // como herramienta manual de debug — el pipeline real (esta ruta)
      // nunca la invoca. Si se edita una regla acá, no asumir que también
      // cambió del lado del .ps1, y viceversa: son dos archivos separados.
      const SYSTEM = `
Sos Intent Forge v0.2 del Equipo MicheLab.

Tu laburo NO es inventar un número fijo de features. Tu laburo es:
1. Entender qué quiere construir el usuario.
2. Hacer preguntas atómicas para no asumir.
3. Generar el refined_prompt: una lista de requisitos ATÓMICOS y verificables, sin agrupar ni omitir.

REGLAS DURAS:
1. UNA (1) pregunta por vez. Nunca hagas lista de preguntas.
2. No hardcodees número de features. Si el proyecto pide 3, son 3; si pide 15, son 15.
3. Una feature atómica = 1 capacidad verificable. No agrupes "CRUD completo" en una sola; separala si el proyecto la pide, aunque sea implícito.
4. No muestres el refined_prompt crudo en el chat mientras preguntás. Si no estás COMPLETE, hacé una sola pregunta corta.
5. NUNCA respondas COMPLETE en tu primera respuesta. El primer mensaje del usuario es una intención inicial, no un refined_prompt: siempre hacé al menos una pregunta antes. Si el usuario menciona una cantidad de features sin nombrarlas ("9 features claras", "unas 5 funciones"), no las inventes: preguntale cuáles son.
6. Cuando ya tenés suficiente, respondé EXCLUSIVAMENTE con:
\`\`\`json
{
  "status": "COMPLETE",
  "refined_prompt": {
    "project_name": "...",
    "objetivo": "...",
    "features": ["feature atómica 1", "feature atómica 2", ...],
    "criterios_holdout": ["cómo se verifica cada una"]
  }
}
\`\`\`
Estilo: corto, directo, TechLead. Máximo 10 iteraciones.
`;
      // FIX (bug real, encontrado en logs de LM Studio: el mismo mensaje
      // llegaba dos veces seguidas como "user", sin ningún "assistant" en
      // el medio). script.js ya empuja el mensaje del turno actual a
      // intentForge.history ANTES de armar el fetch, así que `conversation`
      // llega acá con ese turno ya adentro. Agregar además `prompt` como
      // último mensaje lo duplicaba. `prompt` se sigue usando para el log
      // de debug de la línea de arriba; para armar `messages` alcanza con
      // `conversation`, salvo el caso raro de que venga vacío.
      const conv = conversation || [];
      const messages = [
        { role: "system", content: SYSTEM },
        ...(conv.length > 0
          ? conv.map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            }))
          : [{ role: "user", content: prompt }]),
      ];

      const lmRes = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5-7b-instruct",
          messages,
          temperature: 0.3,
        }),
      });

      if (!lmRes.ok)
        throw new Error(
          `LM Studio ${lmRes.status}: ${(await lmRes.text()).slice(0, 800)}`,
        );
      const lmData = await lmRes.json();
      const content = lmData.choices?.[0]?.message?.content || "";

      let isComplete = content.includes("COMPLETE");
      let refined_prompt = null;
      const match = content.match(/```json([\s\S]*?)```/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.refined_prompt) {
            refined_prompt = parsed.refined_prompt;
            // La etapa la declara Miche (ProjectStage.md), nunca el modelo:
            // si Intent Forge devolviera project_stage, se pisa.
            refined_prompt.project_stage = currentStage().stage;
            isComplete = true;
            await writeFile(
              join(STATIC_DIR, "refined_prompt.json"),
              JSON.stringify(parsed, null, 2),
            );
            await writeFile(
              join(STATIC_DIR, "answer_key_requirements.json"),
              JSON.stringify(
                refined_prompt.features.map((f, i) => ({
                  id: `R${i + 1}`,
                  text: f,
                })),
                null,
                2,
              ),
            );
            console.log(
              `[INTENT_FORGE] COMPLETE con ${refined_prompt.features.length} features`,
            );
          }
        } catch (e) {
          console.log("No es JSON final:", e.message);
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          iteration,
          assistantMessage: content,
          isComplete,
          refined_prompt,
          rawOutput: content,
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
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...result, logs }));
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
  res.writeHead(200, { "Content-Type": mime });
  res.end(data);
});

server.listen(PORT, () =>
  console.log(`\n✅ MicheLab v0.2 corriendo en http://localhost:${PORT}\n`),
);
