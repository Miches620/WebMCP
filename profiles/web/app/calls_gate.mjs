// calls_gate.mjs — Validation profile web/app: COMPUERTA de llamadas (12/10, punto 7).
//
// Punto 7 del plan de Miche: "el validador de artefactos ejecuta las pruebas, además de lo que ya hace".
// Kanban 4ª corrida: R4 "Etiquetar" dio PASS porque al apretar el botón la pantalla cambiaba, pero
// agregarEtiqueta se llamaba con labelId undefined (dibujaba una etiqueta vacía). El paso de controles
// del Specialist SÍ lo había visto ("falta labelid"); el juez final era más blando que el control interno.
//
// Qué hace: usa la pantalla como una persona (sonda de llamadas: completa los campos visibles y aprieta
// cada botón) y mira, por cada acción del contrato, si alguna vez se llamó CON DATOS DE VERDAD:
//   - se llamó (algún botón la dispara);
//   - en al menos una llamada, ningún param llegó vacío (undefined, null, "", NaN, "undefined"…) y los
//     params que son ids traen un id que existe en el estado;
//   - después de llamarla se dibujó otra vez.
// Si una acción falla, los requisitos que esa acción cumple (sus "features") quedan FAIL.
//
// Independencia (decisión de Miche, 12/10): es una COMPUERTA. Nunca suma un PASS: el contrato de Gemma
// solo dice qué acción va con qué requisito; si Gemma se olvidó de una acción, esto no aprueba nada.
// Las reglas del contrato las lee del Standard (S.validation), no las copia.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseJsonLoose } from "../../../json_loose.mjs";
import { runCallsProbe } from "../validation/page_tools.mjs";
import { getStandard } from "../../../standards/registry.mjs";

export const CALLS_GATE_VERSION = "calls_gate v0.2";
const EMPTY = new Set(["__undefined__", "__NaN__", "__object__", "__array__", "__function__", "undefined", "null", "NaN", "[object Object]", ""]);
const isEmpty = (v) => v === null || (typeof v === "string" && EMPTY.has(v.trim()));
// ¿dos elementos son de la misma clase? comparten la mayoría de sus claves (los campos opcionales no los separan)
const sameKind = (a = [], b = []) => { const A = new Set(a), B = new Set(b); return [...A].filter((k) => B.has(k)).length / (new Set([...A, ...B]).size || 1) >= 0.5; };
const show = (v) => (v === "__undefined__" ? "undefined" : v === "__NaN__" ? "NaN" : JSON.stringify(v));
const ctlName = (k) => String(k || "").replace(/^accion:/, "data-accion=").replace(/^[A-Z]+:/, "");

/**
 * Juzga lo que registró la sonda. Función pura (sin navegador), para poder probarla.
 * @param {{found, tracked, calls, undrawn, args, via}} probe   resultado de runCallsProbe
 * @param {{nombre, params, ids, features}[]} actions          del Standard (S.validation.actions)
 * @param {(string|number)[]} idValues                          ids del estado inicial
 * @param {{global?:string, draw?:string}} names
 */
