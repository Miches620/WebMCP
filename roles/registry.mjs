// roles/registry.mjs — Roles y sus Skills (07/10, paso 3).
//
// Una Skill es un .md con frontmatter (id, status, pasos, evidencia, detecta) y un texto corto.
// `pasos` son clases de paso del motor (data, logic, screen, render, wiring): cada paso recibe
// solo las Skills de su clase (16k de contexto: nada de mandarlas todas a todos los pasos).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Lee una Skill (.md con frontmatter simple). */
export function parseSkill(md, file = "") {
  const m = String(md).replace(/\r/g, "").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`SKILL_FORMAT: ${file} no tiene frontmatter (--- … ---)`);
  const meta = Object.fromEntries(m[1].split("\n").filter((l) => l.includes(":")).map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]));
  const kinds = String(meta.pasos || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!meta.id || !kinds.length) throw new Error(`SKILL_FORMAT: ${file} necesita id y pasos`);
  return { id: meta.id, status: meta.status || "DRAFT", kinds, evidence: meta.evidencia || "", detects: meta.detecta ? new RegExp(meta.detecta, "i") : null, text: m[2].trim() };
}

/** Carga un Role con sus Skills. Falla fuerte si no existe. */
export async function loadRole(id) {
  const dir = join(here, id);
  if (!existsSync(join(dir, "role.mjs"))) throw new Error(`ROLE_UNKNOWN: "${id}"`);
  const role = (await import(new URL(`./${id}/role.mjs`, import.meta.url))).default;
  const sdir = join(dir, role.skillsDir || "skills");
  const skills = existsSync(sdir) ? readdirSync(sdir).filter((f) => f.endsWith(".md")).sort().map((f) => parseSkill(readFileSync(join(sdir, f), "utf8"), f)) : [];
  return { ...role, skills };
}

/** Texto que recibe un paso: solo las Skills de su clase. "" si no hay. */
export function skillsBlock(skills, kind) {
  const mine = (skills || []).filter((s) => s.kinds.includes(kind));
  return mine.length ? `HABILIDADES (lo que sabe hacer un programador con experiencia en este tipo de proyecto):\n${mine.map((s) => `- ${s.text}`).join("\n")}` : "";
}
