/* ============================================================
   VALIDATION PROFILE — Atomizer / Role Dependencies
   ============================================================

   Documento    : validation_profile_role_dependencies.mjs
   Version      : 0.1
   Dominio      : Atomizer (TechLeader → Atomizer → Checker → Re-Atomizer)
   Relacionado  : Specialist.md (Validation Profiles), Validation.md

   QUÉ VALIDA
   ------------------------------------------------------------
   No valida atomicidad — eso ya lo hace el Checker (CHECKER_PROMPT).
   No valida el contenido de una tarea, ni si está bien redactada.
   No valida si el ARTEFACTO que entregue un Specialist cumple la tarea.

   Valida una sola cosa: si el grafo FINAL de Atomic Tasks respeta las
   "REGLAS ESPECÍFICAS POR ROL" que ya están declaradas en
   DECOMPOSE_CONTEXT_ADDENDUM (atomic_engine_v5.js) — sin confiar en
   que el LLM (Atomizer, Checker o Re-Atomizer) las haya seguido.
   Es determinístico: no llama a ningún modelo, no depende de LM Studio.

   NO ES el gate READY → DONE
   ------------------------------------------------------------
   Este Profile valida el PLAN: la salida de TechLeader → Atomizer →
   Checker → Re-Atomizer → resolveDependencies. Pregunta "¿el grafo es
   coherente?", no "¿el trabajo está bien hecho?".

   El futuro gate READY → DONE es artefact-level: ¿lo que entregó un
   Specialist cumple lo que su Atomic Task pedía? Ese Profile no puede
   escribirse todavía porque el Specialist real no existe (hoy es un
   "runner" placeholder). Cuando exista, es un Profile aparte — no una
   extensión de este.

   DÓNDE SE ENGANCHA
   ------------------------------------------------------------
     const result = await runAtomicGraph(phases, log, onTaskResolved);
     const validation = validateRoleDependencies(result.allTasks);
     if (validation.status === "FAIL") {
       // no exponer el grafo como confiable en la UI todavía
     }

   Funciona igual sobre result.allTasks (crudo) o sobre
   resolveDependencies(...).nodes (con resolver_status agregado) —
   solo lee id / role / depends_on, nada más.

   TERMINOLOGÍA
   ------------------------------------------------------------
   FAIL / WARN / PASS acá son locales a este Profile. Validation.md
   todavía no fija el vocabulario oficial de Validation States del
   laboratorio (gap ya anotado, compartido con Governance.md). Cuando
   eso se resuelva, este Profile debería adoptar esos nombres.

   ============================================================ */

/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */

function findTaskById(tasks, id) {
  return tasks.find((t) => t.id === id);
}

/* ------------------------------------------------------------
   RULE 1 (FAIL) — QA_REQUIRES_UPSTREAM_ARTIFACT

   Encodes: "Si tu fase es QA, debe depender de al menos una Atomic
   Task concreta de Backend o Frontend cuando existan tareas de esas
   fases que produzcan el artefacto a validar."

   Si NO existe ninguna tarea Backend/Frontend en el grafo, la regla
   no aplica — igual que en el prompt original — y no se reporta nada.
   ------------------------------------------------------------ */
function checkQaRequiresUpstreamArtifact(tasks) {
  const upstreamCandidates = tasks.filter(
    (t) => t.role === "Backend" || t.role === "Frontend",
  );

  if (upstreamCandidates.length === 0) return [];

  const failures = [];

  for (const t of tasks) {
    if (t.role !== "QA") continue;

    const deps = t.depends_on || [];
    const hasUpstreamDependency = deps.some((depId) => {
      const dep = findTaskById(tasks, depId);
      return dep && (dep.role === "Backend" || dep.role === "Frontend");
    });

    if (!hasUpstreamDependency) {
      failures.push({
        rule: "QA_REQUIRES_UPSTREAM_ARTIFACT",
        severity: "FAIL",
        taskId: t.id,
        message:
          `${t.id} (QA) no depende de ninguna Atomic Task Backend/Frontend, ` +
          `pero existen ${upstreamCandidates.length} en el grafo. No hay ` +
          `artefacto declarado para validar.`,
      });
    }
  }

  return failures;
}

/* ------------------------------------------------------------
   RULE 2 (FAIL, defensivo) — NO_PHASE_LEVEL_DEPENDENCY

   resolveDependencies() ya lanza DEPENDENCY_LEVEL_MISMATCH para esto.
   Se repite acá a propósito: un Validation Profile independiente no
   debería asumir que el mecanismo que valida no falló — es lo mismo
   que discutimos sobre "el Checker se llama independiente pero es
   el mismo modelo que el Atomizer".
   ------------------------------------------------------------ */
