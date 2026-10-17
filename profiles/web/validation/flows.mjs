// flows.mjs — Validation de FLUJO (v0.1, 16/10 noche). "La vara" de la visión unificada.
//
// Por qué: la app de Gemma sola con "crear" ROTO y la misma app ARREGLADA dieron IGUAL en Validation (6 PASS):
// action_changes veía "clic en Agregar → se abrió el modal → 1 cambio" y lo daba por bueno. Un juez que no
// distingue una app que crea de una que no, no sirve para comparar ni para guiar correcciones.
//
// Estos chequeos usan la app COMO UNA PERSONA y miran el RESULTADO, sin saber cómo está programada (sin
// data-accion, sin contrato, sin harness): sirven igual para lo que arma el pipeline y para una app libre.
//   flow_create   clic en el control → completa los campos que estén al lado o que aparezcan (también en un modal)
//                 con un texto único → confirma → ese texto TIENE QUE VERSE (y, si se pide, en el lugar "donde").
//   flow_edit     sobre un elemento que ya está → su control de editar → escribe un texto único → confirma → se ve.
//   flow_delete   sobre un elemento → su control de borrar (acepta la confirmación) → su texto YA NO se ve.
//   flow_move     un elemento de un contenedor (columna) → arrastrar a otro, o su control de mover → queda en OTRO.
//   flow_persist  crea → recarga la página (sin borrar lo guardado) → lo creado SIGUE.
// Si la app arranca sin elementos, editar / borrar / mover crean uno antes (con params.crear) para tener con qué.
// Cada chequeo arranca con el almacenamiento del navegador vacío (localStorage), salvo lo que el flujo mismo guarda.
// Los errores de JS que aparecen durante el flujo van al detalle (con archivo y línea): son la pista para corregir.

import { bestControl, norm, words } from "./lib.mjs";
import { waitForSettle } from "./form_runtime.mjs";

export const FLOWS_VERSION = "flows v0.1";
const CONFIRM = ["guardar", "crear", "agregar", "anadir", "aceptar", "confirmar", "ok", "listo", "save", "submit", "si", "eliminar", "borrar", "actualizar", "mover"];
// Un ELEMENTO (tarjeta, ítem) = algo que se repite y que el usuario maneja: una clase cuyo nombre ES card / tarjeta /
// item / task / tarea / nota (o termina así: kanban-card, task_item), un <li> o algo arrastrable con texto.
// "card-count", "card-body", "cards-container", "tarjeta-actions" NO son elementos (v0.1, Gemma sola: "(0)" salía como tarjeta).
export const ITEM_CLASS = /(^|[-_])(card|tarjeta|item|task|tarea|nota|note|ticket)$/i;

// ---------- en la página ----------
/** Marca los campos visibles y escribibles con data-flow-f (n) y devuelve sus números. */
export const MARK_FIELDS = () => {
  const vis = (e) => !!e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
  const out = [];
  document.querySelectorAll("input, textarea, select").forEach((f, i) => {
    const t = (f.getAttribute("type") || "text").toLowerCase();
    if (["button", "submit", "checkbox", "radio", "hidden", "color", "range", "file", "reset", "image"].includes(t) || f.disabled || f.readOnly || !vis(f)) return;
    f.setAttribute("data-flow-f", String(i));
    out.push(String(i));
  });
  return out;
};
/** Escribe en los campos pedidos (por número) un texto único; selects: la 2ª opción si hay.
 *  campos (planilla v0.1): {titulo|descripcion|prioridad|…: valor} → al campo cuyo nombre / etiqueta / placeholder
 *  lo nombra, o (select) que tiene una opción con ese valor. keep (editar): los demás campos NO se tocan. */
