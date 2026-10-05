const LLAMA_URL = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL_NAME = "google/gemma-4-e4b";

const MAX_RETRIES = 3;

// OJO:
// Esto NO significa "3 retries + original".
// Son 3 intentos TOTALES por AT:
// intento 1 = atomización original
// intento 2 = primera reatomización
// intento 3 = segunda reatomización
const MAX_AT_ATTEMPTS = 3;

/* =========================================================
   UTILIDADES
   ========================================================= */

async function callLLM(messages, logCallback = () => {}) {
  const response = await fetch(LLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("LLM no devolvió contenido.");
  }

  return content;
}

function extractJSON(text) {
  let cleaned = text.trim();

  // Quitar fences markdown si el modelo se manda una licencia
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No se encontró JSON válido en la respuesta.");
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  return JSON.parse(cleaned);
}

/* =========================================================
   ATOMIZER
   ========================================================= */

const DECOMPOSE_PROMPT = (
  phase,
  rolePadre,
  roles,
) => `Eres un especialista Senior en el rol "${rolePadre}".

Tu única responsabilidad es ATOMIZAR la fase recibida en
Atomic Tasks ejecutables.

IMPORTANTE:

No eres el TechLeader.
No debes redefinir la fase.
No debes cambiar su alcance.
No debes crear nuevas fases.

La fase fue definida previamente por TechLeader y asignada al rol:

"${rolePadre}"

FASE:
${JSON.stringify(phase, null, 2)}

TU OBJETIVO:

Analiza esta fase desde la perspectiva de "${rolePadre}" y
determina la descomposición más adecuada para ejecutarla.

No existe una cantidad máxima fija de Atomic Tasks.

La cantidad debe ser la que realmente necesite esta fase.

No dividas artificialmente una tarea que ya sea atómica.
No agrupes tareas diferentes solamente para reducir la cantidad.

Una Atomic Task debe:

- tener un único objetivo;
- tener un resultado claramente identificable;
- tener alcance suficientemente definido;
- poder ser ejecutada por un agente del rol asignado;
- no requerir tomar nuevas decisiones de diseño;
- no mezclar múltiples objetivos diferentes.

No inventes decisiones de diseño.

No agregues automáticamente:

- testing
- seguridad
- documentación
- autorización
- infraestructura
- deployment
- auditoría
- validación
- optimizaciones

salvo que la fase explícitamente los requiera.

DEPENDENCIAS:

Si una Atomic Task necesita el resultado de otra Atomic Task
de esta misma fase, indícalo mediante "depends_on".

Si pueden ejecutarse independientemente, NO introduzcas
una dependencia artificial.

ROL:

Todas las Atomic Tasks deben utilizar "${rolePadre}".

Roles permitidos:

${roles.map((r) => `"${r}"`).join("\n")}

SALIDA:

Devuelve ÚNICAMENTE JSON válido.

FORMATO:

{
  "phase_id": "${phase.id}",
  "atomic": false,
  "subtasks": [
    {
      "id": "F1.1",
      "task": "...",
      "role": "${rolePadre}",
      "description": "...",
      "depends_on": []
    }
  ]
}

Si la fase completa puede convertirse directamente en una
única Atomic Task:

{
  "phase_id": "${phase.id}",
  "atomic": true,
  "subtasks": [
    {
      "id": "F1.1",
"task": "...",
      "role": "${rolePadre}",
      "description": "...",
      "depends_on": []
    }
  ]
}

NO incluyas texto antes ni después del JSON.
`;

// ADDENDUM DE COHERENCIA - ESTO ES LO NUEVO, NO MODIFICA EL ANTERIOR
const DECOMPOSE_CONTEXT_ADDENDUM = (previousTasks = [], roleRules = []) => {
  if (!previousTasks || previousTasks.length === 0) {
    return `

[CONTEXTO ADICIONAL - HISTORIAL]
No hay tareas previas, esta es la primera fase.

REGLA ESTRICTA DE DEPENDENCIAS:
- depends_on SOLO puede contener IDs de Atomic Tasks que existan de verdad.
- No hay ninguna Atomic Task previa en este caso (lista vacía arriba), así
  que acá depends_on debe ser [] salvo que dependa de otra tarea de esta
  misma fase que vos mismo estés generando ahora.
- Formato de un ID real: FASE.NUMERO (ej. F1.1) o, si es una subtarea
  producto de una re-atomización, FASE.NUMERO.R{intento}.{indice} (ej.
  F2.4.R2.1). Esto es el FORMATO, no un ID para copiar: nunca escribas
  F2.4.R2.1 literal salvo que esa tarea exista de verdad en la lista de
  arriba.
- NUNCA uses IDs de fase solos como "F1", "F2", "F3", etc.
- NUNCA uses el nombre de una fase como dependencia.
- NUNCA uses una dependencia implícita como "todo F2".
- Si no existe una Atomic Task previa concreta de la que dependa tu tarea, usa [].

`;
  }

  const list = previousTasks
    .map((t) => `- ${t.id} | Fase ${t.phase} | ${t.task}`)
    .join("\n");

  return `
[CONTEXTO ADICIONAL - HISTORIAL DE TAREAS YA GENERADAS]

Para mantener coherencia del grafo completo, ya existen estas Atomic Tasks de fases anteriores:

${list}

REGLA ESTRICTA DE DEPENDENCIAS:

Además de las dependencias intra-fase que ya te pidió el prompt original, DEBES considerar las dependencias inter-fase cuando sean necesarias.

- depends_on SOLO puede contener IDs que aparezcan EXACTAMENTE, letra por
  letra, en la lista de tareas previas de arriba. No generes un ID nuevo
  vos mismo, ni siquiera si "parece" que debería existir.
- Formato de un ID real: FASE.NUMERO (ej. F1.1) o, si es una subtarea
  producto de una re-atomización, FASE.NUMERO.R{intento}.{indice} (ej.
  F2.4.R2.1). Esto es el FORMATO, no un ID para copiar: usalo solo para
  reconocer un ID real cuando lo veas en la lista de arriba, nunca para
  inventar uno que no está ahí.

- NUNCA uses IDs de fase solos como dependencia:
  F1
  F2
  F3
  F4
  F5

- NUNCA uses el nombre de una fase como dependencia.
- NUNCA uses una dependencia implícita como "todo F2".
- Si una tarea necesita trabajo realizado en otra fase, debes identificar las Atomic Tasks concretas que necesita.
- Usa únicamente IDs que aparezcan exactamente en el historial proporcionado.
- Si no puedes identificar una Atomic Task concreta, NO inventes un ID y NO uses el ID de la fase.
- Si realmente no necesita ninguna tarea previa, usa [].

Ejemplos de la FORMA correcta (asumiendo que esos IDs existieran en la
lista de tareas previas de arriba — si no están ahí, no los uses):
- ["F2.1"]
- ["F2.1", "F2.4"]

Ejemplos INCORRECTOS:
- ["F2"]
- ["F3"]
- ["Backend"]
- ["todas las tareas de F2"]
- cualquier ID que no aparezca literalmente en la lista de tareas previas

REGLAS ESPECÍFICAS POR ROL:
${roleRules.map((r) => `- ${r}`).join("\n")}
- Estas reglas NO autorizan a usar IDs de fase como dependencias.

`;
};

