// profiles/web/profile.mjs — PLATAFORMA web (lo que comparte todo artefacto que
// corre en un navegador: landing, app, juego…).
//
// Solo datos: este archivo lo cargan el navegador (script.js) y Node.
// Nace DRAFT como cualquier Standard: lo que dice acá salió de las corridas
// de webmcp (Project13–Project25), no de una decisión de Governance.

export default {
  id: "web",
  label: "Web (plataforma)",
  kind: "platform",
  selectable: false, // no se elige solo: lo trae un tipo (web/landing, web/app)
  status: "DRAFT",
  version: "0.1",
  describe: "Artefacto que corre en un navegador: HTML/CSS/JS autocontenido, datos simulados en window.api, validado en Chromium.",

  // ---- TechLeader / Atomizer ----
  // Roles que puede asignar TechLeader y usar el Atomizer.
  roles: ["Backend", "Frontend", "DBA", "DevOps", "QA"],
  // Rol de una fase cuyo responsable_sugerido no está en la lista (antes fijo en script.js).
  defaultRole: "Backend",
  // Rol del ejemplo de formato en el prompt de TechLeader.
  exampleRole: "DBA",
  // "REGLAS ESPECÍFICAS POR ROL" del Atomizer (antes fijas en atomic_engine_v5.js).
  atomizerRoleRules: [
    "Si tu fase es Backend y necesita esquema de DB, depende de las Atomic Tasks concretas de DBA que proporcionen ese esquema.",
    "Si tu fase es Frontend y consume APIs, depende de las Atomic Tasks concretas de Backend que proporcionen esas APIs.",
    "Si tu fase es QA, debe depender de al menos una Atomic Task concreta de Backend o Frontend cuando existan tareas de esas fases que produzcan el artefacto a validar.",
    "Si tu fase es DevOps, depende de las Atomic Tasks concretas de fases anteriores que sean necesarias para su trabajo.",
  ],
  // Reglas del validador role_dependencies que dependen de los roles (la de
  // dependencias a nivel fase es universal y vive en el validador).
  roleDependencyRules: [
    { type: "requires_upstream", rule: "QA_REQUIRES_UPSTREAM_ARTIFACT", severity: "FAIL", role: "QA", upstream: ["Backend", "Frontend"] },
    { type: "root_without", rule: "BACKEND_ROOT_WITHOUT_DBA", severity: "WARN", role: "Backend", upstream: "DBA", hint: "Confirmar si necesita esquema de base de datos." },
    { type: "root_without", rule: "FRONTEND_ROOT_WITHOUT_BACKEND", severity: "WARN", role: "Frontend", upstream: "Backend", hint: "Confirmar si consume alguna API." },
  ],

  // Lo que la plataforma aporta al build (Node): profiles/web/validation/ (catálogo
  // de chequeos en Chromium, traductor) y profiles/web/specialist/ (encapsulado de
  // componentes, window.api). No tiene build propio: lo arma cada tipo.

  evidence: [
    "role_dependencies v0.1: Project13–Project17 (overview 09/2026); QA_REQUIRES_UPSTREAM_ARTIFACT solo mira dependencias directas (falso FAIL Project16 v3).",
    "Roles: Project14 v2 corrió sin Backend; Project17 generó DevOps no pedido (lo frena ProjectStage, no el profile).",
    "Chequeos de base en Chromium: validation/fixtures (19 casos) y pilot/fixtures (8).",
  ],
};
