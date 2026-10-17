// test_flows.mjs — Validation de FLUJO (flows v0.1, 16/10 noche): la vara tiene que distinguir lo que anda de lo que no.
//   node profiles/web/validation/test_flows.mjs
// Apps REALES del 16/10 (fixtures flow_*):
//   - Gemma sola en LM Studio (sin webmcp), tal cual: "crear" tira error (openModal('Pendiente')).
//   - La misma, con esa línea arreglada (openModal(null, 'pendiente')): todo anda (drag & drop, localStorage).
//   - Build del pipeline con web/app/estado (18-27-12): botón "➕ Agregar" muerto, tarjetas sin controles.
//   - Build del pipeline con web/app/plantillas (20-44-02): crear no aparece; editar, borrar y mover andan.
// Lo que se espera de cada una sale de probarlas a mano (Claude, Playwright, 16/10) — no del juez.
import { fileURLToPath } from "node:url";
import { validationFor } from "./check_catalog.mjs";
import { FLOWS_VERSION } from "./flows.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const F = (n) => fileURLToPath(new URL(`./fixtures/${n}/index.html`, import.meta.url));
const V = validationFor(["web", "web/app"]);
const CHECKS = [
  { type: "flow_create", params: { abrir: ["agregar", "tarjeta"], donde: "Pendiente" } },
  { type: "flow_edit", params: { abrir: ["editar"], crear: ["agregar", "tarjeta"] } },
  { type: "flow_delete", params: { abrir: ["eliminar", "borrar"], crear: ["agregar", "tarjeta"] } },
  { type: "flow_move", params: { abrir: ["mover"], crear: ["agregar", "tarjeta"] } },
  { type: "flow_persist", params: { abrir: ["agregar", "tarjeta"] } },
].map(V.normalizeCheck);

t("versión y los 5 flujos están en el catálogo de web/app", FLOWS_VERSION === "flows v0.1" && CHECKS.every(Boolean));

// crear · editar · borrar · mover · guardar
const EXPECT = {
  flow_gemma_sola_rota: "FFFFF",
  flow_gemma_sola_arreglada: "PPPPP",
  flow_pipeline_estado: "FFFFF",
  flow_pipeline_plantillas: "FPPPF",
};
const res = {};
for (const [app, exp] of Object.entries(EXPECT)) {
  const r = await V.runChecks(F(app), CHECKS);
  res[app] = r;
  const got = r.map((x) => x.result[0]).join("");
  t(`${app}: ${exp} (crear · editar · borrar · mover · guardar)`, got === exp, `dio ${got}\n    ${r.map((x) => `${x.type}: ${x.detail}`).join("\n    ")}`);
}
// lo que más importa: la app rota y la arreglada YA NO dan lo mismo (con action_changes daban 6 PASS las dos)
t("rota ≠ arreglada en crear (antes Validation no las distinguía)", res.flow_gemma_sola_rota[0].result === "FAIL" && res.flow_gemma_sola_arreglada[0].result === "PASS");
t("el FAIL de la rota trae el error de JS con archivo y línea (la pista para corregir)", /error de JS: Cannot read properties of undefined \(reading 'find'\) \(script\.js:13\d\)/.test(res.flow_gemma_sola_rota[0].detail), res.flow_gemma_sola_rota[0].detail);
t("crear arreglada: el texto aparece EN la columna pedida (Pendiente)", /se ve en "Pendiente"/.test(res.flow_gemma_sola_arreglada[0].detail));
t("mover arreglada: por arrastre (drag & drop de verdad), de Pendiente a otra columna", /arrastrada de "Pendiente" → quedó en "En Curso"/.test(res.flow_gemma_sola_arreglada[3].detail), res.flow_gemma_sola_arreglada[3].detail);
t("guardar arreglada: recarga y sigue (localStorage)", /recargó → sigue/.test(res.flow_gemma_sola_arreglada[4].detail));
t("pipeline estado: el botón '➕ Agregar' existe pero no pasa nada (no aparece ningún campo)", /no apareció ningún campo/.test(res.flow_pipeline_estado[0].detail));
t("pipeline plantillas: 'Editar tarjeta' NO cuenta como crear (el verbo tiene que estar)", /ningún control visible dice "agregar"/.test(res.flow_pipeline_plantillas[0].detail));
t("pipeline plantillas: mover con el botón del harness y el destino elegido", /con "Mover tarjeta" \(destino "[^"]+"\): de "Pendiente" →/.test(res.flow_pipeline_plantillas[3].detail), res.flow_pipeline_plantillas[3].detail);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
