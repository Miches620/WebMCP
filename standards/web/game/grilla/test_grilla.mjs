// test_grilla.mjs — Standard "juego de grilla" (DRAFT) corriendo sobre el motor general.
//   node standards/web/game/grilla/test_grilla.mjs
// Antes: profiles/web/game/test_game_files.mjs (game_files v0.8–v0.8.2). Mismos casos, ahora
// el contrato/pruebas/sonda salen del Standard y los jueces del motor (harness/files_engine.mjs).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import S, { gameHints, validateLevels, CONTRACT, IDS, SCRIPTS } from "./standard.mjs";
import { RULE_TESTS } from "./acceptance.mjs";
import { levelFromSpec, solve, levelsFromSpecs, nivelesJs, stuckBoxes } from "./levels.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { postprocessChecks } from "../../../../profiles/web/game/build.mjs";
import * as E from "../../../../harness/files_engine.mjs";
import { fixRedeclare } from "../../../../profiles/web/specialist/encapsulation.mjs";

const { cleanFragment, cleanCss, extractFile, findMember, replaceMember, topNames, clashes, shadowProblems } = E;
const step = (id) => S.steps.find((s) => s.id === id);
const loadScripts = (codes) => E.loadScripts(codes, ["NIVELES", "Reglas"]);
const runRuleTests = (R, niveles = []) => E.runAcceptance(R, niveles, step("reglas"));
const dibujoProblems = (x) => E.probeProblems(x, step("dibujo"));
const screenProblems = (html) => { const m = E.missingIds(html, IDS); return m.length ? [`faltan estos ids en juego.html: ${m.map((x) => "#" + x).join(", ")}.`] : []; };
const JS_FILES = SCRIPTS;
const pageHtml = (o) => E.pageHtml({ scripts: SCRIPTS, mainId: S.mainId, ...o });
const baselinePage = (r, p) => E.baselinePage(r, p, S);

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const ref = (n) => readFileSync(fileURLToPath(new URL(`../../../../profiles/web/validation/fixtures/game_files_ok/${n}`, import.meta.url)), "utf8");

// pistas del brief (Boxworld real)
const h = gameHints({ features: ["El juego deberá tener al menos 5 niveles."], restricciones: ["El tamaño del mapa es 10 casilleros de largo x 10 casilleros de alto."] });
t("gameHints: 5 niveles y mapa 10x10 desde el texto del usuario", h.minLevels === 5 && h.rows === 10 && h.cols === 10, JSON.stringify(h));
t("gameHints: sin números → 1 nivel, sin tamaño", JSON.stringify(gameHints({})) === JSON.stringify({ minLevels: 1, cols: null, rows: null }));

// niveles (casos de los builds reales: filas de largo distinto b6/b7, 1 caja y 5 objetivos b6, cajas sobre objetivos b5)
const refN = loadScripts([ref("js/niveles.js")]).NIVELES;
t("niveles de referencia: válidos", validateLevels(refN, h).length === 0, JSON.stringify(validateLevels(refN, h)));
const v = validateLevels([["#####", "#@$.#", "####"], ["#####", "#@$..#", "#####"], ["####", "#@*#", "####"], ["#####", "#@$x#", "#####"]], { minLevels: 5 });
t("faltan niveles", v.some((x) => /4 niveles y se piden al menos 5/.test(x)));
t("filas de largo distinto (b6, b7)", v.some((x) => /nivel 1: las filas tienen largos distintos/.test(x)));
t("cajas ≠ objetivos (b6: 1 caja, 5 objetivos)", v.some((x) => /nivel 2: tiene 1 cajas y 2 objetivos/.test(x)));
t("todas las cajas sobre objetivos = ya ganado (b5)", v.some((x) => /nivel 3: todas las cajas empiezan sobre un objetivo/.test(x)));
t("caracteres fuera del formato (b6 usaba 'E' para piso)", v.some((x) => /nivel 4: caracteres que no son del formato: "x"/.test(x)));
t("tamaño pedido", validateLevels([["####", "#@$.#", "####"]], { rows: 3, cols: 5 }).some((x) => /tienen que tener 5 caracteres/.test(x)));

