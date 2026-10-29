// Hoja ROTA a propósito (29/10): las fórmulas muestran el texto, el color no se aplica y ocultar columna no hace nada.
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let estado = JSON.parse(localStorage.getItem("hoja") || "null") || { cols: 10, filas: 20, datos: {}, colores: {}, ocultasC: [], ocultasF: [] };
let sel = null; // { tipo: "celda"|"col"|"fila", c, f }
const k = (c, f) => `${c},${f}`;
const guardar = () => localStorage.setItem("hoja", JSON.stringify(estado));

function ref(nombre) { const m = /^([A-Z]+)(\d+)$/.exec(nombre.trim().toUpperCase()); return m ? { c: LETRAS.indexOf(m[1]), f: Number(m[2]) - 1 } : null; }
function valor(c, f, vis = new Set()) {
  const t = estado.datos[k(c, f)] ?? "";
  if (!String(t).startsWith("=")) return t === "" ? 0 : (isNaN(Number(t)) ? t : Number(t));
  if (vis.has(k(c, f))) return "#CICLO";
  vis.add(k(c, f));
  return calcular(String(t).slice(1), vis);
}
function rango(txt, vis) {
  const [a, b] = txt.split(":").map(ref);
  const out = [];
  for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) for (let f = Math.min(a.f, b.f); f <= Math.max(a.f, b.f); f++) out.push(Number(valor(c, f, new Set(vis))) || 0);
  return out;
}
function calcular(expr, vis) {
  const suma = /^SUMA\((.*)\)$/i.exec(expr.trim());
  if (suma) return suma[1].split(";").flatMap((p) => (p.includes(":") ? rango(p, vis) : [Number(valor(ref(p).c, ref(p).f, new Set(vis))) || 0])).reduce((a, b) => a + b, 0);
  const m = /^([A-Z]+\d+|\d+(?:\.\d+)?)\s*([-+*/])\s*([A-Z]+\d+|\d+(?:\.\d+)?)$/i.exec(expr.trim());
  if (!m) return "#ERROR";
  const v = (x) => (ref(x) ? Number(valor(ref(x).c, ref(x).f, new Set(vis))) || 0 : Number(x));
  const [x, y] = [v(m[1]), v(m[3])];
  return m[2] === "+" ? x + y : m[2] === "-" ? x - y : m[2] === "*" ? x * y : y === 0 ? "#DIV/0" : x / y;
}
function mostrar(c, f) { return estado.datos[k(c, f)] ?? ""; }

function dibujar() {
  const t = document.getElementById("hoja");
  t.innerHTML = "";
  const cab = t.insertRow();
  cab.appendChild(document.createElement("th"));
  for (let c = 0; c < estado.cols; c++) {
    if (estado.ocultasC.includes(c)) continue;
    const th = document.createElement("th"); th.textContent = LETRAS[c];
    if (sel?.tipo === "col" && sel.c === c) th.classList.add("sel");
    th.onclick = () => { sel = { tipo: "col", c }; dibujar(); };
    cab.appendChild(th);
  }
  for (let f = 0; f < estado.filas; f++) {
    if (estado.ocultasF.includes(f)) continue;
    const tr = t.insertRow();
    const th = document.createElement("th"); th.textContent = f + 1;
    if (sel?.tipo === "fila" && sel.f === f) th.classList.add("sel");
    th.onclick = () => { sel = { tipo: "fila", f }; dibujar(); };
    tr.appendChild(th);
    for (let c = 0; c < estado.cols; c++) {
      if (estado.ocultasC.includes(c)) continue;
      const td = tr.insertCell();
      td.textContent = mostrar(c, f);
      if (estado.colores[k(c, f)]) td.style.backgroundColor = estado.colores[k(c, f)];
      if ((sel?.tipo === "celda" && sel.c === c && sel.f === f) || (sel?.tipo === "col" && sel.c === c) || (sel?.tipo === "fila" && sel.f === f)) td.classList.add("sel");
      td.onclick = () => editar(td, c, f);
    }
  }
  document.getElementById("sel").textContent = !sel ? "Nada seleccionado" : sel.tipo === "col" ? `Columna ${LETRAS[sel.c]}` : sel.tipo === "fila" ? `Fila ${sel.f + 1}` : `Celda ${LETRAS[sel.c]}${sel.f + 1}`;
}
function editar(td, c, f) {
  sel = { tipo: "celda", c, f };
  const inp = document.createElement("input");
  inp.value = estado.datos[k(c, f)] ?? "";
  td.textContent = ""; td.appendChild(inp); inp.focus();
  let listo = false;
  const fin = () => { if (listo) return; listo = true; estado.datos[k(c, f)] = inp.value; guardar(); dibujar(); };
  inp.onkeydown = (e) => { if (e.key === "Enter") fin(); if (e.key === "Escape") { listo = true; dibujar(); } };
  inp.onblur = fin;
}
function celdasSel() {
  const out = [];
  if (!sel) return out;
  if (sel.tipo === "celda") out.push([sel.c, sel.f]);
  if (sel.tipo === "col") for (let f = 0; f < estado.filas; f++) out.push([sel.c, f]);
  if (sel.tipo === "fila") for (let c = 0; c < estado.cols; c++) out.push([c, sel.f]);
  return out;
}
function correr(tipo, i) {
  // borra la columna (o fila) i: lo de la derecha (o abajo) se corre un lugar
  const nd = {}, nc = {};
  for (const [kk, v] of Object.entries(estado.datos)) { const [c, f] = kk.split(",").map(Number); const x = tipo === "col" ? c : f; if (x === i) continue; const n = tipo === "col" ? k(x > i ? c - 1 : c, f) : k(c, x > i ? f - 1 : f); nd[n] = v; }
  for (const [kk, v] of Object.entries(estado.colores)) { const [c, f] = kk.split(",").map(Number); const x = tipo === "col" ? c : f; if (x === i) continue; const n = tipo === "col" ? k(x > i ? c - 1 : c, f) : k(c, x > i ? f - 1 : f); nc[n] = v; }
  estado.datos = nd; estado.colores = nc;
}
document.getElementById("color").addEventListener("nada", (e) => { celdasSel().forEach(([c, f]) => (estado.colores[k(c, f)] = e.target.value)); guardar(); dibujar(); });
document.getElementById("vaciar").onclick = () => { celdasSel().forEach(([c, f]) => delete estado.datos[k(c, f)]); guardar(); dibujar(); };
document.getElementById("borrar").onclick = () => { if (!sel || sel.tipo === "celda") return; correr(sel.tipo, sel.tipo === "col" ? sel.c : sel.f); sel = null; guardar(); dibujar(); };
document.getElementById("ocultar").onclick = () => {  if (sel?.tipo === "fila") estado.ocultasF.push(sel.f); sel = null; guardar(); dibujar(); };
document.getElementById("mostrar").onclick = () => { estado.ocultasC = []; estado.ocultasF = []; guardar(); dibujar(); };
dibujar();
