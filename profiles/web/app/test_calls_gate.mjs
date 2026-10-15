// test_calls_gate.mjs — compuerta de llamadas del Validation profile web/app (12/10, punto 7).
//   node profiles/web/app/test_calls_gate.mjs
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeCalls, validationGates } from "./calls_gate.mjs";
import { pageHtml } from "../specialist/files_kit.mjs";
import { getStandard } from "../../../standards/registry.mjs";
import { datosJs } from "../../../standards/web/app/estado/contract.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const S = getStandard("web/app/estado");

// ---------- 1. el juez (sin navegador) ----------
const ACT = [
  { nombre: "agregar", params: ["texto"], ids: [], campos: ["texto"], features: [1] },
  { nombre: "borrar", params: ["id"], ids: ["id"], campos: [], features: [2] },
  { nombre: "mover", params: ["id", "destino"], ids: ["id", "destino"], campos: [], features: [3, 4] },
];
const IDS = [1, 2, "a", "b"];
const P = (o) => ({ found: true, tracked: true, calls: {}, undrawn: {}, args: {}, via: {}, ...o });
const all = judgeCalls(P({ calls: { agregar: 1, borrar: 1, mover: 1 }, args: { agregar: [["__object__", "Prueba"]], borrar: [["__object__", 1]], mover: [["__object__", 2, "b"]] } }), ACT, IDS);
t("juez: todo bien → sin compuertas", Object.keys(all.gates).length === 0 && all.rows.every((r) => !r.problem), JSON.stringify(all));
const nc = judgeCalls(P({ calls: { agregar: 1, mover: 1 }, args: { agregar: [["__object__", "x"]], mover: [["__object__", 1, "a"]] } }), ACT, IDS);
t("juez: acción que nadie llama → FAIL en su requisito", nc.gates.R2?.result === "FAIL" && /ningún botón de la pantalla llama a App\.borrar/.test(nc.gates.R2.detail) && !nc.gates.R1, JSON.stringify(nc.gates));
const un = judgeCalls(P({ calls: { agregar: 1, borrar: 1, mover: 1 }, via: { borrar: "accion:borrar" }, args: { agregar: [["__object__", "x"]], borrar: [["__object__", "__undefined__"]], mover: [["__object__", 1, "a"]] } }), ACT, IDS);
t("juez: id undefined (Kanban 4ª corrida, labelId) → FAIL con el dato", /"data-accion=borrar" llama a App\.borrar con id = undefined/.test(un.gates.R2?.detail || ""), JSON.stringify(un.gates));
const nan = judgeCalls(P({ calls: { agregar: 1, borrar: 1, mover: 1 }, args: { agregar: [["__object__", "x"]], borrar: [["__object__", "__NaN__"]], mover: [["__object__", 1, "a"]] } }), ACT, IDS);
t("juez: id NaN (Number(undefined)) → FAIL", /id = NaN/.test(nan.gates.R2?.detail || ""));
const fake = judgeCalls(P({ calls: { agregar: 1, borrar: 1, mover: 1 }, args: { agregar: [["__object__", "x"]], borrar: [["__object__", "[object HTMLButtonElement]"]], mover: [["__object__", 1, "a"]] } }), ACT, IDS);
t("juez: id que no es ningún id del estado → FAIL", /no es ningún id del estado/.test(fake.gates.R2?.detail || ""));
const campoNum = judgeCalls(P({ calls: { agregar: 1, borrar: 1, mover: 1 }, args: { agregar: [["__object__", "__NaN__"]], borrar: [["__object__", 1]], mover: [["__object__", 1, "a"]] } }), ACT, IDS);
t("juez: campo numérico con NaN (la sonda escribe 'Prueba' en un input de texto) no es concluyente", !campoNum.gates.R1);
const vacio = judgeCalls(P({ calls: { agregar: 1, borrar: 1, mover: 1 }, args: { agregar: [["__object__", ""]], borrar: [["__object__", 1]], mover: [["__object__", 1, "a"]] } }), ACT, IDS);
t("juez: campo vacío ('') → FAIL (el campo no estaba al lado del botón)", /texto = ""/.test(vacio.gates.R1?.detail || ""));
const some = judgeCalls(P({ calls: { agregar: 1, borrar: 2, mover: 1 }, args: { agregar: [["__object__", "x"]], borrar: [["__object__", "__undefined__"], ["__object__", 2]], mover: [["__object__", 1, "a"]] } }), ACT, IDS);
t("juez: alcanza con UNA llamada con datos de verdad (p.ej. el botón 'Guardar' después del ícono)", !some.gates.R2);
const multi = judgeCalls(P({ calls: { agregar: 1, borrar: 1 }, args: { agregar: [["__object__", "x"]], borrar: [["__object__", 1]] } }), ACT, IDS);
t("juez: una acción con 2 features → FAIL en las dos", multi.gates.R3?.result === "FAIL" && multi.gates.R4?.result === "FAIL");
const nd = judgeCalls(P({ calls: { agregar: 1, borrar: 1, mover: 1 }, undrawn: { borrar: 1 }, args: { agregar: [["__object__", "x"]], borrar: [["__object__", 1]], mover: [["__object__", 1, "a"]] } }), ACT, IDS);
t("juez: después de la acción no se dibuja → FAIL", /no se llama a dibujar/.test(nd.gates.R2?.detail || ""));
t("juez: sin App en la página → FAIL en todas", Object.keys(judgeCalls(P({ found: false }), ACT, IDS).gates).sort().join() === "R1,R2,R3,R4");
t("Standard web/app/estado declara lo que Validation lee (contract, calls, actions, idValues)", ["contract", "calls", "actions", "idValues"].every((k) => typeof S.validation?.[k] === "function"));
t("Standard web/game/grilla no declara contrato de acciones → la compuerta no corre ahí", typeof getStandard("web/game/grilla").validation?.contract !== "function"
  && (await validationGates({ artifact: "x", outDir: ".", input: {}, specialist: { standard: { id: "web/game/grilla" } } })) === null);