function checkNoPhaseLevelDependency(tasks) {
  const PHASE_ID = /^F\d+$/;
  const failures = [];

  for (const t of tasks) {
    for (const depId of t.depends_on || []) {
      if (PHASE_ID.test(depId)) {
        failures.push({
          rule: "NO_PHASE_LEVEL_DEPENDENCY",
          severity: "FAIL",
          taskId: t.id,
          message: `${t.id} declara "${depId}" como dependencia — eso es un ID de FASE, no de Atomic Task.`,
        });
      }
    }
  }

  return failures;
}

/* ------------------------------------------------------------
   RULE 3 (WARN) — BACKEND_ROOT_WITHOUT_DBA

   Encodes: "Si tu fase es Backend y necesita esquema de DB, depende
   de las Atomic Tasks concretas de DBA..."

   WARN y no FAIL a propósito: no todo Backend necesita esquema
   (puede ser un servicio sin persistencia propia). Esto no se puede
   saber con certeza estructural — pide confirmación humana, no
   auto-falla.
   ------------------------------------------------------------ */
function checkBackendRootWithoutDba(tasks) {
  const dbaTasks = tasks.filter((t) => t.role === "DBA");
  if (dbaTasks.length === 0) return [];

  const warnings = [];

  for (const t of tasks) {
    if (t.role !== "Backend") continue;
    if ((t.depends_on || []).length === 0) {
      warnings.push({
        rule: "BACKEND_ROOT_WITHOUT_DBA",
        severity: "WARN",
        taskId: t.id,
        message: `${t.id} (Backend) no tiene dependencias y existen ${dbaTasks.length} tarea(s) DBA en el grafo. Confirmar si necesita esquema de base de datos.`,
      });
    }
  }

  return warnings;
}

/* ------------------------------------------------------------
   RULE 4 (WARN) — FRONTEND_ROOT_WITHOUT_BACKEND

   Encodes: "Si tu fase es Frontend y consume APIs, depende de las
   Atomic Tasks concretas de Backend..." Mismo criterio WARN que la
   regla 3 y por la misma razón: no todo Frontend consume una API
   propia (puede ser layout/shell puro).
   ------------------------------------------------------------ */
function checkFrontendRootWithoutBackend(tasks) {
  const backendTasks = tasks.filter((t) => t.role === "Backend");
  if (backendTasks.length === 0) return [];

  const warnings = [];

  for (const t of tasks) {
    if (t.role !== "Frontend") continue;
    if ((t.depends_on || []).length === 0) {
      warnings.push({
        rule: "FRONTEND_ROOT_WITHOUT_BACKEND",
        severity: "WARN",
        taskId: t.id,
        message: `${t.id} (Frontend) no tiene dependencias y existen ${backendTasks.length} tarea(s) Backend en el grafo. Confirmar si consume alguna API.`,
      });
    }
  }

  return warnings;
}

/* ------------------------------------------------------------
   ENTRY POINT
   ------------------------------------------------------------ */
export function validateRoleDependencies(tasks = []) {
  if (!Array.isArray(tasks)) {
    throw new Error("INVALID_INPUT: tasks debe ser un array.");
  }

  const failures = [
    ...checkQaRequiresUpstreamArtifact(tasks),
    ...checkNoPhaseLevelDependency(tasks),
  ];

  const warnings = [
    ...checkBackendRootWithoutDba(tasks),
    ...checkFrontendRootWithoutBackend(tasks),
  ];

  const status =
    failures.length > 0
      ? "FAIL"
      : warnings.length > 0
        ? "PASS_WITH_WARNINGS"
        : "PASS";

  return {
    profile: "role_dependencies",
    version: "0.1",
    status,
    failures,
    warnings,
  };
}

/* ------------------------------------------------------------
   TESTS DETERMINÍSTICOS (8) — no llaman a ningún LLM

   Usan IDs calcados del run real (F2.3.R2.1, F4.4.R2.1/.2, F1.3)
   para que queden trazables contra el bug que los originó.
   ------------------------------------------------------------ */
function makeTask(id, role, depends_on = []) {
  return { id, role, depends_on };
}

