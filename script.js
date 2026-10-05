import { validateRoleDependencies } from "./validation_profile_role_dependencies.mjs";
import { runAtomicGraph, resolveDependencies } from "./atomic_engine_v5.js";
import { reviewStatus } from "./review_gate.mjs";
import { parseJsonLoose } from "./json_loose.mjs";
import { resolveProfiles, SELECTABLE, profileLabel } from "./profiles/registry.mjs";
import { buildTechLeaderPrompt } from "./techleader_prompt.mjs";
import {
  TEMPLATE_TEXT,
  TEMPLATE_EXAMPLE,
  buildTechLeaderInput,
  linesWithItems,
  fieldLabel,
  isCompleteMessage,
  FIELDS,
  norm,
} from "./intent_brief.mjs";

// BUILD_ID: subirlo en cada cambio de script.js. server.mjs lo lee del disco
// (/api/version) y, si no coincide con el de la pestaña abierta, la UI avisa
// que hay que recargar. Origen: Project21 corrió con el JS viejo en una
// pestaña abierta desde antes del cambio (reiniciar el server no alcanza).
const BUILD_ID = "2026-10-05.3";

const STORAGE_KEY = "webmcp_state";
const MAX_TECHLEADER_ATTEMPTS = 3;

// === LOCK DE ORQUESTACION - FIX RACE CONDITION ===
// Antes, esto Y requestHumanDecision() decidían por separado el texto del
// botón — dos fuentes de verdad que podían pisarse. Ahora este objeto solo
// guarda estado (locked/reason); syncChatUI() es la ÚNICA función que
// escribe en el botón y el input, derivando el estado de acá.
const OrchestrationLock = {
  locked: false,
  reason: null,
  lock(reason) {
    this.locked = true;
    this.reason = reason;
    webmcpState.isGenerating = true;
    syncChatUI();
    saveState();
  },
  unlock() {
    this.locked = false;
    this.reason = null;
    webmcpState.isGenerating = false;
    syncChatUI();
    saveState();
  },
  canSend() {
    if (this.locked) {
      appendToReasoning(
        `<div class="text-red-400 text-xs">[LOCK] Bloqueado por ${this.reason}, no podes mandar otro mensaje</div>`,
      );
      return false;
    }
    return true;
  },
};

// === FASE DEL CHAT ÚNICO (reemplaza a los dos inputs/botones separados) ===
// Deriva la fase actual a partir del estado que YA existe (OrchestrationLock,
// awaitingDecision, intentForge.status) en vez de mantener una bandera nueva
// que se pueda desincronizar de esas otras tres.
function getChatPhase() {
  if (webmcpState.awaitingDecision) return "HUMAN_DECISION";
  if (OrchestrationLock.locked) {
    return OrchestrationLock.reason?.startsWith("INTENT_FORGE")
      ? "ASKING"
      : "GENERATING";
  }
  if (
    webmcpState.intentForge?.status === "COMPLETE" &&
    !(webmcpState.atomicTasks?.length > 0)
  ) {
    return "AWAITING_CONFIRMATION";
  }
  if (!webmcpState.prompt) return "IDLE";
  return "DEFAULT";
}

function syncChatUI() {
  const btn = document.getElementById("chatActionBtn");
  const input = document.getElementById("refinementPrompt");
  if (!btn || !input) return;

  btn.disabled = false;
  input.disabled = false;
  btn.classList.remove("opacity-50", "cursor-not-allowed");

  const phase = getChatPhase();
  // Tipo de proyecto (profiles, 05/10): se elige en IDLE y queda fijo para el proyecto.
  const sel = document.getElementById("projectProfile");
  if (sel) {
    if (webmcpState.profiles?.length) sel.value = webmcpState.profiles[0];
    sel.disabled = phase !== "IDLE";
  }
  // IDLE: la plantilla de 4 campos precargada (Intent Forge v0.3). El resto
  // de las fases usa el input chico de siempre.
  input.rows = phase === "IDLE" ? 12 : 2;
  if (phase === "IDLE" && !input.value.trim()) input.value = TEMPLATE_TEXT;
  if (phase !== "IDLE" && input.value === TEMPLATE_TEXT) input.value = "";
  switch (phase) {
    case "IDLE":
      btn.innerText = "Enviar plantilla";
      input.placeholder = "Completá la plantilla (Ctrl+Enter para enviar)";
      break;
    case "ASKING":
      btn.innerText = `⏳ Preguntando (iter ${webmcpState.intentForge?.iteration || 0}/${INTENT_FORGE_MAX_ITERATIONS})...`;
      btn.disabled = true;
      input.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
      input.placeholder = "Intent Forge está preguntando...";
      break;
    case "AWAITING_CONFIRMATION":
      btn.innerText = "Esperando confirmación ↑";
      btn.disabled = true;
      input.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
      input.placeholder = "Usá los botones de arriba para confirmar o ajustar";
      break;
    case "GENERATING":
      btn.innerText = "⏳ Creando graph...";
      btn.disabled = true;
      input.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
      input.placeholder = "Creando graph, esperá...";
      break;
    case "HUMAN_DECISION":
      btn.innerText = "Responder al Orchestrator";
      input.placeholder = "Respondé la consulta de arriba...";
      break;
    case "DEFAULT":
    default:
      btn.innerText = "Enviar";
      input.placeholder = "Escribí acá si necesitás avisarle algo al equipo...";
      break;
  }
}

// === INTENT FORGE v0.2 — llama a /api/intent-forge (server.mjs). NO invoca
// intent_forge_v02.ps1; ese script es una herramienta manual aparte, ver
// la nota al principio de server.mjs. ===
const INTENT_FORGE_MAX_ITERATIONS = 10;
let INTENT_FORGE_ITERATION = 0;

function appendToIntentForgeChat(role, text, { plain = false } = {}) {
  const container = document.getElementById("intentForgeChatHistory");
  if (!container) return;
  // plain: texto escrito por el usuario o el modelo → se escapa y conserva
  // los saltos de línea (la plantilla viaja en varias líneas).
  if (plain) text = `<span class="whitespace-pre-wrap">${escapeHTML(text)}</span>`;
  const color = role === "user" ? "text-indigo-300" : "text-gray-300";
  const label =
    role === "user"
      ? "Vos"
      : role === "techleader"
        ? "TECHLEADER"
        : role === "orchestrator"
          ? "ORCHESTRATOR"
          : "Intent Forge";
  container.innerHTML += `<div class="${color}"><b>${label}:</b> ${text}</div>`;
  container.scrollTop = container.scrollHeight;
}

function updateIntentForgeStatus(status) {
  const el = document.getElementById("intentForgeStatus");
  if (el) {
    el.innerText = status;
    el.className =
      status === "COMPLETE"
        ? "text-xs px-2 py-1 bg-green-600 rounded-full"
        : status.includes("RUNNING") || status.includes("ASKING")
          ? "text-xs px-2 py-1 bg-yellow-600 rounded-full"
          : "text-xs px-2 py-1 bg-gray-600 rounded-full";
  }
}