// ---------- 2. en Chromium: una lista bien hecha y versiones rotas ----------
const CONTRATO = { estado: { items: [{ id: 1, texto: "Comprar pan", hecho: false }, { id: 2, texto: "Llamar a Ana", hecho: true }], siguiente: 3 },
  acciones: [
    { nombre: "agregarItem", params: ["texto"], ejemplo: ["Nuevo"], hace: "agrega", features: [1], cambia: ["items"] },
    { nombre: "borrarItem", params: ["id"], ejemplo: [1], hace: "saca", features: [2], cambia: ["items"] },
    { nombre: "marcarHecho", params: ["id"], ejemplo: [1], hace: "invierte hecho", features: [3], cambia: ["items"] },
  ], se_ve: [4] };
const REFINED = { features: ["Agregar", "Borrar", "Marcar hecho", "Ver la lista"], estilo: [] };
const LOGICA = `const App = {
  crear() { return JSON.parse(JSON.stringify(ESTADO_INICIAL)); },
  agregarItem(estado, texto) { const n = JSON.parse(JSON.stringify(estado)); n.items.push({ id: n.siguiente, texto, hecho: false }); n.siguiente++; return n; },
  borrarItem(estado, id) { return { ...estado, items: estado.items.filter((x) => x.id !== id) }; },
  marcarHecho(estado, id) { return { ...estado, items: estado.items.map((x) => x.id === id ? { ...x, hecho: !x.hecho } : x) }; }
};`;
const DIBUJO = (idAttr = true) => `function dibujar(estado) {
  const app = document.getElementById("app"); app.innerHTML = "";
  const n = document.createElement("div");
  const i = document.createElement("input"); i.dataset.campo = "texto"; n.appendChild(i);
  const a = document.createElement("button"); a.textContent = "Agregar"; a.dataset.accion = "agregarItem"; n.appendChild(a);
  app.appendChild(n);
  estado.items.forEach((it) => {
    const d = document.createElement("div"); d.textContent = it.texto + (it.hecho ? " ✓" : "");
    for (const [t, a] of [["Borrar", "borrarItem"], ["Hecho", "marcarHecho"]]) { const b = document.createElement("button"); b.textContent = t; b.dataset.accion = a; ${idAttr ? "b.dataset.id = it.id;" : 'if (a !== "borrarItem") b.dataset.id = it.id;'} d.appendChild(b); }
    app.appendChild(d);
  });
}`;
const CONTROLES = ({ borrar = true, marcarDibuja = true } = {}) => `let estado = App.crear();
document.getElementById("app").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-accion]"); if (!b) return;
  const id = Number(b.dataset.id);
  if (b.dataset.accion === "agregarItem") estado = App.agregarItem(estado, b.parentElement.querySelector('[data-campo="texto"]').value);
  ${borrar ? 'if (b.dataset.accion === "borrarItem") estado = App.borrarItem(estado, id);' : ""}
  if (b.dataset.accion === "marcarHecho") { estado = App.marcarHecho(estado, id); ${marcarDibuja ? "" : "return;"} }
  dibujar(estado);
});
dibujar(estado);`;
const root = mkdtempSync(join(tmpdir(), "calls-gate-"));
const app = (name, files) => {
  const d = join(root, name); mkdirSync(join(d, "js"), { recursive: true });
  const all = { "styles.css": "div{color:red}", "js/datos.js": datosJs(CONTRATO.estado), "js/logica.js": LOGICA, "js/dibujo.js": DIBUJO(), "js/controles.js": CONTROLES(), ...files };
  for (const [f, c] of Object.entries(all)) writeFileSync(join(d, f), c);
  writeFileSync(join(d, "index.html"), pageHtml({ title: "T", fragment: '<h1>Lista</h1><div id="app"></div>', scripts: ["js/datos.js", "js/logica.js", "js/dibujo.js", "js/controles.js"], mainId: "principal" }));
  writeFileSync(join(d, "contrato.json"), JSON.stringify(CONTRATO));
  return d;
};
const gate = (d, refined = REFINED) => validationGates({ artifact: join(d, "index.html"), outDir: d, input: { refined }, specialist: { standard: { id: "web/app/estado" } } });
const g0 = await gate(app("bien", {}));
t("Chromium: lista bien hecha → PASS, sin compuertas (no da FAIL falsos)", g0?.result === "PASS" && Object.keys(g0.gates).length === 0, JSON.stringify(g0));
const g1 = await gate(app("sin_id", { "js/dibujo.js": DIBUJO(false) }));
t("Chromium: 'Borrar' sin data-id → borrarItem(estado, NaN) → FAIL R2, solo R2", g1.gates.R2 && /borrarItem con id = NaN/.test(g1.gates.R2.detail) && Object.keys(g1.gates).join() === "R2", JSON.stringify(g1.gates));
const g2 = await gate(app("sin_borrar", { "js/controles.js": CONTROLES({ borrar: false }) }));
t("Chromium: borrar sin conectar → FAIL R2 (nadie lo llama)", /ningún botón de la pantalla llama a App\.borrarItem/.test(g2.gates.R2?.detail || ""), JSON.stringify(g2.gates));
const g3 = await gate(app("sin_dibujar", { "js/controles.js": CONTROLES({ marcarDibuja: false }) }));
t("Chromium: marcar sin dibujar → FAIL R3", /después de App\.marcarHecho no se llama a dibujar/.test(g3.gates.R3?.detail || ""), JSON.stringify(g3.gates));
const g4 = await validationGates({ artifact: "x", outDir: root, input: { refined: REFINED }, specialist: { standard: { id: "web/app/estado" } } });
t("sin contrato.json → SIN_CONTRATO, sin compuertas (no se inventa nada)", g4.result === "SIN_CONTRATO" && Object.keys(g4.gates).length === 0);
t("sin Standard (motor viejo por componentes) → no corre", (await validationGates({ artifact: "x", outDir: root, input: {}, specialist: {} })) === null);