// WRAPPER QUE UNE AMBOS SIN MODIFICAR EL ORIGINAL
// Refactor de profiles (05/10): los roles permitidos y las "REGLAS ESPECÍFICAS
// POR ROL" vienen del profile del proyecto (profiles/registry.mjs); antes
// estaban fijas acá (Backend/Frontend/DBA/DevOps/QA). Sin profile, falla fuerte.
function requireProfile(profile, where) {
  if (!profile?.roles?.length || !Array.isArray(profile.atomizerRoleRules))
    throw new Error(`PROFILE_REQUIRED: ${where} necesita el profile del proyecto (opts.profile = resolveProfiles(...))`);
  return profile;
}

const buildDecomposePrompt = (phase, rolePadre, previousTasks = [], profile) => {
  return (
    DECOMPOSE_PROMPT(phase, rolePadre, profile.roles) +
    DECOMPOSE_CONTEXT_ADDENDUM(previousTasks, profile.atomizerRoleRules)
  );
};

/* =========================================================
   ATOMIZAR FASE
   ========================================================= */

export async function atomizePhase(
  phase,
  rolePadre,
  previousTasksOrCallback = [],
  logCallback = () => {},
  opts = {},
) {
  const profile = requireProfile(opts.profile, "atomizePhase");
  // Retrocompatibilidad: si el 3er param es función, es el logCallback viejo
  let previousTasks = [];
  let logger = logCallback;

  if (typeof previousTasksOrCallback === "function") {
    logger = previousTasksOrCallback;
    previousTasks = [];
  } else {
    previousTasks = Array.isArray(previousTasksOrCallback)
      ? previousTasksOrCallback
      : [];
    if (typeof logCallback !== "function") logger = () => {};
  }

  logger(
    `   ATOMIZER → ${phase.id} | ${phase.name} | ${rolePadre} | previas: ${previousTasks.length}`,
  );

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callLLM([
        {
          role: "user",
          content: buildDecomposePrompt(phase, rolePadre, previousTasks, profile),
        },
      ]);

      const result = extractJSON(raw);
      if (!Array.isArray(result.subtasks))
        throw new Error("Atomizer no devolvió subtasks[].");
      return result;
    } catch (error) {
      lastError = error;
      logger(
        `   ⚠ Atomizer ${phase.id}: intento ${attempt}/${MAX_RETRIES} falló - ${error.message}`,
      );
    }
  }

  throw new Error(
    `Atomizer agotó sus retries técnicos para ${phase.id}: ${lastError?.message}`,
  );
}

/* =========================================================
   CHECKER
   ========================================================= */

const CHECKER_PROMPT = (at, role) => `Eres un Checker independiente.

Tu única responsabilidad es determinar si la siguiente
propuesta constituye una Atomic Task válida.

NO evalúes si está correctamente implementada.

NO ejecutes la tarea.

NO diseñes una solución alternativa completa.

Debes evaluar exclusivamente su atomicidad.

AT:

${JSON.stringify(at, null, 2)}

ROL:

${role}

CRITERIOS:
1. Tiene un único objetivo.
2. Tiene un resultado identificable.
3. Tiene alcance acotado.
4. Puede ser ejecutada por el rol asignado.
5. No requiere nuevas decisiones de diseño.
6. No mezcla múltiples objetivos.
7. No contiene trabajo perteneciente a otras tareas.
8. No intenta reinterpretar toda la fase.

RESPONDE ÚNICAMENTE JSON:

{
  "is_valid": true,
  "reason": "..."
}

o:

{
  "is_valid": false,
  "reason": "Explicación concreta de qué debe dividirse, separarse o acotarse."
}
`;

/* =========================================================
   CHECK AT
   ========================================================= */

export async function checkAtomicTask(at, role, logCallback = () => {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callLLM([
        {
          role: "user",
          content: CHECKER_PROMPT(at, role),
        },
      ]);

      const result = extractJSON(raw);

      if (typeof result.is_valid !== "boolean") {
        throw new Error("Checker no devolvió is_valid boolean.");
      }

      return result;
    } catch (error) {
      lastError = error;

      logCallback(
        `   ⚠ Checker ${at.id}: intento técnico ${attempt}/${MAX_RETRIES} falló`,
      );
    }
  }

  throw new Error(
    `Checker agotó sus retries técnicos para ${at.id}: ${lastError?.message}`,
  );
}

/* =========================================================
   RE-ATOMIZER
   ========================================================= */

