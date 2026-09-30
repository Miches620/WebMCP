// stage_loader.mjs
// Extrae el bloque operativo de ProjectStage.md para inyectarlo en el prompt del reviewer.
// Falla fuerte (throw) si el archivo o las marcas no existen: nunca "sin stage" en silencio.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const BEGIN = "<!-- BEGIN_STAGE_BLOCK -->";
const END = "<!-- END_STAGE_BLOCK -->";

export function loadStageBlock(path) {
  const raw = readFileSync(path, "utf8"); // lanza si el archivo no existe

  const i = raw.indexOf(BEGIN);
  const j = raw.indexOf(END);
  if (i === -1 || j === -1 || j < i) {
    throw new Error(`ProjectStage: marcas BEGIN/END no encontradas o desordenadas en ${path}`);
  }

  const block = raw.slice(i + BEGIN.length, j).trim();
  if (!block) {
    throw new Error(`ProjectStage: el bloque operativo está vacío en ${path}`);
  }

  return {
    block,
    sha256: createHash("sha256").update(block).digest("hex"),
    chars: block.length,
  };
}
