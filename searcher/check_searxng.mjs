// searcher/check_searxng.mjs — ¿SearXNG está listo para el Searcher? (16/10 noche)
//
//   node searcher/check_searxng.mjs            (o: npm run searxng)
//   SEARXNG_URL=http://127.0.0.1:8888 por defecto
//
// El Searcher (en construcción) le va a pedir resultados en JSON a un SearXNG local. Esto prueba UNA búsqueda y dice,
// con palabras, qué falta si no anda. No instala nada.

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const SEARXNG_URL = (process.env.SEARXNG_URL || "http://127.0.0.1:8888").replace(/\/+$/, "");
export const CHECK_VERSION = "check_searxng v0.1";

/** De la respuesta (o del error de red) → { ok, motivo }. Función pura: la usan los tests. */
export function diagnose({ error = null, status = null, body = "" } = {}) {
  if (error) return { ok: false, motivo: `SearXNG no responde en ${SEARXNG_URL} (${error}). ¿Está corriendo el contenedor? Probá: docker start searxng` };
  if (status === 403) return { ok: false, motivo: "SearXNG responde pero no deja pedir JSON (403). En settings.yml, dentro de search: → formats:, agregá la línea '- json' y reiniciá: docker restart searxng" };
  if (status === 429) return { ok: false, motivo: "SearXNG frenó el pedido por el limitador (429). En settings.yml, en server:, poné limiter: false (es solo para tu máquina) y reiniciá: docker restart searxng" };
  if (status !== 200) return { ok: false, motivo: `SearXNG respondió ${status}: ${String(body).slice(0, 120)}` };
  let j;
  try { j = JSON.parse(body); } catch { return { ok: false, motivo: "SearXNG respondió, pero no en JSON. Revisá que formats tenga '- json' y que la dirección sea la de SearXNG" }; }
  const n = Array.isArray(j.results) ? j.results.length : -1;
  if (n < 0) return { ok: false, motivo: "La respuesta JSON no trae 'results'" };
  if (n === 0) return { ok: true, n, motivo: `anda, pero la búsqueda de prueba no trajo resultados (¿hay internet? ¿motores bloqueados?): ${(j.unresponsive_engines || []).map((e) => e[0]).join(", ") || "sin datos"}` };
  return { ok: true, n, motivo: `anda: ${n} resultados (p. ej. "${String(j.results[0].title || "").slice(0, 60)}")` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const url = `${SEARXNG_URL}/search?q=${encodeURIComponent("tablero kanban javascript")}&format=json`;
  let d;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    d = diagnose({ status: r.status, body: await r.text() });
  } catch (e) { d = diagnose({ error: e.cause?.code || e.message }); }
  console.log(`[SEARXNG] ${CHECK_VERSION} · ${SEARXNG_URL} → ${d.ok ? "OK" : "FALTA"}: ${d.motivo}`);
  process.exit(d.ok ? 0 : 1);
}
