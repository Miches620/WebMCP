// validation.mjs — Validation profile "web/game" (06/10, paso 2).
//
// Qué se valida en un juego. Extiende web/app (teclas, clics, contadores) y suma: el tablero
// cambia, no se gana con un movimiento, reiniciar vuelve al inicio, y lo que depende del
// CONTRATO del juego. El contrato no está escrito acá: lo declara el Standard que siguió el
// Specialist (env.standard.validation: dónde están los niveles, la lógica, el tablero, los
// escenarios). Sin Standard esos chequeos dan NOT_APPLICABLE (no se inventa un contrato).
// Nuevos en el paso 2 (antes solo los veía el Specialist mientras construía, b10–b12):
//   game_scenario   partidas cortas del Standard (b11: al ganar quedaba bloqueado)
//   looks_distinct  las piezas DIBUJADAS se distinguen a la vista (b10–b11)
//   layout_stable   el tablero no se deforma con un mensaje largo (b12)

import { cpSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { runScenario, drawnLooksProbe, drawnLooksProblems, stableRealProbe, stableProblems } from "../validation/page_tools.mjs";
import { ARROWS, BOARD_SNAP, HOVER_KINDS, ITEM_LEFTS, LABELED_NUMBERS, MARK_SECTION, NAV_RE, NUMBERS_IN, RENDER_AFTER, RENDER_STATIC, SEEN_SRC, SEEN_WORDS, SNAP, STYLE_SNAP, WIN_AT_LOAD, WIN_WORDS, diffCount, diffSample, fieldText, findControl, keysFrom, matches, norm, visibleTexts, words, INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle } from "../validation/lib.mjs";

export default {
  id: "web/game",
  extends: "web/app",
  // Chequeos que este profile corre SIEMPRE (no los elige el traductor). gate: si falla, los
  // requisitos de la pantalla son FAIL (como components_render); si no, quedan informados.
  always: [
    { type: "looks_distinct", params: {}, gate: true },   // b10–b11: 5 PASS con el juego invisible
    { type: "layout_stable", params: {}, gate: false },   // b12: se deformaba con el mensaje de victoria
  ],
  checks: {
    board_changes: {
      describe: "Al apretar una tecla cambia el TABLERO del juego (la grilla o el canvas: una pieza se mueve), no solo un texto o un contador. Usar para 'el avatar / jugador / la pieza se mueve con las flechas'.",
      params: { keys: "string[]?" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const keys = keysFrom(c.params.keys);
        const changed = [];
        let label = null;
        for (const k of keys) {
          await reload();
          const a = await page.evaluate(BOARD_SNAP);
          if (!a.found) break;
          label = a.label;
          await page.keyboard.press(k);
          await page.waitForTimeout(150); await waitForSettle(page);
          const b = await page.evaluate(BOARD_SNAP);
          if (diffCount(a.lines, b.lines)) changed.push(k);
        }
        if (!label) { r.detail = "no hay tablero (una grilla con 9 o más casilleros, o un canvas)"; break; }
        r.result = changed.length ? "PASS" : "FAIL";
        r.detail = changed.length ? `${label} cambia con: ${changed.join(", ")}` : `${label} no cambia con ninguna tecla (${keys.join(", ")}): puede cambiar el estado o un texto, pero el tablero no se redibuja`;
        break;
      } while (false); },
    },
    game_levels: {
      describe: "(Juego con Standard) El juego trae al menos N niveles. Usar para 'al menos N niveles'; min = [\"N\"].",
      params: { min: "string[]" },
      run: async ({ page, c, r, env, htmlPath }) => {
        const V = std(env, r, "levels"); if (!V) return;
        const g = V.levels.global;
        const min = Number((c.params.min || []).map((x) => String(x).match(/\d+/)?.[0]).find(Boolean) || 1);
        const n = await page.evaluate(`typeof ${g} !== "undefined" && Array.isArray(${g}) ? ${g}.length : -1`);
        if (n < 0) { r.detail = `la página no define ${g} (contrato del Standard ${env.standard.id})`; return; }
        r.result = n >= min ? "PASS" : "FAIL";
        r.detail = `${n} niveles (se piden al menos ${min})`;
      },
    },
    moves_one_cell: {
      describe: "(Juego con Standard) Cada movimiento avanza exactamente un casillero y la pared lo bloquea. Usar para 'se mueve de a un casillero'.",
      params: {},
      run: async ({ page, c, r, env, htmlPath }) => {
        const V = std(env, r, "logic"); if (!V) return;
        const L = V.logic;
        // la lógica del juego se llama con los nombres que declara el Standard
        const t = await page.evaluate(`(function () {
          if (typeof ${L.global} === "undefined") return { err: "la página no define ${L.global} (contrato del Standard ${env.standard.id})" };
          try {
            var G = ${L.global}, e = G.${L.create}(${JSON.stringify(L.probe)});
            var d = G.${L.move}(e, ${JSON.stringify(L.dirs.right)}), b = G.${L.move}(e, ${JSON.stringify(L.dirs.down)}), w = G.${L.move}(e, ${JSON.stringify(L.dirs.left)});
            var dd = G.${L.move}(d, ${JSON.stringify(L.dirs.right)});
            var p = function (x) { return x && x.${L.pos} ? x.${L.pos}.fila + "," + x.${L.pos}.col : "?"; };
            return { d: p(d), b: p(b), w: p(w), dd: p(dd) };
          } catch (err) { return { err: String(err.message || err) }; }
        })()`);
        if (t.err) { r.detail = t.err; return; }
        const ok = t.d === "1,2" && t.b === "2,1" && t.w === "1,1" && t.dd === "1,3";
        r.result = ok ? "PASS" : "FAIL";
        r.detail = ok ? "derecha → (1,2), otra vez → (1,3), abajo → (2,1), contra la pared se queda en (1,1)" : `desde (1,1): derecha → ${t.d} (esperado 1,2), otra vez → ${t.dd} (1,3), abajo → ${t.b} (2,1), izquierda contra la pared → ${t.w} (1,1)`;
      },
    },
    fixed_map_size: {
      describe: "(Juego con Standard) Todos los niveles tienen el mismo tamaño de mapa y el tablero dibuja filas x columnas casilleros. Usar para 'el tamaño del mapa es fijo'.",
      params: {},
      run: async ({ page, c, r, env, htmlPath }) => {
        const V = std(env, r, "levels", "board"); if (!V) return;
        const g = V.levels.global;
        const t = await page.evaluate(`(function () {
          if (typeof ${g} === "undefined") return { err: "la página no define ${g} (contrato del Standard ${env.standard.id})" };
          var dims = ${g}.map(function (nv) { return nv.length + "x" + Math.max.apply(null, nv.map(function (f) { return f.length; })); });
          var tab = document.getElementById(${JSON.stringify(V.board)});
          return { dims: dims.filter(function (x, i) { return dims.indexOf(x) === i; }), first: dims[0], cells: tab ? tab.children.length : -1, need: ${g}[0].length * ${g}[0][0].length };
        })()`);
        if (t.err) { r.detail = t.err; return; }
        const ok = t.dims.length === 1 && t.cells === t.need;
        r.result = ok ? "PASS" : "FAIL";
        r.detail = ok ? `todos los niveles son de ${t.first} y el tablero dibuja ${t.cells} casilleros` : `tamaños: ${t.dims.join(", ")}; el tablero dibuja ${t.cells} casilleros de ${t.need}`;
      },
    },
    not_won_immediately: {
      describe: "Con UN solo movimiento (una tecla) no aparece un mensaje de victoria ni se completa el nivel. Usar para 'acomodar / llegar / completar el nivel / ganar'.",
      params: { keys: "string[]?" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const keys = keysFrom(c.params.keys);
        const won = [], moved = [];
        // v0.7.2 (Boxworld build 5): niveles cuyas cajas EMPIEZAN sobre los objetivos → ganado al cargar.
        // Al cargar solo cuentan palabras inequívocas ("completado" suelto puede ser "niveles completados: 0").
        const loadText = norm(await page.evaluate(() => document.body.innerText));
        const atLoad = WIN_AT_LOAD.find((x) => loadText.includes(x));
        if (atLoad) { r.detail = `recién cargado ya aparece la victoria ("${atLoad}"): el nivel empieza resuelto`; break; }
        for (const k of keys) {
          await reload();
          const a = await page.evaluate(SNAP, true);
          const t0 = norm(await page.evaluate(() => document.body.innerText));
          await page.keyboard.press(k);
          await page.waitForTimeout(200); await waitForSettle(page);
          const t1 = norm(await page.evaluate(() => document.body.innerText));
          if (diffCount(a, await page.evaluate(SNAP, true))) moved.push(k);
          const w = WIN_WORDS.find((x) => t1.includes(x) && !t0.includes(x));
          if (w) won.push(`${k} → "${w}"`);
        }
        if (!moved.length) { r.result = "FAIL"; r.detail = `ninguna tecla cambia nada (${keys.join(", ")}): no se puede jugar`; break; }
        r.result = won.length ? "FAIL" : "PASS";
        r.detail = won.length ? `con UN movimiento ya aparece la victoria: ${won.join("; ")}` : `${moved.length} movimientos de prueba, ninguno gana`;
        break;
      } while (false); },
    },
    reset_restores: {
      describe: "Después de jugar (teclas), el control X (reiniciar) vuelve la pantalla al estado del inicio. Usar para 'botón reiniciar / volver a empezar'.",
      params: { click: "string[]", keys: "string[]?" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const keys = keysFrom(c.params.keys);
        const s0 = await page.evaluate(SNAP, false);
        // v0.8.1 (Boxworld b11): se juega tecla por tecla hasta que algo cambie. Antes se apretaban
        // ↑ ↓ ← → seguidas: el avatar volvía al casillero de inicio y daba FAIL falso ("las teclas
        // no cambian nada"), tapando el bug real (reiniciar con disabled).
        let s1 = s0, d1 = 0;
        for (const k of [...keys, ...keys]) {
          await page.keyboard.press(k); await page.waitForTimeout(120); await waitForSettle(page);
          s1 = await page.evaluate(SNAP, false); d1 = diffCount(s0, s1);
          if (d1) break;
        }
        if (!d1) { r.detail = `las teclas (${keys.join(", ")}) no cambian nada: no hay qué reiniciar`; break; }
        const ctl = await findControl(page, c.params.click);
        if (!ctl) { r.detail = `después de jugar, ningún control visible menciona: ${c.params.click.join(" / ")}`; break; }
        if (await ctl.loc.isDisabled().catch(() => false)) { r.detail = `después de jugar, "${ctl.text.slice(0, 40)}" está deshabilitado`; break; }
        await ctl.loc.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(150); await waitForSettle(page);
        const s2 = await page.evaluate(SNAP, false);
        const d2 = diffCount(s0, s2);
        r.result = d2 === 0 ? "PASS" : "FAIL";
        r.detail = d2 === 0 ? `jugar cambió ${d1} elementos; "${ctl.text.slice(0, 30)}" los volvió todos al inicio`
          : `jugar cambió ${d1} elementos; después de "${ctl.text.slice(0, 30)}" quedan ${d2} distintos del inicio (ej. ${diffSample(s0, s2).join(" ; ")})`;
        break;
      } while (false); },
    },
    game_scenario: {
      describe: "(Juego con Standard) Se juegan las partidas cortas que declara el Standard (por ejemplo: ganar un nivel y pasar al siguiente, y que se pueda seguir jugando). Usar para 'botón próximo / siguiente nivel' y 'avanzar de nivel'.",
      params: {},
      run: async ({ page, c, r, env, htmlPath }) => {
        const V = std(env, r, "scenarios"); if (!V) return;
        const appDir = dirname(htmlPath), problems = [];
        for (const sc of V.scenarios) {
          // copia de la app con los datos de prueba del escenario (la app original no se toca)
          const dir = mkdtempSync(join(tmpdir(), "vc-escenario-"));
          try {
            cpSync(appDir, dir, { recursive: true });
            for (const [f, txt] of Object.entries(sc.files || {})) writeFileSync(join(dir, f), txt, "utf8");
            problems.push(...await runScenario(join(dir, "index.html"), sc));
          } finally { rmSync(dir, { recursive: true, force: true }); }
        }
        r.result = problems.length ? "FAIL" : "PASS";
        r.detail = problems.length ? problems.join(" | ").slice(0, 400) : `${V.scenarios.map((x) => x.name).join("; ")}: OK`;
      },
    },
    looks_distinct: {
      describe: "BASE (no lo usa el traductor): las piezas que dibuja el juego se distinguen a la vista (fondo, borde, sombra o símbolo).",
      params: {},
      base: true,
      run: async ({ page, c, r, env, htmlPath }) => {
        const V = std(env, r, "looks"); if (!V) return;
        await page.evaluate(drawnLooksProbe(V.looks));
        const looks = await page.evaluate(() => window.__looks || null);
        if (!looks) { r.detail = `no hay #${V.looks.container} con celdas .${V.looks.base} para mirar`; return; }
        const pr = drawnLooksProblems(looks, V.looks, "", "el código");
        r.result = pr.length ? "FAIL" : "PASS";
        r.detail = pr.length ? pr.join(" ") : `se distinguen: ${V.looks.variants.filter((v) => looks[v] != null).join(", ")}`;
      },
    },
    layout_stable: {
      describe: "BASE (no lo usa el traductor): el tablero no cambia de tamaño ni se separan sus celdas cuando aparece un mensaje largo (por ejemplo, el de victoria).",
      params: {},
      base: true,
      run: async ({ page, c, r, env, htmlPath }) => {
        const V = std(env, r, "stable"); if (!V) return;
        const p = await page.evaluate(stableRealProbe(V.stable));
        if (!p || !p.ok) { r.detail = `no se pudo medir: ${p?.error || "sin respuesta"}`; return; }
        const pr = stableProblems(p, V.stable);
        r.result = pr.length ? "FAIL" : "PASS";
        r.detail = pr.length ? `#${V.stable.container} ${p.before.w}px → ${p.after.w}px con un texto largo en #${V.stable.changing}${p.after.gap > p.before.gap + 1 ? `; huecos de ${p.after.gap}px entre celdas` : ""}`
          : `#${V.stable.container} igual (${p.before.w}px) con un texto largo en #${V.stable.changing}`;
      },
    },
  },
};

/** Lo que el Standard declara para Validation; si falta, el chequeo queda NOT_APPLICABLE. */
function std(env, r, ...keys) {
  const V = env?.standard?.validation;
  const miss = !V ? "sin Standard" : keys.filter((k) => !V[k]);
  if (!V || miss.length) { r.result = "NOT_APPLICABLE"; r.detail = !V ? "sin Standard: no sé cuál es el contrato del juego" : `el Standard ${env.standard.id} no declara: ${miss.join(", ")}`; return null; }
  return V;
}
