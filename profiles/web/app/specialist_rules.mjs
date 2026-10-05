// specialist_rules.mjs — reglas del Specialist para una APP de una pantalla (web/app).
// Se agregan al SYSTEM_PROMPT del Specialist por componentes (landing/specialist_components.mjs).

export const APP_SPECIALIST_RULES = `ESTE PROYECTO ES UNA APP DE UNA SOLA PANTALLA (no una landing):
A1. Hay UN componente y toda la app vive en él. No hay header, menú ni pie de página; no escribas textos de presentación ("Bienvenido", "Sobre nosotros").
A2. El estado vive en UN objeto JS (ej. const estado = {...}). Una función dibujar() arma la pantalla desde el estado; cada acción cambia el estado y llama a dibujar(). Ningún dato vive solo en el DOM.
A3. Al final de componente.js llamá a la inicialización (ej. iniciar();). Sin DOMContentLoaded: el componente ya corre con la página cargada.
A4. Las REGLAS DEL USUARIO del brief son obligatorias: la app las tiene que cumplir todas.`;

/** Restricciones y contexto del usuario: en una app o un juego son las reglas de lo que se construye. */
export function rulesBrief(refined = {}) {
  const parts = [];
  const r = (refined.restricciones || []).filter(Boolean);
  const c = (refined.contexto || []).filter(Boolean);
  if (r.length) parts.push("REGLAS DEL USUARIO (se cumplen todas):", ...r.map((x) => `- ${x}`));
  if (c.length) parts.push("", "CONTEXTO DEL USUARIO:", ...c.map((x) => `- ${x}`));
  return parts.join("\n");
}
