// profiles/web/landing/profile.mjs — TIPO "landing": una página de una sola
// pantalla con header + secciones + footer (café, Project20, Project22).
//
// Solo datos (lo carga también el navegador). El código de build vive en
// ./build.mjs y solo lo importa Node.

export default {
  id: "web/landing",
  extends: "web",
  label: "Landing / página de secciones",
  kind: "type",
  selectable: true,
  status: "DRAFT",
  version: "0.1",
  describe: "Página única con header, secciones (hero, catálogo, contacto…) y footer. Page plan por secciones, un componente por sección.",
  build: "web/landing", // módulo profiles/web/landing/build.mjs
  evidence: [
    "Landing de Café (01/10): v0.4 PASS 4/4 sin PASS triviales (claude/evidencia_build_landing_2026-10-01.md).",
    "Project20 (formulario de contacto): piloto 30/09, C4 detectó la feature perdida.",
    "Project22 (landing con secciones): page plan v0.2 por feature, sections_visible, Specialist v0.7 por componentes.",
  ],
};
