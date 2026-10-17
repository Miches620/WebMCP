// test_searcher.mjs — el Searcher sin red ni modelo: buscar, bajar, citas verificadas, agrupar, preguntas.
//   node searcher/test_searcher.mjs
import { readFileSync } from "node:fs";
import { runSearcher, htmlToText, quoteInSource, pickSources, questionsFrom, groupTraits, sameTrait, alreadyAsked, outOfStack, SEARCHER_VERSION, TRAITS_SYSTEM, MAX_PREGUNTAS } from "./searcher.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

t("versión", SEARCHER_VERSION === "searcher v0.2");
t("HTML → texto: sin scripts, estilos ni menú; entidades", htmlToText('<nav>Menú</nav><script>x()</script><p>Arrastrá &amp; soltá</p><style>.a{}</style>') === "Arrastrá & soltá");
t("cita: tolera tildes, mayúsculas y espacios; corta (<12) no vale; inventada no está", quoteInSource("Podés ARRASTRAR las tarjetas  entre columnas", "...podes arrastrar las tarjetas entre columnas y...") && !quoteInSource("arrastrar", "arrastrar") && !quoteInSource("guarda todo en la nube automáticamente", "arrastrá tarjetas"));
const ps = pickSources([{ results: [{ url: "https://a.com/1", title: "A1" }, { url: "https://a.com/2" }, { url: "https://a.com/3" }, { url: "https://www.youtube.com/watch" }] }, { results: [{ url: "https://b.com/1#x" }, { url: "https://a.com/1" }] }], 6);
t("fuentes: intercala consultas, sin repetir URL, máx. 2 por dominio, sin videos/redes", ps.map((s) => s.url).join() === "https://a.com/1,https://b.com/1,https://a.com/2", ps.map((s) => s.url).join());
const qs = questionsFrom([{ rasgo: "arrastrar tarjetas entre columnas", fuentes: ["S1", "S2"], ya_pedido: false }, { rasgo: "crear tarjetas", fuentes: ["S1"], ya_pedido: true }], 3);
t("preguntas: solo lo que la idea NO pide, cerradas (sin depender del infinitivo) y con cuántas fuentes", qs.length === 1 && qs[0].pregunta === "¿Querés que tu app tenga esto?: arrastrar tarjetas entre columnas" && /2 de 3 fuentes \(S1, S2\)/.test(qs[0].porque), JSON.stringify(qs));
t("el pedido de rasgos excluye beneficios y usos ('generar en minutos', 'stakeholders')", /NO un beneficio ni un uso/.test(TRAITS_SYSTEM));
t("mismo rasgo: mismo verbo y casi las mismas palabras (con sinónimos tarea/tarjeta, arrastrar/soltar)", sameTrait("arrastrar tarjetas entre columnas", "arrastrar y soltar tareas") && sameTrait("compartir el tablero", "compartir el tablero con todo tu equipo") && !sameTrait("crear tareas en la columna de la izquierda", "arrastrar tarjetas entre columnas") && !sameTrait("compatibilidad con equipos grandes", "compartir el tablero"));
t("ya lo pide: solo si TODAS las palabras del rasgo están en la idea (ante la duda, se pregunta)", alreadyAsked("crear tarjetas", "Un Kanban para crear tarjetas") && !alreadyAsked("arrastrar tarjetas entre columnas", "Un tablero Kanban para organizar mis tareas"));
t("fuera del stack sin servidor: compartir / equipo / integración; 'métricas integradas' no", !!outOfStack({ rasgo: "compartir el tablero", de: [] }, [], false) && !outOfStack({ rasgo: "controlar el trabajo con métricas integradas", de: [] }, [], false) && !outOfStack({ rasgo: "compartir el tablero", de: [] }, [], true));
t("el pedido de rasgos exige cita copiada y prohíbe precios/empresas", /COPIADO tal cual/.test(TRAITS_SYSTEM) && /precios/.test(TRAITS_SYSTEM));

