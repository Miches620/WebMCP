/* ============================================================
   VALIDATION PROFILE — Atomizer / Role Dependencies
   ============================================================

   Documento    : validation_profile_role_dependencies.mjs
   Version      : 0.2 (reglas por rol desde el profile, 05/10)
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
   Refactor de profiles (05/10)
   ------------------------------------------------------------
   Las reglas que nombran roles (QA, Backend, Frontend, DBA) ahora las declara
   el profile del proyecto (profiles/web/profile.mjs → roleDependencyRules) y
   acá quedan solo los DOS TIPOS de regla, genéricos:

     requires_upstream (ej. QA_REQUIRES_UPSTREAM_ARTIFACT, FAIL)
       Encodes: "Si tu fase es QA, debe depender de al menos una Atomic
       Task concreta de Backend o Frontend cuando existan tareas de esas
       fases que produzcan el artefacto a validar."
       Si NO existe ninguna tarea upstream en el grafo, la regla no aplica.

     root_without (ej. BACKEND_ROOT_WITHOUT_DBA / FRONTEND_ROOT_WITHOUT_BACKEND, WARN)
       Encodes: "Si tu fase es Backend y necesita esquema de DB, depende
       de las Atomic Tasks concretas de DBA...". WARN y no FAIL a propósito:
       no todo Backend necesita esquema ni todo Frontend consume una API
       propia — pide confirmación humana, no auto-falla.

   NO_PHASE_LEVEL_DEPENDENCY es universal (no depende de roles) y sigue acá.
   Mismos nombres de regla y mismos mensajes que v0.1.
   ------------------------------------------------------------ */
function checkRequiresUpstream(tasks, r) {
  const upstreamCandidates = tasks.filter((t) => r.upstream.includes(t.role));

  if (upstreamCandidates.length === 0) return [];

  const failures = [];

  for (const t of tasks) {
    if (t.role !== r.role) continue;

    const deps = t.depends_on || [];
    const hasUpstreamDependency = deps.some((depId) => {
      const dep = findTaskById(tasks, depId);
      return dep && r.upstream.includes(dep.role);
    });

    if (!hasUpstreamDependency) {
      failures.push({
        rule: r.rule,
        severity: r.severity,
        taskId: t.id,
        message:
          `${t.id} (${r.role}) no depende de ninguna Atomic Task ${r.upstream.join("/")}, ` +
          `pero existen ${upstreamCandidates.length} en el grafo. No hay ` +
          `artefacto declarado para validar.`,
      });
    }
  }

  return failures;
}

/* ------------------------------------------------------------
   RULE (FAIL, defensivo, universal) — NO_PHASE_LEVEL_DEPENDENCY

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

function checkRootWithout(tasks, r) {
  const upstreamTasks = tasks.filter((t) => t.role === r.upstream);
  if (upstreamTasks.length === 0) return [];

  const warnings = [];

  for (const t of tasks) {
    if (t.role !== r.role) continue;
    if ((t.depends_on || []).length === 0) {
      warnings.push({
        rule: r.rule,
        severity: r.severity,
        taskId: t.id,
        message: `${t.id} (${r.role}) no tiene dependencias y existen ${upstreamTasks.length} tarea(s) ${r.upstream} en el grafo. ${r.hint}`,
      });
    }
  }

  return warnings;
}

const RULE_TYPES = { requires_upstream: checkRequiresUpstream, root_without: checkRootWithout };

/* ------------------------------------------------------------
   ENTRY POINT
   ------------------------------------------------------------ */
/**
 * @param {object[]} tasks
 * @param {{roleDependencyRules: object[]}} profile  resultado de resolveProfiles()
 */
