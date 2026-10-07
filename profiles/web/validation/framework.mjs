// framework.mjs — Validation FRAMEWORK web (06/10, paso 2): CÓMO se valida.
//
// Validation.md: "Validation define cómo se valida; los Validation Profiles definen qué".
// Este archivo abre la página en Chromium, la recarga antes de cada chequeo, junta errores y
// diálogos, y le pasa la página al chequeo que corresponde. QUÉ se chequea lo traen los
// Validation profiles (uno por tipo de proyecto, junto a su tipo):
//   profiles/web/validation/validation_web.mjs   web (plataforma): carga, textos, controles, formularios…
//   profiles/web/landing/validation.mjs          web/landing: secciones, carrusel, scroll, animaciones
//   profiles/web/app/validation.mjs              web/app: teclas, clics, contadores
//   profiles/web/game/validation.mjs             web/game: tablero, niveles, escenarios (LEE el Standard)
// Un profile extiende a otro (web → web/app → web/game) y se suman sus chequeos.
// Antes todo esto era check_catalog.mjs (63 KB, landing + app + juego mezclados); su historia:
//
// (historia) check_catalog.mjs — catálogo CERRADO de chequeos ejecutables (Validation profile: SPA).
//
// Decisión 01/10: el juez de cobertura es Validation ejecutando el artefacto.
// Un requisito se traduce a chequeos de este catálogo (lo hace
// check_translator.mjs con Qwen, sin escribir código) y cada chequeo se
// ejecuta en Chromium real: PASS / FAIL / NOT_APPLICABLE lo decide el código.
//
// Alcance v0.1: solo lo que se ve y se usa en la SPA (backend simulado /
// datos mockeados). Los elementos se buscan por TEXTO visible (label, name,
// placeholder, aria-label, texto del botón), con una lista de sinónimos que
// da el traductor, porque el traductor no conoce el DOM.


// (versión del catálogo antes del corte: check_catalog v0.8.1)
// v0.8 (06/10, web/game por archivos): chequeos sobre el CONTRATO del juego (NIVELES y Reglas
// existen en la página): game_levels (al menos N niveles), moves_one_cell (de a un casillero,
// la pared bloquea), fixed_map_size (todos los niveles del mismo tamaño y el tablero lo dibuja).
// Cierran R3, R5 y R6 de Boxworld, que con la página sola quedaban SIN_CHEQUEO.
// v0.8.1 (06/10, Boxworld b11): reset_restores juega tecla por tecla hasta que algo cambie.
// v0.7.4 (05/10, Boxworld build 7): la foto de pantalla (SNAP) incluye data-*; reset_restores daba
// "las teclas no cambian nada" en un juego que marca jugador/cajas con data-type.
// v0.7.3 (05/10, Boxworld build 6): no_js_errors devuelve también la línea del error (errors[].line).

// v0.7.2 (05/10, Boxworld build 5): not_won_immediately también falla si la victoria ya
// se ve recién cargada la página (3 de 5 niveles tenían las cajas sobre los objetivos).

// v0.7.1 (05/10, Boxworld build 4): key_changes dio PASS a "el avatar se mueve con las
// flechas" y el avatar NO se movía: el estado cambiaba (contador 0 → 3) pero dibujar()
// nunca se volvía a llamar; lo que cambiaba era el texto del contador y el mensaje.
// board_changes mira solo el TABLERO (la grilla con más casilleros, o un canvas).

// v0.7 (05/10, web/app y web/game): chequeos de INTERACCIÓN. Evidencia: Boxworld
// build 3 — el juego "ganaba" con el primer movimiento, reiniciar quedaba
// deshabilitado y el contador de movimientos se verificó con numbers_animate
// ("cambian solos"): 5 de 8 requisitos SIN_CHEQUEO y el bug invisible.
//   key_changes          apretar una tecla cambia la pantalla (cualquier cosa, también un texto)
//   board_changes        (juego, v0.7.1) apretar una tecla cambia el TABLERO
//   click_changes        hacer clic en un control cambia la pantalla
//   counter_on_action    el número junto a una etiqueta cambia después de actuar
//   not_won_immediately  (juego) UN movimiento no alcanza para ganar
//   reset_restores       (juego) después de jugar, reiniciar vuelve al estado inicial

// v0.6.1 (05/10, Boxworld build 3): sections_visible dio FAIL falso en #juego (10/21):
// las 11 palabras que faltaban eran el overlay de victoria, con style="display:none"
// en el HTML, que aparece al ganar. El texto adentro de un descendiente con `hidden`
// o display:none inline se cuenta aparte (ondemand) y no entra en el total.

// v0.6 (05/10): components_render — chequeo de BASE. Evidencia: Boxworld build 2,
// el JS de #juego era una función anónima que nadie llamaba; el tablero
// (#game-board) quedó vacío y Validation no lo vio (sections_visible cuenta
// palabras, y los títulos y botones del HTML estático se veían). Ahora, por
// componente con <script data-component>: los contenedores que su JS nombra
// (#id o .clase) y que siguen vacíos después de cargar. Si TODOS siguen vacíos,
// el componente no dibujó nada → FAIL. No cuentan los contenedores "a demanda"
// (dentro de un form, aria-live/role=alert|status, o nombre tipo mensaje/feedback/
// error/estado): esos se llenan después de una acción.

