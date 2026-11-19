// nucleo.js — lo escribe el harness (modo núcleo, tablero Kanban): NO lo cambies.
// Dibuja las columnas (de tablero.json), las tarjetas, el contador, el botón de agregar con su formulario, editar, borrar
// (con la pregunta), arrastrar entre columnas, y guarda/carga. Las REGLAS son de logica.js: crear, editar, borrar, mover,
// ordenar y preguntaBorrar.
(function () {
  var CLAVE = "tablero";
  var T = typeof TABLERO === "object" && TABLERO ? TABLERO : { columnas: [], agregar_en: null, campos: [] };
  var K = window.Kanban = { estado: null, tablero: T };
  var raiz = document.getElementById("tablero");
  var aviso = document.getElementById("aviso");
  var modal = document.getElementById("formulario-modal"), form = document.getElementById("formulario"), campos = document.getElementById("formulario-campos"), nombreForm = document.getElementById("formulario-nombre");
  var confirma = document.getElementById("confirmar-modal"), pregunta = document.getElementById("confirmar-pregunta");
  var editando = null, borrando = null;

  // las funciones de logica.js: en un objeto Logica o sueltas (function crear(...) {...}); nunca una del navegador
  function fn(n) {
    if (typeof Logica === "object" && Logica && typeof Logica[n] === "function") return Logica[n];
    var f = window[n];
    return typeof f === "function" && !/\[native code\]/.test(Function.prototype.toString.call(f)) ? f : null;
  }
  function vacio() { return { tarjetas: [], siguiente: 1 }; }
  function sano(e) {
    e = e && typeof e === "object" && !Array.isArray(e) ? e : vacio();
    if (!Array.isArray(e.tarjetas)) e.tarjetas = [];
    e.tarjetas = e.tarjetas.filter(function (t) { return t && typeof t === "object"; });
    if (!(Number(e.siguiente) > 0)) e.siguiente = 1;
    e.tarjetas.forEach(function (t) {
      if (t.id == null) t.id = "t" + e.siguiente++;
      t.id = String(t.id);
      t.titulo = t.titulo == null ? "" : String(t.titulo);
      if (!t.campos || typeof t.campos !== "object" || Array.isArray(t.campos)) t.campos = {};
      if (!(Number(t.creada) > 0)) t.creada = e.siguiente++;
    });
    return e;
  }
  function cargar() { try { K.estado = sano(JSON.parse(localStorage.getItem(CLAVE))); } catch (e) { K.estado = sano(vacio()); } }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(K.estado)); } catch (e) {} }
  function buscar(id) { return K.estado.tarjetas.filter(function (t) { return t.id === id; })[0] || null; }
  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  // v0.2: lo que abre y cierra el núcleo (los formularios, el aviso) se muestra con un estilo que styles.css no puede pisar
  // (en las réplicas, un ".modal { display: none }" de Gemma escondía el formulario y agregar dejaba de andar)
  var FORZAR = { display: null, visibility: "visible", opacity: "1" };
  function mostrar(e, si, display) {
    e.hidden = !si;
    Object.keys(FORZAR).forEach(function (k) {
      if (si) e.style.setProperty(k, k === "display" ? display : FORZAR[k], "important"); else e.style.removeProperty(k);
    });
  }
  function avisar(msj) { aviso.textContent = msj; mostrar(aviso, !!msj, "block"); }

  // una regla de logica.js: cambia estado (o devuelve uno nuevo); si devuelve un texto, es un aviso y no cambia nada
  function hacer(nombre, args, para) {
    var f = fn(nombre);
    if (!f) { console.error("la función " + nombre + " no existe en logica.js: el núcleo la usa para " + para); return; }
    var antes = copia(K.estado);
    try {
      var r = f.apply(null, [K.estado].concat(args));
      if (typeof r === "string" && r) { K.estado = antes; avisar(r); }
      else { if (r && typeof r === "object" && !Array.isArray(r)) K.estado = r; avisar(""); }
    } catch (e) { K.estado = antes; console.error(nombre + " (logica.js) tiró un error: " + e.message); }
    K.estado = sano(K.estado); guardar(); dibujar();
  }

  function ordenadas(col) {
    var ts = K.estado.tarjetas.filter(function (t) { return t.columna === col; });
    var f = fn("ordenar");
    if (!f) return ts;
    try {
      var r = f(copia(ts), col);
      if (!Array.isArray(r)) { console.error("ordenar (logica.js) no devolvió una lista de tarjetas"); return ts; }
      return r.map(function (x) { return x && buscar(String(x.id)); }).filter(Boolean);
    } catch (e) { console.error("ordenar (logica.js) tiró un error: " + e.message); return ts; }
  }
  function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; }
  function boton(cls, texto, titulo) { var b = el("button", cls, texto); b.type = "button"; if (titulo) { b.title = titulo; b.setAttribute("aria-label", titulo); } return b; }

  function dibujar() {
    raiz.textContent = "";
    T.columnas.forEach(function (col) {
      var ts = ordenadas(col);
      var s = el("section", "columna"); s.dataset.columna = col;
      var cab = el("div", "cabecera");
      cab.appendChild(el("h2", null, col));
      cab.appendChild(el("span", "contador", String(ts.length)));
      s.appendChild(cab);
      var lista = el("div", "lista");
      ts.forEach(function (t) {
        var a = el("article", "tarjeta"); a.draggable = true; a.dataset.id = t.id;
        a.appendChild(el("span", "manija", "⠿"));
        a.appendChild(el("h3", null, t.titulo));
        T.campos.forEach(function (c) {
          var v = t.campos[c.nombre];
          if (v == null || v === "") return;
          var p = el("p", "campo", String(v)); p.dataset.campo = c.nombre; a.appendChild(p);
        });
        var bs = el("div", "botones");
        bs.appendChild(boton("editar", "✏️", "Editar tarjeta"));
        bs.appendChild(boton("borrar", "🗑️", "Borrar tarjeta"));
        a.appendChild(bs);
        lista.appendChild(a);
      });
      s.appendChild(lista);
      if (col === T.agregar_en) s.appendChild(boton("agregar", "+ Agregar tarjeta"));
      raiz.appendChild(s);
    });
  }

  // ---- el formulario (agregar y editar): los campos salen de tablero.json
  function abrirForm(t) {
    editando = t ? t.id : null;
    nombreForm.textContent = t ? "Editar tarjeta" : "Nueva tarjeta";
    campos.textContent = "";
    var fila = function (etiqueta, nombre, control) { var l = el("label", "campo-form"); l.appendChild(el("span", null, etiqueta)); control.name = nombre; l.appendChild(control); campos.appendChild(l); };
    var ti = document.createElement("input"); ti.type = "text"; ti.value = t ? t.titulo : ""; fila("Título", "titulo", ti);
    T.campos.forEach(function (c) {
      var x, v = t ? t.campos[c.nombre] : null;
      if (c.tipo === "opciones") {
        x = document.createElement("select");
        c.opciones.forEach(function (o) { var op = document.createElement("option"); op.value = o; op.textContent = o; x.appendChild(op); });
        if (v != null) x.value = v;
      } else { x = document.createElement(c.tipo === "largo" ? "textarea" : "input"); if (x.tagName === "INPUT") x.type = "text"; x.value = v == null ? "" : v; }
      fila(c.nombre, c.nombre, x);
    });
    mostrar(modal, true, "flex"); ti.focus();
  }
  function cerrarForm() { mostrar(modal, false); editando = null; }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var datos = { titulo: form.elements.titulo.value.trim(), campos: {} };
    T.campos.forEach(function (c) { var x = form.elements[c.nombre]; if (x) datos.campos[c.nombre] = x.value; });
    var id = editando; cerrarForm();
    if (id) hacer("editar", [id, datos], "editar una tarjeta (el formulario de ✏️)");
    else {
      var n = K.estado.siguiente++;
      hacer("crear", [{ id: "t" + n, titulo: datos.titulo, columna: T.agregar_en, creada: n, campos: datos.campos }], "crear una tarjeta (el botón de agregar)");
    }
  });
  document.getElementById("formulario-cancelar").addEventListener("click", cerrarForm);

  // ---- borrar: si logica.js tiene preguntaBorrar, primero se pregunta
  function pedirBorrar(t) {
    var f = fn("preguntaBorrar"), q = null;
    if (f) { try { q = f(copia(t)); } catch (e) { console.error("preguntaBorrar (logica.js) tiró un error: " + e.message); } }
    if (!q) return hacer("borrar", [t.id], "borrar una tarjeta (el botón 🗑️)");
    borrando = t.id; pregunta.textContent = String(q); mostrar(confirma, true, "flex");
  }
  document.getElementById("confirmar-si").addEventListener("click", function () { var id = borrando; borrando = null; mostrar(confirma, false); if (id) hacer("borrar", [id], "borrar una tarjeta (el botón 🗑️)"); });
  document.getElementById("confirmar-no").addEventListener("click", function () { borrando = null; mostrar(confirma, false); });

  raiz.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("button"); if (!b) return;
    if (b.classList.contains("agregar")) return abrirForm(null);
    var a = b.closest(".tarjeta"), t = a && buscar(a.dataset.id); if (!t) return;
    if (b.classList.contains("editar")) abrirForm(t);
    else if (b.classList.contains("borrar")) pedirBorrar(t);
  });

  // ---- arrastrar una tarjeta a otra columna
  raiz.addEventListener("dragstart", function (ev) { var a = ev.target.closest && ev.target.closest(".tarjeta"); if (a) { ev.dataTransfer.setData("text/plain", a.dataset.id); ev.dataTransfer.effectAllowed = "move"; } });
  raiz.addEventListener("dragover", function (ev) { if (ev.target.closest && ev.target.closest(".columna")) ev.preventDefault(); });
  raiz.addEventListener("drop", function (ev) {
    var s = ev.target.closest && ev.target.closest(".columna"); if (!s) return;
    ev.preventDefault();
    var t = buscar(ev.dataTransfer.getData("text/plain"));
    if (t && t.columna !== s.dataset.columna) hacer("mover", [t.id, s.dataset.columna], "mover una tarjeta (arrastrarla a otra columna)");
  });

  if (!T.columnas.length) console.error("tablero.json no tiene columnas: no hay nada para dibujar");
  cargar(); dibujar();
})();
