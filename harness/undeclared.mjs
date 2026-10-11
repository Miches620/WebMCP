// undeclared.mjs — arreglo DETERMINISTA de una variable sin declarar (12/10, decisión de Miche).
//
// Evidencia (banco de reglas con --repair, 11/10): la falla que la reparación por función no arregla
// es `state is not defined` adentro de `mover(estado, direccion)`: el parámetro se llama `estado` y el
// cuerpo usa `state.mapa`. La reparación de mover (la función más larga) falló 8 de 9 veces.
// Igual que fixRedeclare: lo arregla el harness, sin Gemma, y SOLO cuando es seguro:
//   - X aparece en "X is not defined" y X no está declarado en ningún lado del archivo;
//   - X se usa adentro de UNA función (miembro) que tiene exactamente un nombre propio (parámetro o
//     declaración local) que es su traducción (alias que declara el Standard) o casi el mismo nombre
//     (distancia de edición ≤ 2, nombres de 6 letras o más: objectivos → objetivos);
//   - se renombra X solo en esa función, solo como identificador (no en textos, comentarios ni
//     después de un punto: `e.state` no se toca).
// No sabe de ningún dominio: los alias los da el Standard.

const ID = /[A-Za-z_$][\w$]*/y;

/** Recorre el código y llama a onId(nombre, inicio, fin) por cada identificador que es código. */
function eachIdentifier(code, onId) {
  const s = String(code);
  const stack = []; // "`" dentro de un template; "{" dentro de ${…}
  let i = 0;
  while (i < s.length) {
    const ch = s[i], nx = s[i + 1];
    const inTpl = stack.at(-1) === "`";
    if (inTpl) {
      if (ch === "\\") { i += 2; continue; }
      if (ch === "`") { stack.pop(); i++; continue; }
      if (ch === "$" && nx === "{") { stack.push("{"); i += 2; continue; }
      i++; continue;
    }
    if (ch === "/" && nx === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (ch === "/" && nx === "*") { const e = s.indexOf("*/", i + 2); i = e < 0 ? s.length : e + 2; continue; }
    if (ch === '"' || ch === "'") { i++; while (i < s.length && s[i] !== ch) { if (s[i] === "\\") i++; i++; } i++; continue; }
    if (ch === "`") { stack.push("`"); i++; continue; }
    if (ch === "{" && stack.length) { stack.push("{"); i++; continue; }
    if (ch === "}" && stack.at(-1) === "{") { stack.pop(); i++; continue; }
    if (/[A-Za-z_$]/.test(ch) && !/[\w$]/.test(s[i - 1] || "")) {
      ID.lastIndex = i;
      const m = ID.exec(s);
      onId(m[0], i, i + m[0].length, s);
      i += m[0].length; continue;
    }
    i++;
  }
}

const prevChar = (s, i) => { let j = i - 1; while (j >= 0 && /\s/.test(s[j])) j--; return s[j] || ""; };
const nextChar = (s, i) => { let j = i; while (j < s.length && /\s/.test(s[j])) j++; return s[j] || ""; };

/** Usos de X como variable (no `obj.X`, no clave `{ X: 1 }`). */
function usesOf(code, X) {
  const out = [];
  eachIdentifier(code, (n, a, b, s) => {
    if (n !== X) return;
    if (prevChar(s, a) === ".") return;
    if (nextChar(s, b) === ":" && /[{,]/.test(prevChar(s, a))) return;
    out.push([a, b]);
  });
  return out;
}

/** ¿X está declarado en algún lado (const/let/var/function/class/parámetro/catch)? */
export function isDeclared(code, X) {
  const s = String(code);
  if (new RegExp(`\\b(?:const|let|var|function|class)\\s+${X}\\b`).test(s)) return true;
  if (new RegExp(`\\b(?:const|let|var)\\s*[\\[{][^=]*\\b${X}\\b[^=]*[\\]}]\\s*=`).test(s)) return true; // desestructuración
  if (new RegExp(`(?:^|[^\\w$.])${X}\\s*=>`).test(s)) return true;
  for (const m of s.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) if (new RegExp(`(?:^|[^\\w$.])${X}\\b`).test(m[1])) return true;
  return false;
}

/** Nombres propios de una función: parámetros (primera línea) + declaraciones locales. */
function ownNames(text) {
  const head = (String(text).match(/\(([^)]*)\)/) || [])[1] || "";
  const params = head.split(",").map((p) => p.trim().replace(/=.*$/, "").trim()).filter((p) => /^[A-Za-z_$][\w$]*$/.test(p));
  const locals = [...String(text).matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  return [...new Set([...params, ...locals])];
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Nombres que aparecen en errores "X is not defined". */
export const undefinedNames = (texts) => [...new Set((texts || []).flatMap((t) => [...String(t).matchAll(/\b([A-Za-z_$][\w$]*) is not defined/g)].map((m) => m[1])))];

/**
 * @param {string} code
 * @param {string[]} names       nombres de "X is not defined"
 * @param {{name,start,end,text}[]} members  funciones del archivo (findMember)
 * @param {Record<string,string[]>} aliases  del Standard: { estado: ["state"], … }
 * @returns {{code:string, fixes:{name,to,fn,count,why}[]}}
 */
export function fixUndeclared(code, names, members, aliases = {}) {
  let out = String(code);
  const fixes = [];
  for (const X of names) {
    if (isDeclared(out, X)) continue;
    const lines = out.split("\n");
    for (const m of members) {
      const text = lines.slice(m.start - 1, m.end).join("\n");
      const uses = usesOf(text, X);
      if (!uses.length) continue;
      const own = ownNames(text);
      const byAlias = own.filter((n) => (aliases[n] || []).includes(X));
      const byNear = X.length >= 6 ? own.filter((n) => n.length >= 6 && editDistance(n.toLowerCase(), X.toLowerCase()) <= 2) : [];
      const cand = [...new Set([...byAlias, ...byNear])];
      if (cand.length !== 1) continue;
      const to = cand[0];
      let t = text;
      for (const [a, b] of [...uses].reverse()) t = t.slice(0, a) + to + t.slice(b);
      out = [...lines.slice(0, m.start - 1), t, ...lines.slice(m.end)].join("\n");
      fixes.push({ name: X, to, fn: m.name, count: uses.length, why: byAlias.includes(to) ? "alias" : "casi igual" });
      lines.splice(0, lines.length, ...out.split("\n")); // renombrar no cambia la cantidad de líneas: los rangos siguen sirviendo
    }
  }
  return { code: out, fixes };
}
