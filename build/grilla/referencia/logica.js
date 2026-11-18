// logica.js de REFERENCIA (la escribió Claude a mano, 17/11): la vara del modo --grilla. Con el núcleo del harness y esta
// lógica, el juez tiene que aprobar la hoja entera. Si no, el problema está en el núcleo (o en el juez), no en Gemma.
const Logica = {
  // lo que muestra una celda: el texto, o el resultado si empieza con "="
  valorDe(estado, id, vistos = []) {
    const t = String(estado.celdas[id]?.texto ?? "");
    if (!t.startsWith("=")) return t;
    if (vistos.includes(id)) return "#CICLO";
    const num = (ref) => { const v = Number(Logica.valorDe(estado, ref.toUpperCase(), [...vistos, id])); return Number.isFinite(v) ? v : 0; };
    const rango = (a, b) => {
      const [, ca, fa] = a.toUpperCase().match(/^([A-Z]+)(\d+)$/), [, cb, fb] = b.toUpperCase().match(/^([A-Z]+)(\d+)$/);
      const out = [];
      for (let c = Math.min(ca.charCodeAt(0), cb.charCodeAt(0)); c <= Math.max(ca.charCodeAt(0), cb.charCodeAt(0)); c++)
        for (let f = Math.min(+fa, +fb); f <= Math.max(+fa, +fb); f++) out.push(String.fromCharCode(c) + f);
      return out;
    };
    let e = t.slice(1).replace(/SUMA\(([^)]*)\)/gi, (_, dentro) => String(dentro.split(";").flatMap((p) => {
      const m = p.trim().match(/^([A-Za-z]+\d+):([A-Za-z]+\d+)$/);
      return m ? rango(m[1], m[2]) : [p.trim()];
    }).reduce((s, r) => s + (/^[A-Za-z]+\d+$/.test(r) ? num(r) : Number(r) || 0), 0)));
    e = e.replace(/\b([A-Za-z]+\d+)\b/g, (r) => String(num(r)));
    if (!/^[\d\s+\-*/().,]*$/.test(e)) return "#ERROR";
    try { const v = Function(`"use strict"; return (${e.replace(/,/g, ".")});`)(); return Number.isFinite(v) ? Math.round(v * 1e9) / 1e9 : "#DIV/0"; } catch { return "#ERROR"; }
  },
  pintar(estado, sel, color) { for (const id of sel.celdas) estado.celdas[id] = { ...(estado.celdas[id] || {}), color }; },
  vaciar(estado, sel) { for (const id of sel.celdas) if (estado.celdas[id]) estado.celdas[id].texto = ""; },
  borrar(estado, sel) { for (const id of sel.celdas) delete estado.celdas[id]; },
  ocultar(estado, sel) {
    if (sel.tipo === "columna" && !estado.ocultas.columnas.includes(sel.id)) estado.ocultas.columnas.push(sel.id);
    if (sel.tipo === "fila" && !estado.ocultas.filas.includes(sel.id)) estado.ocultas.filas.push(sel.id);
  },
};
