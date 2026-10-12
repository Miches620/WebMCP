// js/acciones.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
// controlesDe(tipo, elemento, estado) devuelve un <div class="ctl-controles"> con un grupo por acción:
// sus campos visibles y su botón (data-accion, y los ids en data-*). dibujar() solo lo agrega adentro del elemento.
var TIPOS = {"columns":{"path":["columns"],"id":"id","label":"title"},"cards":{"path":["columns","cards"],"id":"id","label":"content"}};
var ACCIONES = [{"nombre":"agregarTarjeta","label":"Agregar tarjeta","owner":"columns","ownerParam":"columnaId","ctx":[],"choice":[],"campos":[{"p":"contenido","num":false,"prefill":true}]},{"nombre":"moverTarjeta","label":"Mover tarjeta","owner":"cards","ownerParam":"tarjetaId","ctx":[{"p":"nuevaColumnaId","kind":"columns"}],"choice":[],"campos":[]},{"nombre":"agregarComentario","label":"Agregar comentario","owner":"cards","ownerParam":"cardId","ctx":[],"choice":[],"campos":[{"p":"textoComentario","num":false,"prefill":true}]},{"nombre":"agregarEtiqueta","label":"Agregar etiqueta","owner":"cards","ownerParam":"cardId","ctx":[],"choice":[],"campos":[{"p":"etiquetaTexto","num":false,"prefill":true}]},{"nombre":"editarTarjeta","label":"Editar tarjeta","owner":"cards","ownerParam":"cardId","ctx":[],"choice":[],"campos":[{"p":"nuevoContenido","num":false,"prefill":true}]},{"nombre":"borrarTarjeta","label":"Borrar tarjeta","owner":"cards","ownerParam":"tarjetaId","ctx":[{"p":"columnaId","kind":"columns"}],"choice":[],"campos":[]}];
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
