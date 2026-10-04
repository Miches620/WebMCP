// intent_cli.mjs — Intent Forge por consola (herramienta de debug).
// Usa el MISMO intent_brief.mjs que el pipeline (reemplaza a intent_forge_v02.ps1,
// que tenía su propio prompt y divergía del server).
//
//   node intent_cli.mjs                  pega la plantilla y terminá con una línea "."
//   node intent_cli.mjs plantilla.txt    la toma de un archivo
//   node intent_cli.mjs plantilla.txt --model qwen2.5-7b-instruct
//
// Deja la corrida en evidence/intent_forge/cli_<fecha>.json. No toca
// refined_prompt.json ni answer_key_requirements.json (eso es del pipeline).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { runIntentForge, linesWithItems, fieldLabel, TEMPLATE_TEXT, BRIEF_VERSION } from "./intent_brief.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const mi = args.indexOf("--model");
const model = mi >= 0 ? args[mi + 1] : "qwen2.5-7b-instruct";
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--model");
const rl = createInterface({ input: process.stdin, terminal: false });
const lineIt = rl[Symbol.asyncIterator]();
// Lee una línea; si stdin se termina (entrada por pipe), responde "listo".
async function ask(prompt = "") {
  process.stdout.write(prompt);
  const { value, done } = await lineIt.next();
  return done ? "listo" : value;
}

async function readBlock() {
  console.log(`Pegá la plantilla y terminá con una línea que tenga solo "."\n\n${TEMPLATE_TEXT}\n`);
  const lines = [];
  for (;;) {
    const l = await ask();
    if (l === "listo" || l.trim() === ".") break;
    lines.push(l);
  }
  return lines.join("\n");
}

const calls = [];
const callModel = async (messages) => {
  const t0 = Date.now();
  const res = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`LM Studio ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const content = (await res.json()).choices?.[0]?.message?.content || "";
  calls.push({ ms: Date.now() - t0, messages, content });
  return content;
};

const conversation = [{ role: "user", content: file ? readFileSync(file, "utf8") : await readBlock() }];
let r;
for (;;) {
  r = await runIntentForge(conversation, { callModel });
  if (r.status === "COMPLETE") break;
  if (r.faltantes?.length) console.log(`\n  (faltantes según el entrevistador: ${r.faltantes.join(" · ")})`);
  console.log(`\n[Intent Forge${r.by === "harness" ? " · harness" : ""}] ${r.question}`);
  conversation.push({ role: "assistant", content: r.question, ...(r.faltantes?.length ? { faltantes: r.faltantes } : {}) });
  conversation.push({ role: "user", content: await ask("> ") });
}
rl.close();

const ref = r.refined;
console.log(`\n=== ${ref.project_name} — ${ref.brief.items.length} ítems, ${ref.brief.preguntas.length} preguntas, reintentos ${ref.brief.repairs}, auto ${r.auto_added.length} ===`);
for (const { line, items } of linesWithItems(ref.brief)) {
  console.log(`\n${line.id} [${fieldLabel(line.field)}] "${line.text}"`);
  for (const it of items) console.log(`   → ${it.tipo.padEnd(11)} ${it.texto}${it.auto ? "   ⚠ ubicada por el harness" : ""}${it.compuesta ? "   ⚠ junta varias acciones" : ""}`);
}
const dir = join(here, "evidence", "intent_forge");
mkdirSync(dir, { recursive: true });
const out = join(dir, `cli_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
writeFileSync(out, JSON.stringify({ version: BRIEF_VERSION, model, conversation, refined_prompt: ref, auto_added: r.auto_added, calls }, null, 2));
console.log(`\nEvidencia: ${out}`);
