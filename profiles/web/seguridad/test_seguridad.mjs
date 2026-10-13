// test_seguridad.mjs — Validation profile de tema web/seguridad (12/10).
//   node profiles/web/seguridad/test_seguridad.mjs
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProfiles, concernsFor, CONCERNS, SELECTABLE, PROFILES } from "../../registry.mjs";
import { runConcern } from "./validation.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

// ---------- registro: segundo eje (tema) además del tipo ----------
t("web/seguridad es un profile de tema, DRAFT, de la plataforma web", CONCERNS["web/seguridad"]?.kind === "concern" && CONCERNS["web/seguridad"].platform === "web" && CONCERNS["web/seguridad"].status === "DRAFT");
t("un profile de tema no es un tipo elegible ni da roles", !SELECTABLE.some((p) => p.id === "web/seguridad") && !PROFILES["web/seguridad"] && !CONCERNS["web/seguridad"].roles);
t("se suma solo a todo proyecto web (landing, app, juego)", ["web/landing", "web/app", "web/game"].every((id) => concernsFor(resolveProfiles([id])).some((c) => c.id === "web/seguridad")));
t("no se suma a un proyecto de otra plataforma", concernsFor({ chain: ["firmware"] }).length === 0);

// ---------- SEG-1 en Chromium ----------
const dir = mkdtempSync(join(tmpdir(), "seg-"));
const page = (name, body) => { const f = join(dir, name + ".html"); writeFileSync(f, `<!doctype html><meta charset="utf-8"><body>${body}</body>`); return f; };
const APP = (render) => `<div id="app"></div><script>
var items = ["Primero"];
function dibujar() { var a = document.getElementById("app"); a.innerHTML = "";
  items.forEach(function (x) { var p = document.createElement("p"); ${render} a.appendChild(p); });
  var g = document.createElement("div"); var i = document.createElement("input"); var b = document.createElement("button"); b.textContent = "Agregar";
  b.onclick = function () { items.push(i.value); dibujar(); }; g.appendChild(i); g.appendChild(b); a.appendChild(g); }
dibujar();</script>`;
const bad = await runConcern(page("innerhtml", APP("p.innerHTML = x;")));
t("texto del usuario con innerHTML → FAIL (se ejecuta código)", bad[0].verdict === "FAIL" && /se ejecutó código/.test(bad[0].detail), JSON.stringify(bad));
const good = await runConcern(page("textcontent", APP("p.textContent = x;")));
t("texto del usuario con textContent → PASS (se ve el HTML como texto)", good[0].verdict === "PASS", JSON.stringify(good));
const none = await runConcern(page("sin_campos", "<h1>Hola</h1><button>Nada</button>"));
t("sin campos de texto → SIN_EVIDENCIA (no inventa un PASS)", none[0].verdict === "SIN_EVIDENCIA", JSON.stringify(none));
const silent = await runConcern(page("no_muestra", `<input><button onclick="this.previousElementSibling.value=''">Guardar</button>`));
t("el texto no vuelve a aparecer → SIN_EVIDENCIA", silent[0].verdict === "SIN_EVIDENCIA", JSON.stringify(silent));
const form = await runConcern(page("form", `<form onsubmit="event.preventDefault(); document.getElementById('o').innerHTML = this.q.value"><input name="q"><button>Buscar</button></form><div id="o"></div>`));
t("también en un formulario (landing): innerHTML con lo escrito → FAIL", form[0].verdict === "FAIL", JSON.stringify(form));

// ---------- corrida real (6ª/7ª corrida: comentarios, editar y crear con innerHTML; etiquetas con textContent) ----------
const FX6 = fileURLToPath(new URL("../validation/fixtures/real_kanban_c6/index.html", import.meta.url));
const real = await runConcern(FX6);
t("Kanban real: FAIL en comentario, editar y crear; etiquetas no (ahí Gemma usó textContent)", real[0].verdict === "FAIL" && /textoComentario/.test(real[0].detail) && /nuevoContenido/.test(real[0].detail) && /"contenido"/.test(real[0].detail) && !/etiquetaTexto/.test(real[0].detail), real[0].detail);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