const REATOMIZE_PROMPT = (
  originalAT,
  checkerReason,
  role,
  externalDependencyContext = [],
) => `Eres un especialista Senior en el rol "${role}".

Una Atomic Task propuesta por ti fue RECHAZADA por un Checker.

Tu responsabilidad ahora es REATOMIZAR ÚNICAMENTE esa Atomic Task.

NO vuelvas a atomizar la fase completa.

NO modifiques otras Atomic Tasks.

NO redefinas la fase.

NO inventes requisitos.

NO ignores la devolución del Checker.

ATOMIC TASK ORIGINAL:

${JSON.stringify(originalAT, null, 2)}

DEVOLUCIÓN DEL CHECKER:

${checkerReason}

Debes corregir exactamente el problema indicado por el Checker.

La salida puede contener CUALQUIER cantidad de nuevas Atomic Tasks
que resulte necesaria.

Puede ser:

- una única Atomic Task;
- dos Atomic Tasks;
- varias Atomic Tasks.

No existe un número fijo.

Cada nueva Atomic Task debe:

- tener un único objetivo;
- tener un resultado claramente identificable;
- tener alcance acotado;
- poder ejecutarse dentro del rol "${role}";
- no requerir nuevas decisiones de diseño;
- no mezclar objetivos diferentes.

DEPENDENCIAS INTERNAS DE ESTA RE-ATOMIZACIÓN:

IMPORTANTE: el motor asignará automáticamente el ID final de cada
nueva Atomic Task. Por lo tanto, NO generes IDs para las subtasks.

Si una nueva Atomic Task depende de otra nueva Atomic Task
generada en ESTA MISMA respuesta, expresa la dependencia mediante
"depends_on_index", usando índices 0-based.

Ejemplo válido:

subtask 1 -> "depends_on_index": []
subtask 2 -> "depends_on_index": [0]
subtask 3 -> "depends_on_index": [0, 1]

Esto significa que la subtask 2 depende de la subtask 1 y la
subtask 3 depende de las subtasks 1 y 2.

NO uses IDs inventados, IDs de intentos anteriores, IDs del padre,
ni referencias como ".R1", ".R2" o ".R3" dentro de esta respuesta.

NO utilices objetos en "depends_on_index".

DEPENDENCIAS EXTERNAS DE LA AT ORIGINAL:

La Atomic Task original ya tenía las siguientes dependencias externas:

${JSON.stringify(externalDependencyContext, null, 2)}

Estas dependencias EXISTEN y forman parte del contexto que debe
preservarse durante la re-atomización.

Para cada nueva subtask, indica qué dependencias externas de esta
lista necesita realmente mediante "depends_on_external".

REGLAS PARA depends_on_external:

- Solo puedes utilizar IDs que aparezcan en la lista anterior.
- NO inventes IDs.
- NO uses IDs de fase como "F1", "F2", etc.
- NO uses IDs de la Atomic Task original como dependencia.
- NO copies automáticamente todas las dependencias a todas las subtasks.
- Asigna cada dependencia externa solamente a las subtasks que
  realmente necesiten su resultado.
- Si una subtask no necesita ninguna dependencia externa, usa [].
- Si todas las subtasks necesitan una misma dependencia externa,
  puedes declararla en todas.
- El motor combinará depends_on_index y depends_on_external en
  el depends_on final.

Ejemplo:

{
  "subtasks": [
    {
      "task": "API de Usuarios",
      "depends_on_index": [],
      "depends_on_external": ["F1.3"]
    },
    {
      "task": "API de Roles",
      "depends_on_index": [],
      "depends_on_external": []
    }
]
}

NO introduzcas dependencias externas que no estén en el contexto.

RESPONDE ÚNICAMENTE JSON:

{
  "atomic": false,
  "subtasks": [
    {
      "task": "...",
      "role": "${role}",
      "description": "...",
      "depends_on_index": [],
      "depends_on_external": []
    }
  ]
}

NO incluyas texto antes ni después del JSON.
`;

/* =========================================================
   RE-ATOMIZAR
   ========================================================= */

export async function reatomizeAtomicTask(
  originalAT,
  checkerReason,
  role,
  attempt,
  logCallback = () => {},
) {
  logCallback(
    `   ↻ RE-ATOMIZER → ${originalAT.id} | strike ${attempt}/${MAX_AT_ATTEMPTS}`,
  );

  let lastError = null;

  for (let retry = 1; retry <= MAX_RETRIES; retry++) {
    try {
      const raw = await callLLM([
        {
          role: "user",
          content: REATOMIZE_PROMPT(
            originalAT,
            checkerReason,
            role,
            normalizeDependsOn(originalAT.depends_on, originalAT.id),
          ),
        },
      ]);

      const result = extractJSON(raw);

      if (!Array.isArray(result.subtasks)) {
        throw new Error("Re-Atomizer no devolvió subtasks[].");
      }

      return result;
    } catch (error) {
      lastError = error;

      logCallback(
        `   ⚠ Re-Atomizer ${originalAT.id}: retry técnico ${retry}/${MAX_RETRIES} falló`,
      );
    }
  }

  throw new Error(
    `Re-Atomizer agotó retries técnicos para ${originalAT.id}: ${lastError?.message}`,
  );
}

/* =========================================================
   NORMALIZAR DEPENDENCIAS
   ========================================================= */

/*
 * Contrato interno de MicheLab:
 *
 * depends_on = string[]
 *
 * Una Atomic Task NO puede contener objetos,
 * IDs vacíos ni otros tipos.
 *
 * IMPORTANTE:
 *
 * NO convertimos automáticamente:
 *
 * { id: "F1.1" }
 *
 * en:
 *
 * "F1.1"
 *
 * porque eso ocultaría una salida contractual
 * incorrecta del LLM.
 */

function normalizeDependsOn(rawDependsOn, atId) {
  if (rawDependsOn == null) {
    return [];
  }

  if (!Array.isArray(rawDependsOn)) {
    throw new Error(`Atomic Task ${atId}: depends_on debe ser un array.`);
  }

  const normalized = [];

  for (const dep of rawDependsOn) {
    if (typeof dep !== "string") {
      throw new Error(
        `Atomic Task ${atId}: depends_on contiene un valor inválido. ` +
          `Cada dependencia debe ser un ID string.`,
      );
    }

    const dependencyId = dep.trim();

    if (!dependencyId) {
      throw new Error(`Atomic Task ${atId}: depends_on contiene un ID vacío.`);
    }

    normalized.push(dependencyId);
  }

  return [...new Set(normalized)];
}

/* =========================================================
   NORMALIZAR AT
   ========================================================= */

function normalizeAtomicTask(rawAT, phase, phaseIndex, sequence, lineage = {}) {
  const id = rawAT.id || `${phase.id}.AT-${sequence}`;

  return {
    id,

    phase: phase.id,
    phase_name: phase.name,

    task: rawAT.task,
    role: rawAT.role,

    responsable_sugerido: rawAT.responsable_sugerido || rawAT.role,

    description: rawAT.description || "",

    depends_on: normalizeDependsOn(rawAT.depends_on, id),

    status: "PROPOSED",

    phase_index: phaseIndex,

    checker: null,

    // Metadatos operativos del ciclo de resolución.
    // NO son todavía Knowledge Lifecycle / historial.
    attempt: lineage.attempt || 1,
    parent_at: lineage.parent_at || null,
  };
}

/* =========================================================
   CHECK + RE-ATOMIZE RECURSIVO CONTROLADO
   ========================================================= */

