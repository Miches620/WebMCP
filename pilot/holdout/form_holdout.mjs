// holdout/form_holdout.mjs — Validation del piloto "Formulario de contacto".
//
// HOLDOUT: el Specialist nunca ve este archivo ni su contenido. Es la vara
// fija, escrita a mano y aprobada por Miche (30/09), contra la que se mide
// lo que produce Gemma. PASS/FAIL lo decide este código, no un LLM.
//
// Origen de cada criterio:
//   Miche (entrevista Project20): "El formulario de contacto debe tener solo
//     campos obligatorios y a lo sumo un unico campo de preferencias del cliente"
//   Feature 2: "Formulario de contacto con campos obligatorios y opcionalmente
//     un campo para preferencias"
//   Decisión 30/09: si falta el campo de preferencias → FAIL (C4).
//
// "Obligatorio" se mide por COMPORTAMIENTO, no por el atributo `required`:
// se completan todos los campos con datos válidos, se vacía uno y se envía.
// Si el envío queda bloqueado, ese campo es obligatorio. Así vale igual para
// validación HTML5 que para validación en JavaScript.

import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const SPEC_VERSION = "form_holdout v0.1";

// Textos fuente del holdout: run_pilot.mjs verifica que ninguno llegue al Specialist.
export const HOLDOUT_TEXTS = [
  "El formulario de contacto debe tener campos obligatorios solo.",
  "solo campos obligatorios y a lo sumo un unico campo de preferencias",
];

export const CRITERIA = {
  C1: "La página carga sin errores de JavaScript",
  C2: "Hay un formulario visible",
  C3: "Todos los campos son obligatorios salvo, a lo sumo, uno",
  C4: "Existe exactamente un campo opcional y es el de preferencias",
  C5: "Enviar el formulario vacío queda bloqueado",
  C6: "Un email mal formado queda bloqueado (si hay campo de email)",
  C7: "Con datos válidos el envío pasa",
};

const ERROR_TEXT = /(obligatori|requerid|inv[aá]lid|invalid|error|complet[aá]|debe[s]? (ingresar|completar)|falta)/i;
const SUCCESS_TEXT = /(gracias|enviad|[eé]xito|recibid|success)/i;
const PREF = /prefer/i;

// Script que se inyecta antes de que cargue la página: registra los submit
// que llegan al final del burbujeo y frena la navegación real.
const INIT = () => {
  window.__submits = [];
  window.addEventListener("submit", (e) => {
    window.__submits.push({ prevented: e.defaultPrevented });
    e.preventDefault();
  });
};

