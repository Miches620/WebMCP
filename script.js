import { validateRoleDependencies } from "./validation_profile_role_dependencies.mjs";
import { runAtomicGraph, resolveDependencies } from "./atomic_engine_v5.js";
import { runCompletenessReview } from "./completeness_reviewer.mjs";

const STORAGE_KEY = "webmcp_state";
const MAX_TECHLEADER_ATTEMPTS = 3; // Nuevo: Límite de reintentos del TechLeader

let GLOBAL_ID = 1;

let webmcpState = {
  prompt: "",
  projectId: null,
  atomicTasks: [],
  unresolvedTasks: [],
  htmlGenerated: "",
  isGenerating: false,
  lastPhase: 0,
  lastGlobalId: 1,
  fullPlan: null,
  rejectedTasks: [],
  dependencyGraph: null,
  replacementMap: {},
};

const techLeaderPrompt = `Eres un TechLeader Senior.

Tu responsabilidad es analizar el proyecto solicitado y construir su PLAN DE FASES.

NO debes atomizar las fases en Atomic Tasks.
NO debes ejecutar tareas.
NO debes diseñar cada implementación en detalle.

Tu salida debe representar únicamente las fases necesarias para organizar la ejecución del proyecto.

INVESTIGACIÓN PREVIA:

Puedes utilizar Context7 para investigar proyectos, arquitecturas,
patrones o implementaciones similares al proyecto solicitado.

Utiliza esa investigación como referencia para determinar una
estructura de fases razonable.

No copies una estructura únicamente porque aparezca en un proyecto similar:
adáptala al objetivo, alcance y contexto del proyecto actual.

REGLAS:

1. Determina CUÁNTAS FASES sean realmente necesarias.

NO existe un número fijo máximo o mínimo de fases.

No agregues fases artificiales para alcanzar una cantidad determinada.

No fusiones fases diferentes únicamente para reducir su cantidad.

2. Cada fase debe representar una unidad coherente de trabajo del proyecto.

3. Cada fase DEBE tener un "responsable_sugerido".

4. "responsable_sugerido" DEBE ser EXACTAMENTE UNO de estos roles:

"Backend"
"Frontend"
"DBA"
"DevOps"
"QA"

5. El responsable debe ser el rol más adecuado para comprender y
posteriormente atomizar esa fase.

Ejemplos:

Persistencia, tablas, índices, migraciones → DBA
APIs, servicios, lógica de negocio → Backend
UI, componentes, pantallas → Frontend
Deploy, CI/CD, configuración de ejecución → DevOps
Pruebas y automatización de pruebas → QA

6. Una fase puede depender conceptualmente de otra.

Si existe una dependencia necesaria, exprésala mediante "depends_on".

7. NO conviertas una fase en una lista de Atomic Tasks.

La atomización será realizada posteriormente por otro nodo especializado.

8. NO agregues trabajo que no sea necesario para cumplir el objetivo solicitado.

9. NO inventes requisitos.

Si una decisión importante no puede determinarse con la información disponible,
mantenla explícita en la fase en lugar de inventarla.

10. El resultado debe permitir que cada fase sea enviada posteriormente,
de manera independiente, a un Atomizer que asumirá temporalmente el rol
indicado en "responsable_sugerido".

11. La descripción debe explicar QUÉ debe lograrse en la fase y su alcance
suficiente para que el Atomizer pueda trabajar sobre ella.

NO describas todavía cómo implementarla paso a paso.

12. Puedes utilizar Context7 antes de generar el resultado para contrastar
el proyecto con implementaciones similares.

RESPONDE ÚNICAMENTE CON JSON VÁLIDO.

NO incluyas markdown.
NO incluyas explicaciones fuera del JSON.

FORMATO OBLIGATORIO:

{
  "stack_sugerido": ["..."],
  "fases": [
    {
      "id": "F1",
      "name": "...",
      "responsable_sugerido": "DBA",
      "description": "...",
      "depends_on": []
    }
  ],
  "features_clave": ["..."]
}

PROYECTO:
`;

