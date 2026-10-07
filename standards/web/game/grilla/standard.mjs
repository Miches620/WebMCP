// standard.mjs — Standard "juego de grilla" (web/game/grilla) · DRAFT v0.1.1 (06/10).
// v0.1.5 (Miche jugando b12): pantalla declara `stable`: el tablero no puede cambiar de tamaño
// cuando #mensaje tiene un texto largo (al ganar se estiraba y quedaban franjas).
// v0.1.4 (b12, 7 PASS): ningún nivel se gana con un solo movimiento (b12: nivel 1 "@$." hizo
// fallar not_won_immediately y se reintentó controles 3 veces por un problema del nivel).
// v0.1.3 (Miche jugó b11): controles declara un escenario "ganar y seguir" (al ganar, el avatar
// quedaba bloqueado en todos los niveles; ningún chequeo jugaba más allá del nivel 1).
// v0.1.2 (Boxworld b11, 5 PASS otra vez con caja y jugador invisibles): dibujo declara `looks`
// (el tablero DIBUJADO se mira en Chromium: dibujar() pintaba con style y tapaba el CSS);
// pantalla declara `enabled` (#btn-reiniciar vino con disabled); niveles: el reintento pide
// solo los que faltan; la prueba de '*' y '+' dice solo lo que está mal.
// v0.1.1 (Boxworld b10, 5 PASS pero tablero de 100 casilleros iguales): pantalla declara
// `swatches` (cada clase se tiene que ver distinta; el motor lo prueba en Chromium); niveles
// junta los válidos de todos los intentos, explica las cajas trabadas contra la pared y se
// ordenan por empujes; el número de nivel empieza en 1.
//
// Qué es: la forma de trabajar que recibe el Specialist cuando el proyecto es un juego de una
// pantalla sobre una grilla, con piezas que se empujan hacia objetivos (familia Sokoban).
// Declara: archivos, contrato (nombres, forma del estado, ids), los PASOS en orden con el
// pedido de cada uno, las pruebas de aceptación de la lógica, la sonda del dibujo y los
// chequeos de interacción. El motor (harness/files_engine.mjs) no sabe nada de esto.
// Validation profile (paso 2 del plan, pendiente) va a LEER este Standard para saber qué
// verificar; no lo copia.
//
// DRAFT: sale de UN juego (Boxworld b2–b9). No es Standard oficial hasta que la evidencia
// (otro juego de la familia, Utility Score) lo respalde y Governance lo adopte.
// Pendiente: la pista "en estado.mapa no hay cajas" está en el contrato pero es una SKILL
// (saber hacer), no contrato: se mueve cuando existan las skills (paso 3 del plan).

import { RULE_TESTS, LEVEL_TESTS } from "./acceptance.mjs";
import { levelsFromSpecs, nivelesJs } from "./levels.mjs";

