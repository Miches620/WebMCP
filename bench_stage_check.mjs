// bench_stage_check.mjs — matriz de briefs para el chequeo de etapa del plan.
// Necesita LM Studio con qwen2.5-7b-instruct. Evidencia, no test unitario:
//   node bench_stage_check.mjs            (3 repeticiones por caso)
//   node bench_stage_check.mjs 5          (5 repeticiones)
// Escribe evidence/stage_check_<fecha>.json con cada veredicto crudo.
//
// Esperado por fase: "IN" (debe quedar IN_SCOPE), "OUT" (debe marcarse
// DEFERRED o EXCESS) o "ANY" (discutible: no cuenta para el score).
// Los planes de Project20 intentos 1 y 2 solo tienen el NOMBRE de cada fase
// (el log no guardó descripciones); el intento 3 es el plan real completo.

import { mkdirSync, writeFileSync } from "node:fs";
import { runPlanStageCheck } from "./plan_stage_check.mjs";

const REPS = Number(process.argv[2] || 3);

const P20_BRIEF = `Proyecto: Landing Page de Café Especialidad
Crear una landing page para una empresa de café especialidad con secciones para mostrar cafés, formulario de contacto, clientes, nosotros y carta.

Features:

1. Catalogo de cafés en tarjetas con foto superior e información inferior (en carrousel)
2. Formulario de contacto con campos obligatorios y opcionalmente un campo para preferencias
3. Sección 'Nosotros' con historia de la empresa
4. Sección 'Carta' con productos disponibles actualmente, obtenidos desde archivo de texto`;

const byName = (arr) => arr.map(([id, role, name, exp]) => ({ fase: { id, responsable_sugerido: role, name, description: name }, exp }));

const CASES = [
  {
    id: "P20-intento1",
    brief: P20_BRIEF,
    phases: byName([
      ["F1", "DBA", "Modelado y Estructura de Datos (Data Layer)", "ANY"],
      ["F2", "Frontend", "Implementación del Layout Base y Contenido Estático", "IN"],
      ["F3", "Frontend", "Desarrollo de Componentes Dinámicos (Catálogo y Carta)", "IN"],
      ["F4", "Backend", "Manejo de Interacciones y Formulario de Contacto", "IN"],
      ["F5", "DevOps", "Pruebas Integrales, Optimización y Despliegue (QA/DevOps)", "OUT"],
    ]),
  },
  {
    id: "P20-intento2",
    brief: P20_BRIEF,
    phases: byName([
      ["F1", "DevOps", "Configuración del Entorno y Estructura Base", "ANY"],
      ["F2", "DBA", "Modelado e Ingesta de Datos Estáticos (Menú)", "IN"],
      ["F3", "Frontend", "Desarrollo del Frontend Estático y Componentes Reutilizables", "IN"],
      ["F4", "Frontend", "Integración de Contenido Estático y Catálogo de Cafés", "IN"],
      ["F5", "Backend", "Implementación del Backend de Datos Dinámicos y Formulario", "IN"],
      ["F6", "Frontend", "Conexión Final de Datos e Interfaz de Usuario", "IN"],
      ["F7", "QA", "Pruebas Funcionales, Optimización y Despliegue", "OUT"],
    ]),
  },
  {
    // Control de falsos positivos: plan real aprobado (EXCESS=0 en el reviewer).
    id: "P20-intento3",
    brief: P20_BRIEF,
    phases: [
      ["F1", "Frontend", "Configuración del Layout Base y Estructura de Secciones", "Establecer la estructura HTML/CSS base de la Landing Page. Crear los contenedores vacíos para las secciones principales: 'Nosotros', Catálogo, Carta y Contacto.", "IN"],
      ["F2", "Frontend", "Implementación del Contenido Estático (Nosotros y Mockup de Catálogo)", "Integrar el contenido textual para la sección 'Nosotros'. Desarrollar el componente visual del carrusel de cafés utilizando datos estáticos simulados, asegurando la funcionalidad básica de navegación entre tarjetas (foto y descripción).", "IN"],
      ["F3", "Backend", "Servicio de Datos para el Menú ('Carta')", "Crear un endpoint o servicio que lea, parsee y sirva los productos disponibles desde el archivo de texto fuente.", "IN"],
      ["F4", "Frontend", "Desarrollo del Formulario de Contacto y Validación", "Diseñar e implementar el formulario de contacto. Aplicar la validación en el lado del cliente para asegurar que solo los campos obligatorios sean requeridos.", "IN"],
      ["F5", "Frontend", "Integración Final y Conexión Dinámica de Datos", "Consumir los datos del menú desde el endpoint creado en F3 y renderizar dinámicamente la sección 'Carta'.", "IN"],
    ].map(([id, role, name, description, exp]) => ({ fase: { id, responsable_sugerido: role, name, description }, exp })),
  },
  {
    // Regla 5: si el brief pide expresamente el despliegue, prevalece el brief.
    id: "deploy-pedido",
    brief: `Proyecto: Portfolio personal\nPágina estática con mis proyectos.\n\nFeatures:\n\n1. Lista de proyectos con título, imagen y link\n2. Sección "Sobre mí"\n3. El sitio debe quedar publicado en GitHub Pages con una URL pública`,
    phases: [
      ["F1", "Frontend", "Maquetado de la página", "HTML/CSS de la lista de proyectos y la sección Sobre mí.", "IN"],
      ["F2", "DevOps", "Publicación en GitHub Pages", "Configurar el repositorio y publicar el sitio en GitHub Pages con URL pública.", "IN"],
    ].map(([id, role, name, description, exp]) => ({ fase: { id, responsable_sugerido: role, name, description }, exp })),
  },
  {
    id: "operacion-y-hardening",
    brief: `Proyecto: Lista de tareas con login\nApp web para que un usuario gestione sus tareas.\n\nFeatures:\n\n1. Registro e inicio de sesión con email y contraseña\n2. Crear, completar y borrar tareas\n3. Las tareas de cada usuario son privadas`,
    phases: [
      ["F1", "DBA", "Esquema de usuarios y tareas", "Tablas de usuarios y tareas con relación por usuario.", "IN"],
      ["F2", "Backend", "Autenticación y API de tareas", "Registro, login con contraseña hasheada y endpoints de tareas filtrados por usuario.", "IN"],
      ["F3", "Frontend", "Pantallas de login y lista de tareas", "Formularios de registro/login y la lista de tareas.", "IN"],
      ["F4", "DevOps", "Monitoreo, alertas y escalado horizontal", "Métricas, alertas de caída y autoescalado de instancias para alta carga.", "OUT"],
      ["F5", "Backend", "Rate limiting y auditoría de accesos", "Límite de pedidos por IP y registro de auditoría de todos los accesos.", "OUT"],
    ].map(([id, role, name, description, exp]) => ({ fase: { id, responsable_sugerido: role, name, description }, exp })),
  },
  {
    id: "excess-no-pedido",
    brief: P20_BRIEF,
    phases: [
      ["F1", "Frontend", "Landing con todas las secciones", "Maquetado de catálogo en carrusel, formulario, Nosotros y Carta.", "IN"],
      ["F2", "Backend", "Lectura de la carta desde archivo de texto", "Servicio que lee el archivo de texto de productos.", "IN"],
      ["F3", "Backend", "Panel de administración con usuarios y roles", "Backoffice con login, alta de usuarios, roles y permisos para editar el sitio.", "OUT"],
    ].map(([id, role, name, description, exp]) => ({ fase: { id, responsable_sugerido: role, name, description }, exp })),
  },
];