const ROLES_VALIDOS = ["Backend", "Frontend", "DBA", "DevOps", "QA"];

function appendToReasoning(html) {
  const reasoningPanel = document.getElementById("llmReasoningOutput");
  if (!reasoningPanel) return;
  reasoningPanel.innerHTML += html;
  reasoningPanel.scrollTop = reasoningPanel.scrollHeight;
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const savedState = JSON.parse(stored);
      webmcpState = { ...webmcpState, ...savedState };
      GLOBAL_ID = webmcpState.lastGlobalId || 1;
    } catch (e) {
      console.error("Error cargando state", e);
    }
  }
  if (webmcpState.atomicTasks.length > 0) {
    updateUIFromState();
  }
  toggleResumeButtons();
}

function saveState() {
  webmcpState.lastGlobalId = GLOBAL_ID;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(webmcpState));
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  webmcpState = {
    prompt: "",
    projectId: null,
    atomicTasks: [],
    unresolvedTasks: [],
    htmlGenerated: "",
    isGenerating: false,
    lastPhase: 0,
    lastGlobalId: 1,
    fullPlan: null,
    rejectedTasks: [],
    dependencyGraph: null,
    replacementMap: {},
  };
  GLOBAL_ID = 1;
  updateUIFromState();
  toggleResumeButtons();
  document.getElementById("initial-view").classList.remove("hidden");
  document.getElementById("orchestration-view").classList.add("hidden");
}

function toggleResumeButtons() {
  const hasProgress = webmcpState.atomicTasks.length > 0;
  document
    .getElementById("resumeButton")
    .classList.toggle("hidden", !hasProgress);
  document
    .getElementById("newProjectButton")
    .classList.toggle("hidden", !hasProgress);
}

function updateUIFromState() {
  const promptInput = document.getElementById("projectPrompt");
  if (promptInput) {
    promptInput.value = webmcpState.prompt;
  }
  renderTaskList();
  updatePreview();
}

function renderTaskList() {
  const taskListContainer = document.getElementById("taskListContainer");
  const taskCountElement = document.getElementById("taskCount");
  if (!taskListContainer) return;

  taskListContainer.innerHTML = "";
  webmcpState.atomicTasks = (webmcpState.atomicTasks || []).filter(
    (t) => t && t.id && t.role,
  );

  const roleColors = {
    DBA: "bg-purple-600 text-white",
    Backend: "bg-blue-600 text-white",
    Frontend: "bg-orange-500 text-white",
    DevOps: "bg-gray-600 text-white",
    QA: "bg-pink-600 text-white",
    "A CONFIRMAR": "bg-red-600 text-white",
  };

  webmcpState.atomicTasks.slice(-100).forEach((task) => {
    if (!task || !task.id) return;
    const roleBadgeClass = roleColors[task.role] || "bg-yellow-500 text-black";
    const borderClass =
      task.resolver_status === "READY"
        ? "border-green-600 bg-green-900/20"
        : task.resolver_status === "BLOCKED"
          ? "border-yellow-600 bg-yellow-900/20"
          : task.resolver_status === "PENDING"
            ? "border-cyan-600 bg-cyan-900/20"
            : "border-gray-700 bg-gray-800";

    const statusBadge =
      task.resolver_status === "READY"
        ? `<span class="text-green-400">✅ ${task.resolver_status}</span>`
        : task.resolver_status === "BLOCKED"
          ? `<span class="text-yellow-400">⏸ ${task.resolver_status}</span>`
          : `<span class="text-cyan-400">🕒 ${task.resolver_status || task.status || "Pendiente"}</span>`;

    const blockedInfo =
      task.blocked_by && task.blocked_by.length
        ? `<div class="text-xs text-red-400 mt-1">🔒 Bloqueada por: ${task.blocked_by.join(", ")}</div>`
        : "";

    taskListContainer.innerHTML += `
      <div class="p-3 border rounded-md mb-2 text-sm ${borderClass} transition-all">
        <div class="flex justify-between items-center">
          <div class="font-mono text-cyan-400 font-bold">${task.id}</div>
          <div class="text-xs px-2 py-1 rounded">${statusBadge}</div>
        </div>
        <div class="text-white mt-1 font-medium">${task.task || "Sin titulo"}</div>
        <div class="flex gap-2 mt-2 items-center">
          <span class="text-[10px] px-2 py-1 rounded-full font-bold ${roleBadgeClass}">${task.role || "SIN ROL"}</span>
          <span class="text-xs text-gray-400">Fase: ${task.phase || "-"}</span>
          <span class="text-xs text-gray-500">→ ${(task.depends_on || []).join(", ") || "— root"}</span>
        </div>
        ${blockedInfo}
      </div>
    `;
  });

  if (taskCountElement) {
    const ready = webmcpState.atomicTasks.filter(
      (t) => t && t.resolver_status === "READY",
    ).length;
    const blocked = webmcpState.atomicTasks.filter(
      (t) => t && t.resolver_status === "BLOCKED",
    ).length;
    const pending = webmcpState.atomicTasks.filter(
      (t) => t && t.resolver_status === "PENDING",
    ).length;
    taskCountElement.innerHTML = `${webmcpState.atomicTasks.length} Tareas | <span class="text-green-400">${ready} READY</span> | <span class="text-yellow-400">${blocked} BLOCKED</span> | <span class="text-cyan-400">${pending} PENDING</span>`;
  }
  taskListContainer.scrollTop = taskListContainer.scrollHeight;
}