export const IDS = ["tablero", "nivel", "movimientos", "mensaje", "btn-reiniciar", "btn-siguiente"];
export const SCRIPTS = ["js/niveles.js", "js/reglas.js", "js/dibujo.js", "js/controles.js"];
export const CONTRACT = `CONTRATO DEL JUEGO (lo define el harness; respetalo al pie de la letra):
- Archivos: juego.html (solo el contenido de la pantalla), styles.css, js/niveles.js, js/reglas.js, js/dibujo.js, js/controles.js. Se cargan en ese orden con <script src> comunes: NADA de import/export ni módulos. Cada archivo define SOLO lo suyo.
- js/niveles.js (lo escribe el harness a partir de tus coordenadas) define: const NIVELES = [nivel1, nivel2, ...]; cada nivel es un array de strings (una fila por string, todas del mismo largo) en formato Sokoban: # pared, espacio piso, . objetivo, $ caja, * caja sobre objetivo, @ jugador, + jugador sobre objetivo.
- js/reglas.js define: const Reglas = { crearEstado(nivel), mover(estado, direccion), ganado(estado) }. Sin DOM (no usa document ni window).
    estado = { mapa: [strings con SOLO '#', ' ' y '.'], jugador: {fila, col}, cajas: [{fila, col}], objetivos: [{fila, col}], movimientos: 0 }
    direccion: "arriba" | "abajo" | "izquierda" | "derecha". mover DEVUELVE UN ESTADO NUEVO (no modifica el que recibe). Si el movimiento no se puede (pared, caja contra pared o contra otra caja), devuelve un estado igual con los mismos movimientos. Empujar: el jugador avanza un casillero y la caja otro en la misma dirección. OJO: en estado.mapa NO hay cajas ni jugador (solo '#', ' ' y '.'): para saber si hay una caja en un casillero mirá estado.cajas; mover cambia jugador, cajas y movimientos, nunca mapa. ganado = TODOS los objetivos tienen una caja encima.
- juego.html tiene estos ids: #tablero (la grilla), #nivel (número de nivel), #movimientos (contador), #mensaje (vacío al empezar), #btn-reiniciar, #btn-siguiente. Sin <script> ni <style>.
- js/dibujo.js define: function dibujar(estado, numeroNivel). Vacía #tablero y crea UN div por casillero, hijos directos de #tablero, fila por fila, con clase "casillero" y además: "pared" o "piso"; "objetivo" si es objetivo; "caja" si hay caja; "jugador" si está el jugador. Pone #tablero.style.gridTemplateColumns con la cantidad de columnas. Escribe estado.movimientos en #movimientos y numeroNivel en #nivel (numeroNivel empieza en 1: controles llama dibujar(estado, nivelActual + 1)).
- js/controles.js: let nivelActual = 0; let estado; function iniciarNivel(i) { nivelActual = i; crea el estado con Reglas.crearEstado(NIVELES[i]), vacía #mensaje y llama a dibujar(estado, nivelActual + 1) }. Un solo listener keydown en document: flechas → preventDefault, estado = Reglas.mover(estado, dir), dibujar; si Reglas.ganado(estado) → #mensaje dice "¡Nivel completado!". #btn-reiniciar → iniciarNivel(nivelActual). #btn-siguiente → si hay otro nivel, iniciarNivel(nivelActual + 1). Al final del archivo: iniciarNivel(0).`;

// ---------- pistas del brief (números que el usuario escribió) ----------
export function gameHints(refined = {}) {
  const txt = [...(refined.features || []), ...(refined.restricciones || []), ...(refined.contexto || [])].join("\n");
  const lv = txt.match(/al menos\s+(\d+)\s+niveles|(\d+)\s+niveles/i);
  const sz = txt.match(/(\d+)\s*casilleros?\s*de\s*largo\s*x\s*(\d+)/i) || txt.match(/\b(\d+)\s*x\s*(\d+)\b/);
  return { minLevels: lv ? Number(lv[1] || lv[2]) : 1, cols: sz ? Number(sz[1]) : null, rows: sz ? Number(sz[2]) : null };
}

