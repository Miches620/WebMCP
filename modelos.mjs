// modelos.mjs — qué LLM ocupa cada puesto (10/11, idea de Miche).
//
// La tabla vive en PUESTOS.md: el código pide el modelo de un PUESTO (modeloDe("specialist")) y nunca nombra un
// modelo. Así MicheLab no se ata a ningún LLM: cambiar quién ocupa un puesto es cambiar una línea del .md.
// Para una prueba suelta sin tocar la tabla: MODELO_<PUESTO> (p. ej. MODELO_SPECIALIST). Las variables viejas
// (SPECIALIST_MODEL, REVIEWER_MODEL, PLANILLA_MODEL, SEARCHER_MODEL) siguen andando igual que antes.
// Solo Node (lee un archivo): el navegador (script.js) lo recibe del server.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PUESTOS_MD = fileURLToPath(new URL("./PUESTOS.md", import.meta.url));

/** Variables de entorno de antes, por puesto (compatibilidad). */
const VIEJAS = { specialist: ["SPECIALIST_MODEL"], techleader: ["SPECIALIST_MODEL"], revisor: ["REVIEWER_MODEL"], planilla: ["PLANILLA_MODEL", "REVIEWER_MODEL"], buscador: ["SEARCHER_MODEL", "REVIEWER_MODEL"] };

const limpio = (s) => String(s || "").replace(/`/g, "").trim();

/** La tabla del .md → { puesto: { modelo, role, hace } }. Toma la primera tabla cuya cabecera empieza con "puesto". */
export function leerPuestos(texto) {
  const filas = String(texto).replace(/\r/g, "").split("\n").filter((l) => /^\s*\|/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map(limpio));
  const cab = filas.findIndex((f) => /^puesto$/i.test(f[0]));
  if (cab < 0) return {};
  const cols = filas[cab].map((c) => c.toLowerCase());
  const iModelo = cols.findIndex((c) => c.startsWith("modelo")), iRole = cols.findIndex((c) => c.startsWith("role")), iHace = cols.findIndex((c) => c.startsWith("qué") || c.startsWith("que"));
  const out = {};
  for (const f of filas.slice(cab + 1)) {
    if (f.every((c) => /^:?-+:?$/.test(c) || !c)) continue; // la línea |---|---|
    const puesto = f[0].toLowerCase();
    if (!puesto) continue;
    out[puesto] = { modelo: f[iModelo] || "", role: iRole >= 0 && f[iRole] !== "—" ? f[iRole] : "", hace: iHace >= 0 ? f[iHace] : "" };
  }
  return out;
}

let cache = null;
/** La tabla de PUESTOS.md (se lee una vez). */
export function puestos() {
  if (!cache) cache = existsSync(PUESTOS_MD) ? leerPuestos(readFileSync(PUESTOS_MD, "utf8")) : {};
  return cache;
}

/** El modelo de un puesto: MODELO_<PUESTO> > variable vieja > PUESTOS.md. Falla fuerte si no hay. */
export function modeloDe(puesto, env = process.env) {
  const p = String(puesto).toLowerCase();
  const nuevo = env[`MODELO_${p.toUpperCase()}`];
  if (nuevo) return nuevo;
  for (const v of VIEJAS[p] || []) if (env[v]) return env[v];
  const fila = puestos()[p];
  if (fila?.modelo) return fila.modelo;
  throw new Error(`PUESTO_SIN_MODELO: el puesto "${p}" no tiene modelo en PUESTOS.md (puestos: ${Object.keys(puestos()).join(", ") || "ninguno"})`);
}
