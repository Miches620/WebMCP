// test_roles.mjs — Roles y Skills (07/10, paso 3).
//   node roles/test_roles.mjs
import { loadRole, parseSkill } from "./registry.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

const r = await loadRole("web-game");
t("Role web-game: DRAFT con sus Skills", r.status === "DRAFT" && r.skills.length >= 6);
t("cada Skill tiene evidencia (un build real), pasos y qué error detecta", r.skills.every((s) => /b\d/.test(s.evidence) && s.kinds.length && s.detects), r.skills.filter((s) => !/b\d/.test(s.evidence) || !s.detects).map((s) => s.id).join(", "));
const KINDS = ["data", "logic", "screen", "render", "wiring"];
t("las Skills aplican a clases de paso que existen en el motor", r.skills.every((s) => s.kinds.every((k) => KINDS.includes(k))));
t("las Skills son cortas (entran en 16k de contexto): menos de 400 caracteres cada una", r.skills.every((s) => s.text.length < 400), r.skills.map((s) => s.id + ":" + s.text.length).join(" "));
t("las Skills no nombran el contrato del Standard (NIVELES, Reglas, #tablero)", r.skills.every((s) => !/\b(NIVELES|Reglas|crearEstado)\b|#tablero/.test(s.text)));
// cada Skill detecta el problema real que la originó
const real = {
  "nombres-del-contrato": "recién creado no está ganado: tiró un error: state is not defined",
  "piezas-aparte-del-mapa": "con [...] mover(estado, \"derecha\") empuja la caja ... El jugador quedó ENCIMA de una caja: mover no vio la caja.",
  "flecha-sin-tapar": "en `c => c.fila === r && c.col === c` el parámetro \"c\" tapa a la variable \"c\" de afuera",
  "siempre-jugable": "ganar un nivel y pasar al siguiente: ... el juego queda bloqueado.",
  "botones-habilitados": "en juego.html, #btn-reiniciar tiene el atributo disabled: así nunca se puede usar.",
  "grilla-que-no-se-estira": "en styles.css #tablero cambia de tamaño cuando #mensaje tiene un texto largo",
};
t("cada Skill detecta el texto real del problema que la originó (y solo ese)", r.skills.every((s) => Object.entries(real).every(([id, txt]) => s.detects.test(txt) === (id === s.id))));
t("parseSkill: sin frontmatter → error claro", (() => { try { parseSkill("hola", "x.md"); return false; } catch (e) { return /SKILL_FORMAT/.test(e.message); } })());
t("loadRole: Role desconocido → falla fuerte", await (async () => { try { await loadRole("web-snake"); return false; } catch (e) { return /ROLE_UNKNOWN/.test(e.message); } })());

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
