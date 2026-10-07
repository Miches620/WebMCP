// json_loose.mjs — parseo tolerante del JSON que devuelven los modelos chicos.
//
// Evidencia (Project25, 05/10): TechLeader (Gemma) devolvió un plan con una
// coma faltante ("Expected ',' or '}' after property value ... line 41") y
// JSON.parse cortó toda la corrida en el intento 3. Lo mismo pasó antes con
// Intent Forge ('"' suelto después de la última '}').
//
// Intenta, en orden: tal cual → recortado al primer '{' / último '}' (y sin
// fence) → reparaciones mecánicas (comentarios //, comas colgantes, comas
// faltantes entre valores separados por salto de línea). Si nada anda, tira
// el error del intento original para que el que llama pueda pedir otro JSON.
// Módulo puro: lo usan script.js (navegador) y los tests (node).

export const JSON_LOOSE_VERSION = "json_loose v0.2";
// v0.2 (07/10, Depósito con Gemma): el JSON de niveles vino completo salvo la ÚLTIMA llave "}"
// (cortó el cierre). Ahora, si nada más anda, se cierran las llaves y corchetes que quedaron
// abiertos (contando fuera de los strings) y se vuelve a probar.

function slice(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fence ? fence[1] : text;
  const a = src.indexOf("{"), b = src.lastIndexOf("}");
  return a >= 0 && b > a ? src.slice(a, b + 1) : null;
}

function repair(src) {
  return src
    .replace(/^\s*\/\/.*$/gm, "")                                  // comentarios de línea
    .replace(/,\s*([}\]])/g, "$1")                                  // coma colgante
    .replace(/(["\]}]|\d|true|false|null)(\s*\n\s*)(["{\[])/g, "$1,$2$3"); // coma faltante entre líneas
}

/** Desde el primer '{' hasta el final (sin fence): para JSON al que le falta el cierre. */
function tail(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)(```|$)/);
  const src = fence ? fence[1] : text;
  const a = src.indexOf("{");
  return a >= 0 ? src.slice(a) : null;
}
/** Agrega los cierres que faltan ("}" y "]") en el orden correcto. */
export function closeOpen(src) {
  const stack = [];
  let q = false, esc = false;
  for (const ch of src) {
    if (q) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') q = false; continue; }
    if (ch === '"') q = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if ((ch === "}" || ch === "]") && stack[stack.length - 1] === ch) stack.pop();
  }
  return src.replace(/[\s,]+$/, "") + stack.reverse().join("");
}

/** @returns {{ok:true, data:any, repaired:boolean} | {ok:false, error:string}} */
export function parseJsonLoose(raw) {
  const text = String(raw ?? "");
  let firstError;
  try { return { ok: true, data: JSON.parse(text), repaired: false }; } catch (e) { firstError = e.message; }
  const s = slice(text);
  if (s) {
    try { return { ok: true, data: JSON.parse(s), repaired: true }; } catch { /* sigue */ }
    try { return { ok: true, data: JSON.parse(repair(s)), repaired: true }; } catch { /* sigue */ }
  }
  const t = tail(text);
  if (t) {
    try { return { ok: true, data: JSON.parse(closeOpen(repair(t))), repaired: true }; } catch { /* sigue */ }
  }
  return { ok: false, error: firstError };
}