const FILL = ([ids, token, replace, campos, keep]) => {
  let n = 0;
  const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const SYN = { titulo: ["titulo", "title", "nombre", "name"], descripcion: ["desc", "detalle", "nota"], prioridad: ["prior", "nivel", "urgen"] };
  const done = new Set();
  if (campos) {
    const fs = ids.map((id) => document.querySelector(`[data-flow-f="${id}"]`)).filter(Boolean);
    const keyOf = (f) => nrm([f.name, f.id, f.placeholder, f.getAttribute("aria-label"), f.labels && [...f.labels].map((l) => l.textContent).join(" "), f.closest("label")?.textContent].filter(Boolean).join(" "));
    for (const [k, v] of Object.entries(campos)) {
      const syn = SYN[nrm(k)] || [nrm(k)];
      let f = fs.find((x) => !done.has(x) && syn.some((w) => keyOf(x).includes(w)));
      if (!f && nrm(k) === "titulo") f = fs.find((x) => !done.has(x) && x.tagName === "INPUT");
      if (!f) f = fs.find((x) => !done.has(x) && x.tagName === "SELECT" && [...x.options].some((o) => nrm(o.text).includes(nrm(v)) || nrm(o.value) === nrm(v)));
      if (!f) continue;
      if (f.tagName === "SELECT") { const i = [...f.options].findIndex((o) => nrm(o.text).includes(nrm(v)) || nrm(o.value) === nrm(v)); if (i >= 0) f.selectedIndex = i; }
      else f.value = String(v);
      f.dispatchEvent(new Event("input", { bubbles: true })); f.dispatchEvent(new Event("change", { bubbles: true }));
      done.add(f); n++;
    }
  }
  for (const id of ids) {
    const f = document.querySelector(`[data-flow-f="${id}"]`);
    if (!f || done.has(f)) continue;
    if (keep) continue;
    const t = (f.getAttribute("type") || "text").toLowerCase();
    if (f.tagName === "SELECT") { if (f.options.length > 1) f.selectedIndex = Math.min(1, f.options.length - 1); }
    else if (t === "number") f.value = String((Number(f.value) || 0) + 7);
    else if (t === "date") f.value = "2026-01-01";
    else if (t === "email") f.value = "qa@ejemplo.com";
    else f.value = replace || !f.value ? `${token}${n ? " " + n : ""}` : f.value;
    f.dispatchEvent(new Event("input", { bubbles: true })); f.dispatchEvent(new Event("change", { bubbles: true }));
    n++;
  }
  return n;
};
/** ¿Se ve el texto? Y, si viene "donde", ¿está adentro de un contenedor cuyo título lo nombra? */
export const SEEN = ([token, donde]) => {
  const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const vis = (e) => !!e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
  const hits = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.includes(token) && n.parentElement && vis(n.parentElement) && !n.parentElement.closest("input, textarea, select, script, style")) hits.push(n.parentElement);
  if (!hits.length) return { seen: false };
  if (!donde) return { seen: true };
  const heading = (a) => [...a.querySelectorAll("h1, h2, h3, h4, h5, h6, [class*=title], [class*=titulo], [class*=header]")].slice(0, 3).map((h) => nrm(h.textContent)).join(" | ");
  for (const h of hits) for (let a = h.parentElement; a && a !== document.body; a = a.parentElement) {
    const t = heading(a);
    if (t && t.includes(nrm(donde)) && !t.includes(token.toLowerCase())) return { seen: true, donde: true };
  }
  return { seen: true, donde: false };
};
/** El contenedor (columna) de un elemento: el ancestro con título cuyo padre tiene ≥2 hermanos con título. */
const CONTAINER_OF = ([sel, itemSrc]) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  // el título del contenedor NO puede ser el de una tarjeta de adentro (v0.1: la columna se llamaba como su 1ª tarjeta)
  const re = new RegExp(itemSrc, "i");
  const inItem = (h) => { for (let x = h; x && x !== document.body; x = x.parentElement) if (x.tagName === "LI" || [...x.classList].some((k) => re.test(k))) return true; return false; };
  const titled = (a) => [...a.querySelectorAll("h1, h2, h3, h4, h5, h6, [class*=title], [class*=titulo], [class*=header]")].find((h) => !inItem(h) && (h.textContent || "").trim());
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const p = a.parentElement;
    if (!p || !titled(a)) continue;
    const sibs = [...p.children].filter((x) => x !== a && x.tagName === a.tagName && titled(x));
    if (sibs.length) {
      const name = (titled(a).textContent || "").trim().split("\n")[0].trim().slice(0, 40);
      sibs.forEach((s, i) => s.setAttribute("data-flow-other", String(i)));
      return { name, others: sibs.map((s) => (titled(s).textContent || "").trim().split("\n")[0].trim().slice(0, 40)) };
    }
  }
  return null;
};