export async function resolveAtomicTask(
  at,
  role,
  phase,
  phaseIndex,
  logCallback = () => {},
) {
  let currentTask = at;
  let currentAttempt = at.attempt || 1;
  while (currentAttempt <= MAX_AT_ATTEMPTS) {
    logCallback(
      `   CHECK → ${currentTask.id} | intento ${currentAttempt}/${MAX_AT_ATTEMPTS}`,
    );

    const checkResult = await checkAtomicTask(currentTask, role, logCallback);

    if (checkResult.is_valid) {
      logCallback(`   ✓ ACCEPTED → ${currentTask.id}`);

      return {
        status: "ACCEPTED",
        tasks: [
          {
            ...currentTask,
            status: "ACCEPTED",
            checker: {
              is_valid: true,
              reason: checkResult.reason || "",
              attempt: currentAttempt,
            },
          },
        ],
        replacementMap: {},
        rejected: [],
      };
    }

    logCallback(`   ✗ REJECTED → ${currentTask.id}`);
    logCallback(`     razón: ${checkResult.reason}`);

    if (currentAttempt >= MAX_AT_ATTEMPTS) {
      logCallback(`   ☠ UNRESOLVED → ${currentTask.id} | 3 strikes`);

      return {
        status: "UNRESOLVED",
        tasks: [
          {
            ...currentTask,
            status: "UNRESOLVED",
            checker: {
              is_valid: false,
              reason: checkResult.reason,
              attempt: currentAttempt,
            },
          },
        ],
        replacementMap: {},
        rejected: [
          {
            id: currentTask.id,
            reason: checkResult.reason || "",
            attempt: currentAttempt,
          },
        ],
      };
    }

    const nextAttempt = currentAttempt + 1;

    const reatomized = await reatomizeAtomicTask(
      currentTask,
      checkResult.reason,
      role,
      nextAttempt,
      logCallback,
    );

    if (!reatomized.subtasks.length) {
      logCallback(
        `   ☠ UNRESOLVED → ${currentTask.id} | Re-Atomizer no produjo ATs`,
      );

      return {
        status: "UNRESOLVED",
        tasks: [
          {
            ...currentTask,
            status: "UNRESOLVED",
            checker: {
              is_valid: false,
              reason: "Re-Atomizer no produjo nuevas Atomic Tasks.",
              attempt: nextAttempt,
            },
          },
        ],
        replacementMap: {},
        rejected: [
          {
            id: currentTask.id,
            reason: "Re-Atomizer no produjo nuevas Atomic Tasks.",
            attempt: nextAttempt,
          },
        ],
      };
    }

    const nextTasks = reatomized.subtasks.map((rawTask, index) => {
      const generatedId = `${currentTask.id}.R${nextAttempt}.${index + 1}`;

      // El Re-Atomizer no conoce los IDs finales porque el motor los
      // genera después de recibir su respuesta. Las dependencias entre
      // subtasks se expresan por posición (1-based) y se traducen aquí
      // de forma determinística.
      const dependencyIndexes = rawTask.depends_on_index ?? [];

      if (!Array.isArray(dependencyIndexes)) {
        throw new Error(
          `INVALID_REATOM_DEPENDENCIES: ${generatedId} debe usar depends_on_index[]`,
        );
      }

      const localDependencies = dependencyIndexes.map((dependencyIndex) => {
        if (!Number.isInteger(dependencyIndex)) {
          throw new Error(
            `INVALID_REATOM_DEPENDENCY_INDEX: ${generatedId} contiene un índice no entero`,
          );
        }

        if (
          dependencyIndex < 0 ||
          dependencyIndex >= reatomized.subtasks.length
        ) {
          throw new Error(
            `INVALID_REATOM_DEPENDENCY_INDEX: ${generatedId} referencia la subtask ${dependencyIndex}, fuera de rango`,
          );
        }

        if (dependencyIndex === index) {
          throw new Error(
            `SELF_DEPENDENCY: ${generatedId} depende de sí misma mediante depends_on_index`,
          );
        }

        return `${currentTask.id}.R${nextAttempt}.${dependencyIndex + 1}`;
      });

      // Dependencias externas: el Re-Atomizer solo puede redistribuir
      // dependencias que ya existían en la AT original. Nunca puede
      // inventar una dependencia nueva.
      const allowedExternalDependencies = normalizeDependsOn(
        currentTask.depends_on,
        currentTask.id,
      );

      const externalDependencies = normalizeDependsOn(
        rawTask.depends_on_external,
        generatedId,
      );

      for (const dependencyId of externalDependencies) {
        if (!allowedExternalDependencies.includes(dependencyId)) {
          throw new Error(
            `INVALID_REATOM_EXTERNAL_DEPENDENCY: ${generatedId} ` +
              `declara ${dependencyId}, pero esa dependencia no existía ` +
              `en la Atomic Task original ${currentTask.id}.`,
          );
        }

        if (dependencyId === generatedId) {
          throw new Error(
            `SELF_DEPENDENCY: ${generatedId} depende de sí misma mediante depends_on_external`,
          );
        }
      }

      const finalDependencies = [
        ...new Set([...localDependencies, ...externalDependencies]),
      ];

      return normalizeAtomicTask(
        {
          ...rawTask,
          id: generatedId,
          role,
          depends_on: finalDependencies,
        },
        phase,
        phaseIndex,
        index + 1,
        {
          attempt: nextAttempt,
          parent_at: currentTask.id,
        },
      );
    });

    const resolvedTasks = [];
    const replacementMap = {};
    const rejected = [];

    for (const nextTask of nextTasks) {
      const result = await resolveAtomicTask(
        nextTask,
        role,
        phase,
        phaseIndex,
        logCallback,
      );

      resolvedTasks.push(...result.tasks);
      rejected.push(...(result.rejected || []));

      for (const [fromId, toIds] of Object.entries(
        result.replacementMap || {},
      )) {
        replacementMap[fromId] = [...(replacementMap[fromId] || []), ...toIds];
      }
    }

    const terminalIds = resolvedTasks.map((task) => task.id);

    // La tarea actual dejó de existir como nodo final.
    // Registramos únicamente sustituciones que el sistema conoce.
    replacementMap[currentTask.id] = [
      ...(replacementMap[currentTask.id] || []),
      ...terminalIds,
    ];

    for (const id of Object.keys(replacementMap)) {
      replacementMap[id] = [...new Set(replacementMap[id])];
    }

    return {
      status: resolvedTasks.some((task) => task.status === "UNRESOLVED")
        ? "UNRESOLVED"
        : "ACCEPTED",
      tasks: resolvedTasks,
      replacementMap,
      rejected,
    };
  }

  throw new Error(
    `Estado imposible: ${currentTask.id} excedió MAX_AT_ATTEMPTS`,
  );
}

/* ============================================================
   DEPENDENCY RESOLVER
   ============================================================ */

/**
 * Construye el grafo de dependencias entre FASES.
 *
 * Importante:
 * - Las dependencias de fase son conceptuales.
 * - NO se expanden automáticamente a todas las Atomic Tasks.
 * - Este grafo sirve para validar estructura y obtener orden lógico.
 */
