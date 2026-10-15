// standards/web/app/estado/enlace.mjs — paso ENLACE: a qué parte de la app pertenece cada Atomic Task.
//
// v0.1 (14/10, punto 9 paso 3, Miche: "seguimos con el paso enlace"): tareas de logica/controles → una acción
// del contrato. Pedirlo DENTRO del contrato lo rompió (build 2026-10-14T22-19-17), por eso es un pedido aparte,
// chico, al final: si falla, se pierde solo el veredicto por tarea, no el build. Gemma: 13/13 al 1er intento en
// 6 builds seguidos (temperatura 0 y 0.7).
//
// v0.2 (15/10, p49, Miche: "arrancá el camino 1"): 16 de 28 tareas quedaban SIN_EVIDENCIA (vista, datos, estilo)
// porque no se sabía de qué parte de la app eran. Ahora el mismo pedido ubica TODAS las tareas, según su pieza:
//   logica, controles → una ACCIÓN del contrato        (evidencia: pruebas de lógica, compuerta, pantalla)
//   vista, datos      → una LISTA del estado ("a[].b") (evidencia: sus textos se ven / existe con elementos)
//   estilo            → uno o más REQUISITOS de aspecto (evidencia: el veredicto de Validation de ese requisito)
// Salida de Gemma: un objeto plano { "<acción | lista | R<n> | ninguna>": ["<id>", …] }.
// El harness valida: destinos que no existen, ids que no son tareas, tareas sin ubicar, repetidas, o puestas en
// un destino que no es de su pieza (una tarea de vista en una acción).
//
// OJO (epistemología): el enlace es una AFIRMACIÓN de Gemma, no evidencia. La evidencia es la del destino.
// Un enlace mal hecho se ve comparando el título de la tarea con su destino (enlace.json y el veredicto).

import { listPaths } from "./contract.mjs";

export const ENLACE_VERSION = "enlace v0.2";
/** Qué clase de destino le corresponde a cada pieza de la receta. */
export const DESTINO_DE = Object.freeze({ logica: "accion", controles: "accion", vista: "lista", datos: "lista", estilo: "requisito" });
export const ENLACE_PIEZAS = Object.freeze(Object.keys(DESTINO_DE));
export const NINGUNA = "ninguna";

/** Las tareas que van al enlace (las que traen una pieza conocida). */
export const linkTasksOf = (tasks = []) => tasks.filter((t) => ENLACE_PIEZAS.includes(t.pieza));

/** Requisitos de aspecto: los que el contrato dice que "se_ve" (o todos, si no lo dice). */
export function aspectReqs(contract, features = []) {
  // 15/10 (step_bench del enlace): un contrato puso en "se_ve" también requisitos de acciones (1–5); Gemma mandó
  // tareas de vista a "R3: Agregar comentarios". De aspecto = los que ninguna acción cumple.
  const deAccion = new Set((contract?.acciones || []).flatMap((a) => (a.features || []).map(Number)));
  const nums = (contract?.se_ve || []).map(Number).filter((n) => n >= 1 && n <= features.length && !deAccion.has(n));
  return (nums.length ? nums : features.map((_, i) => i + 1).filter((n) => !deAccion.has(n))).map((n) => ({ id: `R${n}`, text: String(features[n - 1] || "") }));
}

const FMT = `{
  "borrarNota": ["T2.3", "T2.4"],
  "notas": ["T1.2", "T1.3"],
  "notas[].etiquetas": ["T3.1"],
  "R4": ["T4.1"],
  "${NINGUNA}": ["T3.2"]
}`;

/** Pedido a Gemma (chico: sin brief ni contrato completo). */
export function enlacePrompt(contract, tasks, features = [], paso = "") {
  const acc = contract.acciones.map((a) => `- ${a.nombre}: ${a.hace || ""}`.trimEnd()).join("\n");
  const lists = Object.entries(listPaths(contract.estado)).map(([p, o]) => `- ${p} (${o.n} elemento${o.n === 1 ? "" : "s"} con: ${o.keys.slice(0, 6).join(", ")})`).join("\n");
  const reqs = aspectReqs(contract, features).map((r) => `- ${r.id}: ${r.text}`).join("\n");
  const ts = tasks.map((t) => `- ${t.id} [${t.pieza}] ${String(t.task || "").trim()}`).join("\n");
  return `${paso ? paso + ": " : ""}ENLACE. Decí qué parte de la app hace cada tarea. No escribas código.

ACCIONES (para las tareas [logica] y [controles]):
${acc}

LISTAS DEL ESTADO (para las tareas [vista] y [datos]):
${lists}

REQUISITOS DE ASPECTO (para las tareas [estilo]):
${reqs}

TAREAS:
${ts}

Cada tarea va en la lista de lo que la hace, según su [pieza]: una acción, una lista del estado o un requisito.
Una tarea [estilo] puede ir en más de un requisito; las demás, en UNO solo. Si nada la hace, va en "${NINGUNA}".
Usá los nombres y los ids tal cual.
Formato (es un ejemplo de la forma, no de esta app):
### FILE: enlace.json
\`\`\`json
${FMT}
\`\`\``;
}