function updatePreview() {
  const iframe = document.getElementById("livePreviewIframe");
  if (iframe) {
    iframe.setAttribute(
      "srcdoc",
      webmcpState.htmlGenerated || "<h1>Esperando...</h1>",
    );
  }
}

function showMainUI() {
  document.getElementById("initial-view").classList.add("hidden");
  document.getElementById("orchestration-view").classList.remove("hidden");
}

/**
 * ============================================================
 * TECHLEADER
 * ============================================================
 */
async function generateTechLeaderPlan(promptText, previousFeedback = "") {
  appendToReasoning(
    `<div class="text-cyan-400 font-bold">🧠 TECHLEADER → Analizando proyecto...</div>`,
  );

  let finalPrompt = promptText;
  if (previousFeedback) {
    finalPrompt += `\n\n--- FEEDBACK DE REVISIÓN ANTERIOR ---\n${previousFeedback}\nPor favor, ajusta el plan de fases para corregir estos problemas. NO inventes requisitos, solo ajusta lo estrictamente necesario para resolver el feedback.`;
    appendToReasoning(
      `<div class="text-yellow-400 text-xs">⚠️ Incluyendo feedback del Completeness Reviewer...</div>`,
    );
  }

  const techRes = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-4-e4b",
      messages: [
        { role: "system", content: techLeaderPrompt },
        { role: "user", content: finalPrompt },
      ],
      temperature: 0.0,
    }),
  });

  if (!techRes.ok) {
    throw new Error(`TechLeader Error: ${techRes.status}`);
  }

  const techData = await techRes.json();
  const raw = techData?.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("TechLeader no devolvió contenido.");
  }

  let plan;
  try {
    plan = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("TechLeader no devolvió JSON válido.");
    }
    plan = JSON.parse(match[0]);
  }

  if (!plan || !Array.isArray(plan.fases)) {
    throw new Error("TechLeader no devolvió un array 'fases'.");
  }

  plan.fases = plan.fases.map((fase, index) => ({
    ...fase,
    id: fase.id || `F${index + 1}`,
    responsable_sugerido: ROLES_VALIDOS.includes(fase.responsable_sugerido)
      ? fase.responsable_sugerido
      : "Backend",
    depends_on: Array.isArray(fase.depends_on) ? fase.depends_on : [],
  }));

  appendToReasoning(
    `<div class="text-green-400 font-bold mt-2">🧠 TECHLEADER → ${plan.fases.length} fases detectadas</div>`,
  );
  plan.fases.forEach((fase) => {
    appendToReasoning(
      `<div class="text-gray-300 text-xs mt-1">${fase.id} | ${fase.name} | Role: ${fase.responsable_sugerido}</div>`,
    );
  });

  return plan;
}

