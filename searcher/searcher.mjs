// searcher/searcher.mjs — Searcher v0 (el INVESTIGADOR de la Fundación), delante de Intent Forge. 16/10 noche.
//
//   node searcher/searcher.mjs "<idea de Miche>" [--tipo web/app] [--standard web/app/estado] [--max 6]
//
// Qué hace (reglas de claude/propuesta_searcher_2026-10-16.md):
//   1. Qwen propone 3 búsquedas cortas para la idea (si no responde, se busca con la idea tal cual).
//   2. El HARNESS busca en SearXNG local y baja las páginas (el modelo no navega).
//   3. Qwen lee cada fuente por separado y anota los RASGOS que describe, cada uno con una CITA textual.
//      El harness verifica que la cita esté en la fuente: lo que no está, no entra (sin fuente no hay rasgo).
//   4. Qwen agrupa los rasgos repetidos y marca los que la idea ya pide.
//   5. Cada rasgo que la idea NO pide → una PREGUNTA CERRADA para Miche ("¿querés …? Lo tienen 3 de 5 fuentes").
// El informe NO agrega requisitos: solo preguntas. Lo que Miche acepta pasa a ser un requisito más, y sus filas de
// planilla las escribe planilla_writer (Qwen), como las de cualquier requisito. Todo queda como evidencia
// (consultas, fuentes con su huella, citas, fecha) en evidence/searcher/: la web cambia y el run tiene que poder repetirse.

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseJsonLoose } from "../json_loose.mjs";
import { SEARXNG_URL } from "./check_searxng.mjs";

