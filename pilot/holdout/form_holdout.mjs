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

import { PREF, INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle } from "../../validation/form_runtime.mjs";

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
  const reload = async () => { await page.goto(url, { waitUntil: "load" }); await waitForSettle(page); };

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