export function validateRoleDependencies(tasks = [], profile) {
  if (!Array.isArray(tasks)) {
    throw new Error("INVALID_INPUT: tasks debe ser un array.");
  }
  if (!Array.isArray(profile?.roleDependencyRules)) {
    throw new Error("PROFILE_REQUIRED: validateRoleDependencies necesita el profile del proyecto (roleDependencyRules).");
  }
  const run = (r) => {
    const fn = RULE_TYPES[r.type];
    if (!fn) throw new Error(`PROFILE_BAD_RULE: tipo de regla desconocido "${r.type}" (${r.rule})`);
    return fn(tasks, r);
  };
  const byRules = profile.roleDependencyRules.flatMap(run);

  const failures = [
    ...byRules.filter((x) => x.severity === "FAIL"),
    ...checkNoPhaseLevelDependency(tasks),
  ];

  const warnings = byRules.filter((x) => x.severity !== "FAIL");

  const status =
    failures.length > 0
      ? "FAIL"
      : warnings.length > 0
        ? "PASS_WITH_WARNINGS"
        : "PASS";

  return {
    profile: "role_dependencies",
    version: "0.2",
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

// console.assert imprimía "✓" aunque fallara (README, pendientes): ahora corta.
function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

export async function runRoleDependencyProfileTests() {
  const { resolveProfiles } = await import("./profiles/registry.mjs");
  const WEB = resolveProfiles(["web/landing"]);
  console.log("==========================================");
  console.log("VALIDATION PROFILE — role_dependencies v0.2 — TESTS");
  console.log("==========================================");

  // TEST 1 — QA root con Backend disponible → FAIL (caso real: F4.4.R2.1/.2)
  {
    const tasks = [
      makeTask("F2.1", "Backend"),
      makeTask("F4.4.R2.1", "QA"),
      makeTask("F4.4.R2.2", "QA"),
    ];
    const result = validateRoleDependencies(tasks, WEB);
    check(result.status === "FAIL", "TEST 1 FAILED: debería fallar");
    check(
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
    const result = validateRoleDependencies(tasks, WEB);
    check(result.status === "PASS", "TEST 2 FAILED: debería pasar");
    console.log("TEST 2 ✓ QA con dependencia Backend real → PASS");
  }

  // TEST 3 — QA root sin Backend/Frontend en el grafo → PASS (regla no aplica)
  {
    const tasks = [makeTask("F1.1", "DBA"), makeTask("F4.1", "QA")];
    const result = validateRoleDependencies(tasks, WEB);
    check(
      result.status === "PASS",
      "TEST 3 FAILED: sin Backend/Frontend, la regla no debería dispararse",
    );
    console.log("TEST 3 ✓ QA root sin candidatos en el grafo → regla no aplica");
  }

  // TEST 4 — Backend root con DBA disponible → WARN (caso real: F2.3.R2.1)
  {
    const tasks = [makeTask("F1.3", "DBA"), makeTask("F2.3.R2.1", "Backend")];
    const result = validateRoleDependencies(tasks, WEB);
    check(
      result.status === "PASS_WITH_WARNINGS",
      "TEST 4 FAILED: debería generar warning, no fail",
    );
    check(
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
    const result = validateRoleDependencies(tasks, WEB);
    check(result.status === "PASS", "TEST 5 FAILED");
    console.log("TEST 5 ✓ Backend con dependencia DBA declarada → PASS");
  }

  // TEST 6 — Frontend root con Backend disponible → WARN
  {
    const tasks = [makeTask("F2.1", "Backend"), makeTask("F3.5", "Frontend")];
    const result = validateRoleDependencies(tasks, WEB);
    check(result.status === "PASS_WITH_WARNINGS", "TEST 6 FAILED");
    check(
      result.warnings.some((w) => w.rule === "FRONTEND_ROOT_WITHOUT_BACKEND"),
      "TEST 6 FAILED",
    );
    console.log("TEST 6 ✓ Frontend root con Backend disponible → WARN");
  }

  // TEST 7 — dependencia a un ID de FASE en vez de una AT → FAIL
  {
    const tasks = [makeTask("F2.1", "Backend", ["F1"])];
    const result = validateRoleDependencies(tasks, WEB);
    check(result.status === "FAIL", "TEST 7 FAILED");
    check(
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
    const result = validateRoleDependencies(tasks, WEB);
    check(result.status === "PASS", "TEST 8 FAILED");
    check(
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
  await runRoleDependencyProfileTests();
}
