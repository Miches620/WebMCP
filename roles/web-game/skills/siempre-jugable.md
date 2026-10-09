---
id: siempre-jugable
status: DRAFT
pasos: wiring
evidencia: b11 (al ganar se sacaba el listener de teclado y el juego quedaba bloqueado; lo encontró Miche jugando), b13/b14 (el mismo error, arreglado en el reintento)
detecta: queda bloqueado
medicion: 08/10, con y sin: Boxworld 1→0, Depósito 0→0. A favor (débil: una sola aparición).
---
Al ganar no saques los listeners (nada de removeEventListener). Si hay que ignorar teclas después de ganar, preguntale al estado del juego si ya está ganado y salí de la función. Al empezar o reiniciar un nivel, todo queda listo para jugar otra vez.
