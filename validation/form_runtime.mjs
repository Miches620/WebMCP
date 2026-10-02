// form_runtime.mjs — utilidades de navegador para validar formularios.
// Las usan el holdout del piloto (pilot/holdout/form_holdout.mjs) y el
// catálogo de chequeos (validation/check_catalog.mjs). Movidas sin cambios
// desde form_holdout.mjs (01/10): el comportamiento calibrado con los 8
// fixtures del piloto es el mismo.

export const ERROR_TEXT = /(obligatori|requerid|inv[aá]lid|invalid|error|complet[aá]|debe[s]? (ingresar|completar)|falta)/i;
export const SUCCESS_TEXT = /(gracias|enviad|[eé]xito|recibid|success)/i;
export const PREF = /prefer/i;

// Script que se inyecta antes de que cargue la página: registra los submit
// que llegan al final del burbujeo y frena la navegación real.
export const INIT = () => {
  window.__submits = [];
  // Timers cortos pendientes (latencia simulada del back mock). waitForSettle
  // espera a que no quede ninguno. setInterval no cuenta (autoplay de carrusel).
  window.__pendingTimers = 0;
  const _st = window.setTimeout, _ct = window.clearTimeout, live = new Set();
  window.setTimeout = function (fn, ms, ...a) {
    const short = !(Number(ms) > 3000);
    let id;
    id = _st.call(window, function () { if (live.delete(id)) window.__pendingTimers--; return typeof fn === "function" ? fn.apply(this, arguments) : undefined; }, ms, ...a);
    if (short) { live.add(id); window.__pendingTimers++; }
    return id;
  };
  window.clearTimeout = function (id) { if (live.delete(id)) window.__pendingTimers--; return _ct.call(window, id); };
  // Animaciones de entrada (catálogo v0.4): durante los primeros 1,5 s después de
  // cargar se anotan los elementos que tienen animaciones/transiciones corriendo.
  window.__entrance = [];
  const t0 = performance.now();
  const sample = () => {
    try {
      for (const a of document.getAnimations()) {
        const el = a.effect && a.effect.target;
        if (el && el.nodeType === 1) {
          if (!el.hasAttribute("data-vc-anim")) { el.setAttribute("data-vc-anim", "1"); window.__entrance.push(el); }
        }
      }
    } catch {}
    if (performance.now() - t0 < 1500) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  window.addEventListener("submit", (e) => {
    window.__submits.push({ prevented: e.defaultPrevented });
    e.preventDefault();
  });
};

export async function fieldsInfo(page) {
  return page.evaluate(() => {
    const form = [...document.querySelectorAll("form")].find((f) => f.offsetParent !== null) || null;
    if (!form) return null;
    const skip = new Set(["submit", "button", "reset", "hidden", "image"]);
    const els = [...form.querySelectorAll("input, textarea, select")].filter(
      (el) => !skip.has((el.type || "").toLowerCase()) && el.offsetParent !== null,
    );
    const labelOf = (el) => {
      const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
      const wrap = el.closest("label");
      return ((byFor || wrap)?.textContent || el.getAttribute("aria-label") || "").trim();
    };
    return els.map((el, i) => ({
      index: i,
      tag: el.tagName.toLowerCase(),
      type: (el.type || "").toLowerCase(),
      name: el.name || "",
      id: el.id || "",
      placeholder: el.getAttribute("placeholder") || "",
      label: labelOf(el),
      required_attr: el.required || el.getAttribute("aria-required") === "true",
    }));
  });
}

export function validValue(f) {
  if (f.type === "email" || /mail/i.test(f.name + f.id)) return "ana@example.com";
  if (f.type === "tel" || /tel|phone/i.test(f.name + f.id)) return "1155551234";
  if (f.type === "number") return "3";
  if (f.type === "date") return "2026-10-01";
  if (f.type === "url") return "https://example.com";
  return "Texto de prueba válido";
}

// Completa todos los campos con datos válidos salvo los índices en `empty`;
// `override` permite poner un valor puntual (p.ej. email inválido).
export async function fillForm(page, fields, { empty = [], override = {} } = {}) {
  for (const f of fields) {
    const loc = page.locator("form").filter({ visible: true }).first()
      .locator("input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=image]), textarea, select")
      .filter({ visible: true })
      .nth(f.index);
    if (f.tag === "select") {
      if (empty.includes(f.index)) continue;
      const opts = await loc.locator("option").evaluateAll((os) => os.map((o) => o.value).filter((v) => v !== ""));
      if (opts.length) await loc.selectOption(opts[0]);
    } else if (f.type === "checkbox" || f.type === "radio") {
      if (!empty.includes(f.index)) await loc.check({ force: true });
    } else {
      await loc.fill(empty.includes(f.index) ? "" : override[f.index] ?? validValue(f));
    }
  }
}

// Envía y decide si quedó BLOQUEADO o ACEPTADO.
// Aceptado = llegó un submit (o hubo navegación) y no apareció ninguna señal
// de error (texto nuevo de error, aria-invalid, alert con error).
// Espera a que el DOM deje de cambiar (render asíncrono, latencia simulada del
// back mock). Evidencia 01/10: el mock de la carta tarda 500 ms y Validation
// miraba a los 150 ms → FAIL falso de R4. Determinista: sin LLM, con tope.
// v0.3: además se espera a que no queden timers cortos pendientes (contados
// por INIT) ni texto "Cargando...": con mocks encadenados (300 + 500 ms) el
// DOM queda quieto más que la ventana de silencio (step_13, carta).
export async function waitForSettle(page, { quietMs = 300, maxMs = 5000 } = {}) {
  await page.evaluate(({ quietMs, maxMs }) => new Promise((done) => {
    const t0 = Date.now();
    let last = Date.now();
    const mo = new MutationObserver(() => { last = Date.now(); });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    const loading = () => /(cargando|loading)/i.test(document.body?.innerText || "");
    const tick = () => {
      const now = Date.now();
      if ((now - last >= quietMs && !loading() && !(window.__pendingTimers > 0)) || now - t0 >= maxMs) { mo.disconnect(); done(); }
      else setTimeout(tick, 50);
    };
    setTimeout(tick, 50);
  }), { quietMs, maxMs }).catch(() => {});
}

export async function submitAndJudge(page, ctx) {
  const before = await page.evaluate(() => document.body.innerText);
  ctx.dialogs.length = 0;
  let navigated = false;
  const onNav = () => (navigated = true);
  page.on("framenavigated", onNav);
  const btn = page.locator("form").filter({ visible: true }).first()
    .locator("button:not([type=button]):not([type=reset]), input[type=submit]").first();
  if (await btn.count()) await btn.click({ timeout: 3000 }).catch(() => {});
  else await page.locator("form").first().evaluate((f) => f.requestSubmit());
  await page.waitForTimeout(100);
  await waitForSettle(page);
  page.off("framenavigated", onNav);
  if (navigated) return { accepted: true, why: "hubo navegación (envío real)" };
  const state = await page.evaluate(() => ({
    submits: window.__submits.length,
    ariaInvalid: document.querySelectorAll('[aria-invalid="true"]').length,
    text: document.body.innerText,
  }));
  const added = state.text.replace(before, "");
  const newLines = state.text.split("\n").filter((l) => l.trim() && !before.includes(l.trim()));
  const errorText = newLines.find((l) => ERROR_TEXT.test(l)) || (ERROR_TEXT.test(added) && !before.includes(added.trim()) ? added.trim() : null);
  const dialogError = ctx.dialogs.find((m) => !SUCCESS_TEXT.test(m));
  if (!state.submits) return { accepted: false, why: "el navegador no disparó submit (validación HTML5)" };
  if (state.ariaInvalid) return { accepted: false, why: `aria-invalid en ${state.ariaInvalid} campo(s)` };
  if (errorText) return { accepted: false, why: `mensaje de error: "${errorText.slice(0, 80)}"` };
  if (dialogError) return { accepted: false, why: `alert: "${dialogError.slice(0, 80)}"` };
  return { accepted: true, why: "submit disparado sin señales de error" };
}