// ---------- corrida entera, con todo de mentira ----------
const PAGES = {
  "https://a.com/1": "<html><body><h1>Trello</h1><p>Podés arrastrar las tarjetas entre columnas para cambiar su estado.</p><p>Cada tarjeta puede tener etiquetas de colores y una fecha de vencimiento.</p>" + "<p>texto de relleno para que la página tenga contenido suficiente. </p>".repeat(8) + "</body></html>",
  "https://b.com/1": "<html><body><p>Un tablero kanban te deja crear tarjetas y moverlas entre columnas arrastrándolas con el mouse.</p><p>Los datos se guardan en el navegador y siguen ahí al recargar la página.</p>" + "<p>más texto de relleno para la prueba del searcher. </p>".repeat(8) + "</body></html>",
  "https://c.com/1": null, // no baja
};
const search = async (q) => ({ results: [{ url: "https://a.com/1", title: "Trello" }, { url: "https://b.com/1", title: "Kanban" }, { url: "https://c.com/1", title: "Caído" }] });
const fetchPage = async (u) => { if (!PAGES[u]) throw new Error("timeout"); return PAGES[u]; };
const call = async (messages) => {
  const sys = messages[0].content, user = messages[1].content;
  if (/búsquedas web/.test(sys)) return { content: `{"consultas":["app kanban funcionalidades","kanban board features","tablero de tareas web"]}` };
  if (/UNA página/.test(sys) && /Página S1/.test(user)) return { content: `{"rasgos":[{"rasgo":"arrastrar tarjetas entre columnas","cita":"Podés arrastrar las tarjetas entre columnas"},{"rasgo":"poner etiquetas de colores","cita":"puede tener etiquetas de colores"},{"rasgo":"sincronizar con la nube","cita":"se sincroniza automáticamente con la nube"}]}` };
  if (/UNA página/.test(sys) && /Página S2/.test(user)) return { content: `{"rasgos":[{"rasgo":"crear tarjetas","cita":"te deja crear tarjetas y moverlas"},{"rasgo":"mover tarjetas arrastrándolas","cita":"moverlas entre columnas arrastrándolas con el mouse"},{"rasgo":"guardar los datos al recargar","cita":"siguen ahí al recargar la página"}]}` };
  if (/Agrupás/.test(sys)) return { content: `{"grupos":[{"rasgo":"arrastrar tarjetas entre columnas","de":["T1","T4"],"ya_pedido":false},{"rasgo":"crear tarjetas","de":["T3"],"ya_pedido":true},{"rasgo":"inventado sin T","de":["T99"]}]}` };
  return { content: "{}" };
};
const ev = await runSearcher({ idea: "Un Kanban para crear tarjetas", call, search, fetchPage });
t("consultas de Qwen (3)", ev.consultas.length === 3);
t("fuentes: 2 bajadas, la que no baja queda descartada con el motivo", ev.fuentes.length === 2 && ev.descartados.some((d) => /c\.com/.test(d.fuente) && /no se pudo bajar/.test(d.motivo)));
t("cada fuente con su huella (sha) para poder repetir", ev.fuentes.every((s) => /^[0-9a-f]{12}$/.test(s.sha)));
t("la cita inventada ('sincroniza con la nube') NO entra: sin fuente no hay rasgo", !ev.rasgos.some((r) => /nube/.test(r.rasgo)) && ev.descartados.some((d) => /nube/.test(d.rasgo || "") && /cita no está/.test(d.motivo)), JSON.stringify(ev.descartados));
t("5 rasgos con cita verificada", ev.rasgos.length === 5, ev.rasgos.map((r) => r.rasgo).join(" | "));
t("agrupar SIN modelo: 'arrastrar' junta 2 fuentes; lo demás no se pierde; Qwen no se llama para agrupar", ev.grupos[0].fuentes.join() === "S1,S2" && /arrastr|mover/.test(ev.grupos[0].rasgo) && ev.grupos.some((g) => /etiquetas/.test(g.rasgo)) && ev.grupos.some((g) => /recargar/.test(g.rasgo)) && !ev.llamadas.some((l) => l.paso === "agrupar"), JSON.stringify(ev.grupos));
t("preguntas: no pregunta 'crear tarjetas' (la idea ya lo pide); arrastrar primero, con 2 de 2 fuentes", ev.preguntas.length === 3 && !ev.preguntas.some((q) => /crear tarjetas/.test(q.rasgo)) && /2 de 2 fuentes/.test(ev.preguntas[0].porque), JSON.stringify(ev.preguntas));
// ---------- la 1ª corrida REAL (17/10, "Un tablero Kanban para organizar mis tareas"): 26 rasgos de 6 fuentes ----------
const REAL = JSON.parse(readFileSync(new URL("./fixtures/searcher_kanban_2026-10-17.json", import.meta.url), "utf8"));
const RG = groupTraits(REAL.rasgos).map((g) => ({ ...g, ya_pedido: alreadyAsked(g.rasgo, REAL.idea), fuera_del_stack: outOfStack(g, REAL.rasgos, false) }));
const RQ = questionsFrom(RG, REAL.fuentes.length);
t("real: v0.1 hacía 25 preguntas de 1 fuente cada una; v0.2 agrupa (22 grupos) y pregunta como mucho 8", RQ.length === MAX_PREGUNTAS && RG.length < REAL.rasgos.length, `${RG.length} grupos, ${RQ.length} preguntas`);
t("real: 'arrastrar' ya NO figura como pedido (la idea no lo dice) y es la 1ª pregunta, con 2 fuentes", /arrastrar/.test(RQ[0].rasgo) && /2 de 6 fuentes/.test(RQ[0].porque), RQ[0] && RQ[0].pregunta);
t("real: compartir / integración / stakeholders quedan fuera del stack (no se preguntan)", RG.filter((g) => g.fuera_del_stack).length >= 4 && !RQ.some((q) => /compart|integraci|stakeholder/i.test(q.rasgo)));
t("real: 'crear tareas en la columna' NO se junta con 'arrastrar' (distinto verbo)", !RG.find((g) => /arrastrar/.test(g.rasgo)).de.some((id) => /crear tareas/.test(REAL.rasgos.find((x) => x.id === id).rasgo)));
const nada = await runSearcher({ idea: "x", call: async () => { throw new Error("LM caído"); }, search: async () => { throw new Error("SearXNG 403"); }, fetchPage });
t("sin Qwen ni SearXNG: busca con la idea tal cual, no inventa nada y deja los errores", nada.consultas.join() === "x" && !nada.preguntas.length && nada.llamadas.some((l) => /SearXNG 403/.test(l.error || "")));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