export function runRoleDependencyProfileTests() {
  console.log("==========================================");
  console.log("VALIDATION PROFILE — role_dependencies v0.1 — TESTS");
  console.log("==========================================");

  // TEST 1 — QA root con Backend disponible → FAIL (caso real: F4.4.R2.1/.2)
  {
    const tasks = [
      makeTask("F2.1", "Backend"),
      makeTask("F4.4.R2.1", "QA"),
      makeTask("F4.4.R2.2", "QA"),
    ];
    const result = validateRoleDependencies(tasks);
    console.assert(result.status === "FAIL", "TEST 1 FAILED: debería fallar");
    console.assert(
      result.failures.filter((f) => f.rule === "QA_REQUIRES_UPSTREAM_ARTIFACT")
        .length === 2,
      "TEST 1 FAILED: deberían reportarse 2 violaciones QA",
    );
    console.log("TEST 1 ✓ QA root con Backend disponible → FAIL");
  }

  // TEST 2 — QA con dependencia válida → PASS
  {
    const tasks = [
      makeTask("F2.1", "Backend"),
      makeTask("F4.3", "QA", ["F2.1"]),
    ];
    const result = validateRoleDependencies(tasks);
    console.assert(result.status === "PASS", "TEST 2 FAILED: debería pasar");
    console.log("TEST 2 ✓ QA con dependencia Backend real → PASS");
  }

  // TEST 3 — QA root sin Backend/Frontend en el grafo → PASS (regla no aplica)
  {
    const tasks = [makeTask("F1.1", "DBA"), makeTask("F4.1", "QA")];
    const result = validateRoleDependencies(tasks);
    console.assert(
      result.status === "PASS",
      "TEST 3 FAILED: sin Backend/Frontend, la regla no debería dispararse",
    );
    console.log("TEST 3 ✓ QA root sin candidatos en el grafo → regla no aplica");
  }

  // TEST 4 — Backend root con DBA disponible → WARN (caso real: F2.3.R2.1)
  {
    const tasks = [makeTask("F1.3", "DBA"), makeTask("F2.3.R2.1", "Backend")];
    const result = validateRoleDependencies(tasks);
    console.assert(
      result.status === "PASS_WITH_WARNINGS",
      "TEST 4 FAILED: debería generar warning, no fail",
    );
    console.assert(
      result.warnings.some((w) => w.rule === "BACKEND_ROOT_WITHOUT_DBA"),
      "TEST 4 FAILED: falta el warning esperado",
    );
    console.log("TEST 4 ✓ Backend root con DBA disponible → WARN (no FAIL)");
  }

  // TEST 5 — Backend con dependencia a DBA declarada → sin warning
  {
    const tasks = [
      makeTask("F1.3", "DBA"),
      makeTask("F2.3.R2.1", "Backend", ["F1.3"]),
    ];
    const result = validateRoleDependencies(tasks);
    console.assert(result.status === "PASS", "TEST 5 FAILED");
    console.log("TEST 5 ✓ Backend con dependencia DBA declarada → PASS");
  }

  // TEST 6 — Frontend root con Backend disponible → WARN
  {
    const tasks = [makeTask("F2.1", "Backend"), makeTask("F3.5", "Frontend")];
    const result = validateRoleDependencies(tasks);
    console.assert(result.status === "PASS_WITH_WARNINGS", "TEST 6 FAILED");
    console.assert(
      result.warnings.some((w) => w.rule === "FRONTEND_ROOT_WITHOUT_BACKEND"),
      "TEST 6 FAILED",
    );
    console.log("TEST 6 ✓ Frontend root con Backend disponible → WARN");
  }

  // TEST 7 — dependencia a un ID de FASE en vez de una AT → FAIL
  {
    const tasks = [makeTask("F2.1", "Backend", ["F1"])];
    const result = validateRoleDependencies(tasks);
    console.assert(result.status === "FAIL", "TEST 7 FAILED");
    console.assert(
      result.failures.some((f) => f.rule === "NO_PHASE_LEVEL_DEPENDENCY"),
      "TEST 7 FAILED",
    );
    console.log('TEST 7 ✓ dependencia a ID de fase ("F1") → FAIL');
  }

  // TEST 8 — grafo limpio, sin violaciones ni candidatos a warning → PASS
  {
    const tasks = [
      makeTask("F1.3", "DBA"),
      makeTask("F2.1", "Backend", ["F1.3"]),
      makeTask("F3.1", "Frontend", ["F2.1"]),
      makeTask("F4.1", "QA", ["F2.1", "F3.1"]),
    ];
    const result = validateRoleDependencies(tasks);
    console.assert(result.status === "PASS", "TEST 8 FAILED");
    console.assert(
      result.failures.length === 0 && result.warnings.length === 0,
      "TEST 8 FAILED",
    );
    console.log("TEST 8 ✓ grafo completo y coherente → PASS");
  }

  console.log("==========================================");
  console.log("8/8 TESTS COMPLETADOS");
  console.log("==========================================");

  return true;
}

/* ------------------------------------------------------------
   Ejecutable standalone: node validation_profile_role_dependencies.mjs
   ------------------------------------------------------------ */
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runRoleDependencyProfileTests();
}
