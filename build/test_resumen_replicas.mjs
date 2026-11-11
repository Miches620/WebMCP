// test_resumen_replicas.mjs — la tabla de las réplicas (sin modelo ni Chromium).
//   node build/test_resumen_replicas.mjs
import { leerLista, resultado, porVersion } from "./resumen_replicas.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

const L = leerLista("== réplicas MVC: 4 corridas\r\n14:30 EMPIEZA rep_sin_s1 (semilla 1) -> E:\\Proyectos 2026\\webmcp\\build\\proyectos\\x_rep_sin_s1\r\n15:10 TERMINA rep_sin_s1\r\n15:10 EMPIEZA rep_mvc_s1 (semilla 1) -> E:\\Proyectos 2026\\webmcp\\build\\proyectos\\x_rep_mvc_s1\r\n");
t("leerLista: nombre, versión (sin _sN), semilla y carpeta con espacios, aunque la lista tenga CRLF", L.length === 2 && L[0].version === "rep_sin" && L[1].version === "rep_mvc" && L[1].semilla === 1 && L[0].carpeta === "E:\\Proyectos 2026\\webmcp\\build\\proyectos\\x_rep_sin_s1", JSON.stringify(L));

const P = { filas: [{ id: "R1.1", r: "R1" }, { id: "R1.2", r: "R1" }, { id: "R4.1", r: "R4" }] };
const r = resultado(P, { "R1.1": { result: "PASS" }, "R1.2": { result: "PASS" }, "R4.1": { result: "FAIL" } }, ["R4.1", "R9.9"]);
t("resultado: requisito cumplido solo con TODAS sus pruebas; las filas pedidas una por una ('—' si no existe)", r.cumplidos === 1 && r.de === 2 && r.pruebas === 2 && r.fallan.join() === "R4" && r.filas["R4.1"] === "FAIL" && r.filas["R9.9"] === "—", JSON.stringify(r));

const V = porVersion([{ version: "rep_sin", cumplidos: 4, pruebas: 10, minutos: 30 }, { version: "rep_mvc", cumplidos: 7, pruebas: 14, minutos: 40 }, { version: "rep_sin", cumplidos: 5, pruebas: 11, minutos: 32 }, { version: "rep_mvc" }]);
t("porVersion: promedio por versión en orden de aparición; una corrida sin app final no cuenta", V[0].version === "rep_sin" && V[0].cumplidos === 4.5 && V[0].cada_una.join() === "4,5" && V[1].n === 1 && V[1].cumplidos === 7, JSON.stringify(V));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