/**
 * ============================================================
 * COMPLETENESS REVIEWER (Frontend LM Studio Call)
 * ============================================================
 */
function getLensPrompt(lens) {
  if (lens === "GAP") {
    return `LENTE: GAP. Analizá el Graph completo junto al prompt original. Asumí que el Graph podría no representar algo que el prompt pide explícitamente, y buscalo activamente. Reportá SOLO omisiones que puedas sustentar citando la parte exacta del prompt que las exige. Si no encontrás ninguna con esa evidencia, devolvé un array vacío [].`;
  }
  if (lens === "EXCESS") {
    return `LENTE: EXCESS. Analizá el Graph completo junto al prompt original. Asumí que el Graph podría contener elementos sin sustento explícito en el prompt, y buscalos activamente. NO evalúes si la decisión técnica es buena o mala. Evaluá únicamente si está sustentada por el prompt. Reportá SOLO elementos donde puedas señalar exactamente qué parte del Graph carece de sustento explícito. Si no encontrás ninguno, devolvé un array vacío [].`;
  }
  if (lens === "AMBIGUOUS") {
    return `LENTE: AMBIGUOUS. Identificá fragmentos del prompt original cuya interpretación admite más de una lectura razonable y que puedan cambiar qué debería representar el Graph. NO inventes ambigüedades artificiales. Si no encontrás ninguna, devolvé un array vacío [].`;
  }
  return "";
}

async function persistProject(promptText) {
  const response = await fetch("http://localhost:3000/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: promptText }),
  });
  if (!response.ok) {
    throw new Error(`Persistence Error: ${response.status}`);
  }
  const data = await response.json();
  if (!data.id) {
    throw new Error("Persistence no devolvió project_id.");
  }
  return data.id;
}

/**
 * ============================================================
 * REVIEW FEEDBACK
 * ============================================================
 */

function formatValidationFeedback(validation) {
  if (!validation) return "";

  let feedback = "\n\n=== FEEDBACK DE VALIDATION ===\n";

  if (validation.status === "FAIL") {
    feedback += "La validación estructural/de dominio devolvió FAIL.\n\n";
  }

  if (Array.isArray(validation.failures) && validation.failures.length > 0) {
    validation.failures.forEach((failure, index) => {
      const rule =
        failure.rule || failure.code || failure.id || "VALIDATION_FAILURE";

      const detail =
        failure.message ||
        failure.detail ||
        failure.description ||
        JSON.stringify(failure);

      feedback += `${index + 1}. [${rule}] ${detail}\n`;
    });
  }

  if (Array.isArray(validation.warnings) && validation.warnings.length > 0) {
    feedback += "\nAdvertencias detectadas:\n";
    validation.warnings.forEach((warning, index) => {
      const detail =
        warning.message ||
        warning.detail ||
        warning.description ||
        JSON.stringify(warning);

      feedback += `${index + 1}. ${detail}\n`;
    });
  }

  feedback +=
    "\nRevisa el plan de fases y corrige únicamente lo necesario para resolver los FAILS. No inventes requisitos.\n";

  return feedback;
}