// ---------- formato de niveles (strings Sokoban) ----------
/** Problemas de los niveles (texto para Gemma). [] = válidos. */
export function validateLevels(niveles, { minLevels = 1, rows = null, cols = null } = {}) {
  const out = [];
  if (!Array.isArray(niveles)) return ["NIVELES no es un array (tiene que ser const NIVELES = [ [...], [...] ])."];
  if (niveles.length < minLevels) out.push(`hay ${niveles.length} niveles y se piden al menos ${minLevels}.`);
  niveles.forEach((nv, i) => {
    const n = `nivel ${i + 1}`;
    if (!Array.isArray(nv) || !nv.every((f) => typeof f === "string")) { out.push(`${n}: no es un array de strings.`); return; }
    const lens = [...new Set(nv.map((f) => f.length))];
    if (lens.length > 1) out.push(`${n}: las filas tienen largos distintos (${nv.map((f) => f.length).join(", ")}); todas iguales.`);
    if (rows && nv.length !== rows) out.push(`${n}: tiene ${nv.length} filas y el mapa es de ${rows}.`);
    if (cols && lens.some((l) => l !== cols)) out.push(`${n}: las filas tienen que tener ${cols} caracteres.`);
    const all = nv.join("");
    const bad = [...new Set(all.replace(/[#.$*@+ ]/g, ""))];
    if (bad.length) out.push(`${n}: caracteres que no son del formato: ${bad.map((c) => JSON.stringify(c)).join(" ")} (piso = espacio).`);
    const players = (all.match(/[@+]/g) || []).length;
    if (players !== 1) out.push(`${n}: tiene ${players} jugadores (@ o +); tiene que haber exactamente 1.`);
    const boxes = (all.match(/[$*]/g) || []).length, goals = (all.match(/[.*+]/g) || []).length;
    if (boxes === 0) out.push(`${n}: no tiene cajas.`);
    if (boxes !== goals) out.push(`${n}: tiene ${boxes} cajas y ${goals} objetivos; tienen que ser la misma cantidad.`);
    if (boxes && !all.includes("$")) out.push(`${n}: todas las cajas empiezan sobre un objetivo (el nivel ya está ganado).`);
  });
  return out;
}


// ---------- sonda de dibujar() (la corre el motor en Chromium) ----------
const PROBE = `window.__probe = (function () {
  try {
    var e = Reglas.crearEstado(NIVELES[0]); dibujar(e, 1);
    var t = document.getElementById("tablero");
    return { ok: true, cells: t.children.length, rows: e.mapa.length, cols: e.mapa[0].length,
      jugador: t.querySelectorAll(".jugador").length, cajas: t.querySelectorAll(".caja").length, nCajas: e.cajas.length,
      pared: t.querySelectorAll(".pared").length, movs: (document.getElementById("movimientos") || {}).textContent || "" };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;

const LEVEL_FMT = `{ "niveles": [ { "jugador": [fila, col], "cajas": [[fila, col], ...], "objetivos": [[fila, col], ...], "paredes": [[fila, col], ...] }, ... ] }`;
const fence = (lang, s) => "```" + lang + "\n" + s + "\n```";
const size = (h) => ({ rows: h.rows || 10, cols: h.cols || 10, min: Math.max(h.minLevels || 1, 1) });

const STANDARD = {
  id: "web/game/grilla",
  version: "0.1.5",
  status: "DRAFT",
  label: "juego de grilla: empujar piezas hasta sus objetivos",
  describe: "Juego de una pantalla sobre una grilla, por archivos: juego.html, styles.css, js/niveles.js (datos verificados con solver), js/reglas.js (lógica pura probada en Node), js/dibujo.js (probado en Chromium), js/controles.js (chequeos de juego).",
  evidence: [
    "Boxworld b2–b7 (05/10): con todo el juego en una respuesta cada build trajo 1–2 bugs; reintentos completos cortados por length (3 de 3).",
    "Boxworld b8 (06/10): Gemma no puede contar caracteres (filas de 9 a 13 en un mapa de 10) → niveles en coordenadas + solver.",
    "Boxworld b9 (06/10, por archivos): niveles, pantalla y controles bien al primer intento; reglas.js con const repetido y mover que buscaba cajas en el mapa.",
    "Boxworld b12 (06/10): 7 PASS / 0 FAIL, se ve y se juega; nivel 1 ganable con una flecha (y controles reintentado 3 veces por eso).",
    "Boxworld b11 (06/10, lo jugó Miche): se veía y se podía mover y empujar; al ganar cualquier nivel el avatar quedaba bloqueado (removeEventListener del teclado). Ningún chequeo lo vio.",
    "Boxworld b10 (06/10): 5 PASS / 2 FAIL, reglas 13/14, dibujo y controles al primer intento. Pero el tablero se veía vacío (styles.css con '.casillero .pared'), 4 niveles de 5 (nivel 5 con cajas contra la pared en los 3 intentos) y un FAIL falso del traductor (click_changes en reiniciar).",
  ],
  pending: [
    "Probarlo con otro juego de la familia (empujar/llegar a objetivos) antes de pensar en Governance.",
    "Niveles demasiado fáciles (b9: 2 a 8 empujes): dificultad creciente medible con el solver.",
    "La pista 'en estado.mapa no hay cajas' es una skill, no contrato.",
  ],
  mainId: "juego",
  defaultTitle: "Juego",
  ids: IDS,
  scripts: SCRIPTS,
  contract: CONTRACT,
  hints: gameHints,
  hintsText: (h) => `pistas del brief: ${h.minLevels} niveles${h.rows ? `, mapa ${h.cols}x${h.rows}` : ""}`,
  steps: [
    {
      id: "niveles", kind: "data", answer: "niveles.json", file: "js/niveles.js", cap: 4000,
      prompt: (c) => { const z = size(c.hints); return `${c.paso}: proponé ${c.have ? `${Math.max(z.min - c.have, 1)} nivel(es) NUEVO(S) (ya hay ${c.have} válidos guardados: no los repitas)` : `${z.min} niveles o más`} como JSON, en COORDENADAS (no dibujes el mapa: el harness arma js/niveles.js).
Mapa de ${z.rows} filas x ${z.cols} columnas. El borde (fila 0, fila ${z.rows - 1}, columna 0, columna ${z.cols - 1}) ya es pared: no lo listes. Todo lo que pongas va en filas 1 a ${z.rows - 2} y columnas 1 a ${z.cols - 2}.
Formato:
### FILE: niveles.json
${fence("json", LEVEL_FMT)}
Reglas: en cada nivel tantas cajas como objetivos; ninguna caja empieza sobre su objetivo; nada en el mismo casillero (jugador, cajas, paredes); "paredes" son solo las interiores (pocas). Dificultad creciente: el nivel 1 con 1 o 2 cajas cerca de sus objetivos, el último con 3 o 4. Ningún nivel se gana con un solo movimiento. Ninguna caja en una esquina ni pegada al borde (fila 1, fila ${z.rows - 2}, columna 1, columna ${z.cols - 2}) salvo que su objetivo esté pegado a esa misma pared. El harness prueba con un solver que cada nivel se pueda ganar.`; },
      take: (raw, c) => ({ ...c, "niveles.json": c["niveles.json"] || (String(raw).match(/\{[\s\S]*"niveles"[\s\S]*\}/) || [])[0] || null }),
      // los niveles inválidos se descartan; el motor junta los válidos de todos los intentos
      parse: (json, c) => {
        const z = size(c.hints);
        const L1 = levelsFromSpecs(json, { rows: z.rows, cols: z.cols, minLevels: 0 });
        if (!Array.isArray(Array.isArray(json) ? json : json?.niveles)) return { error: L1.problems[0] };
        return { items: L1.levels, reports: L1.report.filter((r) => r.ok), dropped: L1.problems };
      },
      need: (c) => size(c.hints).min,
      missing: (have, need, c) => { const z = size(c?.hints || {}); const lo = 3, hiR = z.rows - 4, hiC = z.cols - 4; // 10x10 → 3 a 6 (igual que en b14: así Boxworld sin skills = b14)
        return `hay ${have} niveles válidos (juntando tus respuestas anteriores) y se piden al menos ${need}: mandá SOLO ${need - have} nivel(es) NUEVO(S). Lo más seguro: 1 o 2 cajas en el medio del mapa (filas ${lo} a ${hiR}, columnas ${lo} a ${hiC}), cada una a 1 o 2 casilleros de su objetivo, sin paredes alrededor.`; },
      // dificultad creciente medible: se ordenan por cantidad de empujes que necesitó el solver
      emit: (items, reports) => {
        const order = items.map((it, i) => i).sort((a, b) => (reports[a]?.pushes ?? 99) - (reports[b]?.pushes ?? 99));
        const its = order.map((i) => items[i]), rps = order.map((i) => reports[i]);
        return { items: its, reports: rps, js: nivelesJs(its, rps) };
      },
      summaryText: (p) => `niveles: ${p.items.length} válidos y resolubles${p.items.length < p.need ? ` (se pedían ${p.need})` : ""} · empujes: ${p.reports.map((r) => r?.pushes ?? "?").join(", ")}${p.reports.some((r) => r?.solvable === null) ? " (alguno sin decidir por el solver)" : ""}${p.dropped.length ? ` · descartados: ${p.dropped.slice(0, 3).join(" | ")}` : ""}`,
    },
    {
      id: "reglas", kind: "logic", file: "js/reglas.js", cap: 5000, needs: ["niveles"],
      global: "Reglas", functions: ["crearEstado", "mover", "ganado"], pure: true, itemsGlobal: "NIVELES",
      label: "lógica de un juego de grilla, sin DOM",
      tests: RULE_TESTS, itemTests: LEVEL_TESTS,
      prompt: (c) => `NOTAS DEL TECHLEADER (contexto):\n${c.notes}\n\nYA EXISTE js/niveles.js (lo armó el harness) con ${c.data.niveles.items.length} niveles. Ejemplo, NIVELES[0]:\n${JSON.stringify(c.data.niveles.items[0] || [], null, 1)}\n\n${c.paso}: escribí js/reglas.js (const Reglas = { crearEstado, mover, ganado }). Sin DOM. El harness lo va a probar con niveles chicos propios.`,
    },
    {
      id: "pantalla", kind: "screen", files: ["juego.html", "styles.css"], cap: 4500,
      // cómo dibuja dibujar(): un div por casillero con class="casillero <variante>"
      swatches: { container: "tablero", base: "casillero", variants: ["pared", "piso", "objetivo", "caja", "jugador"], sameAsBase: ["piso"] },
      // b3 y b11: #btn-reiniciar vino con disabled en el HTML y nadie lo habilitaba
      enabled: ["btn-reiniciar", "btn-siguiente"],
      // b12 (lo vio Miche): con el mensaje largo de victoria el tablero se estiraba y aparecían franjas
      stable: { container: "tablero", base: "casillero", cell: "piso", cols: 10, columns: "repeat(10, 1fr)", changing: "mensaje", text: "¡Nivel completado! Presioná 'Próximo Nivel' para continuar con el siguiente desafío del juego." },
      prompt: (c) => `${c.paso}: escribí juego.html (SOLO el contenido de la pantalla: título, HUD con #nivel y #movimientos, #tablero, #mensaje y los botones #btn-reiniciar y #btn-siguiente; sin <html>, <head>, <script> ni <style>) y styles.css (todo el estilo de la página; #tablero es una grilla CSS de casilleros cuadrados; cada casillero es UN div con varias clases a la vez, por ejemplo class="casillero pared" o class="casillero piso objetivo caja": los selectores son .casillero.pared, .casillero.caja, etc., y cada clase se tiene que ver distinta; #tablero mide lo que miden sus casilleros y no se estira aunque #mensaje tenga un texto largo). Respetá los CRITERIOS DE ESTILO del brief.`,
    },
    {
      id: "dibujo", kind: "render", file: "js/dibujo.js", cap: 4000, needs: ["niveles", "reglas"],
      defines: "dibujar(estado, numeroNivel)", notOwn: { names: ["nivelActual", "estado", "iniciarNivel"], owner: "js/controles.js (paso 5)" }, noListeners: true,
      call: "dibujar(Reglas.crearEstado(NIVELES[0]), 1)", probe: PROBE,
      // b11: el CSS estaba bien pero dibujar() pintaba con style.backgroundColor y tapaba caja y jugador
      looks: { container: "tablero", base: "casillero", variants: ["pared", "piso", "objetivo", "caja", "jugador"] },
      expect: (p) => {
        const out = [];
        if (p.cells !== p.rows * p.cols) out.push(`#tablero tiene ${p.cells} hijos y el nivel tiene ${p.rows}x${p.cols} = ${p.rows * p.cols} casilleros: un div por casillero, hijos directos de #tablero.`);
        if (p.jugador !== 1) out.push(`hay ${p.jugador} casilleros con clase "jugador"; tiene que haber 1.`);
        if (p.cajas !== p.nCajas) out.push(`hay ${p.cajas} casilleros con clase "caja" y el estado tiene ${p.nCajas} cajas.`);
        if (!p.pared) out.push(`ningún casillero tiene clase "pared".`);
        if (!/\d/.test(p.movs)) out.push(`#movimientos no muestra el número de movimientos.`);
        return out;
      },
      prompt: (c) => `YA EXISTEN: NIVELES, Reglas (crearEstado/mover/ganado) y juego.html:\n${fence("html", c.fragment.slice(0, 2500))}\n\n${c.paso}: escribí js/dibujo.js (function dibujar(estado, numeroNivel)).`,
    },
    {
      id: "controles", kind: "wiring", file: "js/controles.js", cap: 4000, needs: ["reglas", "dibujo"],
      play: [
        { type: "no_js_errors", params: {} },
        { type: "board_changes", params: {} },
        { type: "not_won_immediately", params: {} },
        { type: "reset_restores", params: { click: ["reiniciar"] } },
        { type: "counter_on_action", params: { label: ["movimientos"] } },
      ],
      // v0.1.3 (Miche jugando b11): después de ganar, el avatar quedaba bloqueado en todos los niveles.
      // Partida corta con 2 niveles de prueba que se ganan con UNA flecha a la derecha.
      scenarios: [{
        id: "ganar_y_seguir", name: "ganar un nivel y pasar al siguiente",
        files: { "js/niveles.js": 'const NIVELES = [\n  ["#####", "#@$.#", "#####"],\n  ["######", "#@ $.#", "######"]\n];\n' },
        steps: [
          { key: "ArrowRight" },
          { text: "mensaje", any: ["complet", "ganaste", "ganado", "lograste", "felicit", "superado"], problem: "con NIVELES[0] = [\"#####\",\"#@$.#\",\"#####\"] una flecha a la derecha gana el nivel, pero #mensaje no dice \"¡Nivel completado!\"." },
          { click: ["siguiente", "proximo", "próximo"] },
          { snap: "tablero" },
          { key: "ArrowRight" },
          { changed: "tablero", problem: "después de ganar el nivel 1 y apretar Siguiente, la flecha derecha no mueve nada en el nivel 2: el juego queda bloqueado. No saques el listener de teclado al ganar (removeEventListener) ni lo dejes apagado: iniciarNivel() tiene que dejar el juego listo para jugar otra vez." },
        ],
      }],
      prompt: (c) => `NOTAS DEL TECHLEADER (contexto):\n${c.notes}\n\nYA EXISTEN: NIVELES (${c.data.niveles.items.length} niveles), Reglas, dibujar(estado, numeroNivel) y juego.html:\n${fence("html", c.fragment.slice(0, 2500))}\n\n${c.paso}: escribí js/controles.js (estado del juego, teclado, botones y arranque).`,
    },
  ],
};

// ---------- qué lee el Validation profile web/game (paso 2, 06/10) ----------
// Validation no copia el Standard: lo lee. Acá se dice dónde está cada cosa del contrato, y se
// reusan los mismos escenarios y las mismas medidas visuales que usa el Specialist al construir.
const step = (id) => STANDARD.steps.find((s) => s.id === id);
STANDARD.validation = {
  levels: { global: "NIVELES" },
  logic: { global: "Reglas", create: "crearEstado", move: "mover", pos: "jugador", dirs: { right: "derecha", down: "abajo", left: "izquierda" },
    // nivel de prueba: el jugador en (1,1) con piso a la derecha y abajo
    probe: ["######", "#@   #", "#    #", "######"] },
  board: "tablero",
  scenarios: step("controles").scenarios,
  looks: step("dibujo").looks,
  stable: { container: "tablero", changing: "mensaje", text: step("pantalla").stable.text },
};
export default STANDARD;
