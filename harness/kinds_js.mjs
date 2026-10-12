// kinds_js.mjs — clase de paso "logic" para JavaScript (12/10, refactor del borde).
//
// Lógica pura: se carga en Node (sin navegador) y corre las pruebas de aceptación que declara el
// Standard. Es de LENGUAJE (JavaScript), no de una plataforma: la registra el kit de la plataforma
// que programa en JS (hoy web). Movida sin cambios desde files_engine.mjs v0.9.9.
//
// Interfaz de una clase de paso (la usa el motor, harness/files_engine.mjs):
//   make(st, env)          → { judge(content), fix?(content, att), repair?(content, problems, att), … }
//   store(st, K, s, env)   → guarda el resultado del paso (archivos, ctx, rec); "stop" corta el build
//   frozen(st, fz, env)    → banco por paso: carga el paso desde un build anterior (sin Gemma)

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fatal } from "./files_engine.mjs";
import { loadScripts, syntaxOf, runAcceptance, findMember, replaceMember, stripComments, shadowProblems } from "./js_tools.mjs";
import { fixUndeclared, undefinedNames } from "./undeclared.mjs";

export const memberFixPrompt = (file, label) => `Corregís UNA función de ${file} (${label}).
Recibís el CONTRATO, las PRUEBAS DEL HARNESS QUE FALLAN y la función. Devolvé SOLO la función corregida, completa, con el mismo nombre y los mismos parámetros, en UN bloque \`\`\`javascript (con la misma forma: si era "nombre(params) {", devolvé "nombre(params) {"). Sin explicaciones.`;

/** Lo básico de un archivo .js: que venga y que compile. null si está bien. */
export const jsBasics = (st, code, env) => {
  if (!code) return fatal([`la respuesta no trajo ### FILE: ${st.file}.${env.wrongNote(st)}`]);
  const se = syntaxOf(code); if (se) return fatal([`error de sintaxis: ${se}`]);
  return null;
};

/** Archivo de un paso guardado tal cual (render, wiring, logic). */
export const storeFile = (st, _K, s, env) => { env.files[st.file] = s.content[st.file] || ""; };
export const frozenFile = async (st, fz, env) => {
  if (!fz.files?.[st.file]) throw new Error(`BENCH_FROZEN: falta ${st.file} en el build congelado`);
  env.files[st.file] = fz.files[st.file];
};

