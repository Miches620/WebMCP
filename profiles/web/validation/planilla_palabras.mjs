// planilla_palabras.mjs — cada fila de la planilla dicha en palabras, sin modelo (18/10, decisión de Miche).
//
// Decisión de Miche (18/10): Gemma VE qué se va a probar, como la consigna de un examen. El examen lo sigue escribiendo
// Qwen (la planilla), y al correr el juez cambia los textos de prueba por otros al azar (planilla.mjs, conAzar): Gemma
// sabe QUÉ tiene que pasar, no con qué textos. Por eso acá los textos "QA …" no aparecen: se dicen como "un título
// cualquiera" o "el texto que se cargó".
// Con los nombres del glosario de la app (tarjeta, columna…); el código no nombra cosas de ninguna app.

import { filaATipos } from "./glosario.mjs";
import { conNombres } from "./planilla_plantillas.mjs";
import { REGLAS_VISUALES, REGLAS_MODERNAS } from "./visual.mjs";

const isQA = (x) => /^QA\b/.test(String(x || ""));
const q = (x) => `"${x}"`;
const lista = (xs) => xs.map((x) => (isQA(x) ? "el texto que se cargó" : q(x))).join(", ");
const camposTxt = (c) => { const e = Object.entries(c || {}); return e.length ? ` con ${e.map(([k, v]) => `${k} ${isQA(v) ? "(un texto cualquiera)" : q(v)}`).join(" y ")}` : ""; };