async function sendToIntentForge(userMessage, { auto = false } = {}) {
  if (!userMessage?.trim()) return;
  if (webmcpState.isGenerating && !webmcpState.awaitingDecision) return;
  if (webmcpState.awaitingDecision) {
    handleHumanDecisionResponse(userMessage);
    return;
  }

  // Tipo de proyecto (profiles, 05/10): lo declara Miche antes del primer
  // mensaje, como la etapa. Nunca lo decide un modelo ni hay uno por defecto.
  if (!webmcpState.prompt) {
    const chosen = document.getElementById("projectProfile")?.value || "";
    if (!chosen) {
      appendToIntentForgeChat("orchestrator", "Elegí el <b>tipo de proyecto</b> (arriba del cuadro de texto) antes de mandar la plantilla.");
      return;
    }
    resolveProfiles([chosen]); // falla fuerte si el id no existe
    webmcpState.profiles = [chosen];
  }

  // El primer mensaje que se manda (fase IDLE) ES el prompt crudo del
  // proyecto. No se vuelve a tocar en mensajes siguientes, para no pisarlo
  // con una respuesta parcial a una pregunta de Intent Forge.
  if (!webmcpState.prompt) webmcpState.prompt = userMessage;

  appendToIntentForgeChat("user", userMessage, { plain: true });
  const input = document.getElementById("refinementPrompt");
  if (input) input.value = "";

  webmcpState.intentForge = webmcpState.intentForge || {
    status: "IDLE",
    history: [],
    refined_prompt: null,
    iteration: 0,
  };
  webmcpState.intentForge.status = "ASKING";
  // auto=true: mensaje armado por el sistema. intent_brief.numberLines lo
  // ignora (no es una línea del usuario).
  webmcpState.intentForge.history.push(
    auto
      ? { role: "user", content: userMessage, auto: true }
      : { role: "user", content: userMessage },
  );
  INTENT_FORGE_ITERATION = (webmcpState.intentForge.iteration || 0) + 1;
  webmcpState.intentForge.iteration = INTENT_FORGE_ITERATION;

  OrchestrationLock.lock(
    `INTENT_FORGE iter ${INTENT_FORGE_ITERATION}/${INTENT_FORGE_MAX_ITERATIONS}`,
  );
  updateIntentForgeStatus(
    `ASKING (iter ${INTENT_FORGE_ITERATION}/${INTENT_FORGE_MAX_ITERATIONS})`,
  );

  let isCompleteFlag = false;
  let hadError = false;

  try {
    const res = await fetch("/api/intent-forge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: userMessage,
        conversation: webmcpState.intentForge.history,
        iteration: INTENT_FORGE_ITERATION,
        profiles: webmcpState.profiles,
      }),
    });
    if (!res.ok)
      throw new Error(
        `Backend ${res.status}: ${(await res.text()).slice(0, 800)}`,
      );

    const data = await res.json();
    isCompleteFlag = !!data.isComplete;
    const assistantMessage = data.assistantMessage || data.rawOutput || "";

    webmcpState.intentForge.history.push({
      role: "assistant",
      content: assistantMessage,
      ...(data.faltantes?.length ? { faltantes: data.faltantes } : {}),
    });
    appendToReasoning(
      `<div class="text-cyan-400 text-xs">[INTENT_FORGE] iter=${data.iteration} COMPLETE=${data.isComplete}</div>`,
    );

    if (data.isComplete && data.refined_prompt) {
      // OJO: acá NO se muestra assistantMessage en el chat — cuando está
      // COMPLETE, ese texto es el ```json crudo (así lo pide el propio
      // system prompt), no un resumen para leer. El resumen legible lo arma
      // renderConfirmationPrompt() a partir de refined_prompt, estructurado.
      webmcpState.intentForge.refined_prompt = data.refined_prompt;
      webmcpState.intentForge.status = "COMPLETE";
      updateIntentForgeStatus("COMPLETE");
      updateRefinedPromptPin(data.refined_prompt);
      renderConfirmationPrompt(data.refined_prompt);
      appendToReasoning(
        `<div class="text-green-400 font-bold">✅ Intent Forge COMPLETE (${(data.refined_prompt.features || []).length} features, ${(data.refined_prompt.restricciones || []).length} restricciones${data.auto_added?.length ? `, ${data.auto_added.length} línea(s) ubicadas por el harness` : ""}${data.refined_prompt.brief?.repairs ? `, ${data.refined_prompt.brief.repairs} reintento(s)` : ""})</div>`,
      );
    } else {
      appendToIntentForgeChat("assistant", assistantMessage, { plain: true });
      updateIntentForgeStatus(`ASKING (iter ${INTENT_FORGE_ITERATION})`);
    }
    saveState();
  } catch (err) {
    // FIX (bug preexistente): el finally de más abajo pisaba este estado
    // "ERROR" con "ASKING" apenas un instante después, así que el badge
    // nunca llegaba a mostrar el error. hadError evita esa pisada.
    hadError = true;
    appendToIntentForgeChat("assistant", `ERROR: ${err.message}`);
    updateIntentForgeStatus(`ERROR iter ${INTENT_FORGE_ITERATION}`);
  } finally {
    OrchestrationLock.unlock();
    if (!hadError) {
      updateIntentForgeStatus(
        isCompleteFlag ? "COMPLETE" : `ASKING iter ${INTENT_FORGE_ITERATION}`,
      );
    }
    syncChatUI();
  }
}

