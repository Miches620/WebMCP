// standards/web/game/grilla/meta.mjs — ficha del Standard web/game/grilla (solo datos; la carga también el navegador).
// 16/10: stack y requisitos declarados en el Standard (ver standards/web/app/estado/meta.mjs).

export default {
  id: "web/game/grilla",
  version: "0.1.8",
  status: "DRAFT",
  label: "juego de grilla: empujar piezas hasta sus objetivos",
  profiles: ["web/game"],
  stack: {
    nombre: "HTML + CSS + JavaScript sin frameworks (juego en una grilla)",
    usa: [
      "HTML y CSS (un styles.css)",
      "JavaScript en archivos comunes, sin módulos ni paso de build",
      "niveles como datos (coordenadas) verificados por el harness",
      "reglas del juego como funciones puras",
    ],
    no_usa: ["React", "Vue", "Angular", "Svelte", "TypeScript", "Phaser", "Unity", "Three.js", "canvas WebGL", "backend", "servidor", "API", "API REST", "base de datos"],
    servidor: false,
  },
  requiere: [
    { id: "node", para: "correr el harness y las pruebas", verificar: { tipo: "node", minimo: 20 }, instalar: null, manual: "instalá Node.js 20 o más nuevo desde nodejs.org" },
    { id: "playwright", para: "Validation en Chromium", verificar: { tipo: "modulo", modulo: "playwright" }, instalar: "npm install --save-dev playwright" },
    { id: "chromium", para: "Validation en Chromium", verificar: { tipo: "chromium" }, instalar: "npx playwright install chromium" },
  ],
};
