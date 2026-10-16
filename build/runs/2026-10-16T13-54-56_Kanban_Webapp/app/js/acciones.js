// js/acciones.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
// controlesDe(tipo, elemento, estado) devuelve un <div class="ctl-controles"> con un grupo por acción:
// sus campos visibles y su botón (data-accion, y los ids en data-*). dibujar() solo lo agrega adentro del elemento.
var TIPOS = {"columnas":{"path":["columnas"],"id":"id","label":"titulo"},"tarjetas":{"path":["columnas","tarjetas"],"id":"id","label":"titulo"}};
var ACCIONES = [{"nombre":"crearTarjeta","label":"Crear tarjeta","owner":"columnas","ownerParam":"columnaOrigenId","ctx":[],"choice":[],"campos":[{"p":"titulo","num":false,"prefill":true},{"p":"descripcion","num":false,"prefill":true},{"p":"prioridad","num":false,"prefill":true}]},{"nombre":"editarTarjeta","label":"Editar tarjeta","owner":"tarjetas","ownerParam":"id","ctx":[],"choice":[],"campos":[{"p":"nuevoTitulo","num":false,"prefill":true},{"p":"nuevaDescripcion","num":false,"prefill":true},{"p":"nuevaPrioridad","num":false,"prefill":true}]},{"nombre":"borrarTarjeta","label":"Borrar tarjeta","owner":"tarjetas","ownerParam":"id","ctx":[{"p":"columnaId","kind":"columnas"}],"choice":[],"campos":[]},{"nombre":"moverTarjeta","label":"Mover tarjeta","owner":"tarjetas","ownerParam":"cardId","ctx":[{"p":"origenColumnaId","kind":"columnas"}],"choice":[{"p":"destinoColumnaId","kind":"columnas","notHere":true}],"campos":[]}];
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
      // un destino del tipo de un ancestro no ofrece el lugar donde ya está el elemento
      var aca = ctxVal[ch.kind];
      if (aca === undefined && ch.notHere && elemento) { var an = ancestroDe(estado, tipo, elemento, ch.kind); aca = an ? an[K.id] : undefined; }
      elementosDe(estado, K.path).forEach(function (o) {
        if (aca !== undefined && o[K.id] === aca) return;
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