// === TARJETA DE CONFIRMACIÓN (Intent Forge v0.3) ===
// Muestra cada línea que escribió el usuario y en qué quedó ("dijiste →
// quedó como"). Reemplaza al chequeo "mencionaste y no incluí" (Project23:
// 10 de 13 avisos eran ruido y "Excluir" mandaba palabras sueltas como
// órdenes negativas a TechLeader). Acá no hay nada que decidir aviso por
// aviso: si algo quedó mal, se corrige con ✏️ Ajustar.
function escapeHTML(t) {
  return String(t ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

const TIPO_BADGE = {
  feature: ["feature", "bg-indigo-700 text-indigo-100"],
  estilo: ["estilo", "bg-fuchsia-800 text-fuchsia-100"],
  restriccion: ["restricción", "bg-red-800 text-red-100"],
  contexto: ["contexto", "bg-gray-600 text-gray-100"],
  descartado: ["descartado", "bg-gray-800 text-gray-400 line-through"],
};

function itemHTML(it, line) {
  const [label, cls] = TIPO_BADGE[it.tipo] || [it.tipo, "bg-gray-700"];
  const hint = FIELDS[line.field]?.tipo;
  const moved = hint && hint !== it.tipo ? ` <span class="text-[9px] text-cyan-400">↪ movido</span>` : "";
  const auto = it.auto
    ? ` <span class="text-[9px] text-amber-300" title="El modelo no ubicó esta línea; la agregó el harness con el tipo de su campo. Revisala.">⚠ ubicada por el harness</span>`
    : "";
  const comp = it.compuesta
    ? ` <span class="text-[9px] text-amber-300" title="Junta varias acciones en una sola feature. Con Ajustar podés pedir que la separe (ej.: separá crear, editar y borrar).">⚠ junta varias acciones</span>`
    : "";
  return `<div class="ml-3"><span class="text-[9px] px-1 rounded ${cls}">${label}</span> ${escapeHTML(it.texto)}${moved}${auto}${comp}</div>`;
}

// Chip "Tipo: web/landing (DRAFT)" — en rojo si el proyecto no declara tipo.
function profileChip(ids) {
  try {
    const p = resolveProfiles(ids);
    const borrowed = p.borrowed.length ? ` · usa ${p.borrowed.map((b) => b.from).join(", ")}` : "";
    return ` <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-200 align-middle" title="${escapeHTML(profileLabel(p))}">Tipo: ${escapeHTML(p.ids.join(" + "))} (${escapeHTML(p.ids.map((i) => p.status[i]).join("/"))})${escapeHTML(borrowed)}</span>`;
  } catch (e) {
    return ` <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-900 text-red-200 align-middle">Sin tipo de proyecto</span>`;
  }
}

/** Profile del proyecto en curso. Falla fuerte si no declara tipo (estado de antes del 05/10). */
function activeProfile() {
  return resolveProfiles(webmcpState.intentForge?.refined_prompt?.profiles || webmcpState.profiles);
}

/** Opciones del selector de tipo, desde profiles/registry.mjs. */
function populateProfileSelect() {
  const sel = document.getElementById("projectProfile");
  if (!sel || sel.options.length > 1) return;
  for (const p of SELECTABLE) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `${p.label} — ${p.id} (${p.status})`;
    o.title = p.describe;
    sel.appendChild(o);
  }
}

function buildRefinedSummaryHTML(refined) {
  const stage = refined.project_stage
    ? ` <span class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-800 text-cyan-200 align-middle">Etapa: ${escapeHTML(refined.project_stage)}</span>`
    : "";
  const tipo = profileChip(refined.profiles);
  const head = `
    <div class="text-indigo-300 font-bold mb-1">Así entendí lo que escribiste:</div>
    <div class="text-white font-medium">${escapeHTML(refined.project_name || "")}${stage}${tipo}</div>`;
  // Snapshot viejo (antes de v0.3): sin brief, lista simple de features.
  if (!refined.brief?.lines?.length) {
    const feats = (refined.features || []).map((f) => `<li>${escapeHTML(f)}</li>`).join("");
    return `${head}${refined.objetivo ? `<div class="text-gray-300 mt-1">${escapeHTML(refined.objetivo)}</div>` : ""}<ul class="list-disc list-inside text-gray-300 mt-1">${feats}</ul>`;
  }
  const rows = linesWithItems(refined.brief)
    .map(
      ({ line, items }) => `
      <div class="border-l-2 ${items.some((i) => i.auto || i.compuesta) ? "border-amber-500" : "border-gray-600"} pl-2 mt-1">
        <div class="text-gray-400 text-[10px]">${line.id} · ${escapeHTML(fieldLabel(line.field))}</div>
        <div class="text-gray-200">“${escapeHTML(line.text)}”</div>
        ${items.map((it) => itemHTML(it, line)).join("")}
      </div>`,
    )
    .join("");
  const counts = ["feature", "estilo", "restriccion", "contexto"]
    .map((t) => `${refined.brief.items.filter((i) => i.tipo === t).length} ${TIPO_BADGE[t][0]}`)
    .join(" · ");
  return `${head}
    <div class="text-gray-500 text-[10px] mt-1">${counts}</div>
    <div class="mt-1">${rows}</div>
    <div class="text-gray-500 text-[10px] mt-2">Si algo quedó mal, tocá ✏️ Ajustar y escribilo (ej.: "las etiquetas van como feature", "sacá los comentarios").</div>`;
}

// Un solo listener delegado en el contenedor: appendToIntentForgeChat usa
// innerHTML +=, que recrea los nodos y mata cualquier listener directo.
let confirmDelegationReady = false;
function ensureConfirmDelegation(container) {
  if (confirmDelegationReady) return;
  confirmDelegationReady = true;
  container.addEventListener("click", (ev) => {
    const el = ev.target.closest("button[data-action]");
    const card = el?.closest("[data-confirm-card]");
    if (!el || !card || card.dataset.stale === "1" || el.disabled) return;
    if (el.dataset.action === "confirm-refined") confirmRefinedPrompt();
    else if (el.dataset.action === "adjust-refined") adjustRefinedPrompt();
  });
}

function markConfirmCardsStale(container) {
  container.querySelectorAll("[data-confirm-card]").forEach((c) => {
    c.dataset.stale = "1";
    c.querySelectorAll("button").forEach((b) => {
      b.disabled = true;
      b.classList.add("opacity-40", "cursor-not-allowed");
    });
  });
}

function renderConfirmationPrompt(refined) {
  const container = document.getElementById("intentForgeChatHistory");
  if (!container) return;
  ensureConfirmDelegation(container);
  markConfirmCardsStale(container);
  container.innerHTML += `
    <div class="bg-indigo-900/30 border border-indigo-600 p-3 rounded text-xs my-2" data-confirm-card="1">
      ${buildRefinedSummaryHTML(refined)}
      <div class="flex gap-2 mt-2">
        <button type="button" class="flex-1 bg-green-600 rounded py-1 text-xs font-bold" data-action="confirm-refined">✅ Confirmar y generar</button>
        <button type="button" class="flex-1 bg-gray-700 rounded py-1 text-xs font-bold" data-action="adjust-refined">✏️ Ajustar</button>
      </div>
    </div>`;
  container.scrollTop = container.scrollHeight;
  syncChatUI();
}

async function confirmRefinedPrompt() {
  const refined = webmcpState.intentForge?.refined_prompt;
  if (!refined) return;
  if (!(await checkBuild())) return; // no generar con JS viejo
  webmcpState.prompt = buildTechLeaderInput(refined);
  appendToIntentForgeChat(
    "user",
    refined.restricciones?.length
      ? `✅ Confirmado (restricciones: ${refined.restricciones.map(escapeHTML).join(" · ")}).`
      : "✅ Confirmado.",
  );
  appendToReasoning(
    `<div class="text-green-400 text-xs">[FORGE→TECHLEADER] ${(refined.features || []).length} features, ${(refined.restricciones || []).length} restricciones</div>`,
  );
  saveState();
  await handleContinuePlan();
}

function adjustRefinedPrompt() {
  // El próximo mensaje del usuario entra como línea [ajuste]
  // (intent_brief.numberLines) y Qwen vuelve a clasificar todo.
  if (webmcpState.intentForge) {
    webmcpState.intentForge.status = "ASKING";
    const container = document.getElementById("intentForgeChatHistory");
    if (container) markConfirmCardsStale(container);
  }
  updateIntentForgeStatus(`ASKING (iter ${webmcpState.intentForge?.iteration || 0})`);
  saveState();
  syncChatUI();
  document.getElementById("refinementPrompt")?.focus();
}

// Mensaje de bienvenida (no se guarda en el historial): explica la plantilla
// con un ejemplo de otro dominio.
function showTemplateIntro() {
  const container = document.getElementById("intentForgeChatHistory");
  if (!container || container.childElementCount) return;
  container.innerHTML = `
    <div class="text-gray-300"><b>Intent Forge:</b> Completá la plantilla de abajo, una idea por línea. No hace falta que esté perfecta: después te hago algunas preguntas (hasta 10) por si se te pasó algo. Si ya está, escribí <b>listo</b>.
      <div class="mt-1 text-gray-400">Ejemplo:</div>
      <pre class="whitespace-pre-wrap text-gray-400 bg-black/20 rounded p-2 mt-1 text-[11px]">${escapeHTML(TEMPLATE_EXAMPLE)}</pre>
    </div>`;
}

function updateRefinedPromptPin(refined) {
  const el = document.getElementById("refinedPromptPin");
  if (!el || !refined) return;
  const li = (xs) => (xs || []).map((f) => `<li>${escapeHTML(f)}</li>`).join("");
  const feats = li(refined.features);
  const restr = li(refined.restricciones);
  el.innerHTML = `
    <div class="text-cyan-400 font-bold mb-1">📌 Refined prompt</div>
    <div class="text-white">${escapeHTML(refined.project_name || "")}</div>
    ${refined.objetivo ? `<div class="text-gray-400 mt-1">${escapeHTML(refined.objetivo)}</div>` : ""}
    ${feats ? `<ul class="list-disc list-inside text-gray-400 mt-1">${feats}</ul>` : ""}
    ${restr ? `<div class="text-red-300 mt-1">Restricciones:</div><ul class="list-disc list-inside text-gray-400">${restr}</ul>` : ""}
  `;
  el.classList.remove("hidden");
}

// === CHAT GOBERNADO - SOLO APARECE EN 3/3 STRIKES ===
function requestHumanDecision(type, payload) {
  const chatHistory = document.getElementById("intentForgeChatHistory");
  webmcpState.awaitingDecision = { type, payload, timestamp: Date.now() };

  if (type === "TASK_FAIL_3_STRIKES") {
    const taskId = payload.taskId;
    chatHistory.innerHTML += `
      <div class="bg-red-900/30 border border-red-600 p-3 rounded text-xs my-2">
        <b class="text-red-400">TECHLEADER [Fase ${payload.phase || "?"}]:</b> La task <b>${taskId}</b> falló 3/3 strikes.<br>
        <span class="text-gray-300">${payload.error || "Sin detalle"}</span><br><br>
        ¿Qué hacemos?<br>
        - Escribí <code>skip ${taskId}</code> para saltearla<br>
        - Escribí <code>retry ${taskId} con [nueva instruccion]</code><br>
        - Escribí <code>abort</code> para frenar todo
      </div>`;
    document.getElementById("refinementPrompt").placeholder =
      `Ej: skip ${taskId} o retry ${taskId} con usar localStorage`;
    appendToReasoning(
      `<div class="text-red-400 font-bold">[HUMAN DECISION] TASK_FAIL_3_STRIKES ${taskId} - Chat habilitado</div>`,
    );
  }

  if (type === "VALIDATION_FAIL_3_STRIKES") {
    // FIX (mismo bug de forma que en runCompletenessReviewFromGraph_V3):
    // .summary no existe en lo que devuelve completeness_reviewer3.mjs,
    // así que esto siempre mostraba "GAP: 0 | EXCESS: 0" sin importar lo
    // que hubiera encontrado de verdad.
    const cFindings = Array.isArray(payload.completeness?.findings)
      ? payload.completeness.findings
      : [];
    const gapN = cFindings.filter((f) => f.type === "GAP").length;
    const excessN = cFindings.filter((f) => f.type === "EXCESS").length;
    chatHistory.innerHTML += `
      <div class="bg-yellow-900/30 border border-yellow-600 p-3 rounded text-xs my-2">
        <b class="text-yellow-400">ORCHESTRATOR:</b> El graph falló ${MAX_TECHLEADER_ATTEMPTS}/3 intentos completos.<br>
        Validation: <b>${payload.validationStatus}</b><br>
        GAP: ${gapN} | EXCESS: ${excessN}<br><br>
        ¿Seguimos?<br>
        - Escribí <code>seguir con errores</code><br>
        - Escribí <code>reiniciar 3 strikes</code><br>
        - Escribí <code>nuevo prompt: [texto]</code>
      </div>`;
    document.getElementById("refinementPrompt").placeholder =
      `Ej: seguir con errores / reiniciar 3 strikes`;
    appendToReasoning(
      `<div class="text-yellow-400 font-bold">[HUMAN DECISION] VALIDATION_FAIL_3_STRIKES - Chat habilitado</div>`,
    );
  }

  if (type === "REVIEW_NOT_RUN") {
    chatHistory.innerHTML += `
      <div class="bg-red-900/30 border border-red-600 p-3 rounded text-xs my-2">
        <b class="text-red-400">ORCHESTRATOR:</b> El Completeness Reviewer <b>no corrió</b> (${escapeHTML(payload.error)}).<br>
        El graph está generado (role_dependencies: <b>${escapeHTML(payload.validationStatus)}</b>), pero nadie revisó si cubre los requisitos.<br>
        Revisá que LM Studio esté levantado y con el modelo cargado.<br><br>
        ¿Qué hacemos?<br>
        - <code>reintentar revisión</code> (mismo graph, solo vuelve a llamar al reviewer)<br>
        - <code>aprobar sin revisión</code> (queda marcado como no revisado)<br>
        - <code>rehacer plan</code> (TechLeader de nuevo, desde cero)
      </div>`;
    document.getElementById("refinementPrompt").placeholder = "reintentar revisión / aprobar sin revisión / rehacer plan";
    appendToReasoning(`<div class="text-red-400 font-bold">[HUMAN DECISION] REVIEW_NOT_RUN - Chat habilitado</div>`);
  }

  if (type === "REVIEW_FINDINGS") {
    chatHistory.innerHTML += `
      <div class="bg-yellow-900/30 border border-yellow-600 p-3 rounded text-xs my-2">
        <b class="text-yellow-400">ORCHESTRATOR:</b> La revisión corrió y encontró GAP: <b>${payload.gaps}</b> | EXCESS: <b>${payload.excess}</b>.<br><br>
        - <code>rehacer plan</code> (TechLeader con el feedback del reviewer)<br>
        - <code>seguir con hallazgos</code> (se aprueba con los hallazgos registrados)
      </div>`;
    document.getElementById("refinementPrompt").placeholder = "rehacer plan / seguir con hallazgos";
    appendToReasoning(`<div class="text-yellow-400 font-bold">[HUMAN DECISION] REVIEW_FINDINGS - Chat habilitado</div>`);
  }

  chatHistory.scrollTop = chatHistory.scrollHeight;
  syncChatUI();
  document.getElementById("refinementPrompt")?.focus();
  saveState();
}

// Vuelve a llamar solo al reviewer sobre el graph ya generado.
async function retryReviewOnly() {
  OrchestrationLock.lock("REVISANDO");
  let completeness;
  try {
    completeness = await runCompletenessReviewFromGraph_V3(webmcpState.atomicTasks || [], webmcpState.prompt);
  } catch (e) {
    completeness = { error: e.message };
  }
  OrchestrationLock.unlock();
  const review = reviewStatus(completeness);
  if (!review.ran) {
    appendToReasoning(`<div class="text-red-400 font-bold">⛔ La revisión volvió a fallar: ${escapeHTML(review.reason)}</div>`);
    requestHumanDecision("REVIEW_NOT_RUN", { error: review.reason, validationStatus: webmcpState.validation?.status || "?" });
    return;
  }
  if (review.blocking) {
    requestHumanDecision("REVIEW_FINDINGS", { gaps: review.gaps, excess: review.excess, feedback: formatReviewerFeedback(completeness) });
    return;
  }
  webmcpState.reviewSkipped = false;
  appendToReasoning(`<div class="text-green-400 font-bold mt-3">✅ GENERACIÓN APROBADA (revisión reintentada: GAP=0 EXCESS=0)</div>`);
  appendToIntentForgeChat("orchestrator", "La revisión corrió bien y no encontró huecos. Graph aprobado.");
  saveState();
  syncChatUI();
}

function handleHumanDecisionResponse(userMessage) {
  const decision = webmcpState.awaitingDecision;
  if (!decision) return;

  appendToIntentForgeChat("user", userMessage);
  document.getElementById("refinementPrompt").value = "";
  webmcpState.awaitingDecision = null;

  if (decision.type === "VALIDATION_FAIL_3_STRIKES") {
    const lower = userMessage.toLowerCase();
    if (lower.includes("seguir con errores")) {
      appendToReasoning(
        `<div class="text-green-400 font-bold">✅ Usuario: seguir con errores - Finalizando con warnings</div>`,
      );
      appendToIntentForgeChat(
        "orchestrator",
        "Entendido, seguimos con los errores marcados como warnings.",
      );
      OrchestrationLock.unlock();
      saveState();
    } else if (lower.includes("reiniciar")) {
      appendToReasoning(
        `<div class="text-yellow-400 font-bold">🔄 Usuario: reiniciar 3 strikes - Mismo prompt</div>`,
      );
      appendToIntentForgeChat(
        "orchestrator",
        "Reiniciando tanda de 3 strikes con el mismo prompt...",
      );
      handleContinuePlan();
    } else if (lower.includes("nuevo prompt:")) {
      const newPrompt = userMessage.split("nuevo prompt:")[1]?.trim();
      if (newPrompt) {
        webmcpState.prompt = newPrompt;
        appendToIntentForgeChat(
          "orchestrator",
          `Nuevo prompt recibido: ${newPrompt.substring(0, 100)}... Reiniciando.`,
        );
        handleGeneratePlan();
      }
    } else {
      appendToIntentForgeChat(
        "orchestrator",
        `No entendí: "${userMessage}". Escribí "seguir con errores" o "reiniciar 3 strikes"`,
      );
      webmcpState.awaitingDecision = decision; // vuelve a esperar
    }
  }

  if (decision.type === "REVIEW_NOT_RUN" || decision.type === "REVIEW_FINDINGS") {
    const lower = userMessage.toLowerCase();
    if (decision.type === "REVIEW_NOT_RUN" && lower.includes("reintentar")) {
      appendToIntentForgeChat("orchestrator", "Reintentando solo la revisión, con el mismo graph...");
      saveState();
      retryReviewOnly();
      return;
    } else if (decision.type === "REVIEW_NOT_RUN" && lower.includes("aprobar")) {
      webmcpState.reviewSkipped = true;
      appendToReasoning(`<div class="text-amber-400 font-bold">⚠️ GENERACIÓN APROBADA SIN REVISIÓN (decisión humana)</div>`);
      appendToIntentForgeChat("orchestrator", "Aprobado sin revisión. Queda marcado (reviewSkipped) en el estado del proyecto.");
    } else if (decision.type === "REVIEW_FINDINGS" && lower.includes("seguir")) {
      appendToReasoning(`<div class="text-amber-400 font-bold">⚠️ GENERACIÓN APROBADA CON HALLAZGOS DEL REVIEWER (decisión humana)</div>`);
      appendToIntentForgeChat("orchestrator", "Seguimos con los hallazgos registrados.");
    } else if (lower.includes("rehacer")) {
      appendToIntentForgeChat("orchestrator", "Rehaciendo el plan con TechLeader...");
      saveState();
      handleContinuePlan();
      return;
    } else {
      const opts = decision.type === "REVIEW_NOT_RUN" ? '"reintentar revisión", "aprobar sin revisión" o "rehacer plan"' : '"rehacer plan" o "seguir con hallazgos"';
      appendToIntentForgeChat("orchestrator", `No entendí: "${escapeHTML(userMessage)}". Escribí ${opts}.`);
      webmcpState.awaitingDecision = decision; // vuelve a esperar
    }
  }

  if (decision.type === "TASK_FAIL_3_STRIKES") {
    const taskId = decision.payload.taskId;
    const lower = userMessage.toLowerCase();
    if (lower.startsWith("skip")) {
      appendToReasoning(
        `<div class="text-green-400">⏭️ Skip ${taskId} por decisión humana</div>`,
      );
      webmcpState.atomicTasks = webmcpState.atomicTasks.filter(
        (t) => t.id !== taskId,
      );
      webmcpState.rejectedTasks.push({
        id: taskId,
        reason: "Skipped by human decision",
      });
      renderTaskList();
      saveState();
      appendToIntentForgeChat(
        "techleader",
        `Task ${taskId} salteada. Continuando...`,
      );
    } else if (lower.startsWith("retry")) {
      appendToReasoning(
        `<div class="text-yellow-400">🔄 Retry ${taskId} con nueva instruccion: ${userMessage}</div>`,
      );
      appendToIntentForgeChat(
        "techleader",
        `Reintentando ${taskId} con tu nueva instrucción...`,
      );
      // Aquí podrías relanzar solo esa fase
    } else if (lower.includes("abort")) {
      appendToReasoning(
        `<div class="text-red-400 font-bold">🛑 Abort por decisión humana</div>`,
      );
      clearState();
      return; // clearState ya llama a saveState/syncChatUI por su cuenta
    }
  }
  saveState();
  syncChatUI();
}

// === COMPLETENESS V3 VIA BACKEND (NO IMPORT DIRECTO DE node:fs) ===
// FIX (bug real): esto leía result.summary.gap_count y
// result.findings.GAP/.EXCESS como si findings fuera un objeto con una
// clave por lente. completeness_reviewer3.mjs devuelve findings como un
// ARRAY PLANO, cada item con .type = "GAP"|"EXCESS"|"AMBIGUOUS", y no tiene
// .summary. Como resultado, esos campos siempre daban undefined y
// completenessFailed (más abajo) nunca era true — el reintento por
// completitud estaba desconectado en silencio, pasara lo que pasara.
function logTermCoverage(tc) {
  const warn = (tc.items || []).filter((i) => i.missing.length);
  appendToReasoning(
    `<div class="text-gray-500 text-xs">[TERM_COVERAGE] ${warn.length}/${(tc.items || []).length} requisito(s) con palabras propias ausentes (solo registro, review ${escapeHTML(tc.review_id)})${warn.length ? ": " + warn.map((i) => `${escapeHTML(i.id)} → ${i.missing.map(escapeHTML).join(", ")}`).join(" · ") : ""}</div>`,
  );
}

// === AVISO DE COBERTURA POR PALABRAS (term_coverage_check.mjs) ===
// (Tarjeta con etiquetado manual: desactivada el 01/10, ver logTermCoverage.
// Se conserva por si se retoma la calibración.)
// Informativo: no bloquea ni dispara reintentos. Cada aviso se puede
// etiquetar "Hueco real" / "Falso aviso"; la etiqueta queda en
// evidence/term_coverage/<review_id>.json para calibrar el chequeo.
let termDelegationReady = false;
function renderTermCoverageCard(tc, { fromReload = false } = {}) {
  const container = document.getElementById("intentForgeChatHistory");
  if (!fromReload) {
    // Se guarda para volver a dibujar la tarjeta si se recarga la página.
    webmcpState.termCoverageCards = [...(webmcpState.termCoverageCards || []), tc].slice(-10);
  }
  const warn = (tc.items || []).filter((i) => i.missing.length);
  if (!fromReload) appendToReasoning(
    `<div class="text-amber-400 text-xs">[TERM_COVERAGE] ${warn.length}/${(tc.items || []).length} requisito(s) con palabras propias ausentes en el graph (review ${tc.review_id})</div>`,
  );
  if (!container || !warn.length) return;
  if (!termDelegationReady) {
    termDelegationReady = true;
    container.addEventListener("click", async (ev) => {
      const b = ev.target.closest("button[data-term-label]");
      const row = b?.closest("[data-term-row]");
      if (!b || !row) return;
      const was = row.dataset.label || "";
      const label = was === b.dataset.termLabel ? null : b.dataset.termLabel;
      try {
        const res = await fetch("/api/term-label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review_id: row.dataset.review, requirement_id: row.dataset.req, label }),
        });
        if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      } catch (e) {
        appendToReasoning(`<div class="text-red-400 text-xs">[TERM_COVERAGE] no se guardó la etiqueta: ${escapeHTML(e.message)}</div>`);
        return;
      }
      row.dataset.label = label || "";
      row.querySelectorAll("button[data-term-label]").forEach((x) => {
        const on = x.dataset.termLabel === label;
        x.setAttribute("class", `flex-1 rounded py-0.5 text-[10px] ${on ? "bg-amber-600 text-white font-bold" : "bg-gray-700 text-gray-300"}`);
      });
      webmcpState.termLabels = webmcpState.termLabels || {};
      webmcpState.termLabels[`${row.dataset.review}/${row.dataset.req}`] = label;
      saveState();
    });
  }
  const btn = (k, t, cur) =>
    `<button type="button" data-term-label="${k}" class="flex-1 rounded py-0.5 text-[10px] ${cur === k ? "bg-amber-600 text-white font-bold" : "bg-gray-700 text-gray-300"}">${t}</button>`;
  container.innerHTML += `
    <div class="bg-amber-900/20 border border-amber-700 p-3 rounded text-xs my-2" data-term-card="${escapeHTML(tc.review_id)}">
      <div class="text-amber-300 font-bold">🔎 Cobertura por palabras (aviso, no bloquea)</div>
      <div class="text-gray-500 text-[10px] mb-1">Palabras propias de cada requisito que no aparecen en ninguna tarea. Etiquetá para calibrar el chequeo.</div>
      ${warn
        .map(
          (i) => `
        <div class="border border-amber-800/60 rounded p-2 mt-1" data-term-row data-review="${escapeHTML(tc.review_id)}" data-req="${escapeHTML(i.id)}" data-label="${escapeHTML(webmcpState.termLabels?.[`${tc.review_id}/${i.id}`] || "")}">
          <div class="text-gray-200">${escapeHTML(i.id)}: ${escapeHTML(i.text)}</div>
          <div class="text-amber-200 text-[10px]">faltan (${i.total - i.present}/${i.total}): ${i.missing.map(escapeHTML).join(", ")}</div>
          <div class="flex gap-1 mt-1">${btn("hueco_real", "🕳️ Hueco real", webmcpState.termLabels?.[`${tc.review_id}/${i.id}`])}${btn("falso_aviso", "🙈 Falso aviso", webmcpState.termLabels?.[`${tc.review_id}/${i.id}`])}</div>
        </div>`,
        )
        .join("")}
    </div>`;
  container.scrollTop = container.scrollHeight;
}

