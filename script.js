import { validateRoleDependencies } from "./validation_profile_role_dependencies.mjs";
import { runAtomicGraph, resolveDependencies } from "./atomic_engine_v5.js";
import { missingMentions, norm } from "./intent_mention_check.mjs";

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
  switch (phase) {
    case "IDLE":
      btn.innerText = "Iniciar entrevista";
      input.placeholder = "Contame qué querés construir...";
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

function appendToIntentForgeChat(role, text) {
  const container = document.getElementById("intentForgeChatHistory");
  if (!container) return;
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

  // El primer mensaje que se manda (fase IDLE) ES el prompt crudo del
  // proyecto. No se vuelve a tocar en mensajes siguientes, para no pisarlo
  // con una respuesta parcial a una pregunta de Intent Forge.
  if (!webmcpState.prompt) webmcpState.prompt = userMessage;

  appendToIntentForgeChat("user", userMessage);
  const input = document.getElementById("refinementPrompt");
  if (input) input.value = "";

  webmcpState.intentForge = webmcpState.intentForge || {
    status: "IDLE",
    history: [],
    refined_prompt: null,
    iteration: 0,
  };
  webmcpState.intentForge.status = "ASKING";
  // auto=true: mensaje armado por el sistema (p.ej. "Agregá también...").
  // Se manda a Intent Forge igual, pero el chequeo de menciones lo ignora
  // para no avisar por sus propias palabras.
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
      webmcpState.intentForge.mentionDecisions = {};
      updateIntentForgeStatus("COMPLETE");
      updateRefinedPromptPin(data.refined_prompt);
      renderConfirmationPrompt(data.refined_prompt);
      appendToReasoning(
        `<div class="text-green-400 font-bold">✅ Intent Forge COMPLETE (${(data.refined_prompt.features || []).length} features)</div>`,
      );
    } else {
      appendToIntentForgeChat("assistant", assistantMessage);
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

// === TARJETA DE CONFIRMACIÓN (reemplaza a approveIntentForgeBtn) ===
// En vez de un botón aparte lejos del chat, el resumen y la decisión viven
// en la misma burbuja del chat — así el input nunca hace doble rol.
function buildRefinedSummaryHTML(refined) {
  const feats = (refined.features || [])
    .map((f) => `<li>${f}</li>`)
    .join("");
  const criterios = (refined.criterios_holdout || [])
    .map((c) => `<li>${c}</li>`)
    .join("");
  return `
    <div class="text-indigo-300 font-bold mb-1">Ok, en base a lo que acordamos, voy a construir:</div>
    <div class="text-white font-medium">${refined.project_name || ""}${refined.project_stage ? ` <span class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-800 text-cyan-200 align-middle">Etapa: ${refined.project_stage}</span>` : ""}</div>
    ${refined.objetivo ? `<div class="text-gray-300 mt-1">${refined.objetivo}</div>` : ""}
    ${feats ? `<ul class="list-disc list-inside text-gray-300 mt-1">${feats}</ul>` : ""}
    ${criterios ? `<div class="text-gray-500 text-[10px] mt-1">Criterios de éxito: <ul class="list-disc list-inside">${criterios}</ul></div>` : ""}
  `;
}

// === "MENCIONASTE Y NO INCLUÍ" (paso 2 post-Project20) ===
// Al llegar el COMPLETE, compara lo que dijo el usuario en la entrevista con
// el refined_prompt (intent_mention_check.mjs, determinista) y muestra las
// frases que quedaron afuera. "Confirmar y generar" queda bloqueado hasta
// decidir cada aviso: Incluir (vuelve a Intent Forge) / Excluir a propósito
// (va a TechLeader como fuera de alcance) / Falso aviso (no vuelve a salir).
function escapeHTML(t) {
  return String(t ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function ensureIntentForgeListState() {
  const f = webmcpState.intentForge;
  f.exclusiones = f.exclusiones || [];
  f.ignoredMentions = f.ignoredMentions || [];
  f.mentionDecisions = f.mentionDecisions || {};
  f.requestedMentions = f.requestedMentions || {};
  return f;
}

function computeMentionNotices(refined) {
  const f = ensureIntentForgeListState();
  const userMsgs = (f.history || [])
    .filter((m) => m.role === "user" && !m.auto)
    .map((m) => m.content);
  // Una frase ya pedida con "Incluir" se da por atendida si Intent Forge
  // cubrió AL MENOS una de sus palabras faltantes (la frase entera rara vez
  // aparece literal: "algo de panaderia (las cafeterias ... vender ...)" ->
  // feature "Sección de panadería"). Si no cubrió ninguna, vuelve a salir:
  // eso es evidencia de que el modelo ignoró el pedido.
  return missingMentions(userMsgs, refined, {
    exclusiones: f.exclusiones,
    ignoradas: f.ignoredMentions,
  }).filter((n) => {
    const before = f.requestedMentions[n.phrase];
    return !(before && n.missing.length < before.length);
  });
}

const MENTION_CHOICES = [
  ["incluir", "➕ Incluir"],
  ["excluir", "🚫 Excluir a propósito"],
  ["ignorar", "🙈 Falso aviso"],
];

function renderMentionControls(card) {
  const f = ensureIntentForgeListState();
  const notices = computeMentionNotices(f.refined_prompt);
  const box = card.querySelector('[data-role="mentions"]');
  const btn = card.querySelector('[data-action="confirm-refined"]');
  const dec = f.mentionDecisions;
  const pending = notices.filter((n) => !dec[n.phrase]).length;
  const includes = notices.filter((n) => dec[n.phrase] === "incluir").length;

  box.innerHTML = notices.length
    ? `<div class="text-amber-300 font-bold mt-2">⚠️ Mencionaste y no quedó en la lista (${notices.length}):</div>` +
      notices
        .map(
          (n) => `
      <div class="border border-amber-700/60 rounded p-2 mt-1" data-phrase="${escapeHTML(n.phrase)}">
        <div class="text-gray-200">"${escapeHTML(n.phrase)}"</div>
        <div class="text-gray-500 text-[10px]">falta: ${n.missing.map(escapeHTML).join(", ")}</div>
        <div class="flex gap-1 mt-1">
          ${MENTION_CHOICES.map(
            ([k, label]) =>
              `<button type="button" data-action="mention" data-choice="${k}" class="flex-1 rounded py-0.5 text-[10px] ${
                dec[n.phrase] === k ? "bg-amber-600 text-white font-bold" : "bg-gray-700 text-gray-300"
              }">${label}</button>`,
          ).join("")}
        </div>
      </div>`,
        )
        .join("")
    : "";

  if (pending > 0) {
    btn.textContent = `Decidí los avisos (${pending} pendiente${pending > 1 ? "s" : ""})`;
    btn.disabled = true;
    btn.className = "flex-1 bg-gray-600 rounded py-1 text-xs font-bold opacity-50 cursor-not-allowed";
  } else if (includes > 0) {
    btn.textContent = `📨 Pedir a Intent Forge que agregue (${includes})`;
    btn.disabled = false;
    btn.className = "flex-1 bg-amber-600 rounded py-1 text-xs font-bold";
  } else {
    btn.textContent = "✅ Confirmar y generar";
    btn.disabled = false;
    btn.className = "flex-1 bg-green-600 rounded py-1 text-xs font-bold";
  }
  return { notices, pending, includes };
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
    const action = el.dataset.action;
    if (action === "confirm-refined") confirmRefinedPrompt();
    else if (action === "adjust-refined") adjustRefinedPrompt();
    else if (action === "mention") {
      const phrase = el.closest("[data-phrase]")?.dataset.phrase;
      if (phrase == null) return;
      const dec = ensureIntentForgeListState().mentionDecisions;
      // Tocar la opción ya elegida la deselecciona.
      dec[phrase] = dec[phrase] === el.dataset.choice ? undefined : el.dataset.choice;
      if (!dec[phrase]) delete dec[phrase];
      saveState();
      renderMentionControls(card);
    }
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
  const cardId = `confirm-${Date.now()}`;
  container.innerHTML += `
    <div class="bg-indigo-900/30 border border-indigo-600 p-3 rounded text-xs my-2" id="${cardId}" data-confirm-card="1">
      ${buildRefinedSummaryHTML(refined)}
      <div data-role="mentions"></div>
      <div class="flex gap-2 mt-2">
        <button type="button" class="flex-1 bg-green-600 rounded py-1 text-xs font-bold" data-action="confirm-refined">✅ Confirmar y generar</button>
        <button type="button" class="flex-1 bg-gray-700 rounded py-1 text-xs font-bold" data-action="adjust-refined">✏️ Ajustar</button>
      </div>
    </div>`;
  const card = document.getElementById(cardId);
  if (card) {
    const { notices } = renderMentionControls(card);
    if (notices.length) {
      appendToReasoning(
        `<div class="text-amber-400 text-xs">[MENTION_CHECK] ${notices.length} frase(s) del usuario sin reflejo en refined_prompt</div>`,
      );
    }
  }
  container.scrollTop = container.scrollHeight;
  syncChatUI();
}

// Pasa las decisiones Excluir / Falso aviso a las listas persistentes.
// Devuelve las frases marcadas Incluir.
// Ojo: lo que se excluye son las PALABRAS faltantes, no la frase entera.
// 'seccion "carta" para ver productos y precios' excluida entera le diría a
// TechLeader que no planifique la Carta, que sí es feature; se excluye "precios".
function commitMentionDecisions(notices = []) {
  const f = ensureIntentForgeListState();
  const incluir = [];
  const missingOf = Object.fromEntries(notices.map((n) => [n.phrase, n.missing]));
  for (const [phrase, d] of Object.entries(f.mentionDecisions)) {
    const excl = (missingOf[phrase] || [phrase]).join(", ");
    if (d === "excluir" && !f.exclusiones.includes(excl)) f.exclusiones.push(excl);
    else if (d === "ignorar" && !f.ignoredMentions.includes(phrase)) f.ignoredMentions.push(phrase);
    else if (d === "incluir") incluir.push(phrase);
  }
  f.mentionDecisions = {};
  return incluir;
}

// FIX (bug real, no solo de interfaz): antes esto mandaba a TechLeader
// SOLO refined_prompt.objetivo, descartando la lista de features que Intent
// Forge armó con tanto cuidado. TechLeader terminaba planificando a partir
// de una sola oración, mientras el Completeness Reviewer sí recibía las
// features completas vía answer_key_requirements.json — dos fuentes de
// verdad desalineadas. Acá se reconstruye el prompt completo, y además en
// el mismo formato de lista numerada que ya sabe leer
// completeness_reviewer3.mjs (extractRequirements), para que TechLeader y
// el Reviewer trabajen sobre el mismo texto.
function buildTechLeaderInputFromRefinedPrompt(refined, exclusiones = []) {
  const parts = [];
  if (refined.project_name) parts.push(`Proyecto: ${refined.project_name}`);
  if (refined.objetivo) parts.push(refined.objetivo);
  if (Array.isArray(refined.features) && refined.features.length) {
    // Antes decía "El prototipo debe permitir:": fijaba la etapa en el
    // texto y el reviewer la marcó AMBIGUOUS en Project20. La etapa ahora
    // viaja aparte (refined.project_stage + /api/stage).
    parts.push("", "Features:", "");
    refined.features.forEach((f, i) => parts.push(`${i + 1}. ${f}`));
  }
  if (Array.isArray(refined.criterios_holdout) && refined.criterios_holdout.length) {
    parts.push("", "Criterios de éxito:");
    refined.criterios_holdout.forEach((c) => parts.push(`- ${c}`));
  }
  // Va DESPUÉS de "Criterios de éxito" a propósito: extractRequirements del
  // reviewer toma la lista numerada de features, y esto no debe contar como
  // requisito. El reviewer además lee answer_key_requirements.json (solo features).
  if (exclusiones.length) {
    parts.push(
      "",
      "Fuera de alcance (el usuario lo descartó explícitamente; NO planificar):",
    );
    exclusiones.forEach((x) => parts.push(`- ${x}`));
  }
  return parts.join("\n");
}

async function confirmRefinedPrompt() {
  const refined = webmcpState.intentForge?.refined_prompt;
  if (!refined) return;
  const f = ensureIntentForgeListState();
  const notices = computeMentionNotices(refined);
  if (notices.some((n) => !f.mentionDecisions[n.phrase])) return; // guardia: el botón ya está bloqueado
  const incluir = commitMentionDecisions(notices);
  for (const n of notices) {
    if (incluir.includes(n.phrase)) f.requestedMentions[n.phrase] = n.missing;
  }
  saveState();

  if (incluir.length) {
    // Vuelve a Intent Forge: reescribe el refined_prompt y, en el próximo
    // COMPLETE, el chequeo corre de nuevo sobre la versión nueva.
    const container = document.getElementById("intentForgeChatHistory");
    if (container) markConfirmCardsStale(container);
    webmcpState.intentForge.status = "ASKING";
    await sendToIntentForge(
      "Agregá también al refined_prompt, como features atómicas:\n" +
        incluir.map((p) => `- ${p}`).join("\n") +
        "\nMantené todo lo demás igual y devolvé el refined_prompt completo.",
      { auto: true },
    );
    return;
  }

  webmcpState.prompt = buildTechLeaderInputFromRefinedPrompt(refined, f.exclusiones);
  appendToIntentForgeChat(
    "user",
    f.exclusiones.length
      ? `✅ Confirmado (fuera de alcance: ${f.exclusiones.map(escapeHTML).join(" · ")}).`
      : "✅ Confirmado.",
  );
  appendToReasoning(
    `<div class="text-green-400 text-xs">[FORGE→TECHLEADER] refined_prompt completo, ${(refined.features || []).length} features, ${f.exclusiones.length} exclusiones</div>`,
  );
  saveState();
  await handleContinuePlan();
}

function adjustRefinedPrompt() {
  // Vuelve a fase DEFAULT: el próximo mensaje sigue la conversación normal
  // con Intent Forge, por el mismo input de siempre. syncChatUI() ya
  // habilita el input solo con este cambio de status, no hace falta
  // tocar el DOM acá directamente.
  if (webmcpState.intentForge) {
    commitMentionDecisions(computeMentionNotices(webmcpState.intentForge.refined_prompt)); // Excluir / Falso aviso se conservan; Incluir se pide escribiendo
    webmcpState.intentForge.status = "ASKING";
    const container = document.getElementById("intentForgeChatHistory");
    if (container) markConfirmCardsStale(container);
  }
  updateIntentForgeStatus(`ASKING (iter ${webmcpState.intentForge?.iteration || 0})`);
  saveState();
  syncChatUI();
  document.getElementById("refinementPrompt")?.focus();
}

function updateRefinedPromptPin(refined) {
  const el = document.getElementById("refinedPromptPin");
  if (!el || !refined) return;
  const feats = (refined.features || []).map((f) => `<li>${f}</li>`).join("");
  el.innerHTML = `
    <div class="text-cyan-400 font-bold mb-1">📌 Refined prompt</div>
    <div class="text-white">${refined.project_name || ""}</div>
    ${refined.objetivo ? `<div class="text-gray-400 mt-1">${refined.objetivo}</div>` : ""}
    ${feats ? `<ul class="list-disc list-inside text-gray-400 mt-1">${feats}</ul>` : ""}
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

  chatHistory.scrollTop = chatHistory.scrollHeight;
  syncChatUI();
  document.getElementById("refinementPrompt")?.focus();
  saveState();
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
// === AVISO DE COBERTURA POR PALABRAS (term_coverage_check.mjs) ===
// Informativo: no bloquea ni dispara reintentos. Cada aviso se puede
// etiquetar "Hueco real" / "Falso aviso"; la etiqueta queda en
// evidence/term_coverage/<review_id>.json para calibrar el chequeo.
let termDelegationReady = false;
function renderTermCoverageCard(tc) {
  const container = document.getElementById("intentForgeChatHistory");
  const warn = (tc.items || []).filter((i) => i.missing.length);
  appendToReasoning(
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
  const btn = (k, t) => `<button type="button" data-term-label="${k}" class="flex-1 rounded py-0.5 text-[10px] bg-gray-700 text-gray-300">${t}</button>`;
  container.innerHTML += `
    <div class="bg-amber-900/20 border border-amber-700 p-3 rounded text-xs my-2" data-term-card="${escapeHTML(tc.review_id)}">
      <div class="text-amber-300 font-bold">🔎 Cobertura por palabras (aviso, no bloquea)</div>
      <div class="text-gray-500 text-[10px] mb-1">Palabras propias de cada requisito que no aparecen en ninguna tarea. Etiquetá para calibrar el chequeo.</div>
      ${warn
        .map(
          (i) => `
        <div class="border border-amber-800/60 rounded p-2 mt-1" data-term-row data-review="${escapeHTML(tc.review_id)}" data-req="${escapeHTML(i.id)}" data-label="">
          <div class="text-gray-200">${escapeHTML(i.id)}: ${escapeHTML(i.text)}</div>
          <div class="text-amber-200 text-[10px]">faltan (${i.total - i.present}/${i.total}): ${i.missing.map(escapeHTML).join(", ")}</div>
          <div class="flex gap-1 mt-1">${btn("hueco_real", "🕳️ Hueco real")}${btn("falso_aviso", "🙈 Falso aviso")}</div>
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
    if (result.term_coverage) renderTermCoverageCard(result.term_coverage);
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
    exclusiones: [],
    ignoredMentions: [],
    mentionDecisions: {},
    requestedMentions: {},
  },
  awaitingDecision: null,
  validation: null,
  completenessReview: null,
  stage: null,
  stageChecks: [],
  deferredWork: [],
};

const techLeaderPrompt = `Eres un TechLeader Senior.

Tu responsabilidad es analizar el proyecto solicitado y construir su PLAN DE FASES.

NO debes atomizar las fases en Atomic Tasks.
NO debes ejecutar tareas.
NO debes diseñar cada implementación en detalle.

Tu salida debe representar únicamente las fases necesarias para organizar la ejecución del proyecto.

ETAPA DEL PROYECTO:

El PROYECTO trae su ETAPA y el criterio de pertenencia de esa etapa.
Planifica SOLO el trabajo que pertenece a la etapa indicada.
El trabajo profesional válido que pertenece a una etapa posterior NO se
planifica como fase: se lista en "diferido" (se difiere, no se descarta).
La etapa nunca quita una Feature pedida ni agrega requisitos nuevos.

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

6. Una fase puede depender conceptualmente de otra.
Si existe una dependencia necesaria, exprésala mediante "depends_on".

7. NO conviertas una fase en una lista de Atomic Tasks.

8. NO agregues trabajo que no sea necesario para cumplir el objetivo solicitado.

9. NO inventes requisitos.

10. El resultado debe permitir que cada fase sea enviada posteriormente,
de manera independiente, a un Atomizer que asumirá temporalmente el rol
indicado en "responsable_sugerido".

RESPONDE ÚNICAMENTE CON JSON VÁLIDO.
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
  "features_clave": ["..."],
  "diferido": ["trabajo válido que corresponde a una etapa posterior"]
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
      exclusiones: [],
      ignoredMentions: [],
      mentionDecisions: {},
      requestedMentions: {},
    },
    awaitingDecision: null,
    validation: null,
    completenessReview: null,
    stage: null,
    stageChecks: [],
    deferredWork: [],
  };
  GLOBAL_ID = 1;
  INTENT_FORGE_ITERATION = 0;
  document.getElementById("intentForgeChatHistory").innerHTML = "";
  document.getElementById("llmReasoningOutput").innerHTML = "";
  document.getElementById("refinedPromptPin")?.classList.add("hidden");
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
      appendToIntentForgeChat(
        m.role === "user" ? "user" : "assistant",
        m.content,
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
  let finalPrompt = `${promptText}\n\n${stage.criterion}`;
  if (previousFeedback) {
    finalPrompt += `\n\n--- FEEDBACK DE REVISIÓN ANTERIOR ---\n${previousFeedback}\nPor favor, ajusta el plan de fases para corregir estos problemas. NO inventes requisitos, solo ajusta lo estrictamente necesario para resolver el feedback.`;
    appendToReasoning(
      `<div class="text-yellow-400 text-xs">⚠️ Incluyendo feedback de revisión anterior (etapa / validación / completitud)...</div>`,
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
  if (!techRes.ok) throw new Error(`TechLeader Error: ${techRes.status}`);
  const techData = await techRes.json();
  const raw = techData?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("TechLeader no devolvió contenido.");
  let plan;
  try {
    plan = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("TechLeader no devolvió JSON válido.");
    plan = JSON.parse(match[0]);
  }
  if (!plan || !Array.isArray(plan.fases))
    throw new Error("TechLeader no devolvió un array 'fases'.");
  plan.fases = plan.fases.map((fase, index) => ({
    ...fase,
    id: fase.id || `F${index + 1}`,
    responsable_sugerido: ROLES_VALIDOS.includes(fase.responsable_sugerido)
      ? fase.responsable_sugerido
      : "Backend",
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
  const completeness = await runCompletenessReviewFromGraph_V3(
    graphResult.atomicTasks,
    promptText,
  );
  const validationFailed = graphResult.validation?.status === "FAIL";
  // FIX: GAP y EXCESS son defectos reales y bloquean el intento; AMBIGUOUS
  // queda fuera del disparador (informativo, no bloqueante), igual que la
  // intención original del código — solo que ahora el campo que lee sí
  // existe en la forma real que devuelve completeness_reviewer3.mjs.
  const completenessFailed = (completeness?.findings ?? []).some(
    (f) => f.type === "GAP" || f.type === "EXCESS",
  );
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
        appendToReasoning(
          `<div class="text-green-400 font-bold mt-3">✅ GENERACIÓN APROBADA EN EL INTENTO ${attempt}</div>`,
        );
        OrchestrationLock.unlock();
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

function initializeApp() {
  loadState();
  renderTaskList(); // siempre renderiza
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
    if (v) sendToIntentForge(v);
  };
  document
    .getElementById("chatActionBtn")
    ?.addEventListener("click", sendCurrentInput);
  document
    .getElementById("refinementPrompt")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendCurrentInput();
      }
    });
}

window.onload = initializeApp;
