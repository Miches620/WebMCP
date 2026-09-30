// specialist_runner.mjs — Specialist Frontend (Gemma) ejecutando Atomic Tasks
// de a una, en orden de dependencias, sobre UN archivo index.html.
//
// Recibe por tarea: el brief (project_name, objetivo, Features), la tarea y
// el HTML actual. Devuelve el archivo completo actualizado. NO recibe los
// criterios_holdout ni lee holdout/: esa es la vara de Validation.
//
// Cada paso queda guardado (step_N_<id>.html) para ver en qué tarea se rompe algo.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions";
export const SPECIALIST_MODEL = "google/gemma-4-e4b";
export const SPECIALIST_VERSION = "frontend_specialist v0.1";

export const SYSTEM_PROMPT = `Sos un Specialist Frontend de MicheLab.

Ejecutás UNA tarea atómica por vez sobre un único archivo index.html
(HTML + CSS + JavaScript inline, en el mismo archivo, sin librerías ni recursos externos).

Recibís:
- el BRIEF del proyecto (para contexto),
- la TAREA que tenés que ejecutar ahora,
- el ARCHIVO ACTUAL (puede estar vacío si es la primera tarea).

Reglas:
1. Hacé lo que pide la TAREA. No adelantes trabajo de otras tareas.
2. Conservá todo lo que ya existe en el archivo, salvo que la tarea pida cambiarlo.
3. Devolvé el archivo COMPLETO actualizado, dentro de un único bloque \`\`\`html ... \`\`\`.
4. Fuera de ese bloque, como máximo una línea de nota.`;

export function topoOrder(tasks) {
  const ids = new Set(tasks.map((t) => t.id));
  const done = new Set();
  const out = [];
  let guard = 0;
  while (out.length < tasks.length) {
    if (guard++ > tasks.length + 1) throw new Error("dependencias circulares o faltantes");
    for (const t of tasks) {
      if (done.has(t.id)) continue;
      const deps = (t.depends_on || []).filter((d) => ids.has(d));
      if (deps.every((d) => done.has(d))) { out.push(t); done.add(t.id); }
    }
  }
  return out;
}

export function briefText(brief) {
  return [
    `Proyecto: ${brief.project_name}`,
    brief.objetivo,
    "",
    "Features:",
    ...brief.features.map((f, i) => `${i + 1}. ${f}`),
  ].join("\n");
}

export function extractHtml(raw) {
  const m = String(raw || "").match(/```html\s*([\s\S]*?)```/i) || String(raw || "").match(/```\s*(<!DOCTYPE[\s\S]*?)```/i);
  if (m) return m[1].trim();
  const t = String(raw || "").trim();
  return /^<!DOCTYPE html|^<html/i.test(t) ? t : null;
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

/**
 * @param {{brief:object, tasks:object[]}} pilot
 * @param {string} outDir
 * @param {{log?:(m:string)=>void, model?:string, forbidden?:string[]}} [opts]
 */
export async function runSpecialist(pilot, outDir, opts = {}) {
  const log = opts.log || console.log;
  const model = opts.model || SPECIALIST_MODEL;
  mkdirSync(outDir, { recursive: true });
  const brief = briefText(pilot.brief);
  const order = topoOrder(pilot.tasks);
  let html = "";
  const steps = [];

  for (const [i, t] of order.entries()) {
    const user =
      `BRIEF:\n${brief}\n\n` +
      `TAREA ${t.id} (${t.role}): ${t.task}\n${t.description}\n\n` +
      `ARCHIVO ACTUAL (index.html):\n${html ? "```html\n" + html + "\n```" : "(vacío)"}`;
    const leak = (opts.forbidden || []).find((f) => user.toLowerCase().includes(f.toLowerCase()));
    if (leak) throw new Error(`holdout filtrado al Specialist en ${t.id}: "${leak}"`);
    const t0 = Date.now();
    log(`[SPECIALIST] ${i + 1}/${order.length} ${t.id} — ${t.task}`);
    const res = await fetch(LM_STUDIO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
        temperature: 0,
        max_tokens: 4096,
      }),
    });
    if (!res.ok) throw new Error(`LM Studio ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const next = extractHtml(raw);
    const step = {
      n: i + 1,
      task_id: t.id,
      ms: Date.now() - t0,
      finish_reason: data?.choices?.[0]?.finish_reason ?? null,
      usage: data?.usage ?? null,
      html_extracted: !!next,
      chars: next ? next.length : 0,
    };
    if (next) {
      html = next;
      step.file = `step_${i + 1}_${t.id}.html`;
      step.sha256 = sha(html);
      writeFileSync(join(outDir, step.file), html, "utf8");
    } else {
      // No se inventa nada: el paso queda registrado como fallido y el
      // archivo sigue como estaba.
      step.error = "la respuesta no trae un bloque ```html";
      step.raw_head = raw.slice(0, 400);
      log(`[SPECIALIST] ✗ ${t.id}: ${step.error}`);
    }
    writeFileSync(join(outDir, `step_${i + 1}_${t.id}.raw.txt`), raw, "utf8");
    steps.push(step);
  }
  writeFileSync(join(outDir, "index.html"), html, "utf8");
  return { model, specialist_version: SPECIALIST_VERSION, order: order.map((t) => t.id), steps, final_sha256: sha(html) };
}
