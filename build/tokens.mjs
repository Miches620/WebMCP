// tokens.mjs — estimación de tokens (core). Extraída de file_diet.mjs (05/10).
export const estTokens = (s) => Math.ceil(String(s || "").length / 3.2);
