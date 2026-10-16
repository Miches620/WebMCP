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
import seguridad from "./web/seguridad/profile.mjs";
import { CATALOG, standardMeta } from "../standards/catalog.mjs";

const ALL = [web, landing, app, game];
export const PROFILES = Object.freeze(Object.fromEntries(ALL.map((p) => [p.id, p])));
/** Tipos que se pueden elegir para un proyecto. */
export const SELECTABLE = ALL.filter((p) => p.selectable);

// 12/10 (decisión de Miche): Validation profiles POR TEMA (seguridad, después accesibilidad…), un segundo eje
// además del tipo. Se suman solos a todo proyecto de su plataforma (default). No son tipos ni dan roles.
const CONCERN_LIST = [seguridad];
export const CONCERNS = Object.freeze(Object.fromEntries(CONCERN_LIST.map((c) => [c.id, c])));
/** Los profiles de tema que valen para un proyecto ya resuelto (por su plataforma). */
export function concernsFor(resolved) {
  return CONCERN_LIST.filter((c) => c.default && (resolved?.chain || []).includes(c.platform));
}

const SINGULAR = ["defaultRole", "exampleRole"];

/**
 * Resuelve los profiles declarados por un proyecto (con sus plataformas).
 * Falla fuerte si falta la declaración, si un id no existe o si dos profiles
 * se contradicen: nunca "el tipo por defecto" en silencio.
 * @param {string[]} ids  p.ej. ["web/landing"]
 * @param {{standard?: string|null}} [opts]  16/10: el Standard elegido para el proyecto (refined_prompt.standard, lo
 *   elige Miche en la UI, o --standard en run_build para comparar). Sin elegir: el del profile. Tiene que ser un
 *   Standard del catálogo que sirva para ese tipo (su ficha lo declara en "profiles").
 */
export function resolveProfiles(ids, opts = {}) {
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
  // 14/10 (punto 9): el Standard y su receta los pone el tipo más específico que declara Standard.
  // La receta va con SU Standard: web/game (grilla) no hereda la receta de web/app (estado).
  const withStd = chain.slice().reverse().find((p) => p.standard);
  merged.standard = withStd?.standard || null;
  merged.atomizerRecipe = withStd?.atomizerRecipe || null;
  // 16/10: Standard elegido (para comparar Standards con el mismo proyecto). La receta del Atomizer va con su
  // Standard: un Standard que deriva del del profile ("base") usa la misma; otro, ninguna (hasta que tenga la suya).
  if (opts.standard && opts.standard !== merged.standard) {
    const meta = CATALOG[opts.standard];
    if (!meta) throw new Error(`STANDARD_UNKNOWN: "${opts.standard}". Standards: ${Object.keys(CATALOG).join(", ")}`);
    if (!meta.profiles.some((id) => merged.chain.includes(id)))
      throw new Error(`STANDARD_NOT_FOR_PROFILE: "${opts.standard}" sirve para ${meta.profiles.join(", ")}, no para ${merged.chain.join(" → ")}`);
    if (meta.status === "SUPERSEDED") throw new Error(`STANDARD_SUPERSEDED: "${opts.standard}" fue reemplazado; no se usa en proyectos nuevos`);
    if (meta.base !== merged.standard) merged.atomizerRecipe = null;
    merged.standard = opts.standard;
  }
  // El stack lo fija el Standard (16/10): TechLeader y Atomizer lo reciben como dato.
  merged.stack = merged.standard ? standardMeta(merged.standard).stack : null;
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