function formatReviewerFeedback(reviewResult) {
  if (!reviewResult || !reviewResult.findings) return "";

  let feedback = `\n\n=== FEEDBACK DEL COMPLETENESS REVIEWER ===\n`;
  feedback +=
    "El Graph anterior fue evaluado y se encontraron los siguientes problemas:\n\n";

  if (reviewResult.findings.GAP?.length > 0) {
    feedback += `## GAPS (Requisitos faltantes):\n`;
    reviewResult.findings.GAP.forEach((gap, i) => {
      feedback += `${i + 1}. ${gap.detail}\n`;
      if (gap.prompt_evidence) {
        feedback += `   Evidencia del prompt: ${gap.prompt_evidence}\n`;
      }
    });
    feedback += `\n`;
  }

  if (reviewResult.findings.EXCESS?.length > 0) {
    feedback += `## EXCESS (Trabajo sin sustento explícito):\n`;
    reviewResult.findings.EXCESS.forEach((excess, i) => {
      feedback += `${i + 1}. ${excess.detail}\n`;
      if (excess.graph_evidence) {
        feedback += `   Evidencia del Graph: ${excess.graph_evidence}\n`;
      }
    });
    feedback += `\n`;
  }

  if (reviewResult.findings.AMBIGUOUS?.length > 0) {
    feedback += `## AMBIGUOUS (Ambigüedades relevantes):\n`;
    reviewResult.findings.AMBIGUOUS.forEach((amb, i) => {
      feedback += `${i + 1}. ${amb.detail}\n`;
    });
    feedback += `\n`;
  }

  feedback +=
    "\nAjusta el nuevo plan de fases únicamente en respuesta a estos hallazgos. No inventes requisitos.\n";

  return feedback;
}

/**
 * ============================================================
 * COMPLETENESS REVIEWER
 * ============================================================
 */

async function runCompletenessReviewFromGraph(atomicTasks, promptText) {
  const appendToLog = (msg) =>
    appendToReasoning(`<div class="text-purple-400 text-xs">${msg}</div>`);

  const result = await runCompletenessReview(promptText, atomicTasks, {
    model: "qwen2.5-7b-instruct",
    logCallback: appendToLog,
  });

  const totalFindings = result?.summary?.total_findings ?? 0;

  appendToLog(`REVIEW COMPLETO: ${totalFindings} hallazgos totales`);

  appendToLog(
    `GAP: ${result?.summary?.gap_count ?? 0} | EXCESS: ${
      result?.summary?.excess_count ?? 0
    } | AMBIGUOUS: ${result?.summary?.ambiguous_count ?? 0}`,
  );

  webmcpState.completenessReview = result;
  saveState();

  return result;
}

/**
 * ============================================================
 * GRAPH
 * ============================================================
 */