export function judgeCalls(probe, actions, idValues = [], { global = "App", draw = "dibujar" } = {}, idKeys = null) {
  const known = new Set(idValues.map(String));
  // v0.2 (15/10, p48): la clase de cada id (sus claves en el estado). Un id que existe pero es de otra clase
  // (el de una columna donde va el de una tarjeta) no es "un dato de verdad" para esa acción.
  const kindOf = (v) => (idKeys ? idKeys[String(v)] : null);
  const keysTxt = (ks) => `{ ${ks.slice(0, 5).join(", ")}${ks.length > 5 ? ", …" : ""} }`;
  const rows = actions.map((a) => {
    const row = { nombre: a.nombre, features: a.features, called: probe.calls?.[a.nombre] || 0, via: probe.via?.[a.nombre] || null, problem: null };
    if (!probe.found) { row.problem = `${global} no existe en la página`; return row; }
    if (!row.called) { row.problem = `ningún botón de la pantalla llama a ${global}.${a.nombre} (se apretaron todos los botones con los campos completos)`; return row; }
    // params después de "estado": args[k + 1]
    const badOf = (call) => {
      for (const [k, p] of a.params.entries()) {
        const v = call[k + 1];
        // un campo numérico dibujado como <input type="text"> recibe "Prueba" → Number() da NaN: no es concluyente
        if (v === "__NaN__" && (a.campos || []).includes(p)) continue;
        if (v === undefined || isEmpty(v)) return `${p} = ${v === undefined ? "(no se pasó)" : show(v)}`;
        if (a.ids.includes(p) && known.size && !known.has(String(v))) return `${p} = ${show(v)}, que no es ningún id del estado`;
        if (a.ids.includes(p) && a.ejemplo) { const kv = kindOf(v), ke = kindOf(a.ejemplo[k]);
          if (kv && ke && !sameKind(kv, ke)) return `${p} = ${show(v)}, que es el id de otra clase de elemento (${keysTxt(kv)}; ${p} es de ${keysTxt(ke)})`; }
      }
      return null;
    };
    const calls = probe.args?.[a.nombre] || [];
    const bads = calls.map(badOf);
    if (calls.length && bads.every(Boolean)) {
      row.problem = `"${ctlName(row.via)}" llama a ${global}.${a.nombre} con ${bads[0]}: la acción no recibe el dato que necesita`;
      return row;
    }
    // v0.2: una acción sobre un elemento (tiene ids) que desde la pantalla SIEMPRE devuelve el mismo estado no hace nada
    // (las acciones sin ids, como reiniciar, pueden no cambiar el estado inicial: no se juzgan así)
    const eff = probe.effects?.[a.nombre] || [];
    if (a.ids?.length && eff.length && eff.every((x) => x === false)) {
      row.problem = `"${ctlName(row.via)}" llama a ${global}.${a.nombre} pero siempre devuelve el mismo estado: desde la pantalla la acción no cambia nada${calls[0] ? ` (por ejemplo con ${calls[0].slice(1).map(show).join(", ")})` : ""}`;
      return row;
    }
    if (probe.tracked && probe.undrawn?.[a.nombre] && probe.undrawn[a.nombre] === row.called) {
      row.problem = `después de ${global}.${a.nombre} no se llama a ${draw}(estado): la pantalla no muestra el cambio`;
    }
    return row;
  });
  // requisito → compuerta (R<n> con n = feature del brief)
  const gates = {};
  for (const r of rows.filter((x) => x.problem)) {
    for (const n of r.features || []) {
      const id = `R${n}`;
      const g = gates[id] ||= { type: "calls_probe", gate: true, result: "FAIL", detail: "" };
      g.detail = (g.detail ? g.detail + " | " : "") + r.problem;
    }
  }
  return { rows, gates };
}

/**
 * Corre la compuerta sobre la app terminada. null si el Standard no la declara (otros tipos de proyecto)
 * o si no hay contrato legible (la compuerta no se inventa uno: queda informado, sin FAIL).
 */
export async function validationGates({ artifact, outDir, input, specialist }) {
  const sid = specialist?.standard?.id;
  if (!sid) return null;
  const S = getStandard(sid);
  // S.validation es "lo que Validation lee del Standard" (grilla también lo tiene, con otras claves)
  if (typeof S?.validation?.contract !== "function") return null;
  const file = join(outDir, "contrato.json");
  const base = { version: CALLS_GATE_VERSION, standard: `${S.id} v${S.version}` };
  if (!existsSync(file)) return { ...base, result: "SIN_CONTRATO", detail: "no está contrato.json en la corrida", rows: [], gates: {} };
  const pj = parseJsonLoose(readFileSync(file, "utf8"));
  const c = pj.ok ? S.validation.contract(pj.data, input.refined) : null;
  if (!c) return { ...base, result: "SIN_CONTRATO", detail: `contrato.json no se puede leer${pj.ok ? "" : `: ${pj.error}`}`, rows: [], gates: {} };
  const spec = S.validation.calls(c);
  const probe = await runCallsProbe(artifact, spec);
  const { rows, gates } = judgeCalls(probe, S.validation.actions(c), S.validation.idValues(c), spec, typeof S.validation.idKeys === "function" ? S.validation.idKeys(c) : null);
  return {
    ...base,
    result: rows.some((r) => r.problem) ? "FAIL" : "PASS",
    detail: `${rows.filter((r) => !r.problem).length}/${rows.length} acciones se usan desde la pantalla con datos de verdad`,
    errors: probe.errors.slice(0, 3),
    rows,
    gates,
    // 14/10 (punto 9 paso 3): qué tareas declara cada acción del contrato (para el veredicto por tarea)
    tareas: Object.fromEntries(c.acciones.map((a) => [a.nombre, a.cumple || []])),
  };
}
