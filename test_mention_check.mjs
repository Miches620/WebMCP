// test_mention_check.mjs — determinista, sin LLM.
//   node test_mention_check.mjs
import { missingMentions } from "./intent_mention_check.mjs";

let ok = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name}\n    ${e.message}`); fail++; }
}
const has = (res, word) => res.some((r) => r.missing.some((m) => m.startsWith(word)));

// Conversación y refined_prompt reales de Project20
const p20user = [
  "Crear una landing page de una empresa ficticia de Cafe de especialidad",
  'catalogos de sus cafes (lates, capuccinos, americanos, etc), formulario de contacto, algo de panaderia (las cafeterias de especialidad suelen vender panificados), seccion de clientes con reseñas, seccion "nosotros", seccion "carta" para ver productos y precios',
  "sus cafes deben presentarse en cards con la informacion de cada uno en forma sintetica, con una foto en la parte superior de la card y su descripcion en la parte inferior. las cards deberan estar en un carrousel. El formulario de contacto debe tener solo campos obligatorios y a lo sumo un unico campo de preferencias del cliente",
  "la seccion nosotros presentara informacion de la historia de la empresa. La seccion carta mostrara los productos disponibles actualmente. (los obtendra de un archivo de texto que la empresa podra cambiar cada vez que busque actualizar el menu)",
];
const p20refined = {
  project_name: "Landing Page de Café Especialidad",
  objetivo: "Crear una landing page para una empresa de café especialidad con secciones para mostrar cafés, formulario de contacto, clientes, nosotros y carta.",
  features: [
    "Catalogo de cafés en tarjetas con foto superior e información inferior (en carrousel)",
    "Formulario de contacto con campos obligatorios y opcionalmente un campo para preferencias",
    "Sección 'Nosotros' con historia de la empresa",
    "Sección 'Carta' con productos disponibles actualmente, obtenidos desde archivo de texto",
  ],
  criterios_holdout: [
    "Las tarjetas de café deben incluir foto y descripción.",
    "El carrousel debe permitir navegar entre las tarjetas de café.",
    "El formulario de contacto debe tener campos obligatorios solo.",
    "La sección 'Nosotros' debe presentar la historia de la empresa.",
    "La sección 'Carta' debe mostrar productos actualmente disponibles y actualizarlos desde un archivo de texto.",
  ],
};

const r20 = missingMentions(p20user, p20refined);
check("Project20: detecta panadería", () => { if (!has(r20, "panaderia")) throw new Error(JSON.stringify(r20)); });
check("Project20: detecta reseñas", () => { if (!has(r20, "resenas")) throw new Error(JSON.stringify(r20)); });
check("Project20: detecta precios", () => { if (!has(r20, "precios")) throw new Error(JSON.stringify(r20)); });
check("Project20: detecta los tipos de café (lattes, capuccinos, americanos)", () => { if (!has(r20, "capuccinos")) throw new Error(JSON.stringify(r20)); });
check("Project20: no avisa por lo que sí quedó (carrusel, foto, contacto, nosotros, carta)", () => {
  for (const w of ["carrousel", "foto", "contacto", "nosotros", "carta", "formulario"]) if (has(r20, w)) throw new Error(`avisó "${w}"`);
});
check("Project20: a lo sumo 6 avisos (no satura)", () => { if (r20.length > 6) throw new Error(`${r20.length} avisos`); });

check("Una exclusión explícita silencia el aviso", () => {
  const r = missingMentions(p20user, p20refined, { exclusiones: ["panadería y panificados"] });
  if (has(r, "panaderia")) throw new Error("siguió avisando panadería");
  if (!has(r, "resenas")) throw new Error("perdió reseñas");
});
check("Un falso aviso marcado no vuelve a aparecer", () => {
  const frase = r20.find((x) => x.missing.includes("sintetica"))?.phrase;
  const r = missingMentions(p20user, p20refined, { ignoradas: [frase] });
  if (has(r, "sintetica")) throw new Error("siguió avisando");
});
check("Si Intent Forge agrega lo pedido, el aviso desaparece", () => {
  const ref2 = { ...p20refined, features: [...p20refined.features,
    "Sección de panadería con panificados", "Sección de clientes con reseñas", "La carta muestra precios",
    "Catálogo con lattes, capuccinos y americanos"] };
  const r = missingMentions(p20user, ref2);
  for (const w of ["panaderia", "resenas", "precios", "capuccinos"]) if (has(r, w)) throw new Error(`siguió avisando ${w}`);
});
check("Conversación sin pérdidas: cero avisos", () => {
  const r = missingMentions(
    ["Quiero una tienda de instrumentos", "catálogo de guitarras con foto, carrito de compras y login"],
    { project_name: "Tienda de instrumentos", objetivo: "Tienda online de instrumentos",
      features: ["Catálogo de guitarras con imagen", "Carrito de compras", "Autenticación de usuarios (login)"], criterios_holdout: [] });
  if (r.length) throw new Error(JSON.stringify(r));
});

console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