// ---------- 3. las dos corridas reales del Kanban (12/10) ----------
const FX = fileURLToPath(new URL("../validation/fixtures/", import.meta.url));
const real = async (n) => { const d = join(FX, `real_kanban_c${n}`); const refined = JSON.parse((await import("node:fs")).readFileSync(join(d, "refined.json"), "utf8")); return gate(d, refined); };
const c4 = await real(4);
t("Kanban 4ª corrida: R4 'Etiquetar' (PASS falso) → FAIL por labelId undefined", /agregarEtiqueta con labelId = undefined/.test(c4.gates.R4?.detail || ""), JSON.stringify(c4.gates.R4));
t("Kanban 4ª corrida: R1, R2, R3, R5 FAIL; R6 'Borrar' (lo único que anda) sin compuerta", ["R1", "R2", "R3", "R5"].every((r) => c4.gates[r]) && !c4.gates.R6 && /moverTarjeta/.test(c4.gates.R2.detail), Object.keys(c4.gates).join());
const c3 = await real(3);
t("Kanban 3ª corrida: R1–R5 FAIL y R6 sin compuerta (lo que de verdad pasaba en la app)", Object.keys(c3.gates).sort().join() === "R1,R2,R3,R4,R5", Object.keys(c3.gates).join());

// ---------- v0.2 (15/10, p48: réplicas a temperatura 0.7) ----------
{
  // el juez: id de otra clase y acción que no cambia nada
  const A2 = [{ nombre: "borrar", params: ["id"], ids: ["id"], campos: [], features: [2], ejemplo: ["t1"] }];
  const KEYS = { t1: ["id", "texto", "hecho"], t2: ["id", "texto"], g1: ["id", "nombre"] };
  const P2 = (args, effects) => P({ calls: { borrar: args.length }, via: { borrar: "accion:borrar" }, args: { borrar: args }, effects: { borrar: effects } });
  const kind = judgeCalls(P2([["__object__", "g1"]], [false]), A2, ["t1", "t2", "g1"], {}, KEYS);
  t("juez v0.2: un id que existe pero es de otra clase de elemento → FAIL (no es un dato de verdad)", /id = "g1", que es el id de otra clase de elemento/.test(kind.gates.R2?.detail || ""), JSON.stringify(kind.gates));
  const opt = judgeCalls(P2([["__object__", "t2"]], [true]), A2, ["t1", "t2", "g1"], {}, KEYS);
  t("juez v0.2: misma clase con un campo opcional de menos → sin problema", !opt.rows[0].problem, JSON.stringify(opt.rows));
  const same = judgeCalls(P2([["__object__", "t1"], ["__object__", "t2"]], [false, false]), A2, ["t1", "t2", "g1"], {}, KEYS);
  t("juez v0.2: siempre devuelve el mismo estado → FAIL 'no cambia nada'", /siempre devuelve el mismo estado/.test(same.gates.R2?.detail || ""), JSON.stringify(same.gates));
  const once = judgeCalls(P2([["__object__", "t1"], ["__object__", "t2"]], [false, true]), A2, ["t1", "t2", "g1"], {}, KEYS);
  t("juez v0.2: alguna llamada cambió el estado → sin problema", !once.rows[0].problem);
  const noIds = judgeCalls(P({ calls: { reiniciar: 1 }, args: { reiniciar: [["__object__"]] }, effects: { reiniciar: [false] } }), [{ nombre: "reiniciar", params: [], ids: [], campos: [], features: [5] }], [], {}, {});
  t("juez v0.2: una acción sin ids (reiniciar) que no cambia el estado inicial no se marca", !noIds.rows[0].problem);
  // las réplicas reales (Chromium)
  const c16 = await real(16);
  t("build 03-49-43 (anda): 6/6 sin compuertas (sin falsas alarmas)", c16.result === "PASS" && !Object.keys(c16.gates).length, JSON.stringify(c16.gates));
  const c17 = await real(17);
  t("réplica 12-31-25 (seed 1): los botones mandan ids de columna como cardId → R2–R6 FAIL (antes PASS 6/6)", ["R2", "R3", "R4", "R5", "R6"].every((r) => /otra clase de elemento/.test(c17.gates[r]?.detail || "")) && !c17.gates.R1, Object.keys(c17.gates).join());
  const c18 = await real(18);
  t("réplica 13-02-02 (seed 3): lógica sobre una lista y dibujo sobre otra → R2–R6 FAIL 'no cambia nada' (antes PASS 6/6)", ["R2", "R3", "R4", "R5", "R6"].every((r) => /siempre devuelve el mismo estado/.test(c18.gates[r]?.detail || "")), Object.keys(c18.gates).join());
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
