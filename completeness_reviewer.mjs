const DEFAULT_MODEL = "qwen2.5-7b-instruct";
const DEFAULT_ENDPOINT = "http://127.0.0.1:1234/v1/chat/completions";

const LENSES = ["GAP", "EXCESS", "AMBIGUOUS"];

const SYSTEM_PROMPT = `
Eres un Completeness Reviewer.

Tu única responsabilidad es revisar un Graph de Atomic Tasks
contra el prompt original.

NO diseñes.
NO corrijas.
NO propongas arquitectura.
NO generes Atomic Tasks.
NO inventes requisitos.

Tu análisis debe distinguir entre:

GAP:
Una exigencia explícita del prompt que no está representada
en el Graph.

EXCESS:
Un elemento del Graph que no tiene sustento explícito en el
prompt. No evalúes si la decisión técnica es buena o mala.

AMBIGUOUS:
Una parte del prompt que admite al menos dos interpretaciones
razonables y cuya interpretación puede cambiar qué debería
representar el Graph.

Reglas:

1. GAP requiere evidencia textual concreta del prompt.
2. EXCESS requiere identificar concretamente el elemento del Graph
   que carece de sustento explícito.
3. AMBIGUOUS requiere dos interpretaciones razonables y explicar
   por qué cambian el Graph.
4. No conviertas decisiones técnicas razonables derivadas del
   requisito en EXCESS sin demostrar ausencia de sustento.
5. No conviertas reglas de proceso, Stage o Governance en requisitos
   del producto salvo que estén expresamente formuladas como tales
   en el prompt recibido.
6. Si no existe evidencia suficiente, devuelve [].
7. No fuerces hallazgos.
8. Responde únicamente JSON válido.

Formato obligatorio:

{
  "findings": []
}

Cada finding debe tener:

{
  "detail": "...",
  "prompt_evidence": "...",
  "graph_evidence": "...",
  "reason": "..."
}
`;

function compactTask(task) {
  return {
    id: task?.id ?? null,
    phase: task?.phase ?? null,
    role: task?.role ?? null,
    task: task?.task ?? null,
    depends_on: Array.isArray(task?.depends_on) ? task.depends_on : [],
    status: task?.status ?? null,
    resolver_status: task?.resolver_status ?? null,
  };
}

function normalizeFinding(finding, lens) {
  if (!finding || typeof finding !== "object") {
    return null;
  }

  const detail =
    typeof finding.detail === "string" ? finding.detail.trim() : "";

  if (!detail) {
    return null;
  }

  return {
    type: lens,
    detail,
    prompt_evidence:
      typeof finding.prompt_evidence === "string"
        ? finding.prompt_evidence.trim()
        : "",
    graph_evidence:
      typeof finding.graph_evidence === "string"
        ? finding.graph_evidence.trim()
        : "",
    reason: typeof finding.reason === "string" ? finding.reason.trim() : "",
  };
}

function parseJsonObject(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Reviewer no devolvió contenido.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Reviewer no devolvió JSON válido.");
    }

    return JSON.parse(match[0]);
  }
}

function validateLensOutput(parsed, lens) {
  if (!parsed || !Array.isArray(parsed.findings)) {
    throw new Error(`Reviewer ${lens} no devolvió findings[].`);
  }

  return parsed.findings
    .map((finding) => normalizeFinding(finding, lens))
    .filter(Boolean);
}

function buildLensPrompt(lens, promptText, atomicTasks) {
  const graph = atomicTasks.map(compactTask);

  let instruction = "";

  if (lens === "GAP") {
    instruction = `
LENTE GAP.

Busca solamente omisiones que el prompt exija explícitamente.

Cada hallazgo debe poder señalar:
- qué exige el prompt;
- por qué el Graph no lo representa.

Si no puedes demostrarlo con evidencia textual del prompt,
devuelve findings=[].
`;
  }

  if (lens === "EXCESS") {
    instruction = `
LENTE EXCESS.

Busca solamente elementos del Graph que no tengan sustento
explícito en el prompt.
NO juzgues la calidad técnica.
NO confundas una implementación necesaria con un requisito nuevo.

Si el elemento puede derivarse razonablemente de un requisito
explícito, no lo marques.

Si no puedes demostrar ausencia de sustento explícito,
devuelve findings=[].
`;
  }

  if (lens === "AMBIGUOUS") {
    instruction = `
LENTE AMBIGUOUS.

Busca solamente ambigüedades del prompt que admitan al menos
dos interpretaciones razonables y que puedan producir Graphs
diferentes.

Si la ambigüedad es irrelevante para el Graph, no la marques.

Si no existe una ambigüedad material, devuelve findings=[].
`;
  }

  return `
${instruction}

PROMPT ORIGINAL:
<<<
${promptText}
>>>

GRAPH DE ATOMIC TASKS:
<<<
${JSON.stringify(graph, null, 2)}
>>>

Devuelve únicamente:
{
  "findings": []
}
`;
}

async function callReviewer(endpoint, model, lens, promptText, atomicTasks) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildLensPrompt(lens, promptText, atomicTasks),
        },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Completeness Reviewer ${lens}: HTTP ${response.status}`);
  }

  const data = await response.json();

  const raw = data?.choices?.[0]?.message?.content;

  if (!raw) {
    throw new Error(`Completeness Reviewer ${lens} no devolvió contenido.`);
  }

  return validateLensOutput(parseJsonObject(raw), lens);
}

export async function runCompletenessReview(
  promptText,
  atomicTasks,
  options = {},
) {
  if (!promptText || typeof promptText !== "string") {
    throw new Error("Falta promptText.");
  }

  if (!Array.isArray(atomicTasks)) {
    throw new Error("atomicTasks debe ser un array del Graph.");
  }

  const model = options.model || DEFAULT_MODEL;

  const endpoint = options.endpoint || DEFAULT_ENDPOINT;

  const logCallback =
    typeof options.logCallback === "function" ? options.logCallback : () => {};

  const findings = {
    GAP: [],
    EXCESS: [],
    AMBIGUOUS: [],
  };

  const timing = {};

  for (const lens of LENSES) {
    const started = Date.now();

    logCallback(`Completeness Reviewer → ${lens}`);

    findings[lens] = await callReviewer(
      endpoint,
      model,
      lens,
      promptText,
      atomicTasks,
    );

    timing[`${lens.toLowerCase()}_ms`] = Date.now() - started;
  }

  const summary = {
    gap_count: findings.GAP.length,
    excess_count: findings.EXCESS.length,
    ambiguous_count: findings.AMBIGUOUS.length,
    total_findings:
      findings.GAP.length + findings.EXCESS.length + findings.AMBIGUOUS.length,
  };

  return {
    model,
    findings,
    summary,
    timing_ms: timing,
  };
}