async function runCompletenessReviewFromGraph_V3(atomicTasks, promptText) {
  const appendToLog = (msg) => {
    appendToReasoning(
      `<div class="text-purple-400 text-xs">[COMPLETENESS_V3] ${msg}</div>`,
    );
    console.log(`[COMPLETENESS_V3] ${msg}`);
  };
  appendToLog(
    `Llamando a /api/completeness-review con ${atomicTasks.length} tasks`,
  );
  try {
    const res = await fetch("/api/completeness-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText, atomicTasks }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Backend ${res.status}: ${errText.slice(0, 800)}`);
    }
    const result = await res.json();
    const findings = Array.isArray(result.findings) ? result.findings : [];
    const gaps = findings.filter((f) => f.type === "GAP");
    const excess = findings.filter((f) => f.type === "EXCESS");
    const ambiguous = findings.filter((f) => f.type === "AMBIGUOUS");
    appendToLog(
      `RESULT GAP=${gaps.length} EXCESS=${excess.length} AMBIGUOUS=${ambiguous.length} coverage=${result.coverage_score}`,
    );
    if (result.schema_complete === false) {
      appendToLog(
        `⚠️ schema_complete=false: ${JSON.stringify(result.schema_gaps)}`,
      );
    }
    if (gaps.length > 0) {
      appendToLog(
        `GAPS: ${gaps.map((g) => g.reason).join(" | ").substring(0, 400)}`,
      );
    }
    if (result.logs) result.logs.forEach((l) => appendToLog(l));
    // Decisión 01/10 (Miche): el aviso por palabras no pide nada al usuario.
    // Hace demasiado ruido para ser criterio (Project21: 5 avisos, ninguno
    // real) y etiquetar a mano no escala. Queda solo en el log y en
    // evidence/term_coverage/. El juez de cobertura pasa a ser Validation.
    if (result.term_coverage) logTermCoverage(result.term_coverage);
    webmcpState.completenessReview = result;
    saveState();
    return result;
  } catch (e) {
    appendToLog(`FAIL: ${e.message}`);
    appendToLog(`Stack: ${e.stack?.substring(0, 600)}`);
    throw e;
  }
}

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
  intentForge: {
    status: "IDLE",
    history: [],
    refined_prompt: null,
    iteration: 0,
  },
  awaitingDecision: null,
  validation: null,
  completenessReview: null,
  stage: null,
  stageChecks: [],
  deferredWork: [],
  profiles: [],
};

