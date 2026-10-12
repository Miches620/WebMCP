// controls.mjs — Standard web/app/estado v0.4.0 (12/10, punto 8, segunda parte): los CONTROLES de cada
// elemento los arma el harness. Gemma dibuja cómo se ve cada cosa; los botones y campos de las acciones
// salen del contrato y de la FORMA del estado, no del dominio (no sabe qué es una tarjeta ni una columna).
//
// Evidencia: 4 corridas del Kanban + la 5ª con controles.js del harness. En las 5, dibujo.js falló los 3
// intentos con lo mismo: botones que faltan, ids que no van en el botón, campos ocultos o en otro div.
//
// Reglas (todas desde datos, nada de un dominio):
//   TIPOS     cada lista del estado cuyos elementos tienen "id" es un tipo. Su nombre es la última clave
//             ("cards" en estado.columns[].cards). Si dos listas se llaman igual, el camino completo.
//             El padre de un tipo es el tipo que lo contiene (cards está adentro de columns).
//   DUEÑO     el primer param que es un id dice a qué elemento pertenece la acción (sus botones van ahí).
//             Sin ids, la acción es general ("app").
//   CONTEXTO  otro id cuyo tipo es un ANCESTRO del dueño sale de dónde está el elemento (la primera vez).
//   ELECCIÓN  cualquier otro id es una elección: un <select> con todos los elementos de ese tipo
//             (sin el del contexto, si es del mismo tipo: "mover" no ofrece quedarse donde está).
//   CAMPOS    lo que escribe la persona: un <input> visible (number si el ejemplo es un número);
//             si el elemento ya tiene un dato con ese nombre, el campo arranca con ese valor (editar).

const J = (x) => JSON.stringify(x);
const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ID_KEY = (o) => Object.keys(o).find((k) => /^id$/i.test(k)) || Object.keys(o).find((k) => /(^|_)id$|Id$/.test(k) && (typeof o[k] === "string" || typeof o[k] === "number"));
const LABEL_KEYS = ["nombre", "name", "titulo", "title", "texto", "text", "label", "etiqueta", "descripcion"];

/** Los tipos del estado: { nombre: { path: [claves], id, label, parent } } y de qué tipo es cada id. */
export function kindsOf(estado) {
  const found = [];
  (function walk(v, path) {
    if (Array.isArray(v)) {
      const objs = v.filter(isPlain);
      const idk = objs.length && objs.every((o) => ID_KEY(o)) ? ID_KEY(objs[0]) : null;
      if (idk && path.length) {
        const sample = objs[0];
        const label = LABEL_KEYS.find((k) => typeof sample[k] === "string") || Object.keys(sample).find((k) => k !== idk && typeof sample[k] === "string") || idk;
        found.push({ path, id: idk, label, ids: objs.map((o) => o[idk]) });
      }
      // los hijos de los elementos de una lista comparten el camino (sin índice)
      objs.forEach((o) => Object.entries(o).forEach(([k, x]) => (Array.isArray(x) || isPlain(x)) && walk(x, [...path, k])));
      return;
    }
    if (isPlain(v)) Object.entries(v).forEach(([k, x]) => walk(x, [...path, k]));
  })(estado, []);
  // un camino puede aparecer una vez por elemento del padre: se juntan
  const byPath = new Map();
  for (const f of found) { const k = f.path.join("."); if (byPath.has(k)) byPath.get(k).ids.push(...f.ids); else byPath.set(k, { ...f, ids: [...f.ids] }); }
  const list = [...byPath.values()];
  const last = (f) => f.path.at(-1);
  const kinds = {};
  for (const f of list) {
    const name = list.filter((g) => last(g) === last(f)).length > 1 ? f.path.join(".") : last(f);
    kinds[name] = { path: f.path, id: f.id, label: f.label };
  }
  const names = Object.keys(kinds);
  for (const n of names) {
    // el padre: el tipo más largo cuyo camino es prefijo propio de este
    const p = names.filter((m) => m !== n && kinds[m].path.length < kinds[n].path.length && kinds[m].path.every((k, i) => kinds[n].path[i] === k)).sort((a, b) => kinds[b].path.length - kinds[a].path.length)[0];
    kinds[n].parent = p || null;
  }
  const idKind = new Map();
  for (const f of list) { const n = names.find((m) => kinds[m].path.join(".") === f.path.join(".")); for (const x of f.ids) if (!idKind.has(J(x))) idKind.set(J(x), n); }
  return { kinds, idKind };
}

