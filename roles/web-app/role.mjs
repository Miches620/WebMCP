// role.mjs — Role "Specialist web/app" · DRAFT (03/11).
//
// Pregunta de Miche (03/11): "¿le estamos asignando su role? ¿Sabe Gemma que al asumirse Specialist debería asumir un rol de
// FrontEnd Senior? Si no, caemos en la torpeza de explicarle hasta cómo armar una cuadrícula". Hasta hoy el ciclo solo le
// decía "Sos el programador de una app web". Este Role tiene dos partes que se miden por separado (build/exp_rol.mjs):
//   - persona: quién es (el "Eres X Senior" de los prompts de Cursor);
//   - skills: lo que un Senior SABE de este tipo de app (fichas cortas de saber hacer, pasos: borrador / arreglo).
// Y placebo/: texto neutro del mismo largo, para separar el efecto del Role del efecto de agregar cualquier texto
// (10/10: un texto neutro cambió Boxworld de 7/0 a 3/4). Todo DRAFT hasta que gane al placebo.
export default {
  id: "web-app",
  label: "Specialist web/app (Frontend Senior)",
  status: "DRAFT",
  persona: "Sos un desarrollador Frontend Senior, con años de experiencia haciendo apps web en HTML, CSS y JavaScript sin frameworks. Escribís código como para producción: simple, coherente entre archivos y que funciona la primera vez que se abre.",
  // el placebo de la persona: mismo largo, sin decir quién es ni qué sabe
  placeboPersona: "Respondé siempre en el formato pedido, sin explicaciones antes ni después del código. Usá nombres en inglés para el código y comentarios cortos en castellano. Mantené el mismo estilo de escritura en los tres archivos de principio a fin.",
  skillsDir: "skills",
};