// ---------- Playwright ----------
export const settle = async (page) => { await page.waitForTimeout(150); await waitForSettle(page); };
const tokenOf = () => `Prueba QA ${Math.floor(1000 + Math.random() * 8999)}`;
export const errsSince = (ctx, n) => ctx.pageErrors.slice(n).map((m, i) => {
  const st = ctx.pageStacks[n + i]?.stack || "";
  const at = (st.match(/\/([\w.-]+\.(?:js|html)):(\d+)/) || []).slice(1).join(":");
  return `${m}${at ? ` (${at})` : ""}`;
});

export async function freshStart(page, reload) {
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await reload();
}

/** Botón para confirmar dentro del contenedor de los campos nuevos (modal/form), o el submit, o Enter. */
async function confirm(page, fieldIds) {
  const box = await page.evaluateHandle((ids) => {
    const fs = ids.map((id) => document.querySelector(`[data-flow-f="${id}"]`)).filter(Boolean);
    if (!fs.length) return null;
    let a = fs[0];
    while (a && !fs.every((f) => a.contains(f))) a = a.parentElement;
    // subir hasta que haya un botón adentro (el de guardar suele estar al lado de los campos)
    while (a && a !== document.body && !a.querySelector("button, input[type=submit], [role=button]")) a = a.parentElement;
    return a;
  }, fieldIds);
  const el = box.asElement();
  if (el) {
    const cand = await page.evaluate(([root, conf]) => {
      const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const vis = (e) => !!e.getClientRects().length;
      const all = [...root.querySelectorAll("button, input[type=submit], [role=button]")].filter(vis);
      const sc = (b) => { const t = nrm(b.innerText || b.value || b.getAttribute("aria-label") || ""); if (/cancel|cerrar|close|volver|×|✕/.test(t)) return -1; return (b.type === "submit" ? 5 : 0) + (conf.some((w) => t.includes(w)) ? 3 : 0) + 1; };
      const best = all.map((b) => [b, sc(b)]).filter(([, s]) => s > 0).sort((x, y) => y[1] - x[1])[0];
      if (!best) return null;
      best[0].setAttribute("data-flow-ok", "1");
      return (best[0].innerText || best[0].value || "").trim().slice(0, 30);
    }, [el, CONFIRM]);
    if (cand !== null) { await page.locator("[data-flow-ok]").first().click({ timeout: 2000 }).catch(() => {}); await settle(page); return `confirmó con "${cand}"`; }
  }
  await page.locator(`[data-flow-f="${fieldIds.at(-1)}"]`).press("Enter").catch(() => {});
  await settle(page);
  return "confirmó con Enter";
}