const normPath = (s) => String(s).toLowerCase().replace(/\[\]/g, "").replace(/[^a-z0-9_]+/g, ".").replace(/^\.|\.$/g, "");

/**
 * Valida la respuesta. Nunca inventa: lo que no se reconoce queda informado.
 * @returns {{error?:string, items:Array<{enlace, listas, requisitos, ninguna}>, reports:Array, dropped:string[]}}
 */
export function parseLinks(json, contract, tasks, features = []) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return { error: 'enlace.json tiene que ser un objeto {"<acción, lista o requisito>": ["<id>", …]}.', items: [], reports: [], dropped: [] };
  const names = contract.acciones.map((a) => a.nombre);
  const lists = Object.keys(listPaths(contract.estado));
  const reqs = aspectReqs(contract, features).map((r) => r.id);
  const byLower = Object.fromEntries(names.map((n) => [n.toLowerCase(), n]));
  const byPath = Object.fromEntries(lists.map((p) => [normPath(p), p]));
  // el último tramo solo ("etiquetas") vale si no es ambiguo
  const lastSeg = {};
  for (const p of lists) { const k = normPath(p).split(".").pop(); lastSeg[k] = lastSeg[k] === undefined ? p : null; }
  const resolve = (k) => {
    const t = String(k).trim(), l = t.toLowerCase();
    if (l === NINGUNA) return { kind: NINGUNA, key: NINGUNA };
    if (byLower[l]) return { kind: "accion", key: byLower[l] };
    const r = t.toUpperCase().replace(/\s+/g, "").match(/^R(\d+)$/);
    if (r && reqs.includes(`R${r[1]}`)) return { kind: "requisito", key: `R${r[1]}` };
    if (byPath[normPath(t)]) return { kind: "lista", key: byPath[normPath(t)] };
    const ls = lastSeg[normPath(t).split(".").pop()];
    if (ls) return { kind: "lista", key: ls };
    return null;
  };
  const piezaDe = Object.fromEntries(tasks.map((t) => [t.id, t.pieza]));
  const enlace = Object.fromEntries(names.map((n) => [n, []]));
  const listas = {}, requisitos = {}, ninguna = [];
  const desconocidas = [], idsDesconocidos = [], malUbicadas = [], visto = {};
  for (const [k, v] of Object.entries(json)) {
    const d = resolve(k);
    if (!d) { desconocidas.push(String(k).trim()); continue; }
    for (const x of [].concat(v ?? [])) {
      const id = String(x).trim().split(/\s/)[0];
      if (!(id in piezaDe)) { idsDesconocidos.push(id); continue; }
      const want = DESTINO_DE[piezaDe[id]];
      if (d.kind !== NINGUNA && want && d.kind !== want) { malUbicadas.push({ id, pieza: piezaDe[id], en: d.key, quiere: want }); continue; }
      (visto[id] ||= []).push(d.key);
      const bucket = d.kind === NINGUNA ? ninguna : d.kind === "accion" ? enlace[d.key] : d.kind === "lista" ? (listas[d.key] ||= []) : (requisitos[d.key] ||= []);
      if (!bucket.includes(id)) bucket.push(id);
    }
  }
  const ubicadas = Object.keys(visto);
  if (!ubicadas.length) return { error: `enlace.json no ubica ninguna tarea${desconocidas.length ? ` (destinos que no existen: ${desconocidas.slice(0, 4).join(", ")})` : ""}.`, items: [], reports: [], dropped: [] };
  const item = { enlace, listas, requisitos, ninguna };
  const report = {
    total: tasks.length,
    ubicadas: ubicadas.length,
    faltan: tasks.map((t) => t.id).filter((id) => !visto[id] && !malUbicadas.some((m) => m.id === id)),
    // una tarea de estilo puede ir en varios requisitos; las demás, en un solo destino
    repetidas: ubicadas.filter((id) => new Set(visto[id]).size > 1 && DESTINO_DE[piezaDe[id]] !== "requisito"),
    malUbicadas,
    accionesSinTareas: names.filter((n) => !enlace[n].length),
    accionesDesconocidas: desconocidas, idsDesconocidos: [...new Set(idsDesconocidos)],
  };
  // para el veredicto por tarea (Validation lo lee del resumen del paso, sin abrir archivos)
  report.porTarea = actionsByTask(item);
  report.listaDe = Object.fromEntries(Object.entries(listas).flatMap(([p, ids]) => ids.map((id) => [id, p])));
  report.requisitosDe = {};
  for (const [r, ids] of Object.entries(requisitos)) for (const id of ids) (report.requisitosDe[id] ||= []).push(r);
  report.ninguna = [...ninguna];
  return { items: [item], reports: [report], dropped: [] };
}