// reglas: pruebas del harness en Node
const good = loadScripts([ref("js/niveles.js"), ref("js/reglas.js")]);
const rg = runRuleTests(good.Reglas, good.NIVELES);
t("reglas de referencia: pasan todas las pruebas", rg.failed.length === 0 && rg.passed.length === RULE_TESTS.length + 5, JSON.stringify(rg.failed));
const mutate = (from, to) => runRuleTests(loadScripts([ref("js/reglas.js").replace(from, to)]).Reglas, []).failed.map((f) => f.name);
t("sin chequeo de lo que hay detrás de la caja → fallan 'caja contra pared' y 'caja contra caja'", mutate("if (pared(f + df, c + dc) || caja(f + df, c + dc) >= 0) return n; ", "").join() === "caja contra pared no se mueve,caja contra caja no se mueve");
t("ganado contando cajas en vez de objetivos (b6) → detectado", mutate("return e.objetivos.every((o) => e.cajas.some((b) => b.fila === o.fila && b.col === o.col));", "return true;").includes("recién creado no está ganado"));
t("mover que modifica el estado recibido → detectado", mutate("const n = { ...e, jugador: { ...e.jugador }, cajas: e.cajas.map((b) => ({ ...b })) };", "const n = e;").includes("mover no modifica el estado que recibe"));
t("sin Reglas → falla el contrato", runRuleTests(undefined).failed[0].name === "contrato");
t("la falla le dice a Gemma qué esperaba y qué dio", /tendría que dar|debería|quedó/.test(runRuleTests(loadScripts([ref("js/reglas.js").replace("n.movimientos++;", "n.movimientos += 2;")]).Reglas, []).failed[0]?.detail || ""));
t("loadScripts: error de ejecución → mensaje, sin colgarse", /x is not defined/.test(loadScripts(["x.y = 1;"]).error || ""));
t("loadScripts: un while(true) no cuelga (timeout)", /timed out|Script execution/.test(loadScripts(["while(true){}"]).error || ""));