// El system prompt de TechLeader vive en techleader_prompt.mjs y sale del
// profile del proyecto (roles), ver generateTechLeaderPlan.


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
      INTENT_FORGE_ITERATION = webmcpState.intentForge?.iteration || 0;
    } catch (e) {
      console.error("Error cargando state", e);
    }
  }
  if (
    webmcpState.atomicTasks.length > 0 ||
    (webmcpState.intentForge && webmcpState.intentForge.history.length > 0)
  ) {
    updateUIFromState();
  }
  toggleResumeButtons();
  // Si quedó lockeado por crash anterior, desbloquear si no hay proceso real
  if (webmcpState.isGenerating && !webmcpState.awaitingDecision) {
    const lastUpdate = localStorage.getItem(STORAGE_KEY + "_timestamp");
    if (!lastUpdate || Date.now() - parseInt(lastUpdate) > 120000) {
      console.log("[LOCK] Desbloqueando por timeout de crash anterior");
      OrchestrationLock.unlock();
    }
  }
}

function saveState() {
  webmcpState.lastGlobalId = GLOBAL_ID;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(webmcpState));
  localStorage.setItem(STORAGE_KEY + "_timestamp", Date.now().toString());
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY + "_timestamp");
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
    intentForge: {
      status: "IDLE",
      history: [],
      refined_prompt: null,
      iteration: 0,
    },
    awaitingDecision: null,
    validation: null,
    completenessReview: null,
    stage: null,
    stageChecks: [],
    deferredWork: [],
    profiles: [],
  };
  GLOBAL_ID = 1;
  INTENT_FORGE_ITERATION = 0;
  document.getElementById("intentForgeChatHistory").innerHTML = "";
  document.getElementById("llmReasoningOutput").innerHTML = "";
  document.getElementById("refinedPromptPin")?.classList.add("hidden");
  const inp = document.getElementById("refinementPrompt");
  if (inp) inp.value = "";
  const sel = document.getElementById("projectProfile");
  if (sel) sel.value = "";
  showTemplateIntro();
  OrchestrationLock.unlock();
  updateUIFromState();
  toggleResumeButtons();
}

