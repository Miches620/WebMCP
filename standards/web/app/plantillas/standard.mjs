// standard.mjs — Standard "app con estado, dibujada con plantillas" (web/app/plantillas) · DRAFT v0.1.0 (16/10).
//
// Decisión de Miche (16/10): "creamos un standard draft nuevo para comparar" (el stack lo eligió Claude). Para que
// la comparación con web/app/estado mida UNA sola cosa, este Standard ES el de estado salvo en cómo se dibuja:
//   estado:     js/dibujo.js arma el DOM a mano (createElement, textContent, appendChild(controlesDe(...)))
//   plantillas: js/dibujo.js llena una plantilla Handlebars ({{#each}}, {{texto}}) y la pone en #app; los controles
//               los monta el harness en los lugares que marca la plantilla (<div data-controles="tipo" data-id="…">)
// Pasos (iguales salvo los marcados):
//   1. contrato  2. logica  3. acciones (+ montarControles, del harness)  4. handlebars (NUEVO: el harness copia
//   node_modules/handlebars/dist/handlebars.min.js a js/vendor/handlebars.js)  5. pantalla  6. dibujo (OTRO pedido)
//   7. controles  8. enlace
// La sonda de dibujar() es la misma (textos del estado, un botón por acción con sus ids y campos, clases con estilo,
// XSS): Handlebars escapa {{texto}} solo; {{{texto}}} (tres llaves) lo detecta la sonda igual que un innerHTML.
// DRAFT: sin evidencia. Requiere handlebars instalado (ficha meta.mjs → requiere; build/requisitos.mjs lo verifica).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import META from "./meta.mjs";
import BASE, { contractText, cssClasses, SCRIPTS as BASE_SCRIPTS } from "../estado/standard.mjs";
import { controlsPlan, whereOf } from "../estado/controls.mjs";

export const VENDOR = "js/vendor/handlebars.js";
export const SCRIPTS = (() => { const s = [...BASE_SCRIPTS]; s.splice(s.indexOf("js/dibujo.js"), 0, VENDOR); return s; })();
const HANDLEBARS_DIST = fileURLToPath(new URL("../../../../node_modules/handlebars/dist/handlebars.min.js", import.meta.url));
const contractOf = (c) => c?.data?.contrato?.items?.[0] || null;
const fence = (lang, s) => "```" + lang + "\n" + s + "\n```";

/** montarControles(raiz, estado): lo agrega el harness al final de js/acciones.js (usa TIPOS y controlesDe de ahí). */
export const MONTAR_JS = `
// montarControles(raiz, estado) — Standard web/app/plantillas: la plantilla marca dónde van los controles de cada
// elemento (<div data-controles="<tipo>" data-id="<id>"></div>); acá se ponen adentro, ya conectados.
function montarControles(raiz, estado) {
  Array.prototype.forEach.call(raiz.querySelectorAll("[data-controles]"), function (lugar) {
    var tipo = lugar.dataset.controles, el = null;
    if (tipo !== "app") {
      var T = TIPOS[tipo];
      if (!T) return;
      el = elementosDe(estado, T.path).filter(function (x) { return String(x[T.id]) === String(lugar.dataset.id); })[0];
      if (!el) return;
    }
    lugar.appendChild(controlesDe(tipo, el, estado));
  });
}
`;

/** Dónde va el lugar de los controles de cada tipo, en palabras para el pedido de dibujo. */
export function lugaresText(c) {
  const plan = controlsPlan(c);
  const own = [...new Set(plan.acciones.map((a) => a.owner))];
  return own.map((t) => {
    const acts = plan.acciones.filter((a) => a.owner === t).map((a) => a.label).join(", ");
    return t === "app"
      ? `  - "app" (acciones generales): una vez, al final → <div data-controles="app"></div> → ${acts}`
      : `  - "${t}": adentro de cada elemento de ${whereOf(plan.kinds[t])} → <div data-controles="${t}" data-id="{{${plan.kinds[t].id}}}"></div> → ${acts}`;
  }).join("\n");
}

// el contrato que lee Gemma: el de estado, con dibujo.js y el archivo de Handlebars cambiados
const DIBUJO_ESTADO = /- js\/dibujo\.js define: function dibujar\(estado\)\.[^\n]*/;
export function plantillasContractText(ctx) {
  const base = contractText(ctx);
  if (!DIBUJO_ESTADO.test(base) || !base.includes("js/acciones.js, js/dibujo.js")) throw new Error("plantillas: el contrato de web/app/estado cambió; revisá plantillasContractText");
  return base
    .replace("js/acciones.js, js/dibujo.js", `js/acciones.js, ${VENDOR}, js/dibujo.js`)
    .replace(DIBUJO_ESTADO, `- ${VENDOR} (lo copia el harness): Handlebars 4 (Handlebars.compile).
- js/acciones.js también define montarControles(raiz, estado): pone los controles en cada <div data-controles="<tipo>" data-id="<id>"> que encuentre adentro de raiz.
- js/dibujo.js define: const PLANTILLA (una plantilla Handlebars) y function dibujar(estado), que hace #app.innerHTML = Handlebars.compile(PLANTILLA)(estado) y después montarControles(#app, estado). La plantilla muestra cada elemento con sus textos con DOS llaves ({{texto}}: Handlebars los escapa); nunca tres llaves. Adentro de cada elemento con acciones va su <div data-controles>. NO dibuja botones ni campos propios para las acciones. Usa las clases que tienen estilo en styles.css. No agrega listeners.`);
}