// pantalla
t("screenProblems: faltan ids", /faltan estos ids en juego.html: #tablero/.test(screenProblems("<div id='nivel'></div>")[0] || ""));
t("screenProblems: la referencia tiene todos", screenProblems(readFileSync(fileURLToPath(new URL("../../../../profiles/web/validation/fixtures/game_files_ok/index.html", import.meta.url)), "utf8")).length === 0);
t("cleanFragment: saca documento entero, <script>, <style> y <link>", cleanFragment("<!DOCTYPE html><html><head><link rel=x></head><body><div id='tablero'></div><script>x()</script><style>a{}</style></body></html>") === "<div id='tablero'></div>");
t("cleanCss: sin @import ni url externas", !/@import|https:/.test(cleanCss("@import url(x.css);\na{background:url('https://x/y.png')}")));
const page = pageHtml({ title: "B", fragment: "<div id=\"tablero\"></div>", features: ["R1", "R2"] });
t("pageHtml: styles.css y los 4 js con <script src> en orden", page.includes('<link rel="stylesheet" href="styles.css">') && JS_FILES.every((f, i) => page.indexOf(`<script src="${f}">`) > (i ? page.indexOf(`<script src="${JS_FILES[i - 1]}">`) : 0)));
t("pageHtml: main#juego con data-feature (para sections_visible)", page.includes('<main id="juego" data-feature="R1 R2">'));
t("baselinePage: sin scripts", !baselinePage({ project_name: "B", features: ["a"] }, { header: null, footer: null, sections: [{ id: "juego", titulo: "B", features: ["R1"] }] }).includes("<script"));

// respuesta
t("extractFile: por nombre, por extensión y por fence", extractFile("### FILE: js/reglas.js\n```javascript\nA\n```", "js/reglas.js") === "A\n" && extractFile("### FILE: reglas.js\n```js\nB\n```", "js/reglas.js") === "B\n" && extractFile("```css\nC\n```", "styles.css") === "C\n");

// dibujo
t("dibujoProblems: tablero vacío (b6) → casilleros, jugador, cajas", dibujoProblems({ probe: { ok: true, cells: 0, rows: 10, cols: 10, jugador: 0, cajas: 0, nCajas: 2, pared: 0, movs: "0" }, errors: [] }).length === 4);
t("dibujoProblems: error → se informa", /tiró un error: boom/.test(dibujoProblems({ probe: { ok: false, error: "boom" }, errors: [] })[0]));
t("dibujoProblems: correcto → []", dibujoProblems({ probe: { ok: true, cells: 100, rows: 10, cols: 10, jugador: 1, cajas: 2, nCajas: 2, pared: 36, movs: "0" }, errors: [] }).length === 0);

// contrato
t("el contrato nombra los 6 ids y la forma del estado", IDS.every((id) => CONTRACT.includes("#" + id)) && /estado = \{ mapa/.test(CONTRACT) && /DEVUELVE UN ESTADO NUEVO/.test(CONTRACT));

// v0.8.1: niveles en coordenadas + solver (b8: Gemma no puede contar caracteres)
const lv = levelFromSpec({ jugador: [1, 1], cajas: [[2, 3]], objetivos: [[2, 6]], paredes: [[4, 4]] }, { rows: 10, cols: 10 });
t("coordenadas → 10 filas de 10, borde de paredes", lv.rows.length === 10 && lv.rows.every((r) => r.length === 10) && lv.rows[0] === "##########" && lv.rows[1] === "#@       #" && lv.rows[2] === "#  $  .  #" && lv.rows[4][4] === "#");
t("caja sobre objetivo → '*', jugador sobre objetivo → '+'", levelFromSpec({ jugador: [1, 1], cajas: [[2, 2], [3, 3]], objetivos: [[1, 1], [2, 2]] }, { rows: 5, cols: 5 }).rows.join("|") === "#####|#+  #|# * #|#  $#|#####");
const bad = levelFromSpec({ jugador: [0, 0], cajas: [[2, 2], [2, 2]], objetivos: [[3, 3]], paredes: [[2, 2]] }, { rows: 6, cols: 6 }, "nivel 1").problems;
t("fuera del interior, cajas repetidas, cajas ≠ objetivos, caja sobre pared", ["fuera del interior", "dos cajas en el mismo casillero", "2 cajas y 1 objetivos", "caja sobre una pared"].every((x) => bad.some((p) => p.includes(x))), JSON.stringify(bad));
t("todas las cajas sobre sus objetivos = ya ganado", levelFromSpec({ jugador: [1, 1], cajas: [[2, 2]], objetivos: [[2, 2]] }, { rows: 5, cols: 5 }).problems.some((p) => /ya está ganado/.test(p)));
t("solver: nivel fácil → resoluble", solve(["#####", "#@$.#", "#####"]).solvable === true);
t("solver: caja pegada a la pared superior y objetivo abajo → imposible", solve(levelFromSpec({ jugador: [2, 2], cajas: [[1, 3]], objetivos: [[4, 4]] }, { rows: 6, cols: 6 }).rows).solvable === false);
t("solver: dos cajas con paredes interiores → resoluble", solve(levelFromSpec({ jugador: [1, 1], cajas: [[2, 3], [4, 4]], objetivos: [[2, 6], [6, 4]], paredes: [[3, 3], [3, 4]] }).rows).solvable === true);
const ls = levelsFromSpecs({ niveles: [{ jugador: [1, 1], cajas: [[2, 3]], objetivos: [[2, 6]] }, { jugador: [2, 2], cajas: [[1, 3]], objetivos: [[4, 4]] }] }, { rows: 6, cols: 8, minLevels: 2 });
t("levelsFromSpecs: el irresoluble se descarta y se avisa", ls.levels.length === 1 && ls.problems.some((p) => /nivel 2: (NO se puede ganar|la caja en \[1,3\] no puede llegar)/.test(p)) && ls.problems.some((p) => /1 niveles válidos y se piden al menos 2/.test(p)));
t("levelsFromSpecs: JSON sin 'niveles' → problema claro", /"niveles"/.test(levelsFromSpecs({ foo: 1 }).problems[0]));
const nj = nivelesJs(ls.levels, ls.report);
t("nivelesJs: js/niveles.js cargable y válido para el contrato", (() => { const L = loadScripts([nj]); return Array.isArray(L.NIVELES) && L.NIVELES.length === 1 && validateLevels(L.NIVELES).length === 0; })());

// v0.8.1: reparación por método de reglas.js (b8: `state` en vez de `estado` en ganado)
const b8 = `const Reglas = {
    crearEstado(nivel) {
        return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
    },
    ganado(estado) {
        let n = 0;
        return n === state.cajas.length;
    },
    mover(estado, d) { return estado; }
};`;
const gm = findMember(b8, "ganado");
t("findMember: método de literal de objeto con sus líneas", gm && gm.start === 5 && gm.end === 8 && gm.text.includes("state.cajas"));
const rpl = replaceMember(b8, gm, "ganado(estado) {\n        let n = 0;\n        return n === estado.cajas.length;\n    }");
t("replaceMember: repone la coma del literal y compila", rpl.ok && rpl.js.includes("estado.cajas.length;\n    },") && !rpl.js.includes("state.cajas"));
t("replaceMember: otra función o JS roto → rechazado", !replaceMember(b8, gm, "mover(e) { return e; }").ok && !replaceMember(b8, gm, "ganado(estado) { if ( }").ok);
t("findMember: también `function x(` y `const x = (`", findMember("function dibujar(e) {\n  return 1;\n}", "dibujar")?.end === 3 && findMember("const mover = (e) => {\n  return e;\n};", "mover")?.end === 3);
t("pruebas con 'fn': cada falla dice qué función revisar", runRuleTests(loadScripts([b8]).Reglas, []).failed.every((f) => ["crearEstado", "mover", "ganado"].includes(f.fn)));

// v0.8.1: nombres en dos archivos (b8: dibujo.js declaraba nivelActual e iniciarNivel)
t("topNames: const/let/function al nivel superior", topNames("let nivelActual = 0;\nfunction iniciarNivel(i) {\n  const x = 1;\n}\nconst Reglas = {};").join() === "nivelActual,iniciarNivel,Reglas");
t("clashes: nombre ya declarado en otro archivo", clashes("let nivelActual = 0;", { "js/dibujo.js": "let nivelActual = 0;\nfunction dibujar() {}" })[0]?.includes('"nivelActual" ya está declarado en js/dibujo.js'));

// v0.8.2: Boxworld b9 (reglas.js real de Gemma: const altura/ancho declarados dos veces en mover)
const b9 = readFileSync(fileURLToPath(new URL("../../../../profiles/web/validation/fixtures/real_boxworld_b9_reglas.js", import.meta.url)), "utf8");
const compiles = (js) => { try { new vm.Script(js); return true; } catch { return false; } };
t("b9: el reglas.js real no compila", !compiles(b9));
const fr9 = fixRedeclare(b9);
t("fixRedeclare: b9 compila borrando las 2 declaraciones repetidas (mismo valor)", compiles(fr9.js) && fr9.fixes.length === 2 && fr9.fixes.every((f) => /borrada/.test(f.action)), JSON.stringify(fr9.fixes));
const fr2 = fixRedeclare("function f(a) {\n  const x = 1;\n  const x = a + 1;\n  return x;\n}");
t("fixRedeclare: otro valor → asignación y la primera pasa a let", compiles(fr2.js) && /let x = 1;/.test(fr2.js) && /^\s*x = a \+ 1;/m.test(fr2.js) && new vm.Script(fr2.js + ";f(4)").runInNewContext() === 5);
t("fixRedeclare: código sano no se toca", fixRedeclare("const a = 1;\nlet b = 2;").fixes.length === 0);
const t9 = runRuleTests(loadScripts([fr9.js]).Reglas, []);
const push9 = t9.failed.find((f) => f.name === "empujar una caja");
t("b9: la prueba de empujar explica que el jugador quedó encima de la caja (mapa sin cajas)", push9 && /ENCIMA de una caja/.test(push9.detail) && /estado\.cajas/.test(push9.detail));
t("b9: 'ganado después de mover' se atribuye a mover cuando mover falla", t9.failed.find((f) => f.name === "caja en el objetivo = ganado")?.fn === "mover");
t("shadowProblems: b9 dibujo.js (c => c.fila === r && c.col === c)", shadowProblems("const tieneCaja = estado.cajas.some(c => c.fila === r && c.col === c);").length === 1);
t("shadowProblems: comparaciones legítimas no se marcan", shadowProblems("ids.some(id => target === id); a.some((b) => b.fila === r && b.col === c); xs.find(c => c.id === c2)").length === 0);
t("contrato: dice que en mapa no hay cajas (mirar estado.cajas)", /en estado\.mapa NO hay cajas/.test(CONTRACT));

// v0.1.1 (Boxworld b10)
const fx = (n) => readFileSync(fileURLToPath(new URL(`../../../../profiles/web/validation/fixtures/${n}`, import.meta.url)), "utf8");
const b10 = levelsFromSpecs(JSON.parse(fx("real_boxworld_b10_niveles.json")), { rows: 10, cols: 10, minLevels: 5 });
t("b10: el nivel 5 se descarta diciendo POR QUÉ (cajas contra la pared, objetivo en otra línea)", b10.levels.length === 4 && b10.problems.some((p) => /nivel 5: las cajas en \[4,1\]/.test(p) && /contra la pared/.test(p)), JSON.stringify(b10.problems));
t("stuckBoxes: caja contra la pared con su objetivo pegado a esa pared → viva; con el objetivo lejos → trabada", stuckBoxes(["#####", "#@  #", "#$  #", "#.  #", "#####"]).length === 0 && stuckBoxes(["######", "#@   #", "#$   #", "#  . #", "######"]).length === 1);
t("solver: sigue resolviendo los niveles buenos de b10", b10.levels.every((rows) => solve(rows).solvable === true));
const emit = step("niveles").emit(b10.levels, b10.report.filter((r) => r.ok));
t("emit: niveles ordenados por empujes (dificultad creciente medible)", emit.reports.every((r, i, a) => !i || (a[i - 1].pushes ?? 0) <= (r.pushes ?? 0)), JSON.stringify(emit.reports.map((r) => r.pushes)));
t("data: missing dice cuántos faltan y que sean nuevos", /mandá SOLO 1 nivel\(es\) NUEVO/.test(step("niveles").missing(4, 5)));
const sw = step("pantalla").swatches;
const swDir = fileURLToPath(new URL("../../../../build/runs/_test_swatch/", import.meta.url));
const swatch = async (css) => {
  mkdirSync(swDir, { recursive: true });
  writeFileSync(swDir + "styles.css", css);
  writeFileSync(swDir + "index.html", E.pageHtml({ title: "t", fragment: '<div id="tablero"></div>', scripts: [], inline: E.swatchProbe(sw), mainId: "juego" }));
  return E.swatchProblems(await E.probePage(swDir + "index.html"), sw, css);
};
const swBad = await swatch(fx("real_boxworld_b10_styles.css"));
t("pantalla b10: '.casillero .pared' (descendiente) → se ven iguales + pista del selector", swBad.length === 3 && /\.casillero\.pared \(sin espacio\)/.test(swBad[2]), JSON.stringify(swBad));
t("pantalla b10 corregida ('.casillero.pared') → sin problemas", (await swatch(fx("real_boxworld_b10_styles.css").replace(/\.casillero \./g, ".casillero.").replace(".objetivo .caja", ".objetivo.caja"))).length === 0);
t("pantalla: caja y jugador del mismo color → se avisa", (await swatch(".casillero{background:#888}.casillero.pared{background:#000}.casillero.objetivo::after{content:'x'}.casillero.caja{background:red}.casillero.jugador{background:red}")).some((p) => /\.caja = \.jugador/.test(p)));
const refSw = await swatch(ref("styles.css"));
t("referencia game_files_ok: sus clases se ven distintas", refSw.length === 0, JSON.stringify(refSw));
t("traductor web/game: click_changes en 'reiniciar' (b10 R1, FAIL falso) → reset_restores", JSON.stringify(postprocessChecks([{ type: "click_changes", params: { click: ["reiniciar"] } }])) === JSON.stringify([{ type: "reset_restores", params: { click: ["reiniciar"] } }]) && postprocessChecks([{ type: "click_changes", params: { click: ["siguiente"] } }])[0].type === "click_changes");
t("contrato: el número de nivel empieza en 1", /nivelActual \+ 1/.test(CONTRACT));

// v0.1.2 (Boxworld b11: CSS bien, pero dibujar() pintaba con style; reiniciar con disabled)
const b11 = (n) => fx(`real_boxworld_b11/${n}`);
const looksDir = fileURLToPath(new URL("../../../../build/runs/_test_looks/", import.meta.url));
const drawn = async (dibujoJs, css = b11("styles.css")) => {
  mkdirSync(looksDir + "js", { recursive: true });
  for (const f of ["js/niveles.js", "js/reglas.js"]) writeFileSync(looksDir + f, b11(f));
  writeFileSync(looksDir + "js/dibujo.js", dibujoJs);
  writeFileSync(looksDir + "styles.css", css);
  const st = step("dibujo");
  writeFileSync(looksDir + "index.html", E.pageHtml({ title: "t", fragment: '<div id="tablero"></div><div id="nivel"></div><div id="movimientos"></div>', scripts: SCRIPTS.slice(0, 3), inline: st.probe + "\n" + E.drawnLooksProbe(st.looks), mainId: "juego" }));
  const pr = await E.probePage(looksDir + "index.html");
  return E.drawnLooksProblems(pr.looks, st.looks, dibujoJs);
};
const lk = await drawn(b11("js/dibujo.js"));
t("dibujo b11: caja y jugador se ven como el piso en el tablero dibujado + pista de style.backgroundColor", lk.length === 2 && /\.piso = \.caja = \.jugador/.test(lk[0]) && /style\.backgroundColor/.test(lk[1]), JSON.stringify(lk));
t("dibujo b11 sin los style → sin problemas", (await drawn(b11("js/dibujo.js").replace(/\n\s*casilla\.style\.backgroundColor = [^;]+;/g, ""))).length === 0);
t("pantalla b11: #btn-reiniciar con disabled → problema", E.disabledInHtml(b11("index.html"), "btn-reiniciar") && !E.disabledInHtml(b11("index.html"), "btn-siguiente") && step("pantalla").enabled.includes("btn-reiniciar"));
const b11r = runRuleTests(loadScripts([b11("js/niveles.js"), b11("js/reglas.js")]).Reglas, []);
const plus = b11r.failed.find((f) => f.name === "lee '*' y '+'")?.detail || "";
t("prueba de '*' y '+' (b11): dice solo lo que está mal (objetivos y mapa), no lo que está bien", /objetivos: tendrían que ser/.test(plus) && /cada fila tiene que ser un STRING/.test(plus) && !/jugador: tendría/.test(plus) && !/cajas: tendrían/.test(plus), plus);
t("niveles: con niveles ya guardados, el pedido es solo por los que faltan", /proponé 1 nivel\(es\) NUEVO\(S\) \(ya hay 4 válidos/.test(step("niveles").prompt({ hints: { minLevels: 5, rows: 10, cols: 10 }, have: 4, paso: "PASO 1 de 5" })));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