const ancestorsOf = (kinds, k) => { const out = []; for (let p = kinds[k]?.parent; p; p = kinds[p].parent) out.push(p); return out; };
/** "moverTarjeta" → "Mover tarjeta" */
export const humanize = (s) => { const w = String(s).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase().trim(); return w.charAt(0).toUpperCase() + w.slice(1); };

/**
 * El plan de controles: por cada acción, a quién pertenece y de dónde sale cada param.
 * @returns {{ kinds, acciones: [{ nombre, label, owner, ownerParam, ctx:[{p,kind}], choice:[{p,kind}], campos:[{p,num,prefill}] }], warnings: string[] }}
 */
export function controlsPlan(c) {
  const { kinds, idKind } = kindsOf(c.estado);
  const warnings = [];
  const acciones = c.acciones.map((a) => {
    const kindOf = (p) => idKind.get(J(a.ejemplo[a.params.indexOf(p)])) || null;
    const ids = a.ids.filter((p) => kindOf(p));
    // un id que no es de ninguna lista del estado (p.ej. un id suelto arriba) se trata como campo
    for (const p of a.ids.filter((p) => !kindOf(p))) warnings.push(`${a.nombre}: el id "${p}" no es de ninguna lista del estado; va como campo.`);
    const ownerParam = ids[0] || null;
    const owner = ownerParam ? kindOf(ownerParam) : "app";
    const anc = owner === "app" ? [] : ancestorsOf(kinds, owner);
    const ctx = [], choice = [];
    for (const p of ids.slice(1)) {
      const k = kindOf(p);
      if (anc.includes(k) && !ctx.some((x) => x.kind === k)) ctx.push({ p, kind: k });
      else choice.push({ p, kind: k });
    }
    const campos = a.params.filter((p) => !ids.includes(p)).map((p) => ({ p, num: typeof a.ejemplo[a.params.indexOf(p)] === "number", prefill: owner !== "app" }));
    return { nombre: a.nombre, label: humanize(a.nombre), owner, ownerParam, ctx, choice, campos, params: a.params };
  });
  return { kinds, acciones, warnings };
}

/** Dónde vive un tipo, en palabras para el pedido: estado.columns[].cards[] */
export const whereOf = (k) => "estado." + k.path.map((x) => x + "[]").join(".");