function normalizePhaseDependencies(phases = []) {
  if (!Array.isArray(phases)) {
    throw new Error("INVALID_PHASES: phases debe ser un array.");
  }

  const graph = new Map();

  for (const phase of phases) {
    if (!phase || typeof phase !== "object") {
      throw new Error("INVALID_PHASE: fase inválida.");
    }

    if (!phase.id || typeof phase.id !== "string") {
      throw new Error("INVALID_PHASE_ID: toda fase debe tener un id.");
    }

    if (graph.has(phase.id)) {
      throw new Error(`DUPLICATE_PHASE_ID: ${phase.id}`);
    }

    const dependsOn = Array.isArray(phase.depends_on) ? phase.depends_on : [];

    for (const dependency of dependsOn) {
      if (typeof dependency !== "string" || !dependency.trim()) {
        throw new Error(
          `INVALID_PHASE_DEPENDENCY: ${phase.id} contiene una dependencia inválida.`,
        );
      }
    }

    graph.set(phase.id, [...new Set(dependsOn.map((dep) => dep.trim()))]);
  }

  for (const [phaseId, dependencies] of graph.entries()) {
    for (const dependency of dependencies) {
      if (!graph.has(dependency)) {
        throw new Error(
          `MISSING_PHASE_DEPENDENCY: ${phaseId} depende de ${dependency}, pero esa fase no existe.`,
        );
      }

      if (dependency === phaseId) {
        throw new Error(
          `SELF_PHASE_DEPENDENCY: ${phaseId} depende de sí misma.`,
        );
      }
    }
  }

  return graph;
}

/**
 * Detecta ciclos en un grafo de dependencias.
 *
 * El grafo utiliza:
 *
 *   NODE -> [DEPENDENCIES]
 *
 * Por lo tanto:
 *
 *   F2 -> [F1]
 *
 * significa que F2 depende de F1.
 */
function detectCycles(graph, prefix = "") {
  const visiting = new Set();
  const visited = new Set();

  function visit(node, path = []) {
    if (visiting.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle =
        cycleStart >= 0 ? [...path.slice(cycleStart), node] : [...path, node];

      throw new Error(`${prefix}CYCLE_DETECTED: ${cycle.join(" -> ")}`);
    }

    if (visited.has(node)) {
      return;
    }

    visiting.add(node);

    const dependencies = graph.get(node) || [];

    for (const dependency of dependencies) {
      visit(dependency, [...path, node]);
    }

    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }
}

/**
 * Orden topológico determinista.
 *
 * Devuelve siempre primero las dependencias.
 *
 * Ejemplo:
 *
 *   F1
 *    ↓
 *   F2
 *    ↓
 *   F3
 *
 * Resultado:
 *
 *   [F1, F2, F3]
 */
