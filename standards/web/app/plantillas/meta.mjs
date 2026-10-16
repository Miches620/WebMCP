// standards/web/app/plantillas/meta.mjs — ficha del Standard web/app/plantillas (solo datos; la carga también el navegador).
//
// 16/10 (Miche: "creamos un standard draft nuevo para comparar"; eligió Claude el stack). Nace DRAFT y sin evidencia.
// Para que la comparación con web/app/estado mida UNA cosa, cambia una sola: CÓMO se dibuja la pantalla.
//   estado:     dibujar(estado) arma el DOM a mano (document.createElement, textContent, appendChild)
//   plantillas: dibujar(estado) llena una plantilla Handlebars ({{#each}}, {{titulo}}) y la pone en #app
// Todo lo demás (contrato, lógica probada en Node, controles del harness, Validation) es el mismo.
// Pregunta del experimento: ¿un modelo chico escribe mejor una plantilla declarativa (más corta, que escapa los
// textos sola) que DOM a mano? Se responde con builds de los mismos snapshots con --standard de cada uno.
// Se eligió Handlebars porque: se instala por npm (prueba el mecanismo de instalación), trae un archivo para
// <script src> común (no necesita build ni módulos: el motor y las sondas no cambian) y escapa {{texto}} solo (SEG-1).

export default {
  id: "web/app/plantillas",
  version: "0.1.0",
  status: "DRAFT",
  label: "app de una pantalla con estado y acciones, dibujada con plantillas",
  profiles: ["web/app"],
  base: "web/app/estado",
  stack: {
    nombre: "HTML + CSS + JavaScript sin frameworks, con plantillas Handlebars para dibujar",
    tecnologias: ["Handlebars"],
    usa: [
      "HTML y CSS (un styles.css)",
      "JavaScript en archivos comunes, sin módulos ni paso de build",
      "el estado de la app en memoria del navegador (un objeto JavaScript)",
      "dibujar(estado) llena una plantilla Handlebars y la pone en #app",
    ],
    no_usa: ["React", "Vue", "Angular", "Svelte", "Next.js", "TypeScript", "Tailwind", "Bootstrap", "jQuery", "Express", "backend", "servidor", "API", "API REST", "endpoint", "base de datos", "SQL", "MongoDB", "Firebase"],
    servidor: false,
  },
  requiere: [
    { id: "node", para: "correr el harness y las pruebas", verificar: { tipo: "node", minimo: 20 }, instalar: null, manual: "instalá Node.js 20 o más nuevo desde nodejs.org" },
    { id: "playwright", para: "Validation en Chromium", verificar: { tipo: "modulo", modulo: "playwright" }, instalar: "npm install --save-dev playwright" },
    { id: "chromium", para: "Validation en Chromium", verificar: { tipo: "chromium" }, instalar: "npx playwright install chromium" },
    { id: "handlebars", para: "dibujar con plantillas (se copia a la app como js/vendor/handlebars.js)", verificar: { tipo: "archivo", modulo: "handlebars", ruta: "dist/handlebars.min.js" }, instalar: "npm install --save-dev handlebars@4.7.8" },
  ],
};