// mensajes de la sonda de dibujo pensados para DOM a mano → los mismos, dichos para una plantilla
export function forTemplate(msgs = []) {
  return msgs.map((m) => m
    .replace(/agregá controlesDe\("app", null, estado\) una vez al final de #app/g, 'poné <div data-controles="app"></div> una vez al final de la plantilla')
    .replace(/agregá controlesDe\("([^"]+)", elemento, estado\) adentro de cada elemento de ese tipo/g, 'poné <div data-controles="$1" data-id="{{id}}"></div> (con el id de ese elemento) adentro de cada elemento de ese tipo en la plantilla, y llamá a montarControles(app, estado) después de llenarla')
    .replace(/Mostrá cada texto con textContent \(o document\.createTextNode\), nunca metido dentro de innerHTML\./g, "En la plantilla escribí cada texto con DOS llaves ({{texto}}): Handlebars lo escapa. Nunca tres llaves ({{{texto}}}) ni HTML armado a mano con los textos.")
    .replace(/Escribí sus propiedades \(p\.ej\. item\.texto\) con textContent\./g, "En la plantilla usá sus propiedades ({{texto}}), no el objeto entero."));
}

const baseStep = (id) => BASE.steps.find((s) => s.id === id);
const acciones0 = baseStep("acciones"), dibujo0 = baseStep("dibujo");

const STANDARD = {
  ...BASE,
  id: META.id,
  version: META.version,
  status: META.status,
  stack: META.stack,
  requiere: META.requiere,
  label: META.label,
  base: META.base,
  describe: "Como web/app/estado (contrato, lógica probada en Node, controles del harness), pero js/dibujo.js llena una plantilla Handlebars en vez de armar el DOM a mano. Para comparar los dos Standards con los mismos proyectos.",
  evidence: [],
  pending: [
    "Primera corrida: el mismo snapshot con --standard web/app/estado y --standard web/app/plantillas, a temperatura 0.",
    "Medir: intentos del paso dibujo, tokens, problemas de la sonda, Validation.",
  ],
  scripts: SCRIPTS,
  contract: plantillasContractText,
  steps: BASE.steps.flatMap((st) => {
    if (st.id === "acciones") return [{
      ...st,
      write: (ctx) => { const o = acciones0.write(ctx); if (o["js/acciones.js"]) o["js/acciones.js"] += MONTAR_JS; return o; },
    }, {
      // v0.1.0: Handlebars lo copia el harness desde node_modules (lo instaló Miche con build/requisitos.mjs)
      id: "handlebars", kind: "written", file: VENDOR,
      write: () => (existsSync(HANDLEBARS_DIST) ? { [VENDOR]: readFileSync(HANDLEBARS_DIST, "utf8") } : {}),
      check: (c) => (/Handlebars/.test(c[VENDOR] || "") ? [] : Object.assign([`${VENDOR} no es Handlebars: instalalo con node build/requisitos.mjs --standard ${META.id} --instalar`], { fatal: true })),
    }];
    if (st.id === "dibujo") return [{
      ...st,
      notOwn: { names: ["estado", "controlesDe", "montarControles", "Handlebars"], owner: "js/controles.js, js/acciones.js y js/vendor/handlebars.js (los pone el harness)" },
      expect: (p) => forTemplate(dibujo0.expect(p)),
      prompt: (c) => { const cls = cssClasses(c.files?.["styles.css"]);
        return `YA EXISTEN: ESTADO_INICIAL, App (crear, ${contractOf(c).acciones.map((a) => a.nombre).join(", ")}) y app.html:\n${fence("html", c.fragment.slice(0, 2500))}\n${cls.length ? `styles.css tiene estilo para estas clases (usalas): ${cls.slice(0, 40).map((x) => "." + x).join(" ")}\n` : ""}YA EXISTEN Handlebars (${VENDOR}) y montarControles(raiz, estado) (js/acciones.js, los puso el harness): montarControles busca en raiz cada <div data-controles="<tipo>" data-id="<id>"></div> y le pone adentro los campos y botones de las acciones de ese elemento, ya conectados.\n\n${c.paso}: escribí js/dibujo.js con una plantilla Handlebars:\nconst PLANTILLA = \`...\`; (recorré las listas con {{#each <lista>}} ... {{/each}}; los textos con DOS llaves {{campo}}, nunca tres)\nfunction dibujar(estado) { var app = document.getElementById("app"); app.innerHTML = Handlebars.compile(PLANTILLA)(estado); montarControles(app, estado); }\nEn la plantilla, adentro de cada elemento que tiene acciones, el lugar de sus controles:\n${lugaresText(contractOf(c))}\nNo dibujes botones ni campos propios para las acciones.`; },
    }];
    return [st];
  }),
};
export default STANDARD;