function topologicalSort(graph) {
  const visited = new Set();
  const result = [];

  function visit(node) {
    if (visited.has(node)) {
      return;
    }

    visited.add(node);

    const dependencies = graph.get(node) || [];

    for (const dependency of dependencies) {
      visit(dependency);
    }

    result.push(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }

  return result;
}

/**
 * Resuelve y valida las dependencias de las Atomic Tasks aceptadas.
 *
 * RESPONSABILIDAD:
 * - validar dependencias
 * - detectar inconsistencias
 * - detectar ciclos
 * - determinar orden topológico
 * - detectar BLOCKED por dependencias UNRESOLVED/BLOCKED
 *
 * NO ejecuta tareas.
 * NO modifica el contenido de las tareas.
 * NO inventa dependencias.
 * NO convierte automáticamente dependencias de fases en dependencias
 *   de Atomic Tasks.
 */
function expandReplacementId(id, replacementMap, trail = []) {
  if (!replacementMap[id]) {
    return [id];
  }

  if (trail.includes(id)) {
    throw new Error(`REPLACEMENT_CYCLE: ${[...trail, id].join(" -> ")}`);
  }

  const expanded = [];

  for (const replacementId of replacementMap[id]) {
    expanded.push(
      ...expandReplacementId(replacementId, replacementMap, [...trail, id]),
    );
  }

  return [...new Set(expanded)];
}

/**
 * Validación incremental de existencia de dependencias, fase por fase.
 *
 * Antes, un id inventado (por ejemplo, copiado de un ejemplo del prompt
 * en vez de un id real — ver DECOMPOSE_CONTEXT_ADDENDUM) recién se
 * detectaba en resolveDependencies(), al final de TODAS las fases. Si el
 * id inventado aparecía en la fase 2 de 5, las fases 3, 4 y 5 se
 * generaban igual y se descartaban enteras al fallar el intento completo.
 *
 * Esta función corre apenas termina cada fase (dentro de runAtomicGraph)
 * y valida SOLO las tareas de esa fase recién cerrada contra el conjunto
 * de ids ya conocidos (de esta fase y de las anteriores). No reemplaza a
 * resolveDependencies(): no detecta ciclos ni calcula READY/BLOCKED, eso
 * sigue necesitando el grafo completo al final. Solo corta temprano el
 * caso más barato y más común de cortar: una dependencia a un id que
 * lisa y llanamente no existe.
 */
export function validatePhaseDependencyExistence(
  phaseTasks,
  knownIds,
  replacementMap = {},
) {
  for (const task of phaseTasks) {
    const dependencies = normalizeDependsOn(task.depends_on, task.id);

    for (const dependencyId of dependencies) {
      if (dependencyId === task.id) {
        throw new Error(`SELF_DEPENDENCY: ${task.id} depende de sí misma.`);
      }

      // FIX (Project20, intento 1): si la dependencia apunta a una AT que
      // el Re-Atomizer reemplazó (ej. F5.3 -> F5.3.R2.1..3), su id original
      // ya no está entre los aceptados, pero NO es un id inventado:
      // reconcileDependencies() la expande al final. Acá se expande igual
      // que allá y se exige que TODOS los reemplazos terminales existan.
      if (replacementMap[dependencyId]) {
        const terminalIds = expandReplacementId(dependencyId, replacementMap);
        const missing = terminalIds.filter((id) => !knownIds.has(id));
        if (missing.length > 0) {
          throw new Error(
            `MISSING_DEPENDENCY: ${task.id} depende de ${dependencyId}, ` +
              `que fue reemplazada por ${terminalIds.join(", ")}, pero ` +
              `${missing.join(", ")} no existe (fase ${task.phase}).`,
          );
        }
        continue;
      }

      if (!knownIds.has(dependencyId)) {
        throw new Error(
          `MISSING_DEPENDENCY: ${task.id} depende de ${dependencyId}, ` +
            `pero esa Atomic Task no existe (detectado apenas terminó la ` +
            `fase ${task.phase}, no al final de todo el graph).`,
        );
      }
    }
  }
}

/**
 * Reconciliación determinística de dependencias afectadas por
 * re-atomizaciones.
 *
 * Regla:
 * - Si una dependencia apunta a una AT que el sistema sabe que fue
 *   reemplazada, se expande a sus reemplazos finales.
 * - Si la referencia NO está en replacementMap, se conserva intacta.
 * - Las dependencias externas de una re-atomización ya fueron
 *   redistribuidas por el Re-Atomizer antes de llegar aquí.
 * - Nunca se adivina ni se corrige una referencia desconocida.
 */
export function reconcileDependencies(tasks = [], replacementMap = {}) {
  if (!Array.isArray(tasks)) {
    throw new Error("INVALID_ATOMIC_TASKS: tasks debe ser un array.");
  }

  if (!replacementMap || typeof replacementMap !== "object") {
    throw new Error("INVALID_REPLACEMENT_MAP: replacementMap inválido.");
  }

  const taskIds = new Set(tasks.map((task) => task.id));

  for (const [fromId, replacements] of Object.entries(replacementMap)) {
    if (!Array.isArray(replacements) || replacements.length === 0) {
      throw new Error(
        `INVALID_REPLACEMENT: ${fromId} no tiene reemplazos válidos.`,
      );
    }

    const terminalIds = expandReplacementId(fromId, replacementMap);

    for (const terminalId of terminalIds) {
      if (!taskIds.has(terminalId)) {
        throw new Error(
          `INVALID_REPLACEMENT_TARGET: ${fromId} apunta a ${terminalId}, ` +
            `pero esa Atomic Task no existe en el conjunto final.`,
        );
      }
    }
  }

  return tasks.map((task) => {
    const dependencies = normalizeDependsOn(task.depends_on, task.id);
    const reconciled = [];

    for (const dependencyId of dependencies) {
      const expanded = expandReplacementId(dependencyId, replacementMap);
      reconciled.push(...expanded);
    }

    return {
      ...task,
      depends_on: [...new Set(reconciled)],
    };
  });
}

/**
 * Resuelve y valida las dependencias de las Atomic Tasks finales.
 *
 * RESPONSABILIDAD:
 * - validar dependencias
 * - detectar inconsistencias
 * - detectar ciclos
 * - determinar orden topológico
 * - determinar READY / BLOCKED / UNRESOLVED
 *
 * NO ejecuta tareas.
 * NO inventa dependencias.
 * NO convierte dependencias de fases en dependencias de ATs.
 */
export function resolveDependencies(atomicTasks = [], phases = []) {
  if (!Array.isArray(atomicTasks)) {
    throw new Error("INVALID_ATOMIC_TASKS: atomicTasks debe ser un array.");
  }

  if (!Array.isArray(phases)) {
    throw new Error("INVALID_PHASES: phases debe ser un array.");
  }

  const phaseGraph = normalizePhaseDependencies(phases);
  detectCycles(phaseGraph, "PHASE_");
  const phaseOrder = topologicalSort(phaseGraph);

  const atById = new Map();

  for (const at of atomicTasks) {
    if (!at || typeof at !== "object") {
      throw new Error("INVALID_AT: Atomic Task inválida.");
    }

    if (!at.id || typeof at.id !== "string") {
      throw new Error("INVALID_AT_ID: toda Atomic Task debe tener un id.");
    }

    if (atById.has(at.id)) {
      throw new Error(`DUPLICATE_AT_ID: ${at.id}`);
    }

    atById.set(at.id, at);
  }

  const atGraph = new Map();

  for (const at of atomicTasks) {
    const dependencies = normalizeDependsOn(at.depends_on, at.id);
    const normalizedDependencies = [];

    for (const dependencyId of dependencies) {
      if (phaseGraph.has(dependencyId)) {
        throw new Error(
          `DEPENDENCY_LEVEL_MISMATCH: ${at.id} depende de la fase ${dependencyId}. ` +
            `Las Atomic Tasks solo pueden depender de otras Atomic Tasks.`,
        );
      }

      if (!atById.has(dependencyId)) {
        throw new Error(
          `MISSING_DEPENDENCY: ${at.id} depende de ${dependencyId}, ` +
            `pero esa Atomic Task no existe.`,
        );
      }

      if (dependencyId === at.id) {
        throw new Error(`SELF_DEPENDENCY: ${at.id} depende de sí misma.`);
      }

      normalizedDependencies.push(dependencyId);
    }

    atGraph.set(at.id, [...new Set(normalizedDependencies)]);
  }

  detectCycles(atGraph, "AT_");

  const atOrder = topologicalSort(atGraph);
  const statusById = new Map();

  for (const at of atomicTasks) {
    const rawStatus = at.status || "ACCEPTED";
    statusById.set(at.id, rawStatus === "PENDING" ? "ACCEPTED" : rawStatus);
  }

  const blockedBy = new Map();
  const blockedReason = new Map();

  for (const atId of atOrder) {
    const dependencies = atGraph.get(atId) || [];

    const unresolvedDependencies = dependencies.filter(
      (dependencyId) => statusById.get(dependencyId) === "UNRESOLVED",
    );

    const blockedDependencies = dependencies.filter(
      (dependencyId) => statusById.get(dependencyId) === "BLOCKED",
    );

    if (unresolvedDependencies.length || blockedDependencies.length) {
      const blockers = [
        ...new Set([...unresolvedDependencies, ...blockedDependencies]),
      ];

      blockedBy.set(atId, blockers);
      blockedReason.set(atId, `Dependency blocked by: ${blockers.join(", ")}`);
      statusById.set(atId, "BLOCKED");
    } else if (dependencies.length > 0) {
      // V0.1: las dependencias estructurales hacen que la tarea
      // espere a sus prerequisitos. No se asume ejecución automática.
      blockedBy.set(atId, dependencies);
      blockedReason.set(atId, `Waiting for: ${dependencies.join(", ")}`);
      statusById.set(atId, "BLOCKED");
    } else if (statusById.get(atId) === "ACCEPTED") {
      statusById.set(atId, "READY");
    }
  }

  const nodes = atomicTasks.map((at) => ({
    ...at,
    resolver_status: statusById.get(at.id) || "ACCEPTED",
    blocked_by: blockedBy.get(at.id) || [],
    blocked_reason: blockedReason.get(at.id) || null,
  }));

  return {
    valid: true,
    phaseGraph: Object.fromEntries([...phaseGraph.entries()]),
    atGraph: Object.fromEntries([...atGraph.entries()]),
    phaseOrder,
    topologicalOrder: atOrder,
    nodes,
    ready: nodes.filter((node) => node.resolver_status === "READY"),
    blocked: nodes.filter((node) => node.resolver_status === "BLOCKED"),
    unresolved: nodes.filter((node) => node.resolver_status === "UNRESOLVED"),
  };
}

/* ============================================================
   ATOMIC GRAPH RUNNER
   ============================================================ */

/**
 * Ejecuta el flujo completo de:
 *
 *   PHASE
 *      ↓
 *   ATOMIZE
 *      ↓
 *   CHECK
 *      ↓
 *   RE-ATOMIZE si corresponde
 *      ↓
 *   ACCEPTED / UNRESOLVED
 *
 * IMPORTANTE:
 * - BATCH_SIZE = 1 por compatibilidad con LM Studio.
 * - Las fases se procesan secuencialmente.
 * - Las ATs también se verifican de forma controlada.
 * - La resolución de dependencias ocurre DESPUÉS de obtener
 *   las ATs aceptadas.
 */
export async function runAtomicGraph(
  phases = [],
  logCallback = () => {},
  onTaskResolved = () => {},
  opts = {},
) {
  const profile = requireProfile(opts.profile, "runAtomicGraph");
  if (!Array.isArray(phases)) {
    throw new Error("INVALID_PHASES: phases debe ser un array.");
  }

  const BATCH_SIZE = 1;
  const acceptedTasks = [];
  const unresolvedTasks = [];
  const rejectedTasks = [];
  const replacementMap = {};

  for (let i = 0; i < phases.length; i += BATCH_SIZE) {
    const batch = phases.slice(i, i + BATCH_SIZE);

    for (let j = 0; j < batch.length; j++) {
      const phase = batch[j];
      const phaseIndex = i + j;

      console.log(
        `[ATOMIZER] Fase ${phase.id} (${phaseIndex + 1}/${phases.length})`,
      );

      // El Atomizer recibe las ATs finales de fases anteriores como
      // contexto para poder declarar dependencias inter-fase con IDs reales.
      const result = await atomizePhase(
        phase,
        phase.responsable_sugerido,
        acceptedTasks,
        logCallback,
        { profile },
      );

      if (!result || !Array.isArray(result.subtasks)) {
        throw new Error(`INVALID_ATOMIZER_RESULT: ${phase.id}`);
      }

      for (let k = 0; k < result.subtasks.length; k++) {
        const task = normalizeAtomicTask(
          result.subtasks[k],
          phase,
          phaseIndex,
          k + 1,
        );

        const resolved = await resolveAtomicTask(
          task,
          task.role,
          phase,
          phaseIndex,
          logCallback,
        );

        acceptedTasks.push(
          ...resolved.tasks.filter((t) => t.status === "ACCEPTED"),
        );

        unresolvedTasks.push(
          ...resolved.tasks.filter((t) => t.status === "UNRESOLVED"),
        );

        rejectedTasks.push(...(resolved.rejected || []));

        // Hook opcional para que la UI pueda reflejar el estado LIVE
        // sin conocer la mecánica interna de Atomizer/Checker/Re-Atomizer.
        for (const resolvedTask of resolved.tasks) {
          onTaskResolved(resolvedTask);
        }

        for (const [fromId, toIds] of Object.entries(
          resolved.replacementMap || {},
        )) {
          replacementMap[fromId] = [
            ...(replacementMap[fromId] || []),
            ...toIds,
          ];
        }

        logCallback(
          `   GRAPH STATE → ${acceptedTasks.length} accepted | ` +
            `${unresolvedTasks.length} unresolved`,
        );
      }

      // Corte temprano: valida las dependencias de ESTA fase apenas
      // termina, contra todo lo conocido hasta acá (esta fase incluida,
      // para permitir que una tarea dependa de una hermana generada en
      // el mismo llamado al Atomizer). Si hay un id inventado, falla acá
      // y no se gastan las fases que faltan.
      const knownIdsSoFar = new Set([
        ...acceptedTasks.map((t) => t.id),
        ...unresolvedTasks.map((t) => t.id),
      ]);
      const tasksFromThisPhase = [...acceptedTasks, ...unresolvedTasks].filter(
        (t) => t.phase_index === phaseIndex,
      );
      validatePhaseDependencyExistence(
        tasksFromThisPhase,
        knownIdsSoFar,
        replacementMap,
      );
      logCallback(
        `   ✓ DEPENDENCY CHECK (fase ${phase.id}) → ${tasksFromThisPhase.length} tareas verificadas`,
      );
    }
  }

  // Las dependencias se resuelven sobre el conjunto FINAL:
  // accepted + unresolved. Así una UNRESOLVED puede bloquear a sus dependientes.
  const finalTasks = [...acceptedTasks, ...unresolvedTasks];

  const reconciledTasks = reconcileDependencies(finalTasks, replacementMap);

  const acceptedFinal = reconciledTasks.filter(
    (task) => task.status === "ACCEPTED",
  );
  const unresolvedFinal = reconciledTasks.filter(
    (task) => task.status === "UNRESOLVED",
  );

  logCallback(
    "   DEPENDENCY RECONCILIATION → referencias conocidas actualizadas",
  );

  return {
    acceptedTasks: acceptedFinal,
    unresolvedTasks: unresolvedFinal,
    rejectedTasks,
    replacementMap,
    allTasks: reconciledTasks,
    totalAccepted: acceptedFinal.length,
    totalUnresolved: unresolvedFinal.length,
    totalRejected: rejectedTasks.length,
  };
}

/* ============================================================
   DETERMINISTIC DEPENDENCY RESOLVER TESTS
   ============================================================ */

/**
 * Genera una Atomic Task mínima para tests.
 */
function makeTestAT(id, depends_on = [], status = "ACCEPTED") {
  return {
    id,
    phase: id.split(".")[0],
    phase_name: `Test ${id.split(".")[0]}`,
    task: `Task ${id}`,
    role: "Backend",
    responsable_sugerido: "Backend",
    description: "",
    depends_on,
    status,
    phase_index: 0,
    checker: null,
  };
}

/**
 * Tests deterministas del Dependency Resolver.
 *
 * Estos tests NO llaman al LLM.
 *
 * Validan exclusivamente la lógica estructural
 * del resolver.
 */
export function runDependencyResolverTests() {
  console.log("==========================================");

  console.log("DEPENDENCY RESOLVER — DETERMINISTIC TESTS");

  console.log("==========================================");

  /*
   * ==========================================================
   * TEST 1
   * Dependencia simple
   *
   * F1.2 → F1.1
   * ==========================================================
   */

  {
    const phases = [
      {
        id: "F1",
        name: "Phase 1",
        depends_on: [],
      },
    ];

    const tasks = [makeTestAT("F1.1"), makeTestAT("F1.2", ["F1.1"])];

    const result = resolveDependencies(tasks, phases);

    console.assert(
      result.valid === true,
      "TEST 1 FAILED: graph debería ser válido.",
    );

    console.assert(
      result.topologicalOrder.join(",") === "F1.1,F1.2",
      "TEST 1 FAILED: orden topológico incorrecto.",
    );

    console.log("TEST 1 ✓ dependencia simple");
  }

  /*
   * ==========================================================
   * TEST 2
   * Dependencia inexistente
   *
   * F1.2 → F1.999
   * ==========================================================
   */

  {
    const phases = [
      {
        id: "F1",
        name: "Phase 1",
        depends_on: [],
      },
    ];

    const tasks = [makeTestAT("F1.1", ["F1.999"])];

    let failed = false;

    try {
      resolveDependencies(tasks, phases);
    } catch (error) {
      failed = error.message.includes("MISSING_DEPENDENCY");
    }

    console.assert(
      failed,
      "TEST 2 FAILED: debería detectar dependencia inexistente.",
    );

    console.log("TEST 2 ✓ missing dependency");
  }

  /*
   * ==========================================================
   * TEST 3
   * Auto dependencia
   *
   * F1.1 → F1.1
   * ==========================================================
   */

  {
    const phases = [
      {
        id: "F1",
        name: "Phase 1",
        depends_on: [],
      },
    ];

    const tasks = [makeTestAT("F1.1", ["F1.1"])];

    let failed = false;

    try {
      resolveDependencies(tasks, phases);
    } catch (error) {
      failed = error.message.includes("SELF_DEPENDENCY");
    }

    console.assert(failed, "TEST 3 FAILED: debería detectar auto dependencia.");

    console.log("TEST 3 ✓ self dependency");
  }

  /*
   * ==========================================================
   * TEST 4
   * Ciclo
   *
   * F1.1 → F1.2
   * F1.2 → F1.1
   * ==========================================================
   */

  {
    const phases = [
      {
        id: "F1",
        name: "Phase 1",
        depends_on: [],
      },
    ];

    const tasks = [makeTestAT("F1.1", ["F1.2"]), makeTestAT("F1.2", ["F1.1"])];

    let failed = false;

    try {
      resolveDependencies(tasks, phases);
    } catch (error) {
      failed = error.message.includes("CYCLE_DETECTED");
    }

    console.assert(failed, "TEST 4 FAILED: debería detectar ciclo.");

    console.log("TEST 4 ✓ cycle detection");
  }

  /*
   * ==========================================================
   * TEST 5
   * UNRESOLVED bloquea dependiente
   *
   * F1.1 = UNRESOLVED
   * F1.2 → F1.1
   * ==========================================================
   */

  {
    const phases = [
      {
        id: "F1",
        name: "Phase 1",
        depends_on: [],
      },
    ];

    const tasks = [
      makeTestAT("F1.1", [], "UNRESOLVED"),
      makeTestAT("F1.2", ["F1.1"], "ACCEPTED"),
    ];

    const result = resolveDependencies(tasks, phases);

    const task2 = result.nodes.find((node) => node.id === "F1.2");

    console.assert(
      task2 && task2.resolver_status === "BLOCKED",
      "TEST 5 FAILED: F1.2 debería quedar BLOCKED.",
    );

    console.assert(
      task2 && task2.blocked_by.includes("F1.1"),
      "TEST 5 FAILED: F1.2 debería indicar F1.1 como blocker.",
    );

    console.log("TEST 5 ✓ unresolved dependency blocks dependent");
  }

  /*
   * ==========================================================
   * TEST 6
   * Separación FASE vs AT
   *
   * F2 depende de F1
   *
   * Esto NO debe convertirse automáticamente en:
   *
   * F2.1 → F1.1
   *
   * El resolver mantiene ambos grafos separados.
   * ==========================================================
   */

  {
    const phases = [
      {
        id: "F1",
        name: "Phase 1",
        depends_on: [],
      },
      {
        id: "F2",
        name: "Phase 2",
        depends_on: ["F1"],
      },
    ];

    const tasks = [makeTestAT("F1.1"), makeTestAT("F2.1")];

    const result = resolveDependencies(tasks, phases);

    console.assert(
      result.phaseGraph.F2.includes("F1"),
      "TEST 6 FAILED: dependencia F2 → F1 no está en phaseGraph.",
    );

    console.assert(
      !result.atGraph["F2.1"].includes("F1.1"),
      "TEST 6 FAILED: phase dependency fue expandida artificialmente.",
    );

    console.log(
      "TEST 6 ✓ phase dependencies remain separate from AT dependencies",
    );
  }

  /*
   * ==========================================================
   * TEST 7
   * Dependencia como OBJECT
   *
   * Evita:
   *
   * [object Object]
   *
   * ==========================================================
   */

  {
    const phases = [
      {
        id: "F1",
        name: "Phase 1",
        depends_on: [],
      },
    ];

    const tasks = [
      makeTestAT("F1.1", [
        {
          id: "F1.2",
        },
      ]),
    ];

    let failed = false;

    try {
      resolveDependencies(tasks, phases);
    } catch (error) {
      failed = error.message.includes("INVALID_DEPENDENCY");
    }

    console.assert(
      failed,
      "TEST 7 FAILED: debería rechazar dependency object.",
    );

    console.log("TEST 7 ✓ dependency must be string ID");
  }

  /*
   * ==========================================================
   * TEST 8
   * Una AT depende directamente de una FASE
   *
   * F2.1 → F1
   *
   * Esto es inválido.
   * ==========================================================
   */

  {
    const phases = [
      {
        id: "F1",
        name: "Phase 1",
        depends_on: [],
      },
      {
        id: "F2",
        name: "Phase 2",
        depends_on: ["F1"],
      },
    ];

    const tasks = [makeTestAT("F2.1", ["F1"])];

    let failed = false;

    try {
      resolveDependencies(tasks, phases);
    } catch (error) {
      failed = error.message.includes("DEPENDENCY_LEVEL_MISMATCH");
    }

    console.assert(
      failed,
      "TEST 8 FAILED: una AT no debe depender directamente de una fase.",
    );

    console.log("TEST 8 ✓ dependency level mismatch");
  }

  /*
   * ==========================================================
   * FINAL
   * ==========================================================
   */

  console.log("==========================================");

  console.log("ALL DEPENDENCY RESOLVER TESTS COMPLETED");

  console.log("==========================================");

  return true;
}