async function runGraph(plan) {
  appendToReasoning(
    `<div class="text-cyan-400 font-bold">INICIANDO GRAPH [LIVE + RE-ATOMIZER OFICIAL]</div>`,
  );

  const startTime = Date.now();
  const button = document.getElementById("generateButton");

  if (button) {
    button.disabled = true;
  }

  webmcpState.atomicTasks = [];
  webmcpState.unresolvedTasks = [];
  webmcpState.rejectedTasks = [];
  webmcpState.dependencyGraph = null;
  webmcpState.replacementMap = {};
  webmcpState.validation = null;

  saveState();
  renderTaskList();

  const logCallback = (message) => {
    appendToReasoning(`<div class="text-gray-400 text-xs">${message}</div>`);
  };

  const onTaskResolved = (task) => {
    if (!task || !task.id) return;

    webmcpState.atomicTasks = webmcpState.atomicTasks.filter(
      (existing) => existing.id !== task.id,
    );

    webmcpState.atomicTasks.push({
      ...task,
      resolver_status: task.status === "UNRESOLVED" ? "UNRESOLVED" : "PENDING",
    });

    if (task.status === "UNRESOLVED") {
      webmcpState.unresolvedTasks = [
        ...webmcpState.unresolvedTasks.filter((t) => t.id !== task.id),
        task,
      ];
    }

    saveState();
    renderTaskList();
  };

  try {
    const result = await runAtomicGraph(
      plan.fases,
      logCallback,
      onTaskResolved,
    );

    webmcpState.replacementMap = result.replacementMap || {};
    webmcpState.rejectedTasks = result.rejectedTasks || [];

    appendToReasoning(
      `<div class="text-green-400 font-bold mt-2">✓ ACCEPTED: ${result.totalAccepted} | UNRESOLVED: ${result.totalUnresolved}</div>`,
    );

    appendToReasoning(
      `<div class="text-cyan-400 text-xs mt-2">↻ DEPENDENCY RECONCILIATION completada</div>`,
    );

    const dependencyResult = resolveDependencies(result.allTasks, plan.fases);

    const validation = validateRoleDependencies(dependencyResult.nodes);

    webmcpState.validation = validation;
    webmcpState.dependencyGraph = dependencyResult;
    webmcpState.atomicTasks = dependencyResult.nodes;
    webmcpState.unresolvedTasks = dependencyResult.unresolved;

    appendToReasoning(
      `<div class="text-cyan-400 font-bold mt-2">🔎 VALIDATION → Role Dependencies</div>`,
    );

    appendToReasoning(
      `<div class="${
        validation.status === "FAIL"
          ? "text-red-400"
          : validation.status === "PASS_WITH_WARNINGS"
            ? "text-yellow-400"
            : "text-green-400"
      } font-bold">${validation.status}</div>`,
    );

    const totalMs = Date.now() - startTime;
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);

    appendToReasoning(
      `<div class="text-gray-500 mt-2">========================================</div>`,
    );

    appendToReasoning(
      `<div class="text-green-400 font-bold">GRAPH COMPLETO EN: ${minutes}m ${seconds}s (${totalMs}ms)</div>`,
    );

    appendToReasoning(
      `<div class="text-green-400">✓ ACCEPTED: ${result.totalAccepted} | UNRESOLVED: ${result.totalUnresolved}</div>`,
    );

    appendToReasoning(
      `<div class="text-cyan-400">✓ READY: ${dependencyResult.ready.length} | BLOCKED: ${dependencyResult.blocked.length}</div>`,
    );

    saveState();
    renderTaskList();

    return {
      status: "OK",
      validation,
      dependencyResult,
      atomicTasks: dependencyResult.nodes,
      unresolvedTasks: dependencyResult.unresolved,
      result,
    };
  } catch (error) {
    console.error(error);

    webmcpState.atomicTasks = (webmcpState.atomicTasks || []).map((task) => ({
      ...task,
      resolver_status: "ERROR",
      resolver_error: error.message,
    }));

    webmcpState.dependencyGraph = {
      valid: false,
      error: error.message,
    };

    saveState();
    renderTaskList();

    appendToReasoning(
      `<div class="text-red-500 font-bold mt-2">✗ ERROR GRAPH: ${error.message}</div>`,
    );

    return {
      status: "FAIL",
      validation: {
        status: "FAIL",
        failures: [
          {
            rule: "GRAPH_EXECUTION_ERROR",
            message: error.message,
          },
        ],
      },
      dependencyResult: null,
      atomicTasks: webmcpState.atomicTasks,
      unresolvedTasks: webmcpState.unresolvedTasks,
      result: null,
    };
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = `🧠 Generar Atomic Tasks`;
    }
  }
}

/**
 * ============================================================
 * UNA GENERACIÓN COMPLETA
 *
 * TechLeader → Graph → Validation → Completeness
 *
 * Cualquier FAIL vuelve al TechLeader.
 * ============================================================
 */

async function runGenerationAttempt(promptText, previousFeedback = "") {
  const plan = await generateTechLeaderPlan(promptText, previousFeedback);

  webmcpState.fullPlan = plan;
  webmcpState.prompt = promptText;
  saveState();

  appendToReasoning(
    `<div class="text-cyan-400 mt-2">Stack: ${
      Array.isArray(plan.stack_sugerido)
        ? plan.stack_sugerido.join(", ")
        : plan.stack_sugerido || "N/D"
    }</div>`,
  );

  const graphResult = await runGraph(plan);

  if (graphResult.status === "FAIL") {
    return {
      status: "FAIL",
      plan,
      graphResult,
      validation: graphResult.validation,
      completeness: null,
      feedback: formatValidationFeedback(graphResult.validation),
    };
  }

  const completeness = await runCompletenessReviewFromGraph(
    graphResult.atomicTasks,
    promptText,
  );

  const validationFailed = graphResult.validation?.status === "FAIL";

  const completenessFailed = (completeness?.summary?.total_findings ?? 0) > 0;

  if (validationFailed || completenessFailed) {
    let feedback = "";

    if (validationFailed) {
      feedback += formatValidationFeedback(graphResult.validation);
    }

    if (completenessFailed) {
      feedback += formatReviewerFeedback(completeness);
    }

    return {
      status: "FAIL",
      plan,
      graphResult,
      validation: graphResult.validation,
      completeness,
      feedback,
    };
  }

  return {
    status: "PASS",
    plan,
    graphResult,
    validation: graphResult.validation,
    completeness,
    feedback: "",
  };
}