/** Usa un control: completa campos al lado (antes) o los que aparecen (después), y confirma. */
export async function useControl(page, loc, token, { replace = false, campos = null, keep = false } = {}) {
  const before = await page.evaluate(MARK_FIELDS);
  // campos al lado del control (mismo padre, o el abuelo si el padre solo tiene el botón)
  const near = await loc.evaluate((b) => {
    let box = b.parentElement;
    if (box && box.querySelectorAll("input, textarea, select").length === 0 && box.parentElement) box = box.parentElement;
    return box ? [...box.querySelectorAll("[data-flow-f]")].map((f) => f.getAttribute("data-flow-f")) : [];
  }).catch(() => []);
  const steps = [];
  if (near.length) {
    const n = await page.evaluate(FILL, [near, token, replace, campos, keep]);
    steps.push(`${n} campo(s) al lado`);
    await loc.click({ timeout: 2000 }).catch(() => {});
    await settle(page);
    return steps;
  }
  await loc.click({ timeout: 2000 }).catch(() => {});
  await settle(page);
  const after = await page.evaluate(MARK_FIELDS);
  const fresh = after.filter((id) => !before.includes(id));
  if (!fresh.length) { steps.push("no apareció ningún campo"); return steps; }
  const n = await page.evaluate(FILL, [fresh, token, true, campos, keep]);
  steps.push(`${n} campo(s) que aparecieron`);
  steps.push(await confirm(page, fresh));
  return steps;
}

