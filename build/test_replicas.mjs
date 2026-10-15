// test_replicas.mjs — resumen de réplicas (p48, 15/10).   node build/test_replicas.mjs
import { summarizeReplicas, replicasText } from "./replicas_summary.mjs";
let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

const ev = ({ seed = null, temp = 0, r3 = "PASS", f34 = "CUMPLIDA", huella = { "index.html": "aaa", "js/logica.js": "bbb" } } = {}) => ({
  muestreo: { temperature: temp, seed }, huella,
  summary: { PASS: r3 === "PASS" ? 8 : 7, FAIL: r3 === "PASS" ? 0 : 1, SIN_EVIDENCIA: 1 },
  coverage: [{ id: "R1", text: "Crear tarjetas", verdict: "PASS" }, { id: "R3", text: "Agregar comentarios", verdict: r3 }],
  task_verdicts: { counts: { CUMPLIDA: f34 === "CUMPLIDA" ? 12 : 11 }, rows: [{ id: "F2.4", pieza: "logica", verdict: "CUMPLIDA" }, { id: "F3.4", pieza: "logica", verdict: f34 }] },
});
const bd = (att) => ({ specialist: { steps: [{ task_id: "contrato", attempts: [1] }, { task_id: "dibujo", attempts: Array(att).fill(1) }, { task_id: "acciones", by: "harness", attempts: [1] }] } });

// temperatura 0: los 3 builds del 15/10 (mismas huellas)
const same = summarizeReplicas([1, 2, 3].map((k) => ({ dir: `r${k}`, evidence: ev(), build: bd(2) })));
t("temperatura 0 con huellas iguales → 'no son réplicas'", same.identicas === true && /no son réplicas/.test(replicasText(same)));
t("requisitos: R1 PASS 3/3", same.requisitos.find((r) => r.id === "R1").cuenta.PASS === 3);

// réplicas de verdad: archivos distintos, un FAIL, un reintento más
const runs = [
  { dir: "a", evidence: ev({ seed: 1, temp: 0.7 }), build: bd(1) },
  { dir: "b", evidence: ev({ seed: 2, temp: 0.7, r3: "FAIL", huella: { "index.html": "aaa", "js/logica.js": "ccc" } }), build: bd(2) },
  { dir: "c", evidence: ev({ seed: 3, temp: 0.7, f34: "NO_CUMPLIDA", huella: { "index.html": "aaa", "js/logica.js": "ddd" } }), build: bd(3) },
];
const s = summarizeReplicas(runs), txt = replicasText(s);
t("réplicas: no son idénticas; logica.js 3 versiones, index.html 1", !s.identicas && s.archivos.find((a) => a.archivo === "js/logica.js").versiones === 3 && s.archivos.find((a) => a.archivo === "index.html").versiones === 1, JSON.stringify(s.archivos));
t("R3: PASS 2/3 · FAIL 1/3", s.requisitos.find((r) => r.id === "R3").cuenta.PASS === 2 && s.requisitos.find((r) => r.id === "R3").cuenta.FAIL === 1 && /R3 Agregar comentarios: PASS 2\/3 · FAIL 1\/3/.test(txt), txt);
t("pasos: intentos por corrida y el del harness marcado", s.pasos.find((p) => p.id === "dibujo").intentos.join() === "1,2,3" && /acciones \(harness\): 1, 1, 1/.test(txt));
t("tareas: solo se listan las que variaron (F3.4)", /F3\.4 \[logica\]: CUMPLIDA 2\/3 · NO_CUMPLIDA 1\/3/.test(txt) && !/F2\.4 \[/.test(txt), txt);
t("muestreo de cada corrida en el texto", /t=0\.7 seed 1 \| t=0\.7 seed 2 \| t=0\.7 seed 3/.test(txt));

// corridas viejas sin huella: no se afirma nada
const old = summarizeReplicas([{ dir: "x", evidence: { ...ev(), huella: undefined }, build: null }, { dir: "y", evidence: { ...ev(), huella: undefined }, build: null }]);
t("sin huella → no dice 'idénticas', avisa que no se puede saber", !old.identicas && old.conHuella === 0 && /sin huella/.test(replicasText(old)));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
