// role.mjs — Role "Specialist web/game" · DRAFT (07/10, paso 3).
//
// Specialist.md: "Cada Role posee determinadas Skills… La selección de las Skills depende de la
// naturaleza de la tarea". Acá: las Skills son fichas cortas de SABER HACER (no contrato, eso es
// del Standard; no verificación, eso es de Validation). Cada una nace de un error que ya pasó en
// un build real, dice cuál (evidencia), a qué clase de paso aplica (pasos) y qué problema del
// harness la delata (detecta). Todas DRAFT: se miden con y sin (`--skills`) y se quedan solo si
// el error baja (Utility Score). Si no, se descartan.
export default {
  id: "web-game",
  label: "Specialist web/game",
  status: "DRAFT",
  skillsDir: "skills",
};
