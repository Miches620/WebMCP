// validation.mjs — Validation profile "web/app": lo que el usuario puede HACER en una pantalla.
// Sale de check_catalog.mjs (paso 2, 06/10) sin cambios de conducta.

import { ARROWS, BOARD_SNAP, HOVER_KINDS, ITEM_LEFTS, LABELED_NUMBERS, MARK_SECTION, NAV_RE, NUMBERS_IN, RENDER_AFTER, RENDER_STATIC, SEEN_SRC, SEEN_WORDS, SNAP, STYLE_SNAP, WIN_AT_LOAD, WIN_WORDS, diffCount, diffSample, fieldText, findControl, keysFrom, matches, norm, visibleTexts, words, INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle, bestControl } from "../validation/lib.mjs";

export default {
  id: "web/app",
  extends: "web",
  checks: {
    key_changes: {
      describe: "Al apretar una tecla (flechas, espacio, enter o una letra) algo cambia en la pantalla. Usar para 'se mueve con las flechas / con el teclado'.",
      params: { keys: "string[]?" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const keys = keysFrom(c.params.keys);
        const changed = [];
        for (const k of keys) {
          await reload();
          const a = await page.evaluate(SNAP, true);
          await page.keyboard.press(k);
          await page.waitForTimeout(150); await waitForSettle(page);
          const b = await page.evaluate(SNAP, true);
          if (diffCount(a, b)) changed.push(k);
        }
        r.result = changed.length ? "PASS" : "FAIL";
        r.detail = changed.length ? `cambia la pantalla: ${changed.join(", ")}` : `ninguna tecla cambia nada (${keys.join(", ")})`;
        break;
      } while (false); },
    },
    click_changes: {
      describe: "Al hacer clic en un control cuyo texto menciona X, algo cambia en la pantalla. Usar para 'botón que hace X' cuando no dice qué texto aparece.",
      params: { click: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const ctl = await findControl(page, c.params.click);
        if (!ctl) { r.detail = `ningún control visible menciona: ${c.params.click.join(" / ")}`; break; }
        const a = await page.evaluate(SNAP, true);
        if (await ctl.loc.isDisabled().catch(() => false)) { r.detail = `"${ctl.text.slice(0, 40)}" está deshabilitado`; break; }
        await ctl.loc.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(150); await waitForSettle(page);
        const b = await page.evaluate(SNAP, true);
        const d = diffCount(a, b);
        r.result = d ? "PASS" : "FAIL";
        r.detail = d ? `clic "${ctl.text.slice(0, 40)}" → ${d} cambios` : `clic "${ctl.text.slice(0, 40)}" → no cambia nada`;
        break;
      } while (false); },
    },
    // 12/10 (web/app por archivos, decisión de Miche): en la app no hay <form>; cada acción es un botón con sus
    // campos al lado. Completa los campos vacíos del mismo elemento padre que el botón, lo aprieta y mira que
    // la pantalla cambie. No lee el contrato de Gemma: Validation sigue siendo independiente.
    action_changes: {
      describe: "Usar una acción de la app: completa los campos que están junto al botón cuyo texto mejor coincide con X, lo aprieta y algo cambia en la pantalla. Usar para 'crear / agregar / editar / borrar / mover X'. click = palabras en orden de importancia (el verbo primero).",
      params: { click: "string[]" },
      run: async ({ page, c, r }) => { do {
        const ctl = await bestControl(page, c.params.click);
        if (!ctl) { r.detail = `ningún control visible coincide con: ${c.params.click.join(" / ")}`; break; }
        if (await ctl.loc.isDisabled().catch(() => false)) { r.detail = `"${ctl.text.slice(0, 40)}" está deshabilitado`; break; }
        const filled = await ctl.loc.evaluate((el) => {
          const box = el.parentElement || el; let n = 0;
          box.querySelectorAll("input, textarea").forEach((f) => {
            const t = (f.getAttribute("type") || "text").toLowerCase();
            if (["button", "submit", "checkbox", "radio", "hidden", "color", "range", "file"].includes(t)) return;
            // un campo de editar ya trae el texto actual: se cambia igual (si no, "Editar" no cambia nada)
            f.value = t === "number" ? String((Number(f.value) || 0) + 1) : t === "date" ? "2026-01-01" : (f.value ? f.value + " (editado)" : "Prueba de Validation"); n++;
            f.dispatchEvent(new Event("input", { bubbles: true })); f.dispatchEvent(new Event("change", { bubbles: true }));
          });
          return n;
        }).catch(() => 0);
        const a = await page.evaluate(SNAP, true);
        await ctl.loc.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(150); await waitForSettle(page);
        const b = await page.evaluate(SNAP, true);
        const d = diffCount(a, b);
        r.result = d ? "PASS" : "FAIL";
        r.detail = `${filled ? `${filled} campo(s) completado(s), ` : ""}clic "${ctl.text.slice(0, 40)}" → ${d ? `${d} cambios` : "no cambia nada"}`;
        break;
      } while (false); },
    },
    counter_on_action: {
      describe: "El número que está junto a la etiqueta X (movimientos, puntaje, tiempo) cambia después de actuar (teclas o un clic). Usar para 'contador de movimientos / puntaje'.",
      params: { label: "string[]", keys: "string[]?", click: "string[]?" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const ws = words(c.params.label);
        const before = await page.evaluate(LABELED_NUMBERS, ws);
        if (!before.length) { r.detail = `no hay ningún número junto a: ${c.params.label.join(" / ")}`; break; }
        let did = "";
        if (c.params.click?.length) {
          const ctl = await findControl(page, c.params.click);
          if (!ctl) { r.detail = `ningún control visible menciona: ${c.params.click.join(" / ")}`; break; }
          await ctl.loc.click({ timeout: 2000 }).catch(() => {}); did = `clic "${ctl.text.slice(0, 30)}"`;
        } else {
          const keys = keysFrom(c.params.keys);
          for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(120); }
          did = keys.join(", ");
        }
        await waitForSettle(page);
        const after = await page.evaluate(LABELED_NUMBERS, ws);
        const changed = after.join(" | ") !== before.join(" | ");
        r.result = changed ? "PASS" : "FAIL";
        r.detail = `${did}: "${before.join(" | ").slice(0, 60)}" → ${changed ? `"${after.join(" | ").slice(0, 60)}"` : "no cambia"}`;
        break;
      } while (false); },
    },
  },
};
