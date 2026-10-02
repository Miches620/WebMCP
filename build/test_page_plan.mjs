// test_page_plan.mjs — validador del plan de página, esqueleto y ancla múltiple (sin LLM).
//   node build/test_page_plan.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validatePlan } from "./page_plan.mjs";
import { skeleton, FILES } from "./specialist_spa.mjs";
import { runChecks, normalizeCheck } from "../validation/check_catalog.mjs";

let ok = 0, fail = 0;
const t = (name, cond, extra = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${extra}`); } };

// Project22 (9 features) y Project20 (4), planes como los esperamos de Qwen.
const P22 = ["Hero con título, subtítulo, botón de llamada a la acción y animación de entrada", "Barra de navegación fija con enlaces que hacen scroll suave a cada sección", "Secciones: Características (tarjetas con iconos), Testimonios, Estadísticas animadas y Contacto", "Pie de página completo", "Animaciones al hacer scroll", "Efectos hover en botones y tarjetas", "Visualmente atractivo", "Totalmente interactivo y responsive", "Código limpio, ordenado y comentado donde haga falta"];
const plan22 = {
  header: { features: ["R2"] },
  sections: [
    { id: "hero", titulo: "Inicio", features: ["R1"] },
    { id: "caracteristicas", titulo: "Características", features: ["R3"] },
    { id: "testimonios", titulo: "Testimonios", features: ["R3"] },
    { id: "estadisticas", titulo: "Estadísticas", features: ["R3"] },
    { id: "contacto", titulo: "Contacto", features: ["R3"] },
  ],
  footer: { features: ["R4"] },
  transversales: ["R5", "R6", "R7", "R8", "R9"],
};
let r = validatePlan(plan22, 9);
t("P22 plan válido", r.errors.length === 0, JSON.stringify(r.errors));
r = validatePlan({ header: { features: [] }, sections: [{ id: "catalogo", titulo: "Catálogo", features: ["R1"] }, { id: "contacto", titulo: "Contacto", features: ["R2"] }, { id: "nosotros", titulo: "Nosotros", features: ["R3"] }, { id: "carta", titulo: "Carta", features: ["R4"] }], footer: { features: [] }, transversales: [] }, 4);
t("P20 plan válido", r.errors.length === 0, JSON.stringify(r.errors));

// Inválidos
r = validatePlan({ ...plan22, transversales: ["R5", "R6", "R7", "R8"] }, 9);
t("falta una feature → error", r.errors.some((e) => e.includes("R9")), JSON.stringify(r.errors));
r = validatePlan({ ...plan22, sections: [...plan22.sections, { id: "x", titulo: "Extra", features: ["R12"] }] }, 9);
t("feature inexistente → error", r.errors.some((e) => e.includes("R12")), JSON.stringify(r.errors));
r = validatePlan({ ...plan22, sections: [...plan22.sections, { id: "Contacto", titulo: "Contacto 2", features: ["R3"] }] }, 9);
t("id repetido (normalizado) → error", r.errors.some((e) => e.includes("repetido")), JSON.stringify(r.errors));
r = validatePlan({ ...plan22, transversales: ["R1", "R5", "R6", "R7", "R8", "R9"] }, 9);
t("transversal y en sección → error", r.errors.some((e) => e.includes("transversal")), JSON.stringify(r.errors));
r = validatePlan({ header: {}, sections: [], footer: {}, transversales: ["R1"] }, 1);
t("sin secciones → error", r.errors.some((e) => e.includes("ninguna sección")), JSON.stringify(r.errors));
r = validatePlan({ ...plan22, sections: plan22.sections.map((s) => ({ ...s, id: s.titulo })) }, 9);
t("ids se normalizan (Características → caracteristicas)", r.plan.sections[1].id === "caracteristicas", r.plan.sections[1].id);

// Esqueleto
const plan = validatePlan(plan22, 9).plan;
const sk = skeleton("Landing Page Ficticia", P22, plan)["index.html"];
t("esqueleto: 5 secciones, sin secciones de cualidades", (sk.match(/<section /g) || []).length === 5 && !/codigo-limpio|visualmente/.test(sk));
t("esqueleto: data-feature en header, secciones y footer", sk.includes('<header id="site-header" data-feature="R2">') && sk.includes('id="testimonios" data-feature="R3"') && sk.includes('<footer id="site-footer" data-feature="R4">'));
const min = skeleton("X", P22, null)["index.html"];
t("plan null → esqueleto mínimo", !min.includes("<section"));
const old = skeleton("X", ["Sección 'Carta' con productos"], undefined)["index.html"];
t("plan undefined → v0.4 (una sección por feature)", old.includes('<section id="carta" data-feature="R1">'));

// Ancla múltiple: R3 está en 4 secciones; el chequeo elige por palabras.
const dir = join(tmpdir(), `pageplan_${Date.now()}`);
mkdirSync(dir, { recursive: true });
const files = skeleton("Landing Page Ficticia", P22, plan);
files["index.html"] = files["index.html"]
  .replace(/(<section id="testimonios"[^>]*>\s*<h2>Testimonios<\/h2>)/, `$1<blockquote class="t"><p>Excelente servicio.</p><cite>Ana</cite></blockquote><blockquote class="t"><p>Muy recomendable.</p><cite>Luis</cite></blockquote>`);
for (const f of FILES) writeFileSync(join(dir, f), files[f]);
const res = await runChecks(join(dir, "index.html"), [
  { type: "section_items", params: { section: ["testimonios"], feature: ["R3"] } },
  { type: "section_items", params: { section: ["caracteristicas"], feature: ["R3"] } },
].map(normalizeCheck));
t("ancla múltiple: testimonios (con ítems) PASS", res[0].result === "PASS" && res[0].detail.includes("#testimonios"), res[0].detail);
t("ancla múltiple: características (vacía) FAIL", res[1].result === "FAIL" && res[1].detail.includes("#caracteristicas"), res[1].detail);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