const runs = [];
const tally = { tp: 0, fn: 0, fp: 0, tn: 0, any: 0, schema_incomplete: 0, errors: 0 };

for (const c of CASES) {
  const fases = c.phases.map((p) => p.fase);
  for (let rep = 1; rep <= REPS; rep++) {
    let r;
    try {
      r = await runPlanStageCheck(c.brief, fases);
    } catch (e) {
      tally.errors++;
      runs.push({ case: c.id, rep, error: e.message });
      console.log(`✗ ${c.id} #${rep} ERROR ${e.message}`);
      continue;
    }
    if (!r.schema_complete) tally.schema_incomplete++;
    const row = [];
    for (const p of c.phases) {
      const v = r.verdicts.find((x) => x.phase_id === p.fase.id);
      const got = v ? (v.verdict === "IN_SCOPE" ? "IN" : "OUT") : "NONE";
      if (p.exp === "ANY") tally.any++;
      else if (p.exp === "OUT") got === "OUT" ? tally.tp++ : tally.fn++;
      else got === "OUT" ? tally.fp++ : tally.tn++;
      const mark = p.exp === "ANY" ? "·" : (p.exp === got ? "✓" : "✗");
      row.push(`${p.fase.id}:${v ? v.verdict : "NONE"}${mark}`);
    }
    console.log(`${c.id} #${rep}  ${row.join("  ")}${r.schema_complete ? "" : "  [schema incompleto]"}`);
    runs.push({ case: c.id, rep, expected: c.phases.map((p) => [p.fase.id, p.exp]), verdicts: r.verdicts, schema_gaps: r.schema_gaps, stage_sha256: r.stage_sha256 });
  }
}

const recall = tally.tp + tally.fn ? tally.tp / (tally.tp + tally.fn) : null;
const precision = tally.tp + tally.fp ? tally.tp / (tally.tp + tally.fp) : null;
console.log(`\nOUT detectados: ${tally.tp}/${tally.tp + tally.fn}  (recall ${recall?.toFixed(2)})`);
console.log(`Falsos OUT sobre fases IN: ${tally.fp}/${tally.fp + tally.tn}  (precision ${precision?.toFixed(2)})`);
console.log(`schema incompleto: ${tally.schema_incomplete} | errores: ${tally.errors} | fases ANY (no puntúan): ${tally.any}`);

mkdirSync(new URL("./evidence/", import.meta.url), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = new URL(`./evidence/stage_check_${stamp}.json`, import.meta.url);
writeFileSync(out, JSON.stringify({ reps: REPS, tally, recall, precision, checker: "plan_stage_check v0.1-bounded", model: "qwen2.5-7b-instruct", runs }, null, 2));
console.log(`→ ${out.pathname}`);
