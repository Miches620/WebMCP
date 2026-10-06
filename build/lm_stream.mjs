// lm_stream.mjs — llamada a LM Studio en modo streaming.
//
// Por qué: fetch de Node (undici) corta con UND_ERR_HEADERS_TIMEOUT si el
// servidor tarda más de 5 min en mandar los headers. Sin streaming, LM Studio
// no responde nada hasta terminar de generar, y con un index.html que crece
// tarea a tarea Gemma pasó los 5 min (Project20, tarea 9/19, 01/10).
// Con stream:true los headers llegan enseguida y el texto va llegando de a
// pedazos. Se corta solo si pasan IDLE_MS sin recibir nada.

const IDLE_MS = 10 * 60 * 1000;

export async function chatStream(url, body, { onProgress } = {}) {
  const ctrl = new AbortController();
  let idle = setTimeout(() => ctrl.abort(), IDLE_MS);
  const bump = () => { clearTimeout(idle); idle = setTimeout(() => ctrl.abort(), IDLE_MS); };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: true, stream_options: { include_usage: true } }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`LM Studio ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", content = "", finish_reason = null, usage = null, chunks = 0, reasoning = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bump();
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let j;
        try { j = JSON.parse(data); } catch { continue; }
        const ch = j.choices?.[0];
        if (ch?.delta?.content) content += ch.delta.content;
        // v0.8.2: algunos modelos "piensan" en un canal aparte; se cuenta para saber a dónde se fue el presupuesto
        const rz = ch?.delta?.reasoning_content ?? ch?.delta?.reasoning;
        if (typeof rz === "string") reasoning += rz.length;
        if (ch?.finish_reason) finish_reason = ch.finish_reason;
        if (j.usage) usage = j.usage;
        if (onProgress && ++chunks % 200 === 0) onProgress(content.length);
      }
    }
    return { content, finish_reason, usage, reasoning_chars: reasoning };
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`LM Studio sin respuesta durante ${IDLE_MS / 60000} min`);
    throw e;
  } finally {
    clearTimeout(idle);
  }
}