/**
 * ============================================================
 * NUEVO PROYECTO
 * ============================================================
 */

async function handleGeneratePlan() {
  const promptText = document.getElementById("projectPrompt").value;

  if (!promptText) {
    return alert("Pega un prompt primero");
  }

  webmcpState.prompt = promptText;
  webmcpState.fullPlan = null;
  webmcpState.atomicTasks = [];
  webmcpState.unresolvedTasks = [];
  webmcpState.rejectedTasks = [];
  webmcpState.dependencyGraph = null;
  webmcpState.replacementMap = {};
  webmcpState.validation = null;
  webmcpState.completenessReview = null;

  GLOBAL_ID = 1;
  saveState();

  await handleContinuePlan();
}

/**
 * ============================================================
 * CONTINUAR
 * ============================================================
 */

async function handleContinuePlan() {
  const promptText =
    document.getElementById("projectPrompt").value || webmcpState.prompt;

  if (!promptText) {
    return alert("Pega un prompt primero");
  }

  const button = document.getElementById("generateButton");

  if (button) {
    button.disabled = true;
  }

  showMainUI();

  let previousFeedback = "";
  let finalAttempt = null;

  try {
    for (let attempt = 1; attempt <= MAX_TECHLEADER_ATTEMPTS; attempt++) {
      appendToReasoning(
        `<div class="text-cyan-400 font-bold">🔄 INTENTO COMPLETO ${attempt}/${MAX_TECHLEADER_ATTEMPTS}</div>`,
      );

      finalAttempt = await runGenerationAttempt(promptText, previousFeedback);

      if (finalAttempt.status === "PASS") {
        appendToReasoning(
          `<div class="text-green-400 font-bold mt-3">✅ GENERACIÓN APROBADA EN EL INTENTO ${attempt}</div>`,
        );

        saveState();
        return;
      }

      appendToReasoning(
        `<div class="text-red-400 font-bold mt-3">❌ FAIL EN INTENTO ${attempt}</div>`,
      );

      previousFeedback = finalAttempt.feedback || "";

      if (attempt < MAX_TECHLEADER_ATTEMPTS) {
        appendToReasoning(
          `<div class="text-yellow-400 font-bold">↻ FAIL detectado. El TechLeader será reintentado automáticamente.</div>`,
        );
      }
    }

    appendToReasoning(
      `<div class="text-red-400 font-bold mt-3">🛑 MÁXIMO DE ${MAX_TECHLEADER_ATTEMPTS} INTENTOS ALCANZADO. El Graph NO se considera aprobado.</div>`,
    );

    webmcpState.fullPlan = finalAttempt?.plan || null;
    saveState();
  } catch (error) {
    console.error(error);

    appendToReasoning(
      `<div class="text-red-400 font-bold mt-3">❌ ERROR: ${error.message}</div>`,
    );

    alert(`Error durante la generación: ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = `🧠 Generar Atomic Tasks`;
    }

    toggleResumeButtons();
  }
}

/**
 * ============================================================
 * INIT
 * ============================================================
 */

function initializeApp() {
  loadState();

  document
    .getElementById("generateButton")
    .addEventListener("click", handleGeneratePlan);

  document
    .getElementById("resumeButton")
    .addEventListener("click", handleContinuePlan);

  document
    .getElementById("newProjectButton")
    .addEventListener("click", clearState);
}

window.onload = initializeApp;
