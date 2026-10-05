// test_json_loose.mjs — determinista.  node test_json_loose.mjs
import { parseJsonLoose } from "./json_loose.mjs";
let ok = 0, fail = 0;
const check = (n, fn) => { try { fn(); console.log(`✓ ${n}`); ok++; } catch (e) { console.log(`✗ ${n}\n    ${e.message}`); fail++; } };
const assert = (c, m = "falló") => { if (!c) throw new Error(m); };

check("JSON válido pasa sin reparar", () => { const r = parseJsonLoose('{"fases":[]}'); assert(r.ok && !r.repaired); });
check("fence y texto alrededor", () => { const r = parseJsonLoose('Acá va:\n```json\n{"fases":[{"id":"F1"}]}\n```\nlisto'); assert(r.ok && r.data.fases[0].id === "F1"); });
check("'\"' suelto después de la última } (caso Intent Forge P24)", () => assert(parseJsonLoose('{"a":1}"').ok));
check("coma faltante entre propiedades en líneas distintas (caso TechLeader P25)", () => {
  const raw = '{\n  "stack_sugerido": ["HTML"],\n  "fases": [\n    {"id": "F1", "name": "x", "depends_on": []}\n    {"id": "F2", "name": "y", "depends_on": ["F1"]}\n  ]\n  "diferido": []\n}';
  const r = parseJsonLoose(raw);
  assert(r.ok, r.error); assert(r.data.fases.length === 2 && Array.isArray(r.data.diferido));
});
check("coma colgante y comentarios", () => assert(parseJsonLoose('{\n// plan\n"fases": [1,2,],\n}').ok));
check("irreparable → ok:false con el error original", () => { const r = parseJsonLoose('{"fases": [ {"id": "F1" "name": "x"} ]}'); assert(!r.ok && /JSON|Expected|Unexpected/.test(r.error)); });
console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