/** js/acciones.js: controlesDe(tipo, elemento, estado) → un <div> con los botones y campos de ese elemento. */
export function accionesJs(plan) {
  const K = Object.fromEntries(Object.entries(plan.kinds).map(([n, k]) => [n, { path: k.path, id: k.id, label: k.label }]));
  const A = plan.acciones.map(({ nombre, label, owner, ownerParam, ctx, choice, campos }) => ({ nombre, label, owner, ownerParam, ctx, choice, campos }));
  return `// js/acciones.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
// controlesDe(tipo, elemento, estado) devuelve un <div class="ctl-controles"> con un grupo por acción:
// sus campos visibles y su botón (data-accion, y los ids en data-*). dibujar() solo lo agrega adentro del elemento.
var TIPOS = ${J(K)};
var ACCIONES = ${J(A)};
function elementosDe(raiz, path) {
  var out = [raiz];
  path.forEach(function (k) { var nx = []; out.forEach(function (o) { var v = o && o[k]; if (Array.isArray(v)) v.forEach(function (x) { nx.push(x); }); }); out = nx; });
  return out;
}
// el elemento de tipo "anc" que contiene a "el" (de tipo "tipo")
function ancestroDe(estado, tipo, el, anc) {
  var T = TIPOS[tipo], A = TIPOS[anc], resto = T.path.slice(A.path.length);
  return elementosDe(estado, A.path).filter(function (a) { return elementosDe(a, resto).some(function (x) { return x[T.id] === el[T.id]; }); })[0];
}
function controlesDe(tipo, elemento, estado) {
  var box = document.createElement("div");
  box.className = "ctl-controles";
  ACCIONES.filter(function (a) { return a.owner === tipo; }).forEach(function (a) {
    var g = document.createElement("div");
    g.className = "ctl-accion";
    var ctxVal = {};
    a.ctx.forEach(function (x) { var an = elemento && ancestroDe(estado, tipo, elemento, x.kind); ctxVal[x.kind] = an ? an[TIPOS[x.kind].id] : undefined; });
    a.campos.forEach(function (f) {
      var i = document.createElement("input");
      i.type = f.num ? "number" : "text";
      i.dataset.campo = f.p;
      i.placeholder = f.p;
      if (f.prefill && elemento && elemento[f.p] !== undefined && typeof elemento[f.p] !== "object") i.value = elemento[f.p];
      g.appendChild(i);
    });
    a.choice.forEach(function (ch) {
      var s = document.createElement("select");
      s.dataset.campo = ch.p;
      var K = TIPOS[ch.kind];
      elementosDe(estado, K.path).forEach(function (o) {
        if (ctxVal[ch.kind] !== undefined && o[K.id] === ctxVal[ch.kind]) return;
        var op = document.createElement("option");
        op.value = o[K.id];
        op.textContent = o[K.label] !== undefined ? o[K.label] : o[K.id];
        s.appendChild(op);
      });
      g.appendChild(s);
    });
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ctl-boton";
    b.textContent = a.label;
    b.dataset.accion = a.nombre;
    if (a.ownerParam && elemento) b.dataset[a.ownerParam.toLowerCase()] = elemento[TIPOS[tipo].id];
    a.ctx.forEach(function (x) { if (ctxVal[x.kind] !== undefined) b.dataset[x.p.toLowerCase()] = ctxVal[x.kind]; });
    g.appendChild(b);
    box.appendChild(g);
  });
  return box;
}
`;
}

/** js/controles.js con el plan: dueño y contexto desde b.dataset; elecciones y campos desde el grupo del botón. */
export function controlesFromPlan(plan, ejemploOf) {
  const dk = (p) => p.toLowerCase();
  const line = (a) => {
    const isNum = (p) => typeof ejemploOf(a.nombre, p) === "number";
    const fromData = new Set([a.ownerParam, ...a.ctx.map((x) => x.p)].filter(Boolean));
    const arg = (p) => { const v = fromData.has(p) ? `b.dataset.${dk(p)}` : `campo(b, ${J(p)})`; return isNum(p) ? `num(${v})` : v; };
    const texts = a.campos.filter((f) => !f.num).map((f) => f.p);
    const empty = texts.length ? `if (${texts.map((p) => `campo(b, ${J(p)}) === ""`).join(" || ")}) return; ` : "";
    return `    case ${J(a.nombre)}: ${empty}estado = App.${a.nombre}(${["estado", ...a.params.map(arg)].join(", ")}); break;`;
  };
  return `// js/controles.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
let estado = App.crear();
// el valor del campo data-campo="<param>" que está al lado del botón (en su mismo elemento padre)
function campo(b, p) { var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return f ? f.value : undefined; }
function num(v) { return v === undefined || v === "" ? undefined : Number(v); }
document.getElementById("app").addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-accion]");
  if (!b) return;
  switch (b.dataset.accion) {
${plan.acciones.map(line).join("\n")}
    default: return;
  }
  dibujar(estado);
});
dibujar(estado);
`;
}
