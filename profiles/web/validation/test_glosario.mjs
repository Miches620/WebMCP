// test_glosario.mjs — el glosario de la app (17/10, diseño de 3 capas): el juez conoce tipos, la app pone los nombres.
//   node profiles/web/validation/test_glosario.mjs
import { readFileSync } from "node:fs";
import { GLOSARIO_VERSION, leerGlosario, palabra, tipoDe, tiene, filaATipos, itemClassRe } from "./glosario.mjs";
import { plantillasPara, systemPromptPlantillas, eleccionATipos, rowsFromChoices } from "./planilla_plantillas.mjs";
import { validateRow, systemPrompt } from "./planilla_writer.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const K = { item: "tarjeta", grupo: "columna" };
const REC = { item: "receta", grupo: "categoría" };
const HOJA = { item: "fila", grupo: null };

t("versión", GLOSARIO_VERSION.startsWith("glosario v0.3"));
t("un glosario se revisa: tipos que no existen y nombres que no son palabras → problemas", leerGlosario(K).ok && !leerGlosario({ tarjeta: "item" }).ok && !leerGlosario({ item: "<div>" }).ok && leerGlosario(HOJA).ok);
t("sin glosario → palabras genéricas (elemento, grupo)", palabra(null, "item") === "elemento" && palabra(null, "grupo") === "grupo");
t("tipoDe: el nombre de la app, su plural y sin tildes", tipoDe(K, "Columnas") === "grupo" && tipoDe(K, "tarjeta") === "item" && tipoDe(REC, "categoria") === "grupo" && tipoDe(K, "receta") === null);
t("null = la app no tiene ese tipo", !tiene(HOJA, "grupo") && tiene(HOJA, "item") && tiene(HOJA, "control"));

// las filas pueden venir con los nombres de la app; el juez las lee con tipos
const fila = { r: "R10", veo: [{ estilo: { de: { columna: "Pendiente" }, prop: "width", valor: "248px" } }] };
t("filaATipos: { columna: X } → { grupo: X } (sin tocar la original)", filaATipos(fila, K).veo[0].estilo.de.grupo === "Pendiente" && fila.veo[0].estilo.de.columna === "Pendiente");
t("el glosario es necesario: la misma fila SIN glosario no pasa el validador (columna no es un tipo)", validateRow(fila, 17, { glosario: K }).ok && !validateRow(fila, 17).ok);
t("los ítems se reconocen por clases genéricas (card, item…) más el nombre de la app", itemClassRe(K).test("tarjeta") && itemClassRe(REC).test("receta") && itemClassRe(REC).test("card") && !itemClassRe(REC).test("tarjeta"));

// plantillas: solo las que tienen sentido, con los nombres de la app
const sinGrupo = Object.keys(plantillasPara(HOJA));
t("una app sin grupos no recibe mover, contador ni orden", !["mover", "contador_al_crear", "orden_por_campo"].some((k) => sinGrupo.includes(k)) && sinGrupo.includes("crear") && sinGrupo.length === 13);
const spR = systemPromptPlantillas(REC), spH = systemPromptPlantillas(HOJA);
t("el pedido de recetas habla de recetas y categorías, nunca de tarjetas ni columnas", /crear una receta \(y aparece en una categoría\)/.test(spR) && /"categoría" \(opcional/.test(spR) && !/tarjeta|columna/i.test(spR));
t("el pedido de una app sin grupos no menciona grupos", !/grupo|categor|columna/i.test(spH.split("Reglas")[0]), spH.split("Reglas")[0].match(/.{30}(grupo|columna).{30}/i)?.[0]);
t("el pedido libre también usa los nombres de la app", /\{ "categoría": "nombre" \}/.test(systemPrompt(REC)) && !/tarjeta|columna/i.test(systemPrompt(REC)));
t("lo que contesta Qwen con nombres de la app → tipos; los casilleros propios (campo) no se traducen", eleccionATipos({ plantilla: "borrar", "categoría": "Postres" }, REC).grupo === "Postres" && eleccionATipos({ plantilla: "color_segun_valor", campo: "x" }, { item: "campo" }).campo === "x" && eleccionATipos({ plantilla: "estilo", de: "receta" }, REC).de === "item");
const rr = rowsFromChoices([{ plantilla: "mover", a: "Postres", desde: "Entradas" }, { plantilla: "estilo", de: "receta", prop: "width", valor: "300px" }], "R1", REC);
t("con el glosario de recetas, las plantillas arman filas con tipos", rr.filas.length === 2 && rr.filas[0].veo[0].en === "Postres" && rr.filas[1].veo[0].estilo.de.item === "QA Alfa" && !rr.problems.length, JSON.stringify(rr));

// v0.2: "inicio" (dónde aparece lo que se crea): el error que más se repitió en el banco de 5 modelos (20/10)
const KI = { ...K, inicio: "Pendiente" };
const ri = rowsFromChoices([{ plantilla: "contador_al_crear", columna: "En Curso" }, { plantilla: "contador_al_crear", columna: "Pendiente" }, { plantilla: "mover", a: "Pendiente", desde: "En Curso" }, { plantilla: "orden_por_campo", campo: "prioridad", valores: ["alta", "baja"], columna: "Completa" }], "R8", KI);
t("inicio: crear y mirar el contador de En Curso, mover A Pendiente u ordenar en Completa (donde no se crea nada) → afuera, diciendo dónde aparece lo nuevo", ri.filas.length === 1 && ri.filas[0].veo[0].contador === "Pendiente" && ri.problems.length === 3 && ri.problems.every((x) => /aparece (en )?"?Pendiente|ya aparece lo que se crea/.test(x)) && leerGlosario(KI).ok && leerGlosario(KI).glosario.inicio === "Pendiente", JSON.stringify(ri.problems));

// GUARDIÁN: el código del juez y de las plantillas no nombra cosas de ninguna app (solo los comentarios cuentan la historia)
// 29/10: "columna" junto con "fila", "encabezado", "lugar" o "seleccion" en la misma línea es la grilla (lugares: A1, la columna C, la fila 3), no el Kanban
const code = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/).map((l) => l.replace(/(^|\s)\/\/.*$/, "")).join("\n"); // 11/11: \r?\n — con saltos de Windows (CRLF) el ".*$" no llegaba al final y los comentarios contaban como código
const leaks = ["glosario.mjs", "planilla.mjs", "planilla_plantillas.mjs", "planilla_writer.mjs", "planilla_palabras.mjs"].flatMap((f) => code(f).split("\n").map((l, i) => [f, i + 1, l]).filter(([, , l]) => /tarjeta|kanban/i.test(l) || (/columna/i.test(l) && !/fila|encabezad|lugar|seleccion|L\.col/i.test(l))).map(([f, n, l]) => `${f}:${n}: ${l.trim().slice(0, 80)}`));
t("GUARDIÁN: ni el juez, ni las plantillas, ni el writer dicen 'tarjeta', 'columna' o 'Kanban' en el código", !leaks.length, "\n    " + leaks.join("\n    "));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