async function fieldsInfo(page) {
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

function validValue(f) {
  if (f.type === "email" || /mail/i.test(f.name + f.id)) return "ana@example.com";
  if (f.type === "tel" || /tel|phone/i.test(f.name + f.id)) return "1155551234";
  if (f.type === "number") return "3";
  if (f.type === "date") return "2026-10-01";
  if (f.type === "url") return "https://example.com";
  return "Texto de prueba válido";
}

// Completa todos los campos con datos válidos salvo los índices en `empty`;
// `override` permite poner un valor puntual (p.ej. email inválido).
async function fillForm(page, fields, { empty = [], override = {} } = {}) {
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
async function submitAndJudge(page, ctx) {
  const before = await page.evaluate(() => document.body.innerText);
  ctx.dialogs.length = 0;
  let navigated = false;
  const onNav = () => (navigated = true);
  page.on("framenavigated", onNav);
  const btn = page.locator("form").filter({ visible: true }).first()
    .locator("button:not([type=button]):not([type=reset]), input[type=submit]").first();
  if (await btn.count()) await btn.click({ timeout: 3000 }).catch(() => {});
  else await page.locator("form").first().evaluate((f) => f.requestSubmit());
  await page.waitForTimeout(400);
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

/**
 * @param {string} htmlPath archivo a validar
 * @returns evidence (objeto serializable)
 */
export async function validateForm(htmlPath) {
  const abs = resolve(htmlPath);
  const html = readFileSync(abs, "utf8");
  const url = pathToFileURL(abs).href;
  const checks = Object.fromEntries(Object.entries(CRITERIA).map(([id, criterion]) => [id, { id, criterion, result: "NOT_RUN", detail: "" }]));
  const set = (id, ok, detail) => Object.assign(checks[id], { result: ok === null ? "N/A" : ok ? "PASS" : "FAIL", detail });
  const info = [];

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ctx = { dialogs: [], pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (e) => ctx.pageErrors.push(e.message));
  page.on("console", (m) => m.type() === "error" && ctx.consoleErrors.push(m.text()));
  page.on("dialog", (d) => { ctx.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(INIT);
  // Nada sale a la red: el artefacto es local y el envío se intercepta.
  await page.route(/^https?:/, (r) => r.abort());
  const reload = async () => { await page.goto(url, { waitUntil: "load" }); await page.waitForTimeout(150); };

  let fields = null;
  try {
    await reload();
    set("C1", ctx.pageErrors.length === 0, ctx.pageErrors.length ? ctx.pageErrors.join(" | ").slice(0, 300) : "sin excepciones");
    if (ctx.consoleErrors.length) info.push(`console.error (no cuenta para C1): ${ctx.consoleErrors.slice(0, 3).join(" | ").slice(0, 300)}`);

    fields = await fieldsInfo(page);
    set("C2", !!fields && fields.length > 0, fields ? `${fields.length} campo(s): ${fields.map((f) => f.name || f.id || f.type).join(", ")}` : "no hay <form> visible");
    if (!fields || !fields.length) throw new Error("sin formulario");
    const unlabeled = fields.filter((f) => !f.label);
    if (unlabeled.length) info.push(`campos sin label (no pedido, no falla): ${unlabeled.map((f) => f.name || f.id || f.type).join(", ")}`);

    // C7 primero: sin un envío válido que pase, medir obligatoriedad no tiene sentido.
    await fillForm(page, fields);
    const ok = await submitAndJudge(page, ctx);
    set("C7", ok.accepted, ok.why);

    await reload();
    const emptyRes = await (async () => { await fillForm(page, fields, { empty: fields.map((f) => f.index) }); return submitAndJudge(page, ctx); })();
    set("C5", !emptyRes.accepted, emptyRes.why);

    const email = fields.find((f) => f.type === "email" || /mail/i.test(f.name + f.id + f.label));
    if (!email) set("C6", null, "no hay campo de email: no aplica");
    else {
      await reload();
      await fillForm(page, fields, { override: { [email.index]: "no-es-un-email" } });
      const r = await submitAndJudge(page, ctx);
      set("C6", !r.accepted, r.why);
    }

    if (checks.C7.result === "PASS") {
      const optional = [];
      for (const f of fields) {
        await reload();
        await fillForm(page, fields, { empty: [f.index] });
        const r = await submitAndJudge(page, ctx);
        f.obligatorio = !r.accepted;
        f.evidencia = r.why;
        if (r.accepted) optional.push(f);
      }
      set("C3", optional.length <= 1, `opcionales: ${optional.length ? optional.map((f) => f.name || f.id || f.type).join(", ") : "ninguno"}`);
      const pref = fields.filter((f) => PREF.test(`${f.name} ${f.id} ${f.placeholder} ${f.label}`));
      let c4;
      if (!pref.length) c4 = [false, "no hay campo de preferencias"];
      else if (optional.length !== 1) c4 = [false, `hay ${optional.length} campo(s) opcional(es); se esperaba exactamente uno (preferencias)`];
      else if (!pref.includes(optional[0])) c4 = [false, `el opcional es "${optional[0].name || optional[0].id}", no el de preferencias`];
      else c4 = [true, `preferencias opcional: "${optional[0].name || optional[0].id}"`];
      set("C4", c4[0], c4[1]);
    } else {
      checks.C3.detail = checks.C4.detail = "no corre: un envío con datos válidos no pasa (C7)";
    }
  } catch (e) {
    if (e.message !== "sin formulario") info.push(`error del validador: ${e.message}`);
  } finally {
    await browser.close();
  }

  const list = Object.values(checks);
  const failed = list.filter((c) => c.result === "FAIL" || c.result === "NOT_RUN");
  return {
    type: "EVIDENCE",
    spec_version: SPEC_VERSION,
    artifact: htmlPath,
    artifact_sha256: createHash("sha256").update(html).digest("hex"),
    timestamp: new Date().toISOString(),
    validation_result: failed.length ? "FAIL" : "PASS",
    failed: failed.map((c) => c.id),
    checks: list,
    fields,
    info,
  };
}

// Uso directo: node pilot/holdout/form_holdout.mjs archivo.html
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const ev = await validateForm(process.argv[2]);
  for (const c of ev.checks) console.log(`${c.result.padEnd(7)} ${c.id} ${c.criterion} — ${c.detail}`);
  ev.info.forEach((i) => console.log(`INFO    ${i}`));
  console.log(`\n${ev.validation_result}`);
}