// v0.5 (03/10): sections_visible — chequeo de BASE (lo corre el harness, no el
// traductor). Evidencia: en Project22 v0.6.1 el hero y el contacto quedaron con
// opacity:0 para siempre (CSS global `section{opacity:0}` + observer que no los
// vigilaba) y Validation dio PASS igual: innerText ignora la opacidad. Ahora cada
// pieza anclada con data-feature se mira DESPUÉS de llevarla a pantalla con la
// rueda del mouse, y se cuentan solo las palabras que se ven de verdad
// (opacidad acumulada ≥ 0.5, visibility, display, tamaño).

// v0.4 (02/10): chequeos de requisitos TRANSVERSALES y de interacción, que en
// Project22 quedaron SIN_CHEQUEO o con FAIL falso: sin scroll horizontal en
// celular, hover que cambia el estilo, nav fija que lleva a la sección, aparición
// al hacer scroll, animación de entrada, números que cambian y sección con
// botón. "Visualmente atractivo" o "código limpio" siguen sin chequeo: no se
// pueden medir ejecutando la página.

// v0.3 (01/10): chequeos de CONTENIDO por sección. Evidencia: con el esqueleto
// v0.4 (título por feature), todo text_visible pasa también en el esqueleto
// vacío → no discrimina (R3/R4 quedaron SIN_EVIDENCIA). Y el traductor
// representaba "en carrusel" con click_reveals inventado (R1 FAIL falso).
// Los tres nuevos ubican la sección por id / título / aria-label y miden lo
// que hay ADENTRO, sin contar los títulos.


import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { INIT, fieldsInfo, waitForSettle, matches, fieldText, words } from "./lib.mjs";

/** Junta los chequeos de una cadena de Validation profiles (de la plataforma a la hoja). */
export function composeValidation(chain) {
  const registry = {};
  for (const p of chain) for (const [type, def] of Object.entries(p.checks || {})) {
    if (registry[type]) throw new Error(`VALIDATION_DUPLICATE: "${type}" está en dos Validation profiles (${registry[type].profile} y ${p.id})`);
    registry[type] = { ...def, profile: p.id };
  }
  return registry;
}

/** El catálogo que ve el traductor (sin las funciones). */
export const specsOf = (registry) => Object.fromEntries(Object.entries(registry).map(([t, { run, ...spec }]) => [t, spec]));

/** Valida un chequeo contra el esquema del catálogo. Devuelve el chequeo limpio o null. */
export function normalizeCheck(c, catalog) {
  const def = catalog?.[c?.type];
  if (!def) return null;
  const params = {};
  for (const [k, t] of Object.entries(def.params)) {
    const v = c.params?.[k];
    const list = (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).map(String).map((s) => s.trim()).filter(Boolean);
    if (t === "string[]" && !words(list).length && !list.some((x) => /\d/.test(x))) return null; // v0.8: un número ("5") también vale
    if (t === "string[]?" && !list.length) continue; // opcional (v0.7)
    params[k] = list;
  }
  // feature (opcional, lo agrega el harness con anchorSections): id de requisito "Rn"
  if (c.params?.section && Array.isArray(c.params.feature) && /^R\d+$/.test(c.params.feature[0] || "")) params.feature = [c.params.feature[0]];
  return { type: c.type, params };
}

export async function runChecks(htmlPath, checks, { registry, env = {} } = {}) {
  if (!registry) throw new Error("runChecks: falta el Validation profile (registry de chequeos)");
  const url = pathToFileURL(resolve(htmlPath)).href;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ctx = { dialogs: [], pageErrors: [], pageStacks: [] };
  page.on("pageerror", (e) => { ctx.pageErrors.push(e.message); ctx.pageStacks.push({ message: e.message, stack: String(e.stack || "") }); });
  page.on("dialog", (d) => { ctx.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(INIT);
  await page.route(/^https?:/, (r) => r.abort());
  const reload = async () => { ctx.pageErrors.length = 0; ctx.pageStacks.length = 0; await page.goto(url, { waitUntil: "load" }); await waitForSettle(page); };

  const out = [];
  try {
    for (const c of checks) {
      const r = { ...c, result: "FAIL", detail: "" };
      try {
        await reload();
        const fields = (await fieldsInfo(page)) || [];
        const findField = () => fields.filter((f) => matches(fieldText(f), c.params.field));
        const def = registry[c.type];
        if (def?.run) await def.run({ page, c, r, ctx, fields, findField, reload, browser, url, env, htmlPath });
        else {
          r.result = "NOT_APPLICABLE";
          r.detail = "tipo fuera del catálogo";
        }
      } catch (e) {
        r.result = "FAIL";
        r.detail = `error del chequeo: ${e.message.slice(0, 150)}`;
      }
      out.push(r);
    }
  } finally {
    await browser.close();
  }
  return out;
}