function toggleResumeButtons() {
  const hasProgress =
    webmcpState.atomicTasks.length > 0 ||
    (webmcpState.intentForge && webmcpState.intentForge.history.length > 0);
  document
    .getElementById("resumeButton")
    ?.classList.toggle("hidden", !hasProgress);
  document
    .getElementById("newProjectButton")
    ?.classList.toggle("hidden", !hasProgress);
}

function updateUIFromState() {
  const hist = document.getElementById("intentForgeChatHistory");
  if (
    hist &&
    webmcpState.intentForge &&
    webmcpState.intentForge.history.length > 0
  ) {
    hist.innerHTML = "";
    webmcpState.intentForge.history.forEach((m) => {
      // El marcador COMPLETE no se muestra: la tarjeta se reconstruye abajo.
      if (m.role !== "user" && isCompleteMessage(m.content)) return;
      appendToIntentForgeChat(
        m.role === "user" ? "user" : "assistant",
        m.content,
        { plain: true },
      );
    });
    updateIntentForgeStatus(webmcpState.intentForge.status || "IDLE");
  }

  if (webmcpState.intentForge?.refined_prompt) {
    updateRefinedPromptPin(webmcpState.intentForge.refined_prompt);
    // Si quedó en COMPLETE sin graph generado (recarga de página a mitad de
    // camino), reconstruye la tarjeta de confirmar/ajustar.
    if (
      webmcpState.intentForge.status === "COMPLETE" &&
      !(webmcpState.atomicTasks?.length > 0)
    ) {
      renderConfirmationPrompt(webmcpState.intentForge.refined_prompt);
    }
  }

  // Tarjetas de cobertura: desactivadas (01/10). Ver logTermCoverage.

  if (webmcpState.awaitingDecision) {
    requestHumanDecision(
      webmcpState.awaitingDecision.type,
      webmcpState.awaitingDecision.payload,
    );
  }

  renderTaskList();
  updatePreview();
  syncChatUI();
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

async function generateTechLeaderPlan(promptText, previousFeedback = "") {
  appendToReasoning(
    `<div class="text-cyan-400 font-bold">🧠 TECHLEADER → Analizando proyecto...</div>`,
  );
  // La etapa se pide al server en cada llamada (si ProjectStage.md cambió,
  // se usa la nueva). Falla fuerte: nunca TechLeader "sin etapa" en silencio.
  const stage = await loadStage();
  // Roles y reglas por rol: del profile del proyecto (profiles, 05/10).
  const profile = activeProfile();
  let finalPrompt = `${promptText}\n\n${stage.criterion}`;
  if (previousFeedback) {
    finalPrompt += `\n\n--- FEEDBACK DE REVISIÓN ANTERIOR ---\n${previousFeedback}\nPor favor, ajusta el plan de fases para corregir estos problemas. NO inventes requisitos, solo ajusta lo estrictamente necesario para resolver el feedback.`;
    appendToReasoning(
      `<div class="text-yellow-400 text-xs">⚠️ Incluyendo feedback de revisión anterior (etapa / validación / completitud)...</div>`,
    );
  }
  // Parseo tolerante + UN reintento si el JSON no se puede leer
  // (Project25, 05/10: una coma faltante cortó toda la corrida en el intento 3).
  const messages = [
    { role: "system", content: buildTechLeaderPrompt(profile) },
    { role: "user", content: finalPrompt },
  ];
  let plan;
  for (let jsonTry = 1; jsonTry <= 2; jsonTry++) {
    const techRes = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemma-4-e4b", messages, temperature: 0.0 }),
    });
    if (!techRes.ok) throw new Error(`TechLeader Error: ${techRes.status}`);
    const techData = await techRes.json();
    const raw = techData?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("TechLeader no devolvió contenido.");
    const parsed = parseJsonLoose(raw);
    if (parsed.ok) {
      plan = parsed.data;
      if (parsed.repaired)
        appendToReasoning(`<div class="text-yellow-400 text-xs">⚠️ TECHLEADER → JSON reparado (fence, comas o texto alrededor)</div>`);
      break;
    }
    appendToReasoning(
      `<div class="text-red-400 text-xs">✗ TECHLEADER → JSON ilegible (${escapeHTML(parsed.error)})${jsonTry < 2 ? " → se le pide de nuevo" : ""}</div>`,
    );
    if (jsonTry === 2) throw new Error(`TechLeader devolvió JSON ilegible dos veces: ${parsed.error}`);
    messages.push(
      { role: "assistant", content: raw },
      { role: "user", content: `Tu JSON no se pudo leer (${parsed.error}). Devolvé SOLO el JSON completo y válido, con el mismo contenido: comas entre cada propiedad y cada elemento, sin texto antes ni después.` },
    );
  }
  if (!plan || !Array.isArray(plan.fases))
    throw new Error("TechLeader no devolvió un array 'fases'.");
  plan.fases = plan.fases.map((fase, index) => ({
    ...fase,
    id: fase.id || `F${index + 1}`,
    responsable_sugerido: profile.roles.includes(fase.responsable_sugerido)
      ? fase.responsable_sugerido
      : profile.defaultRole,
    depends_on: Array.isArray(fase.depends_on) ? fase.depends_on : [],
  }));
  plan.diferido = Array.isArray(plan.diferido)
    ? plan.diferido.filter((d) => typeof d === "string" && d.trim())
    : [];
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

async function persistProject(promptText) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: promptText }),
  });
  if (!response.ok) throw new Error(`Persistence Error: ${response.status}`);
  const data = await response.json();
  if (!data.id) throw new Error("Persistence no devolvió project_id.");
  return data.id;
}

function formatValidationFeedback(validation) {
  if (!validation) return "";
  let feedback = "\n\n=== FEEDBACK DE VALIDATION ===\n";
  if (validation.status === "FAIL")
    feedback += "La validación estructural/de dominio devolvió FAIL.\n\n";
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
  feedback +=
    "\nRevisa el plan de fases y corrige únicamente lo necesario para resolver los FAILS. No inventes requisitos.\n";
  return feedback;
}

