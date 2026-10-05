// profiles/registry.mjs — qué profiles existen y cómo se combinan.
//
// Refactor 05/10 (decisión de Miche): el harness (core) no sabe de landing,
// apps ni firmware; cada TIPO de artefacto trae su profile. Dos niveles:
//   plataforma (web, firmware/…)  → roles, reglas de dependencia, runner de chequeos
//   tipo (web/landing, web/app…)  → planner, Specialist, reglas del traductor
// Un tipo puede extender a otro tipo (05/10: web/game extiende web/app): la cadena
// queda web → web/app → web/game y se suman roles y reglas de todos.
// Un proyecto declara sus tipos en refined_prompt.profiles (lo elige Miche en la
// UI, como la etapa; nunca un modelo). Puede declarar más de uno (NodeMCU =
// firmware + web/app): los roles se suman; el build multi-artefacto todavía no existe.
//
// Solo datos y funciones puras: lo importan el navegador (script.js) y Node.

import web from "./web/profile.mjs";
import landing from "./web/landing/profile.mjs";
import app from "./web/app/profile.mjs";
import game from "./web/game/profile.mjs";

const ALL = [web, landing, app, game];
export const PROFILES = Object.freeze(Object.fromEntries(ALL.map((p) => [p.id, p])));
/** Tipos que se pueden elegir para un proyecto. */
export const SELECTABLE = ALL.filter((p) => p.selectable);

const SINGULAR = ["defaultRole", "exampleRole"];

/**
 * Resuelve los profiles declarados por un proyecto (con sus plataformas).
 * Falla fuerte si falta la declaración, si un id no existe o si dos profiles
 * se contradicen: nunca "el tipo por defecto" en silencio.
 * @param {string[]} ids  p.ej. ["web/landing"]
 */
export function resolveProfiles(ids) {
  const choices = SELECTABLE.map((p) => p.id).join(", ");
  if (!Array.isArray(ids) || !ids.length)
    throw new Error(`PROFILE_REQUIRED: el proyecto no declara su tipo (refined_prompt.profiles). Tipos: ${choices}`);
  const chain = [];
  const add = (id, from) => {
    const p = PROFILES[id];
    if (!p) throw new Error(`PROFILE_UNKNOWN: "${id}"${from ? ` (extends de ${from})` : ""}. Tipos: ${choices}`);
    if (p.extends) add(p.extends, id);
    if (!chain.includes(p)) chain.push(p);
  };
  for (const id of ids) {
    if (!PROFILES[id]?.selectable) throw new Error(`PROFILE_NOT_SELECTABLE: "${id}" no es un tipo de proyecto. Tipos: ${choices}`);
    add(id);
  }
  const leaves = ids.map((id) => PROFILES[id]);

  const merged = {
    ids: [...ids],
    chain: chain.map((p) => p.id),
    status: Object.fromEntries(chain.map((p) => [p.id, p.status])),
    roles: [...new Set(chain.flatMap((p) => p.roles || []))],
    atomizerRoleRules: [...new Set(chain.flatMap((p) => p.atomizerRoleRules || []))],
    roleDependencyRules: [],
    borrowed: leaves.filter((p) => p.borrowed).map((p) => ({ id: p.id, ...p.borrowed })),
  };
  for (const r of chain.flatMap((p) => p.roleDependencyRules || []))
    if (!merged.roleDependencyRules.some((x) => x.rule === r.rule)) merged.roleDependencyRules.push(r);
  for (const k of SINGULAR) {
    const vals = [...new Set(chain.map((p) => p[k]).filter((v) => v !== undefined))];
    if (vals.length > 1) throw new Error(`PROFILE_CONFLICT: ${k} distinto entre ${merged.chain.join(", ")}: ${vals.join(" / ")}`);
    merged[k] = vals[0];
  }
  const builds = [...new Set(leaves.map((p) => p.build).filter(Boolean))];
  if (builds.length > 1) throw new Error(`PROFILE_MULTI_BUILD: ${ids.join(" + ")} necesitan builds distintos (${builds.join(", ")}); el build multi-artefacto todavía no existe`);
  merged.build = builds[0] || null;
  if (!merged.roles.length) throw new Error(`PROFILE_NO_ROLES: ${merged.chain.join(", ")} no declara roles`);
  if (!merged.roles.includes(merged.defaultRole)) throw new Error(`PROFILE_BAD_DEFAULT_ROLE: ${merged.defaultRole} no está en ${merged.roles.join(", ")}`);
  return Object.freeze(merged);
}

/** Línea corta para logs y evidencia: "web/landing (DRAFT) ← web (DRAFT)". */
export function profileLabel(resolved) {
  return resolved.chain.slice().reverse().map((id) => `${id} (${resolved.status[id]})`).join(" ← ");
}
