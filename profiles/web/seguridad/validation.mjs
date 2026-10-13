// profiles/web/seguridad/validation.mjs — chequeos del profile de tema web/seguridad (Node + Chromium).
//
// SEG-1 text_stays_text: usa la pantalla como una persona. Por cada campo de texto visible, recarga la
// página, escribe un texto con HTML en ese campo (y en los demás del mismo grupo), aprieta el botón del
// grupo y mira qué pasó:
//   FAIL           el HTML se convirtió en elementos de la página o se ejecutó código (onerror, alert);
//   PASS           el texto apareció en pantalla tal cual, como texto, y nada se ejecutó;
//   SIN_EVIDENCIA  ningún texto escrito volvió a aparecer en pantalla (no hay con qué juzgar).
// No sabe de ningún dominio ni lee el contrato del Specialist: solo campos, botones y la página.

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import profile from "./profile.mjs";

const MARK = "xss" + "chk";
const PAYLOAD = `<img src=x data-${MARK}="1" onerror="window.__${MARK}=1"><b data-${MARK}="1">texto</b>`;
const SHOWN = `<b data-${MARK}="1">texto</b>`;
const TEXT_TYPES = ["text", "search", "email", "url", "tel", ""];

export async function textStaysText(htmlPath, { max = 12 } = {}) {
  const browser = await chromium.launch();
  const out = { fields: 0, tried: [], executed: [], shown: [], errors: [] };
  try {
    const page = await browser.newPage();
    const dialogs = [];
    page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    page.on("pageerror", (e) => out.errors.push(e.message));
    await page.route(/^https?:/, (r) => r.abort());
    const url = pathToFileURL(htmlPath).href;
    const fieldsSel = (types) => `textarea, ${types.map((t) => (t ? `input[type="${t}"]` : "input:not([type])")).join(", ")}`;
    await page.goto(url, { waitUntil: "load" });
    const count = await page.evaluate((sel) => Array.prototype.filter.call(document.querySelectorAll(sel), (f) => f.getClientRects().length).length, fieldsSel(TEXT_TYPES));
    out.fields = count;
    for (let i = 0; i < Math.min(count, max); i++) {
      await page.goto(url, { waitUntil: "load" });
      const before = dialogs.length;
      const r = await page.evaluate(({ i, sel, payload, mark }) => {
        const vis = Array.prototype.filter.call(document.querySelectorAll(sel), (f) => f.getClientRects().length);
        const f = vis[i]; if (!f) return null;
        const box = f.closest("form") || f.parentElement;
        const btn = box && box.querySelector('button, input[type="submit"], input[type="button"], [data-accion]');
        if (!btn) return { skip: true };
        Array.prototype.forEach.call(box.querySelectorAll(sel), (x) => { if (x.getClientRects().length) { x.value = payload; x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true })); } });
        btn.setAttribute("data-" + mark + "-btn", "1");
        return { label: (f.placeholder || f.name || f.getAttribute("data-campo") || f.id || "campo " + (i + 1)).slice(0, 40), button: (btn.textContent || btn.value || "").trim().slice(0, 40) };
      }, { i, sel: fieldsSel(TEXT_TYPES), payload: PAYLOAD, mark: MARK });
      if (!r || r.skip) continue;
      out.tried.push(r.label);
      await page.click(`[data-${MARK}-btn]`, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
      const after = await page.evaluate(({ mark, shown }) => ({
        ran: !!window["__" + mark],
        elements: document.querySelectorAll(`[data-${mark}]:not(input):not(textarea)`).length,
        shown: (document.body.innerText || "").includes(shown),
      }), { mark: MARK, shown: SHOWN });
      const key = `"${r.label}" + "${r.button}"`;
      if ((after.ran || after.elements || dialogs.length > before) && out.executed.some((x) => x.startsWith(key))) continue;
      if (after.ran || after.elements || dialogs.length > before) out.executed.push(`"${r.label}" + "${r.button}"${after.ran || dialogs.length > before ? " (se ejecutó código)" : " (el texto se convirtió en HTML)"}`);
      else if (after.shown && !out.shown.includes(r.label)) out.shown.push(r.label);
    }
  } finally { await browser.close(); }
  return out;
}

/** Corre los criterios del profile sobre la app terminada. [{ id, text, verdict, detail, ... }] */
export async function runConcern(htmlPath) {
  const x = await textStaysText(htmlPath);
  const c = profile.criteria.find((k) => k.id === "SEG-1");
  const verdict = x.executed.length ? "FAIL" : x.shown.length ? "PASS" : "SIN_EVIDENCIA";
  const detail = x.executed.length ? `el texto del usuario se ejecuta como HTML en: ${x.executed.join("; ")}`
    : x.shown.length ? `${x.shown.length} campo(s) muestran el HTML como texto (${x.shown.slice(0, 4).join(", ")})`
    : x.tried.length ? `se probaron ${x.tried.length} campo(s) pero ningún texto volvió a aparecer en pantalla` : `no hay campos de texto con botón (${x.fields} campos)`;
  return [{ id: c.id, text: c.text, verdict, detail, check: "text_stays_text", tried: x.tried.length }];
}