function formatReviewerFeedback(reviewResult) {
  if (!reviewResult || !Array.isArray(reviewResult.findings)) return "";
  const gaps = reviewResult.findings.filter((f) => f.type === "GAP");
  const excess = reviewResult.findings.filter((f) => f.type === "EXCESS");
  const ambiguous = reviewResult.findings.filter((f) => f.type === "AMBIGUOUS");
  if (!gaps.length && !excess.length && !ambiguous.length) return "";

  let feedback = `\n\n=== FEEDBACK DEL COMPLETENESS REVIEWER V3 ===\n`;
  feedback +=
    "El Graph anterior fue evaluado y se encontraron los siguientes problemas:\n\n";
  if (gaps.length > 0) {
    feedback += `## GAPS (Requisitos faltantes):\n`;
    gaps.forEach((gap, i) => {
      feedback += `${i + 1}. ${gap.reference}: ${gap.reason}\n`;
    });
    feedback += `\n`;
  }
  if (excess.length > 0) {
    feedback += `## EXCESS (Trabajo sin sustento explícito):\n`;
    excess.forEach((exc, i) => {
      feedback += `${i + 1}. ${exc.reference}: ${exc.reason}\n`;
    });
    feedback += `\n`;
  }
  if (ambiguous.length > 0) {
    feedback += `## AMBIGUOUS (Ambigüedades relevantes):\n`;
    ambiguous.forEach((amb, i) => {
      feedback += `${i + 1}. ${amb.reference}: ${amb.reason}\n`;
    });
    feedback += `\n`;
  }
  feedback +=
    "\nAjusta el nuevo plan de fases únicamente en respuesta a estos hallazgos. No inventes requisitos.\n";
  return feedback;
}

