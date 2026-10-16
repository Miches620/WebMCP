// plan_stack_check.mjs — ¿el plan o las tareas nombran otro stack que el del Standard? (16/10). Sin modelo.
//
// Evidencia (pipeline del Kanban, 16/10): el TechLeader sugirió "React, Tailwind CSS" y la primera tanda de tareas
// hablaba de "el nuevo estado global recibido de la API" y "desde el backend", en una app sin servidor. El stack
// ahora lo fija el Standard (standards/catalog.mjs); esto lo verifica con palabras enteras (sin contar las negadas:
// "sin servidor" no cuenta). Es una red, como el chequeo de etapa: en el plan pide rehacerlo; en las tareas avisa.
// Módulo puro: lo usan script.js (navegador) y los tests (Node).

import { mentions } from "./standards/catalog.mjs";

export const STACK_CHECK_VERSION = "stack_check v0.1";

/** Fases (o tareas) que nombran algo que el stack no usa. */
export function stackFlags(items = [], stack, textOf) {
  if (!stack?.no_usa?.length) return [];
  return items
    .map((x) => ({ id: x.id, name: x.name || x.task || "", terms: mentions(textOf(x), stack.no_usa) }))
    .filter((x) => x.terms.length);
}

/** Chequeo del plan del TechLeader: lo marcado + el feedback para rehacerlo. */
export function checkPlanStack(fases = [], stack, standardId = "") {
  const flagged = stackFlags(fases, stack, (f) => `${f.name || ""}. ${f.description || ""}`);
  const feedback = flagged.length
    ? `\n\n--- STACK ---\nEl stack lo fija el Standard${standardId ? ` ${standardId}` : ""}: ${stack.nombre}. Estas fases nombran cosas que ese stack no usa:\n${flagged.map((f) => `- ${f.id} "${f.name}": ${f.terms.join(", ")}`).join("\n")}\nReescribí esas fases con lo que el stack sí usa (sin quitar lo que pide el proyecto).`
    : "";
  return { version: STACK_CHECK_VERSION, flagged, feedback };
}

/** Chequeo de las Atomic Tasks (solo aviso: el atomizado ya se gastó). */
export function checkTasksStack(tasks = [], stack) {
  return { version: STACK_CHECK_VERSION, flagged: stackFlags(tasks, stack, (t) => `${t.task || ""}. ${t.description || ""}`) };
}