export const logicKind = {
  make: (st, env) => {
    const { S, log, ask, skillsFor, fence, outDir, steps } = env;
    const acceptance = (code) => {
      const L = loadScripts([...env.loadedBefore(st), code], [st.global, ...(st.itemsGlobal ? [st.itemsGlobal] : [])]);
      if (L.error) return { error: L.error };
      return { result: runAcceptance(L[st.global], st.itemsGlobal ? L[st.itemsGlobal] : [], st) };
    };
    // v0.9.9 (banco --repair 11/10): `state is not defined` con el parámetro `estado` → se renombra solo
    // en esa función, sin Gemma (harness/undeclared.mjs). Se queda solo si quedan menos pruebas fallando.
    const fix = async (c, att) => {
      const code = c[st.file];
      if (!code || syntaxOf(code)) return null;
      const failTexts = (a) => (a.error ? [a.error] : a.result.failed.map((f) => f.detail));
      const a = acceptance(code);
      const names = undefinedNames(failTexts(a));
      if (!names.length) return null;
      const members = (st.functions || []).map((f) => findMember(code, f)).filter(Boolean);
      const r = fixUndeclared(code, names, members, S.aliases || {});
      if (!r.fixes.length || syntaxOf(r.code)) return null;
      const a2 = acceptance(r.code);
      const n = (x) => (x.error ? Infinity : x.result.failed.length);
      if (n(a2) >= n(a)) return null;
      att.undeclared_fix = r.fixes;
      log(`[SPECIALIST]   variable sin declarar: ${r.fixes.map((f) => `${f.name} → ${f.to} en ${f.fn} (${f.count}×, ${f.why})`).join(", ")} · pruebas que fallan ${n(a) === Infinity ? "no carga" : n(a)} → ${n(a2)}`);
      return { ...c, [st.file]: r.code };
    };
    return {
      fix,
      judge: async (c) => {
        const code = c[st.file];
        const b = jsBasics(st, code, env); if (b) return b;
        // v0.9.6 (Boxworld --skills): el comentario "No utiliza DOM ni window." daba este problema en los 3
        // intentos y tapaba el error real (state is not defined): se mira el código sin comentarios
        // qué globales no puede usar la lógica pura lo dice la plataforma (en web: document y window)
        const banned = env.P?.pureForbidden || [];
        if (st.pure && banned.length && new RegExp(`\\b(${banned.join("|")})\\.`).test(stripComments(code))) return [`${st.file} no puede usar ${banned.join(" ni ")} (es lógica pura).`];
        const sh = shadowProblems(code); if (sh.length) return sh;
        const a = acceptance(code);
        if (a.error) return fatal([`al ejecutarlo: ${a.error}`]);
        const failed = a.result.failed;
        // v0.9.6: si una prueba TIRA un error (no un resultado distinto: el código se rompe), lo de abajo
        // no se puede probar (Boxworld --skills: controles se reintentó 3 veces por "state is not defined")
        return failed.some((f) => f.name === "contrato" || /tiró( un error)?:/.test(f.detail)) ? fatal(failed.map((f) => f.detail)) : failed.map((f) => f.detail);
      },
      repair: async (c, _pr, att) => {
        let code = c[st.file];
        if (!code || syntaxOf(code)) return null;
        const rounds = [];
        for (let k = 0; k < 4; k++) {
          const a = acceptance(code);
          if (a.error) break;
          const failed = a.result.failed;
          if (!failed.length || failed.some((f) => f.name === "contrato")) break;
          const fn = failed.find((f) => f.fn && !rounds.some((r) => r.fn === f.fn && !r.ok))?.fn;
          const m = fn && findMember(code, fn);
          if (!m) break;
          const user = `${env.contract ? env.contract() : S.contract}\n\n${skillsFor("logic") ? skillsFor("logic") + "\n\n" : ""}PRUEBAS DEL HARNESS QUE FALLAN (${fn}):\n${failed.filter((f) => f.fn === fn).map((f) => "- " + f.detail).join("\n")}\n\nFUNCIÓN A CORREGIR (${fn}):\n${fence("javascript", m.text)}`;
          const r = await ask(memberFixPrompt(st.file, st.label || "lógica pura, sin DOM"), user, st.cap || 5000);
          writeFileSync(join(outDir, `step_${String(steps.length + 1).padStart(2, "0")}_${st.id}.a${att.k ?? 0}.${fn}${k + 1}.raw.txt`), r.raw, "utf8");
          const got = (String(r.raw || "").match(/```(?:javascript|js)?\n([\s\S]*?)```/) || [])[1];
          const rp = replaceMember(code, m, got);
          const before = failed.length;
          let after = before;
          if (rp.ok) { const a2 = acceptance(rp.js); after = a2.error ? Infinity : a2.result.failed.length; }
          const note = rp.ok ? null : rp.why + (r.finish_reason === "length" ? " (cortada por largo)" : !String(r.raw || "").trim() ? " (respuesta vacía)" : "");
          const round = { fn, ms: r.ms, finish_reason: r.finish_reason, chars: String(r.raw || "").length, reasoning_chars: r.reasoning_chars ?? 0, ok: rp.ok && after < before, before, after: after === Infinity ? "error" : after, ...(note ? { note } : {}) };
          rounds.push(round);
          if (round.ok) code = rp.js;
        }
        if (rounds.length) {
          att.member_repair = rounds;
          log(`[SPECIALIST]   reparación por función: ${rounds.map((r) => `${r.fn} ${r.ok ? "✓" : `✗${r.note ? ` (${r.note})` : ""}`}`).join(", ")}`);
        }
        return code !== c[st.file] ? { [st.file]: code } : null;
      },
      acceptance,
    };
  },
  store: (st, K, s, env) => {
    storeFile(st, K, s, env);
    const a = K.acceptance(env.files[st.file]);
    s.rec.tests = a.error ? { passed: [], failed: [{ name: "carga", detail: `al ejecutarlo: ${a.error}` }] } : a.result;
    env.out.acceptance = { ...(env.out.acceptance || {}), [st.id]: s.rec.tests };
    // v0.10.1 (web/app): observaciones del Standard (p.ej. lo que Gemma dijo que cambia cada acción):
    // se guardan, NO bloquean
    if (st.observe && !a.error) {
      const L = loadScripts([...env.loadedBefore(st), env.files[st.file]], [st.global]);
      if (!L.error) { try { s.rec.observations = st.observe(L[st.global]); } catch (e) { s.rec.observations = { error: e.message }; } }
    }
    env.log(`[SPECIALIST]   pruebas de ${st.id} (harness, sin navegador): ${s.rec.tests.passed.length}/${s.rec.tests.passed.length + s.rec.tests.failed.length}${s.rec.tests.failed.length ? ` · fallan: ${s.rec.tests.failed.map((f) => f.name).join(", ")}` : ""}`);
  },
  frozen: frozenFile,
};