async function runGraph(plan) {
  appendToReasoning(
    `<div class="text-cyan-400 font-bold">INICIANDO GRAPH [LIVE + RE-ATOMIZER OFICIAL]</div>`,
  );
  const startTime = Date.now();
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
      // Si una task falla 3/3, pedir decisión humana
      if (task.attempts >= 3 || task.retries >= 3) {
        appendToReasoning(
          `<div class="text-red-400 font-bold">❌ TASK ${task.id} 3/3 STRIKES</div>`,
        );
        requestHumanDecision("TASK_FAIL_3_STRIKES", {
          taskId: task.id,
          error: task.error || task.reason,
          phase: task.phase,
        });
      }
    }
    saveState();
    renderTaskList();
  };
  try {
    const profile = activeProfile();
    const result = await runAtomicGraph(
      plan.fases,
      logCallback,
      onTaskResolved,
      { profile },
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
    const validation = validateRoleDependencies(dependencyResult.nodes, profile);
    webmcpState.validation = validation;
    webmcpState.dependencyGraph = dependencyResult;
    webmcpState.atomicTasks = dependencyResult.nodes;
    webmcpState.unresolvedTasks = dependencyResult.unresolved;
    appendToReasoning(
      `<div class="text-cyan-400 font-bold mt-2">🔎 VALIDATION → Role Dependencies</div>`,
    );
    appendToReasoning(
      `<div class="${validation.status === "FAIL" ? "text-red-400" : validation.status === "PASS_WITH_WARNINGS" ? "text-yellow-400" : "text-green-400"} font-bold">${validation.status}</div>`,
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
    webmcpState.dependencyGraph = { valid: false, error: error.message };
    saveState();
    renderTaskList();
    appendToReasoning(
      `<div class="text-red-500 font-bold mt-2">✗ ERROR GRAPH: ${error.message}</div>`,
    );
    return {
      status: "FAIL",
      validation: {
        status: "FAIL",
        failures: [{ rule: "GRAPH_EXECUTION_ERROR", message: error.message }],
      },
      dependencyResult: null,
      atomicTasks: webmcpState.atomicTasks,
      unresolvedTasks: webmcpState.unresolvedTasks,
      result: null,
    };
  }
}

// === ETAPA DEL PROYECTO (paso 3 post-Project20) ===
async function loadStage() {
  const res = await fetch("/api/stage");
  if (!res.ok)
    throw new Error(`No se pudo cargar la etapa del proyecto (/api/stage ${res.status}): ${(await res.text()).slice(0, 300)}`);
  const s = await res.json();
  if (!s.stage || !s.criterion) throw new Error("/api/stage no devolvió etapa y criterio");
  if (webmcpState.stage?.sha256 !== s.sha256) {
    appendToReasoning(
      `<div class="text-cyan-400 text-xs">[STAGE] ${s.stage} (${s.sha256.slice(0, 8)}) → TechLeader</div>`,
    );
  }
  webmcpState.stage = s;
  return s;
}

// Devuelve null si el chequeo no pudo correr: se avisa en rojo y se sigue
// (es una red, no una compuerta; el Completeness Reviewer igual aplica la etapa).
async function checkPlanStage(plan, promptText) {
  appendToReasoning(`<div class="text-cyan-400 font-bold mt-2">🧭 STAGE CHECK → plan de ${plan.fases.length} fases</div>`);
  try {
    const res = await fetch("/api/stage-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: promptText, fases: plan.fases }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
    const r = await res.json();
    (r.logs || []).forEach((m) =>
      appendToReasoning(`<div class="text-gray-400 text-xs">[STAGE_CHECK] ${escapeHTML(m)}</div>`),
    );
    r.flagged.forEach((f) =>
      appendToReasoning(
        `<div class="text-yellow-400 text-xs">⚠️ ${f.phase_id} ${f.verdict}${f.deferred_part ? ` — ${escapeHTML(f.deferred_part)}` : ""}: ${escapeHTML(f.reason)}</div>`,
      ),
    );
    // Sin veredicto no es "en alcance": se avisa aparte y no se da por bueno.
    const gaps = r.schema_gaps || {};
    const unchecked = [...(gaps.missing || []), ...(gaps.invalid || [])];
    if (unchecked.length)
      appendToReasoning(
        `<div class="text-red-400 text-xs">⚠️ STAGE CHECK incompleto: sin veredicto válido para ${escapeHTML(unchecked.join(", "))}</div>`,
      );
    if (!r.flagged.length && r.schema_complete)
      appendToReasoning(`<div class="text-green-400 text-xs">✓ todas las fases pertenecen a ${r.stage}</div>`);
    return r;
  } catch (err) {
    appendToReasoning(
      `<div class="text-red-400 font-bold text-xs">✗ STAGE CHECK no corrió (${escapeHTML(err.message)}). Se sigue sin chequeo de plan.</div>`,
    );
    return null;
  }
}

function addDeferred(items) {
  webmcpState.deferredWork = webmcpState.deferredWork || [];
  for (const it of items) {
    const key = norm(it.text);
    if (!key || webmcpState.deferredWork.some((d) => norm(d.text) === key)) continue;
    webmcpState.deferredWork.push(it);
  }
}

// TechLeader + chequeo de etapa del plan, con hasta MAX_PLAN_STAGE_RETRIES
// reintentos de SOLO el plan (segundos) antes de gastar el atomizado.
const MAX_PLAN_STAGE_RETRIES = 2;
async function generateStageCheckedPlan(promptText, previousFeedback = "") {
  let plan = await generateTechLeaderPlan(promptText, previousFeedback);
  for (let retry = 0; ; retry++) {
    const check = await checkPlanStage(plan, promptText);
    webmcpState.stageChecks = webmcpState.stageChecks || [];
    webmcpState.stageChecks.push({
      at: new Date().toISOString(),
      plan_retry: retry,
      stage_sha256: check?.stage_sha256 || null,
      phases: plan.fases.length,
      flagged: check ? check.flagged : null,
      schema_complete: check ? check.schema_complete : null,
    });
    saveState();
    if (!check || !check.flagged.length) break;
    if (retry >= MAX_PLAN_STAGE_RETRIES) {
      appendToReasoning(
        `<div class="text-yellow-400 font-bold text-xs">⚠️ STAGE CHECK: ${check.flagged.length} fase(s) siguen marcadas tras ${MAX_PLAN_STAGE_RETRIES} reintentos de plan. Sigue al atomizado; el Completeness Reviewer decide.</div>`,
      );
      break;
    }
    // Lo marcado se registra como diferido ANTES de rehacer: si TechLeader lo
    // saca, no se pierde (ProjectStage: "se difiere, no se descarta").
    addDeferred(
      check.flagged
        .filter((f) => f.verdict === "DEFERRED")
        .map((f) => ({ text: f.deferred_part || f.phase_name, source: "stage_check", phase: f.phase_id, reason: f.reason })),
    );
    appendToReasoning(
      `<div class="text-yellow-400 font-bold">↻ Rehaciendo plan por etapa (${retry + 1}/${MAX_PLAN_STAGE_RETRIES})</div>`,
    );
    plan = await generateTechLeaderPlan(promptText, previousFeedback + check.feedback);
  }
  addDeferred(plan.diferido.map((t) => ({ text: t, source: "techleader" })));
  if (webmcpState.deferredWork?.length) {
    appendToReasoning(
      `<div class="text-gray-400 text-xs">📦 Diferido (${webmcpState.deferredWork.length}): ${webmcpState.deferredWork.map((d) => escapeHTML(d.text)).join(" · ")}</div>`,
    );
  }
  saveState();
  return plan;
}

async function runGenerationAttempt(promptText, previousFeedback = "") {
  const plan = await generateStageCheckedPlan(promptText, previousFeedback);
  webmcpState.fullPlan = plan;
  webmcpState.prompt = promptText;
  saveState();
  appendToReasoning(
    `<div class="text-cyan-400 mt-2">Stack: ${Array.isArray(plan.stack_sugerido) ? plan.stack_sugerido.join(", ") : plan.stack_sugerido || "N/D"}</div>`,
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
  // Si la llamada al reviewer falla, no se corta la generación: se registra
  // como "no corrió" y lo decide el gate de abajo.
  let completeness;
  try {
    completeness = await runCompletenessReviewFromGraph_V3(graphResult.atomicTasks, promptText);
  } catch (e) {
    completeness = { error: e.message };
  }
  const validationFailed = graphResult.validation?.status === "FAIL";
  // GATE (05/10, evidencia Project23): un SYSTEM_ERROR ("fetch failed") se
  // aprobaba porque solo frenaban GAP/EXCESS. Ahora un reviewer que no corrió
  // no aprueba: el plan queda en pausa y decide el humano. No se rehace el
  // plan solo, porque el problema no es el plan.
  const review = reviewStatus(completeness);
  if (!validationFailed && !review.ran) {
    return {
      status: "REVIEW_ERROR",
      plan,
      graphResult,
      validation: graphResult.validation,
      completeness,
      reviewError: review.reason,
      feedback: "",
    };
  }
  // GAP y EXCESS son defectos reales y bloquean el intento; AMBIGUOUS no.
  const completenessFailed = review.ran && review.blocking;
  if (validationFailed || completenessFailed) {
    let feedback = "";
    if (validationFailed)
      feedback += formatValidationFeedback(graphResult.validation);
    if (completenessFailed) feedback += formatReviewerFeedback(completeness);
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

// NOTA: nada llama a esta función hoy (no estaba conectada a ningún botón
// ni antes ni ahora); queda como punto de entrada manual/de debug. El flujo
// real arranca en sendToIntentForge -> confirmRefinedPrompt ->
// handleContinuePlan.
async function handleGeneratePlan() {
  if (!OrchestrationLock.canSend()) return;
  const promptText = webmcpState.prompt;
  if (!promptText) return alert("No hay un prompt cargado todavía");

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

async function handleContinuePlan() {
  if (!OrchestrationLock.canSend() && !webmcpState.awaitingDecision) return;
  const promptText = webmcpState.prompt;
  if (!promptText) return alert("No hay un prompt cargado todavía");

  OrchestrationLock.lock("GENERANDO PLAN");

  let previousFeedback = "";
  let finalAttempt = null;
  try {
    for (let attempt = 1; attempt <= MAX_TECHLEADER_ATTEMPTS; attempt++) {
      appendToReasoning(
        `<div class="text-cyan-400 font-bold">🔄 INTENTO COMPLETO ${attempt}/${MAX_TECHLEADER_ATTEMPTS}</div>`,
      );
      finalAttempt = await runGenerationAttempt(promptText, previousFeedback);
      if (finalAttempt.status === "PASS") {
        webmcpState.reviewSkipped = false;
        appendToReasoning(
          `<div class="text-green-400 font-bold mt-3">✅ GENERACIÓN APROBADA EN EL INTENTO ${attempt}</div>`,
        );
        OrchestrationLock.unlock();
        saveState();
        return;
      }
      if (finalAttempt.status === "REVIEW_ERROR") {
        appendToReasoning(
          `<div class="text-red-400 font-bold mt-3">⛔ REVISIÓN NO EJECUTADA: ${escapeHTML(finalAttempt.reviewError)}. El graph quedó generado pero sin revisar; no se aprueba.</div>`,
        );
        OrchestrationLock.unlock();
        requestHumanDecision("REVIEW_NOT_RUN", {
          error: finalAttempt.reviewError,
          validationStatus: finalAttempt.validation?.status || "?",
          attempt,
        });
        saveState();
        return;
      }
      appendToReasoning(
        `<div class="text-red-400 font-bold mt-3">❌ FAIL EN INTENTO ${attempt}</div>`,
      );
      previousFeedback = finalAttempt.feedback || "";
      if (attempt < MAX_TECHLEADER_ATTEMPTS) {
        appendToReasoning(
          `<div class="text-yellow-400 font-bold">↻ FAIL detectado. Reintentando...</div>`,
        );
      }
    }

    // 3/3 FALLARON -> pedir decisión humana, no reintentar solo
    appendToReasoning(
      `<div class="text-red-400 font-bold mt-3">🛑 3/3 STRIKES ALCANZADO. Esperando decisión humana.</div>`,
    );
    OrchestrationLock.unlock();
    requestHumanDecision("VALIDATION_FAIL_3_STRIKES", {
      validationStatus: finalAttempt?.validation?.status || "FAIL",
      completeness: finalAttempt?.completeness,
    });
    webmcpState.fullPlan = finalAttempt?.plan || null;
    saveState();
  } catch (error) {
    console.error(error);
    appendToReasoning(
      `<div class="text-red-400 font-bold mt-3">❌ ERROR: ${error.message}</div>`,
    );
    OrchestrationLock.unlock();
    alert(`Error durante la generación: ${error.message}`);
  } finally {
    toggleResumeButtons();
  }
}

async function checkBuild() {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    const { build } = await res.json();
    if (build && build !== BUILD_ID) {
      appendToReasoning(
        `<div class="bg-red-900/60 border border-red-500 text-red-200 font-bold text-xs p-2 rounded my-1">⚠️ Esta pestaña corre script.js ${BUILD_ID} y en disco está ${build}. Recargá la página (Ctrl+F5) antes de generar: si no, corre el código viejo.</div>`,
      );
      return false;
    }
    return true;
  } catch {
    return true; // server viejo sin /api/version: no bloquear
  }
}

function initializeApp() {
  populateProfileSelect();
  loadState();
  appendToReasoning(`<div class="text-gray-500 text-[10px]">[BUILD] script.js ${BUILD_ID}</div>`);
  checkBuild();
  renderTaskList(); // siempre renderiza
  showTemplateIntro();
  syncChatUI();

  document
    .getElementById("clearBtn")
    ?.addEventListener("click", () => clearState());

  // Un solo input, un solo botón, para las 3 situaciones (arrancar,
  // seguir la entrevista, responder una consulta puntual): la fase que
  // corresponde en cada momento la decide getChatPhase()/syncChatUI(), acá
  // solo se manda lo que el usuario escribió.
  const sendCurrentInput = () => {
    const input = document.getElementById("refinementPrompt");
    const v = input?.value?.trim();
    if (!v || v === TEMPLATE_TEXT.trim()) return; // plantilla sin completar
    sendToIntentForge(v);
  };
  document
    .getElementById("chatActionBtn")
    ?.addEventListener("click", sendCurrentInput);
  document
    .getElementById("refinementPrompt")
    ?.addEventListener("keydown", (e) => {
      // Con la plantilla (IDLE) Enter es salto de línea y se manda con
      // Ctrl+Enter; en el resto de las fases Enter manda, como siempre.
      if (e.key !== "Enter" || e.shiftKey) return;
      if (getChatPhase() === "IDLE" && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      sendCurrentInput();
    });
}

window.onload = initializeApp;