/** Una fila → una frase: "Creo una tarjeta con prioridad "alta" → la tarjeta muestra "alta" · se pinta de rojo". */
export function describirFila(row00, g) {
  // los campos "__…" (p. ej. __variante) son del juez, no de la persona
  const row0 = { ...row00, ...(row00?.dado ? { dado: row00.dado.map((d) => (d?.campos ? { ...d, campos: Object.fromEntries(Object.entries(d.campos).filter(([k]) => !k.startsWith("__"))) } : d)).map((d) => (d?.campos && !Object.keys(d.campos).length ? (({ campos, ...r }) => r)(d) : d)) } : {}) };
  const row = filaATipos(row0, g);
  const N = (t) => conNombres(t, g);
  // cómo nombrar cada texto QA creado en la fila: por sus campos ("la de prioridad alta") si hace falta distinguir
  const movs = (row.dado || []).filter((d) => d?.mover);
  const dado = (row.dado || []).filter((d) => !d?.mover);
  const quien = new Map();
  dado.forEach((d, i) => { const cs = Object.values(d.campos || {}); const rep = dado.filter((x) => JSON.stringify(Object.values(x.campos || {})) === JSON.stringify(cs)).length > 1; quien.set(d.agregar, cs.length ? `la de ${Object.entries(d.campos).map(([k, v]) => `${k} ${v}`).join(" y ")}${rep ? (dado.findIndex((x) => JSON.stringify(Object.values(x.campos || {})) === JSON.stringify(cs)) === i ? " creada primero" : " creada después") : ""}` : N(`{el_item} creado`)); });
  const nombre = (x) => (isQA(x) ? quien.get(x) || N("{el_item}") : q(x));
  const partes = [];
  if (dado.length) partes.push(N(`Antes: creo ${dado.length === 1 ? "{un_item}" : `${dado.length} {items}`}`) + (dado.length > 1 && dado.some((d) => Object.keys(d.campos || {}).length) ? `, en este orden: ${dado.map((d) => (Object.keys(d.campos || {}).length ? Object.entries(d.campos).map(([k, v]) => `${k} ${v}`).join(" y ") : "sin campos")).join(" · ")}` : camposTxt(dado[0].campos)) + ".");
  // 20/10: 10 movidas iguales se leían como 10 renglones "muevo la tarjeta a…" (Miche: "es medio confuso de leer")
  for (const [a, k] of movs.reduce((m, x) => m.set(x.a, (m.get(x.a) || 0) + 1), new Map())) partes.push(k === 1 ? N(`Antes: muevo {el_item} a ${q(a)}.`) : N(`Antes: muevo ${k === dado.length ? `${N("{el_item}").startsWith("la ") ? "esas" : "esos"} ${k}` : k} {items} a ${q(a)}, de a ${N("{el_item}").startsWith("la ") ? "una" : "uno"}.`));
  const h = row.hago || {};
  if (h.agregar) partes.push(N(`Creo {un_item} con un título cualquiera${camposTxt(h.campos).replace(/^ con/, " y")}.`));
  else if (h.editar) partes.push(N(`Edito {el_item}: le cambio el título${h.campos ? ` y le pongo${camposTxt(h.campos).replace(/^ con/, "")}` : ""}.`));
  else if (h.eliminar) partes.push(N("Borro {el_item} (con su control de borrar; si pide confirmar, confirmo)."));
  else if (h.mover) partes.push(h.manija ? N(`Muevo {el_item} a ${q(h.a)} arrastrándol${N("{el_item}").startsWith("la ") ? "a" : "o"} desde su manija ${q(h.manija)}.`) : N(`Muevo {el_item} a ${q(h.a)} (arrastrando, o con su control de mover).`));
  else if (h.recargar) partes.push("Recargo la página.");
  else if (h.pasar_mouse) partes.push(N("Paso el mouse por encima de {el_item}."));
  const veo = (row.veo || []).map((v) => {
    if (v.esta) return isQA(v.esta) ? (h.editar && v.esta === h.a ? "el título nuevo aparece" : h.eliminar && v.esta === h.eliminar ? N(`{el_item} sigue${v.en ? ` en ${q(v.en)}` : ""} (no se borró)`) : N(`{el_item} aparece${v.en ? ` en ${q(v.en)}` : ""}`)) : `se ve ${q(v.esta)}${v.en ? ` en ${q(v.en)}` : ""}`;
    if (v.no_esta) return isQA(v.no_esta) ? (h.editar ? "el título viejo ya no está" : N("{el_item} ya no está")) : `no se ve ${q(v.no_esta)}`;
    if (v.contiene) return N(`{el_item} muestra ${lista(v.contiene)}`);
    if (v.orden) return `en ${q(v.en)} quedan de arriba abajo: ${v.orden.map(nombre).join(" · ")}`;
    if (v.contador != null) return v.vale != null ? `el contador de ${q(v.contador)} vale ${v.vale}` : `el contador de ${q(v.contador)} ${v.cambia > 0 ? "sube" : "baja"} ${Math.abs(v.cambia)}`;
    if (v.control) return `hay un botón que dice ${q(v.control.join(" "))}${v.solo_en ? ` y está solo en ${q(v.solo_en)}` : ""}`;
    if (v.al_pasar) return N(`al pasar el mouse por {el_item} aparecen ${lista(v.al_pasar)} (antes no se ven)`);
    if (v.estilo) {
      const e = v.estilo, d = e.de;
      const cosa = d === "pagina" ? "la página" : d?.grupo ? N(`{el_grupo} ${q(d.grupo)}`) : d?.item ? N("{el_item}") : d?.control ? `el botón ${q(d.control.join(" "))}` : "?";
      const val = e.valor && typeof e.valor === "object" && !Array.isArray(e.valor) ? `distinto de ${e.valor.distinto}` : [].concat(e.valor).join(" o ");
      return `${cosa} tiene ${e.prop}: ${val}`;
    }
    if (v.pregunta) return `al apretar borrar, antes de confirmar, aparece ${q(v.pregunta)}`;
    if (v.centrado) return v.centrado === "grupos" ? N(`${/a$/.test(N("{grupo}")) ? "las" : "los"} {grupos} quedan centrad${/a$/.test(N("{grupo}")) ? "as" : "os"} en la página (mismo espacio libre a la izquierda y a la derecha)`) : `el botón ${q([].concat(v.centrado.control).join(" "))} queda centrado en la página`;
    if (v.moderno) return REGLAS_MODERNAS[v.moderno]?.dice || `regla de diseño ${v.moderno}`;
    if (v.visual) return REGLAS_VISUALES[v.visual]?.dice || `regla visual ${v.visual}`;
    if (v.desborde) return N(`con ${dado.length || "muchos"} {items} en ${q(v.desborde)}, se desplaza (scroll) adentro de {el_grupo} y la página NO se desplaza`);
    if (v.color_en_item) return N(`{el_item} se pinta de ${v.familia}${v.texto ? ` donde dice ${q(v.texto)}` : ""}`);
    return "?";
  });
  return `${partes.join(" ")} → ${veo.join(" · ")}`.trim();
}