/** Los elementos (tarjetas, ítems) visibles, marcados con data-flow-i. */
async function itemsWithControl(page, ws) {
  const n = await page.evaluate((src) => {
    const re = new RegExp(src, "i");
    const vis = (e) => !!e.getClientRects().length;
    const letters = (e) => ((e.innerText || "").match(/[a-záéíóúñ]/gi) || []).length;
    document.querySelectorAll("[data-flow-i]").forEach((e) => e.removeAttribute("data-flow-i"));
    const isItem = (e) => e.tagName === "LI" || [...e.classList].some((k) => re.test(k)) || (e.getAttribute("draggable") === "true" && letters(e) >= 3);
    const all = [...document.querySelectorAll("body *")].filter((e) => !e.closest("button, select, input, textarea, label, script, style") && isItem(e) && vis(e) && letters(e) >= 3);
    // de los anidados, el de afuera (la tarjeta, no un pedazo de ella)
    const roots = all.filter((e) => !all.some((o) => o !== e && o.contains(e)));
    roots.forEach((e, i) => e.setAttribute("data-flow-i", String(i)));
    return roots.length;
  }, ITEM_CLASS.source);
  const out = [];
  for (let i = 0; i < n && out.length < 5; i++) {
    const item = page.locator(`[data-flow-i="${i}"]`);
    await item.hover({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(80);
    const ctl = ws ? await bestControlIn(page, item, ws) : null;
    const title = await item.evaluate((e) => (e.querySelector("h1,h2,h3,h4,h5,h6,strong,b,[class*=title],[class*=titulo]")?.textContent || e.innerText || "").trim().split("\n")[0].slice(0, 60)).catch(() => "");
    out.push({ i, item, ctl, title });
  }
  return out;
}
export async function bestControlIn(page, item, ws) {
  const loc = item.locator("button, a, [role=button], input[type=button]");
  const n = await loc.count();
  let best = null;
  const { controlScore } = await import("./lib.mjs");
  for (let k = 0; k < n; k++) {
    const el = loc.nth(k);
    const t = [await el.innerText().catch(() => ""), await el.getAttribute("title"), await el.getAttribute("aria-label"), await el.getAttribute("class"), String((await el.getAttribute("data-accion")) || "").replace(/([a-z])([A-Z])/g, "$1 $2")].filter(Boolean).join(" ");
    // íconos solos: ✏️ = editar, 🗑️/❌ = borrar
    const icon = /✏|🖉|✎/.test(t) ? " editar" : /🗑|❌|✖|✕/.test(t) ? " borrar" : "";
    // el VERBO (la primera palabra) tiene que estar: "Editar tarjeta" no sirve para "agregar tarjeta"
    if (!controlScore(t + icon, ws.slice(0, 1))) continue;
    const sc = controlScore(t + icon, ws);
    if (sc > 0 && (!best || sc > best.score)) best = { loc: el, text: (await el.innerText().catch(() => "")).trim(), score: sc };
  }
  return best;
}

/** Como bestControl, pero el verbo (la primera palabra) tiene que estar en el texto del control. */
export async function verbControl(page, ws) {
  const ctl = await bestControl(page, ws);
  if (!ctl) return null;
  const { controlScore } = await import("./lib.mjs");
  const t = [ctl.text, await ctl.loc.getAttribute("title"), await ctl.loc.getAttribute("aria-label"), String((await ctl.loc.getAttribute("data-accion")) || "").replace(/([a-z])([A-Z])/g, "$1 $2")].filter(Boolean).join(" ");
  return controlScore(t, ws.slice(0, 1)) ? ctl : null;
}

async function ensureItem(page, c, ctx) {
  if (!c.params.crear?.length) return null;
  const ctl = await verbControl(page, c.params.crear);
  if (!ctl) return null;
  const token = tokenOf();
  await useControl(page, ctl.loc, token);
  const s = await page.evaluate(SEEN, [token, null]);
  return s.seen ? token : null;
}

// ---------- los chequeos ----------
export const FLOW_CHECKS = {
  flow_create: {
    describe: "FLUJO crear: aprieta el control X, completa con un texto único los campos que estén al lado o que aparezcan (también en un modal), confirma, y ese texto TIENE QUE VERSE. Con 'donde', dentro del lugar que lleva ese título (p.ej. una columna). Usar para 'crear / agregar / añadir X'.",
    params: { abrir: "string[]", donde: "string?" },
    run: async ({ page, c, r, ctx, reload }) => {
      await freshStart(page, reload);
      const e0 = ctx.pageErrors.length;
      const ctl = await verbControl(page, c.params.abrir);
      if (!ctl) { r.detail = `ningún control visible dice "${c.params.abrir[0]}" (o un sinónimo): ${c.params.abrir.join(" / ")}`; return; }
      const token = tokenOf();
      const steps = await useControl(page, ctl.loc, token);
      const s = await page.evaluate(SEEN, [token, c.params.donde || null]);
      const errs = errsSince(ctx, e0);
      r.result = s.seen && s.donde !== false ? "PASS" : "FAIL";
      r.detail = `clic "${ctl.text.slice(0, 30)}" · ${steps.join(" · ")} → ${s.seen ? `"${token}" se ve${s.donde === false ? `, pero no adentro de "${c.params.donde}"` : c.params.donde ? ` en "${c.params.donde}"` : ""}` : `"${token}" NO aparece`}${errs.length ? ` · error de JS: ${errs[0].slice(0, 160)}` : ""}`;
      if (errs.length) r.errors = errs;
    },
  },
  flow_edit: {
    describe: "FLUJO editar: sobre un elemento que ya está, aprieta su control X, escribe un texto único (en los campos al lado o en los que aparezcan) y confirma: ese texto TIENE QUE VERSE. Con 'crear', si no hay elementos crea uno antes. Usar para 'editar / modificar X'.",
    params: { abrir: "string[]", crear: "string[]?" },
    run: async ({ page, c, r, ctx, reload }) => {
      await freshStart(page, reload);
      const e0 = ctx.pageErrors.length;
      let items = (await itemsWithControl(page, c.params.abrir)).filter((x) => x.ctl);
      let pre = "";
      if (!items.length && (await ensureItem(page, c, ctx))) { pre = "creó uno antes · "; items = (await itemsWithControl(page, c.params.abrir)).filter((x) => x.ctl); }
      if (!items.length) { r.detail = `${pre}ningún elemento tiene un control que coincida con: ${c.params.abrir.join(" / ")}`; return; }
      const it = items[0];
      const token = tokenOf();
      const steps = await useControl(page, it.ctl.loc, token, { replace: true });
      const s = await page.evaluate(SEEN, [token, null]);
      const errs = errsSince(ctx, e0);
      r.result = s.seen ? "PASS" : "FAIL";
      r.detail = `${pre}"${it.title}" · clic "${it.ctl.text.slice(0, 20)}" · ${steps.join(" · ")} → ${s.seen ? `"${token}" se ve` : `"${token}" NO aparece`}${errs.length ? ` · error de JS: ${errs[0].slice(0, 160)}` : ""}`;
      if (errs.length) r.errors = errs;
    },
  },
  flow_delete: {
    describe: "FLUJO borrar: sobre un elemento, aprieta su control X (acepta la confirmación, también en un modal) y su texto YA NO tiene que verse. Con 'crear', si no hay elementos crea uno antes. Usar para 'borrar / eliminar X'.",
    params: { abrir: "string[]", crear: "string[]?" },
    run: async ({ page, c, r, ctx, reload }) => {
      await freshStart(page, reload);
      const e0 = ctx.pageErrors.length;
      let items = (await itemsWithControl(page, c.params.abrir)).filter((x) => x.ctl && x.title);
      let pre = "";
      if (!items.length && (await ensureItem(page, c, ctx))) { pre = "creó uno antes · "; items = (await itemsWithControl(page, c.params.abrir)).filter((x) => x.ctl && x.title); }
      if (!items.length) { r.detail = `${pre}ningún elemento tiene un control que coincida con: ${c.params.abrir.join(" / ")}`; return; }
      const it = items[0];
      const count = () => page.evaluate((t) => { const vis = (e) => !!e.getClientRects().length; let k = 0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.includes(t) && n.parentElement && vis(n.parentElement)) k++; return k; }, it.title);
      const n0 = await count();
      const before = await page.evaluate(MARK_FIELDS);
      await it.ctl.loc.click({ timeout: 2000 }).catch(() => {});
      await settle(page);
      // confirmación en un modal propio (el confirm() del navegador ya lo acepta el framework)
      const modalBtn = await page.evaluate((conf) => {
        const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const b = [...document.querySelectorAll("button, [role=button]")].filter((x) => x.getClientRects().length && !x.closest("[data-flow-i]")).find((x) => /^(si|sí|confirmar|eliminar|borrar|aceptar|ok)\b/.test(nrm(x.innerText).replace(/^[^a-z]+/, "")));
        if (!b) return null; b.setAttribute("data-flow-yes", "1"); return b.innerText.trim().slice(0, 20);
      }, CONFIRM);
      if (modalBtn) { await page.locator("[data-flow-yes]").first().click({ timeout: 2000 }).catch(() => {}); await settle(page); }
      const n1 = await count();
      const errs = errsSince(ctx, e0);
      r.result = n1 < n0 ? "PASS" : "FAIL";
      r.detail = `${pre}"${it.title}" · clic "${it.ctl.text.slice(0, 20)}"${modalBtn ? ` · confirmó "${modalBtn}"` : ""}${ctx.dialogs.length ? " · aceptó el aviso del navegador" : ""} → ${n1 < n0 ? "ya no se ve" : "SIGUE ahí"}${errs.length ? ` · error de JS: ${errs[0].slice(0, 160)}` : ""}`;
      if (errs.length) r.errors = errs;
    },
  },
  flow_move: {
    describe: "FLUJO mover: un elemento de un contenedor con título (p.ej. una columna) se arrastra a otro contenedor, o se usa su control X (eligiendo otro destino), y TIENE QUE quedar en el otro. Usar para 'mover / arrastrar X entre columnas / listas'.",
    params: { abrir: "string[]?", crear: "string[]?" },
    run: async ({ page, c, r, ctx, reload }) => {
      await freshStart(page, reload);
      const e0 = ctx.pageErrors.length;
      let items = (await itemsWithControl(page, c.params.abrir || null)).filter((x) => x.title);
      let pre = "";
      if (!items.length && (await ensureItem(page, c, ctx))) { pre = "creó uno antes · "; items = (await itemsWithControl(page, c.params.abrir || null)).filter((x) => x.title); }
      let tried = [];
      for (const it of items.slice(0, 3)) {
        const where = await page.evaluate(CONTAINER_OF, [`[data-flow-i="${it.i}"]`, ITEM_CLASS.source]);
        if (!where) continue;
        const now = async () => { const w = await page.evaluate((t) => { const vis = (e) => !!e.getClientRects().length; const wk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = wk.nextNode(); n; n = wk.nextNode()) if (n.nodeValue.includes(t) && n.parentElement && vis(n.parentElement) && !n.parentElement.closest("select, option")) { n.parentElement.setAttribute("data-flow-at", "1"); return true; } return false; }, it.title); if (!w) return null; const c2 = await page.evaluate(CONTAINER_OF, ["[data-flow-at]", ITEM_CLASS.source]); await page.evaluate(() => document.querySelectorAll("[data-flow-at]").forEach((e) => e.removeAttribute("data-flow-at"))); return c2?.name || null; };
        // 1) arrastrar al primer otro contenedor
        await page.locator(`[data-flow-i="${it.i}"]`).dragTo(page.locator('[data-flow-other="0"]').first(), { timeout: 3000 }).catch(() => {});
        await settle(page);
        let n1 = await now();
        if (n1 && n1 !== where.name) {
          const errs = errsSince(ctx, e0);
          r.result = "PASS"; r.detail = `${pre}"${it.title}" arrastrada de "${where.name}" → quedó en "${n1}"${errs.length ? ` · error de JS: ${errs[0].slice(0, 160)}` : ""}`; return;
        }
        tried.push(`arrastrar "${it.title}" de "${where.name}" no la movió`);
        // 2) su control de mover (con un select de destino al lado, si hay)
        if (it.ctl) {
          await page.locator(`[data-flow-i="${it.i}"]`).hover().catch(() => {});
          const sel = await it.ctl.loc.evaluate((b) => { const s = (b.parentElement || b).querySelector("select"); if (!s) return null; const cur = [...s.options].findIndex((o) => o.selected); s.selectedIndex = (cur + 1) % s.options.length; s.dispatchEvent(new Event("change", { bubbles: true })); return s.options[s.selectedIndex]?.text || ""; }).catch(() => null);
          await it.ctl.loc.click({ timeout: 2000 }).catch(() => {});
          await settle(page);
          n1 = await now();
          if (n1 && n1 !== where.name) { r.result = "PASS"; r.detail = `${pre}"${it.title}" con "${it.ctl.text.slice(0, 20)}"${sel ? ` (destino "${sel}")` : ""}: de "${where.name}" → "${n1}"`; return; }
          tried.push(`el control "${it.ctl.text.slice(0, 20)}" no la movió`);
        }
        break;
      }
      const errs = errsSince(ctx, e0);
      r.detail = `${pre}${tried.length ? tried.join(" · ") : "no hay elementos dentro de contenedores con título (columnas)"}${errs.length ? ` · error de JS: ${errs[0].slice(0, 160)}` : ""}`;
    },
  },
  flow_persist: {
    describe: "FLUJO guardar: crea un elemento con el control X (texto único), RECARGA la página y lo creado TIENE QUE seguir. Usar para 'guardar / persistir / localStorage / que no se pierda al recargar'.",
    params: { abrir: "string[]" },
    run: async ({ page, c, r, ctx, reload }) => {
      await freshStart(page, reload);
      const ctl = await verbControl(page, c.params.abrir);
      if (!ctl) { r.detail = `ningún control visible dice "${c.params.abrir[0]}" (o un sinónimo): ${c.params.abrir.join(" / ")}`; return; }
      const token = tokenOf();
      await useControl(page, ctl.loc, token);
      const a = await page.evaluate(SEEN, [token, null]);
      if (!a.seen) { r.detail = `no se pudo crear (el texto no aparece): no hay qué guardar`; return; }
      await page.reload({ waitUntil: "load" }); await settle(page);
      const b = await page.evaluate(SEEN, [token, null]);
      r.result = b.seen ? "PASS" : "FAIL";
      r.detail = `creó "${token}" → recargó → ${b.seen ? "sigue" : "SE PERDIÓ"}`;
    },
  },
};