const DEST_TXT = { accion: "una ACCIÓN", lista: "una LISTA DEL ESTADO", requisito: "un REQUISITO" };
/** Problemas que se le devuelven a Gemma (no rompen: se reintenta y se queda el mejor). */
export function linkProblems(report) {
  const out = [];
  if (report.faltan.length) out.push(`faltan estas tareas: ${report.faltan.join(", ")}. Poné cada una en lo que la hace (según su pieza), o en "${NINGUNA}".`);
  if (report.malUbicadas?.length) out.push(`estas tareas están en un lugar que no es de su pieza: ${report.malUbicadas.map((m) => `${m.id} [${m.pieza}] va en ${DEST_TXT[m.quiere]}, no en "${m.en}"`).join("; ")}.`);
  if (report.repetidas.length) out.push(`estas tareas están en más de un lugar: ${report.repetidas.join(", ")}. Cada una va en UNO solo (solo las [estilo] pueden ir en varios requisitos).`);
  if (report.accionesDesconocidas.length) out.push(`estos nombres no existen: ${report.accionesDesconocidas.join(", ")}. Usá solo las ACCIONES, LISTAS DEL ESTADO y REQUISITOS de arriba, o "${NINGUNA}".`);
  if (report.idsDesconocidos.length) out.push(`estos ids no son tareas: ${report.idsDesconocidos.join(", ")}.`);
  // acciones sin tareas NO es problema: puede pasar de verdad (el Atomizer no armó tarea para esa acción)
  return out;
}
const scoreOf = (r) => r.faltan.length * 2 + r.repetidas.length * 2 + (r.malUbicadas?.length || 0) * 2 + r.idsDesconocidos.length + r.accionesDesconocidas.length;

/** De todos los intentos, el enlace con menos problemas. */
export function bestLinks(items, reports) {
  let b = 0;
  reports.forEach((r, i) => { if (scoreOf(r) < scoreOf(reports[b])) b = i; });
  return b;
}

/** "enlace: 28/28 tareas ubicadas · 6/6 acciones con tareas · 4 listas · 3 requisitos · ninguna: F3.2" */
export function linksSummary(item, report) {
  const total = report.total, ub = report.ubicadas ?? total - report.faltan.length;
  const nAcc = Object.keys(item.enlace).length;
  const nL = Object.keys(item.listas || {}).length, nR = Object.keys(item.requisitos || {}).length;
  return `enlace: ${ub}/${total} tareas ubicadas · ${nAcc - report.accionesSinTareas.length}/${nAcc} acciones con tareas${nL ? ` · ${nL} lista${nL === 1 ? "" : "s"}` : ""}${nR ? ` · ${nR} requisito${nR === 1 ? "" : "s"}` : ""}${item.ninguna.length ? ` · ${NINGUNA}: ${item.ninguna.join(", ")}` : ""}${report.repetidas.length ? ` · en varias: ${report.repetidas.join(", ")}` : ""}${report.malUbicadas?.length ? ` · mal ubicadas: ${report.malUbicadas.map((m) => m.id).join(", ")}` : ""}${report.faltan.length ? ` · sin ubicar: ${report.faltan.join(", ")}` : ""}`;
}

/** { tareaId: [accion…] } para el veredicto por tarea. */
export function actionsByTask(item) {
  const out = {};
  for (const [a, l] of Object.entries(item?.enlace || {})) for (const id of l) (out[id] ||= []).push(a);
  return out;
}
