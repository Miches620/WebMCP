// standards/web/app/estado/meta.mjs — ficha del Standard web/app/estado (solo datos; la carga también el navegador).
//
// 16/10 (decisión de Miche): el TechLeader "sugería" un stack (React, Tailwind) que nadie leía y con eso planificaba
// fases y tareas que no correspondían (API/Servicio en una app sin servidor). El stack NO lo elige un modelo: lo
// fija el Standard, y el TechLeader lo recibe como dato. standard.mjs toma id/versión/estado de acá (una sola fuente).

export default {
  id: "web/app/estado",
  version: "0.8.3",
  status: "DRAFT",
  label: "app de una pantalla con estado y acciones",
  profiles: ["web/app"],
  stack: {
    nombre: "HTML + CSS + JavaScript sin frameworks (el DOM se arma a mano)",
    usa: [
      "HTML y CSS (un styles.css)",
      "JavaScript en archivos comunes, sin módulos ni paso de build",
      "el estado de la app en memoria del navegador (un objeto JavaScript)",
      "dibujar(estado) arma la pantalla con document.createElement",
    ],
    // términos que, si aparecen en una fase o tarea, son de otro stack (se buscan como palabra entera)
    no_usa: ["React", "Vue", "Angular", "Svelte", "Next.js", "TypeScript", "Tailwind", "Bootstrap", "jQuery", "Handlebars", "Express", "backend", "servidor", "API", "API REST", "endpoint", "base de datos", "SQL", "MongoDB", "Firebase"],
    servidor: false,
  },
  // Lo que tiene que estar instalado para construir y validar con este Standard (build/requisitos.mjs lo verifica).
  requiere: [
    { id: "node", para: "correr el harness y las pruebas", verificar: { tipo: "node", minimo: 20 }, instalar: null, manual: "instalá Node.js 20 o más nuevo desde nodejs.org" },
    { id: "playwright", para: "Validation en Chromium", verificar: { tipo: "modulo", modulo: "playwright" }, instalar: "npm install --save-dev playwright" },
    { id: "chromium", para: "Validation en Chromium", verificar: { tipo: "chromium" }, instalar: "npx playwright install chromium" },
  ],
};