export const SEARCHER_VERSION = "searcher v0.2";
const LM_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1/chat/completions";
const MODEL = process.env.SEARCHER_MODEL || process.env.REVIEWER_MODEL || "qwen2.5-7b-instruct";
const SOURCE_CHARS = 6000; // por fuente: entra holgado en 16k con el pedido
const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// ---------- piezas puras (las usan los tests) ----------
/** HTML → texto legible (sin scripts, estilos, menús ni pies). */
export function htmlToText(html) {
  return String(html || "")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
/** ¿La cita está en la fuente? (normalizada: sin tildes, mayúsculas ni espacios de más; ≥ 12 caracteres) */
export function quoteInSource(quote, text) {
  const q = nrm(quote).replace(/^["'“”«»]+|["'“”«».…]+$/g, "");
  return q.length >= 12 && nrm(text).includes(q);
}
/** Resultados de SearXNG de varias consultas → fuentes únicas (por URL, sin repetir dominio más de 2 veces). */
export function pickSources(resultsByQuery, max = 6) {
  const out = [], seen = new Set(), perHost = {};
  const lists = resultsByQuery.map((r) => (r?.results || []).filter((x) => /^https?:\/\//.test(x.url || "")));
  for (let k = 0; out.length < max && lists.some((l) => l.length > k); k++) for (const l of lists) {
    const x = l[k];
    if (!x || out.length >= max) continue;
    const url = x.url.split("#")[0];
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (seen.has(url) || (perHost[host] || 0) >= 2 || /youtube\.com|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com/.test(host)) continue;
    seen.add(url); perHost[host] = (perHost[host] || 0) + 1;
    out.push({ id: `S${out.length + 1}`, url, title: String(x.title || "").slice(0, 120), snippet: String(x.content || "").slice(0, 300) });
  }
  return out;
}
/** Rasgos agrupados → preguntas cerradas (solo los que la idea NO pide, dentro del stack, con ≥ 1 fuente; las de más fuentes primero; hasta max). */
export const MAX_PREGUNTAS = 8;
export function questionsFrom(grupos, nSources, max = MAX_PREGUNTAS) {
  return grupos.filter((g) => !g.ya_pedido && !g.fuera_del_stack && g.fuentes.length).slice(0, max).map((g, i) => ({
    id: `Q${i + 1}`,
    // v0.2: Qwen no siempre escribe el rasgo en infinitivo ("etiquetas de tarjeta"): la pregunta no depende de eso
    pregunta: `¿Querés que tu app tenga esto?: ${g.rasgo.replace(/[.?¿]+$/, "")}`,
    porque: `lo tienen ${g.fuentes.length} de ${nSources} fuentes (${g.fuentes.join(", ")})`,
    rasgo: g.rasgo,
    fuentes: g.fuentes,
  }));
}

// ---------- v0.2: agrupar y "ya lo pide" SIN modelo ----------
// 1ª corrida real (17/10): el agrupado de Qwen devolvió 2 grupos de 26 rasgos y marcó "arrastrar tarjetas" como ya
// pedido (la idea no lo decía): escondió la pregunta más útil. Ahora es por palabras, con sinónimos del dominio de apps.
const STOP = new Set("para por con sin una uno unos unas los las del que mas muy todo toda todos todas tus sus mis este esta estos estas como entre sobre desde hasta cada otro otra otros otras puede pueden poder hacer usar tener ver".split(" "));
const SYN = [
  [/^(tarea|tarje|nota|item|eleme|ficha|card)/, "ITEM"], [/^(arras|solta|mover|muev|drag)/, "MOVER"], [/^(crear|crea|agreg|añadi|anadi|nuev|sumar)/, "CREAR"],
  [/^(table|board)/, "TABLERO"], [/^(colum|lista|carri)/, "COLUMNA"], [/^(borra|elimi|quita)/, "BORRAR"], [/^(edita|modif)/, "EDITAR"],
  [/^(etiqu|label|categ)/, "ETIQUETA"], [/^(color)/, "COLOR"], [/^(compart)/, "COMPARTIR"], [/^(perso|confi|ajust)/, "PERSONALIZAR"], [/^(guard|persi|recar)/, "GUARDAR"],
];
export function stems(text) { return new Set(stemList(text)); }
function stemList(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-zñ]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => { const s = SYN.find(([re]) => re.test(w)); return s ? s[1] : w.slice(0, 5); });
}
/** Mismo rasgo con otras palabras: MISMO verbo (la 1ª raíz) y ≥ 2/3 de las raíces del más corto en común. */
export function sameTrait(a, b) {
  const la = stemList(a), lb = stemList(b);
  if (!la.length || !lb.length || la[0] !== lb[0]) return false;
  const A = new Set(la), B = new Set(lb);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.min(A.size, B.size) >= 2 / 3;
}
/** Rasgos → grupos: cada rasgo va al primer grupo cuyo PRIMER rasgo dice lo mismo (sin encadenar parecidos). */
export function groupTraits(rasgos) {
  const groups = [];
  for (const t of rasgos) {
    const g = groups.find((x) => sameTrait(x.items[0].rasgo, t.rasgo));
    if (g) g.items.push(t); else groups.push({ items: [t] });
  }
  return groups.map(({ items: ts }) => ({ rasgo: ts.slice().sort((x, y) => x.rasgo.length - y.rasgo.length)[0].rasgo, de: ts.map((t) => t.id), fuentes: [...new Set(ts.map((t) => t.fuente))] }))
    .sort((a, b) => b.fuentes.length - a.fuentes.length || b.de.length - a.de.length);
}
/** ¿La idea ya lo pide? Todas las raíces del rasgo están en la idea (conservador: ante la duda, se pregunta). */
export function alreadyAsked(rasgo, idea) { const R = stems(rasgo), I = stems(idea); return R.size > 0 && [...R].every((x) => I.has(x)); }
/** Lo que el stack del Standard no permite (sin servidor: cuentas, equipo, sincronizar, integraciones, IA). */
// Solo el texto de los RASGOS del grupo, no las citas (1ª corrida: la cita de "arrastrar" decía "comparte el tablero
// con tu equipo" y lo sacaba del stack).
const NEEDS_SERVER = /compart|equipo|colabor|integraci[oó]n|integrar con|sincroniz|usuarios?\b|cuentas?\b|notific|\bnube\b|tiempo real|stakeholder|\bia\b|\bai\b|inteligencia artificial|generad|en minutos/i;
export function outOfStack(g, rasgos, servidor = false) {
  if (servidor) return null;
  const txt = [g.rasgo, ...g.de.map((id) => rasgos.find((t) => t.id === id)?.rasgo || "")].join(" ");
  const m = txt.match(NEEDS_SERVER);
  return m ? `necesita servidor o cuentas ("${m[0]}"), y el Standard es sin servidor` : null;
}

// ---------- pedidos a Qwen ----------
export const QUERIES_SYSTEM = `Proponés búsquedas web cortas para encontrar apps PARECIDAS a la idea del usuario y ver qué funcionalidades suelen tener. Respondé SOLO JSON: { "consultas": ["…", "…", "…"] }. Tres consultas, de 3 a 7 palabras, al menos una en inglés. Sin comillas ni operadores.`;
export const TRAITS_SYSTEM = `Leés UNA página web sobre apps parecidas a la idea del usuario y anotás las FUNCIONALIDADES que la página describe (lo que una persona puede hacer o ver en la app). Respondé SOLO JSON: { "rasgos": [ { "rasgo": "frase corta en castellano, empezando con un verbo en infinitivo (p. ej. 'arrastrar tarjetas entre columnas')", "cita": "texto COPIADO tal cual de la página que lo dice (de 5 a 25 palabras)" } ] }.
Reglas: solo lo que la página DICE (la cita se verifica contra la página: si no está, se descarta); un rasgo es algo que una persona HACE en la app o VE en la pantalla (mover, etiquetar, filtrar, ver un contador…), NO un beneficio ni un uso ("mejorar la productividad", "adaptarse a proyectos", "generar en minutos", "gestionar stakeholders"); nada de precios, planes, empresas ni opiniones; como mucho 8 rasgos; si la página no describe funcionalidades, { "rasgos": [] }.`;
// (v0.1 tenía MERGE_SYSTEM: Qwen agrupaba; en la 1ª corrida real falló — ver arriba)
export const MERGE_SYSTEM_V01 = `Agrupás rasgos de varias fuentes que dicen LO MISMO con otras palabras, y marcás los que la idea del usuario YA pide. Respondé SOLO JSON: { "grupos": [ { "rasgo": "frase corta en infinitivo", "de": ["T1", "T4"], "ya_pedido": false } ] }. Cada T va en un solo grupo. No inventes rasgos: solo agrupás los que te paso.`;

const callLM = async (messages, max_tokens = 1500) => {
  const r = await fetch(LM_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages, temperature: 0, max_tokens }) });
  if (!r.ok) throw new Error(`LM Studio ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return { content: j.choices?.[0]?.message?.content || "", usage: j.usage };
};
const searx = async (q) => {
  const r = await fetch(`${SEARXNG_URL}/search?q=${encodeURIComponent(q)}&format=json`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`SearXNG ${r.status}${r.status === 403 ? " (falta '- json' en formats: npm run searxng)" : ""}`);
  return r.json();
};
const download = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Mozilla/5.0 (webmcp searcher)", Accept: "text/html" } });
  if (!r.ok) throw new Error(`${r.status}`);
  if (!/html|text/.test(r.headers.get("content-type") || "")) throw new Error(`no es una página (${r.headers.get("content-type")})`);
  return (await r.text()).slice(0, 400000);
};
const json = (res) => { const j = parseJsonLoose(res?.content); return j.ok ? j.data : null; };

/** El Searcher entero. Todo lo de afuera se inyecta (tests): call (Qwen), search (SearXNG), fetchPage. */
export async function runSearcher({ idea, tipo = "web/app", max = 6, stack = null, call = callLM, search = searx, fetchPage = download, log = () => {} }) {
  const ev = { version: SEARCHER_VERSION, model: MODEL, searxng: SEARXNG_URL, fecha: new Date().toISOString(), idea, tipo, stack: stack?.nombre || null, consultas: [], fuentes: [], rasgos: [], descartados: [], grupos: [], preguntas: [], otros: [], llamadas: [] };
  // 1. consultas
  let qs = null;
  try { const r = await call([{ role: "system", content: QUERIES_SYSTEM }, { role: "user", content: `Tipo: ${tipo}\nIdea: ${idea}` }], 300); ev.llamadas.push({ paso: "consultas", raw: r.content }); qs = json(r)?.consultas; } catch (e) { ev.llamadas.push({ paso: "consultas", error: e.message }); }
  ev.consultas = (Array.isArray(qs) ? qs : []).map(String).map((x) => x.trim()).filter((x) => x.length >= 3).slice(0, 3);
  if (!ev.consultas.length) ev.consultas = [String(idea).slice(0, 80)];
  log(`consultas: ${ev.consultas.join(" | ")}`);
  // 2. buscar y bajar (el harness)
  const results = [];
  for (const q of ev.consultas) { try { results.push(await search(q)); } catch (e) { ev.llamadas.push({ paso: "buscar", consulta: q, error: e.message }); results.push({ results: [] }); } }
  const picked = pickSources(results, max);
  for (const s of picked) {
    try {
      const text = htmlToText(await fetchPage(s.url)).slice(0, SOURCE_CHARS);
      if (text.length < 300) throw new Error("casi sin texto");
      ev.fuentes.push({ ...s, chars: text.length, sha: createHash("sha1").update(text).digest("hex").slice(0, 12), text });
    } catch (e) { ev.descartados.push({ fuente: s.url, motivo: `no se pudo bajar: ${e.message}` }); }
  }
  log(`fuentes: ${ev.fuentes.length} de ${picked.length} (${ev.descartados.length} no se pudieron bajar)`);
  if (!ev.fuentes.length) return ev;
  // 3. rasgos por fuente, con cita verificada
  for (const s of ev.fuentes) {
    let data = null;
    try { const r = await call([{ role: "system", content: TRAITS_SYSTEM }, { role: "user", content: `Idea del usuario: ${idea}\n\nPágina ${s.id} (${s.title}):\n${s.text}` }]); ev.llamadas.push({ paso: "rasgos", fuente: s.id, raw: r.content, usage: r.usage }); data = json(r); } catch (e) { ev.llamadas.push({ paso: "rasgos", fuente: s.id, error: e.message }); }
    for (const t of (data?.rasgos || []).slice(0, 8)) {
      if (!t || typeof t.rasgo !== "string" || !t.rasgo.trim()) continue;
      if (!quoteInSource(t.cita, s.text)) { ev.descartados.push({ fuente: s.id, rasgo: t.rasgo, motivo: "la cita no está en la página" }); continue; }
      ev.rasgos.push({ id: `T${ev.rasgos.length + 1}`, fuente: s.id, rasgo: t.rasgo.trim().slice(0, 140), cita: String(t.cita).trim().slice(0, 300) });
    }
  }
  log(`rasgos con cita verificada: ${ev.rasgos.length} (${ev.descartados.filter((d) => d.rasgo).length} descartados por cita)`);
  if (!ev.rasgos.length) return ev;
  // 4. agrupar, "ya lo pide" y fuera del stack — sin modelo (v0.2)
  const servidor = !!stack?.servidor;
  ev.grupos = groupTraits(ev.rasgos).map((g) => {
    const fuera = outOfStack(g, ev.rasgos, servidor);
    return { ...g, ya_pedido: alreadyAsked(g.rasgo, idea), ...(fuera ? { fuera_del_stack: fuera } : {}) };
  });
  // 5. preguntas cerradas
  ev.preguntas = questionsFrom(ev.grupos, ev.fuentes.length);
  const libres = ev.grupos.filter((g) => !g.ya_pedido && !g.fuera_del_stack).length;
  ev.otros = ev.grupos.filter((g) => !g.ya_pedido && !g.fuera_del_stack).slice(MAX_PREGUNTAS).map((g) => g.rasgo);
  log(`grupos: ${ev.grupos.length} de ${ev.rasgos.length} rasgos · preguntas: ${ev.preguntas.length}${ev.otros.length ? ` (y ${ev.otros.length} más, con menos fuentes)` : ""} · ya lo pide: ${ev.grupos.filter((g) => g.ya_pedido).length} · fuera del stack: ${ev.grupos.filter((g) => g.fuera_del_stack).length}`);
  return ev;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const idea = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))).join(" ");
  if (!idea) { console.log('uso: node searcher/searcher.mjs "<idea>" [--tipo web/app] [--max 6]'); process.exit(2); }
  const t0 = Date.now();
  const { standardsFor, standardMeta } = await import("../standards/catalog.mjs");
  const tipo = flag("--tipo") || "web/app";
  const std = flag("--standard") ? standardMeta(flag("--standard")) : standardsFor(tipo)[0] || null;
  const ev = await runSearcher({ idea, tipo, stack: std?.stack || null, max: Number(flag("--max")) || 6, log: (m) => console.log(`[SEARCHER] ${m}`) });
  const dir = join(dirname(fileURLToPath(import.meta.url)), "../evidence/searcher");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `searcher_${ev.fecha.replace(/[:.]/g, "-").slice(0, 19)}.json`);
  writeFileSync(file, JSON.stringify({ type: "EVIDENCE", kind: "searcher", ms: Date.now() - t0, ...ev }, null, 2));
  console.log(`\n=== Preguntas para Miche (${ev.preguntas.length}) ===`);
  ev.preguntas.forEach((q) => console.log(`${q.id}. ${q.pregunta}  — ${q.porque}`));
  if (ev.otros.length) console.log(`\nOtros (menos fuentes, no se preguntan): ${ev.otros.join(" · ")}`);
  const ya = ev.grupos.filter((g) => g.ya_pedido);
  if (ya.length) console.log(`\nYa lo pedís: ${ya.map((g) => g.rasgo).join(" · ")}`);
  const fuera = ev.grupos.filter((g) => g.fuera_del_stack);
  if (fuera.length) console.log(`\nFuera del stack (${ev.stack || "sin Standard"}): ${fuera.map((g) => g.rasgo).join(" · ")}`);
  console.log(`\nFuentes: ${ev.fuentes.map((s) => `${s.id} ${s.url}`).join("\n        ")}`);
  console.log(`\n→ ${file}  (${Math.round((Date.now() - t0) / 1000)} s)`);
}
