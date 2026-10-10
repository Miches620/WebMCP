const Reglas = {
  /**
   * Crea el estado inicial del juego a partir de un nivel dado.
   * @param {string[]} nivel - Array de strings que representan el mapa.
   * @returns {object} El estado inicial del juego.
   */
  crearEstado: function(nivel) {
    let jugador = null;
    let cajas = [];
    let objetivos = [];

    for (let r = 0; r < nivel.length; r++) {
      for (let c = 0; c < nivel[r].length; c++) {
        const char = nivel[r][c];

        if (char === '@') {
          jugador = { fila: r, col: c };
        } else if (char === '$' || char === '*') {
          cajas.push({ fila: r, col: c });
        } else if (char === '.') {
          objetivos.push({ fila: r, col: c });
        }
      }
    }

    return {
      mapa: nivel,
      jugador: jugador,
      cajas: cajas,
      objetivos: objetivos,
      movimientos: 0
    };
  },

  /**
   * Mueve el estado actual según la dirección. Maneja colisiones y empujes.
   * @param {object} estado - El estado actual del juego.
   * @param {string} direccion - Dirección de movimiento ("arriba", "abajo", "izquierda", "derecha").
   * @returns {object} Un nuevo estado o el estado original si no hay movimiento.
   */
  mover: function(estado, direccion) {
    const { jugador, cajas } = estado;
    let nuevaFila = jugador.fila;
    let nuevaCol = jugador.col;

    // 1. Calcular la posición objetivo del jugador
    switch (direccion) {
      case "arriba":
        nuevaFila -= 1;
        break;
      case "abajo":
        nuevaFila += 1;
        break;
      case "izquierda":
        nuevaCol -= 1;
        break;
      case "derecha":
        nuevaCol += 1;
        break;
    }

    // Verificar límites y paredes en la posición objetivo del jugador
    if (nuevaFila < 0 || nuevaFila >= estado.mapa.length ||
      nuevaCol < 0 || nuevaCol >= estado.mapa[0].length ||
      estado.mapa[nuevaFila][nuevaCol] === '#') {
      return { ...estado, movimientos: estado.movimientos }; // No hay movimiento
    }

    // Verificar si la posición objetivo está ocupada por una caja
    const colisionCaja = cajas.some(c => c.fila === nuevaFila && c.col === nuevaCol);

    if (!colisionCaja) {
      // Movimiento simple exitoso (a piso o objetivo)
      return {
        mapa: estado.mapa,
        jugador: { fila: nuevaFila, col: nuevaCol },
        cajas: cajas,
        objetivos: estado.objetivos,
        movimientos: estado.movimientos + 1
      };
    } else {
      // Intentar empujar una caja
      const cajaAEmpujar = cajas.find(c => c.fila === nuevaFila && c.col === nuevaCol);

      if (!cajaAEmpujar) {
        return { ...estado, movimientos: estado.movimientos }; // No debería pasar
      }

      // Calcular la posición detrás de la caja (destino del empuje)
      let destinoFila = nuevaFila;
      let destinoCol = nuevaCol;

      switch (direccion) {
        case "arriba":
          destinoFila -= 1;
          break;
        case "abajo":
          destinoFila += 1;
          break;
        case "izquierda":
          destinoCol -= 1;
          break;
        case "derecha":
          destinoCol += 1;
          break;
      }

      // Verificar si el destino es válido (dentro de límites, no pared)
      const puedeEmpujar = destinoFila >= 0 && destinoFila < estado.mapa.length &&
        destinoCol >= 0 && destinoCol < estado.mapa[0].length &&
        estado.mapa[destinoFila][destinoCol] !== '#';

      // Verificar si el destino está libre de otras cajas
      const hayOtraCajaDetras = cajas.some(c => c.fila === destinoFila && c.col === destinoCol &&
                                 !(c.fila === nuevaFila && c.col === nuevaCol));

      if (puedeEmpujar && !hayOtraCajaDetras) {
        // Empuje exitoso: 1. Mover jugador, 2. Mover caja, 3. Incrementar movimientos
        let nuevasCajas = [];
        let cajasActualizadas = false;

        for (const c of cajas) {
          if (c.fila === nuevaFila && c.col === nuevaCol) {
            // Esta es la caja que se mueve
            nuevasCajas.push({ fila: destinoFila, col: destinoCol });
            cajasActualizadas = true;
          } else {
            // Otras cajas permanecen en su lugar
            nuevasCajas.push(c);
          }
        }

        if (cajasActualizadas) {
          return {
            mapa: estado.mapa,
            jugador: { fila: nuevaFila, col: nuevaCol },
            cajas: nuevasCajas,
            objetivos: estado.objetivos,
            movimientos: estado.movimientos + 1
          };
        }
      }

    // Si no se pudo mover ni empujar (colisión con pared o caja contra otra caja)
    return { ...estado, movimientos: estado.movimientos };
  },

  /**
   * Verifica si todas las cajas están sobre un objetivo.
   * @param {object} estado - El estado actual del juego.
   * @returns {boolean} True si el nivel está ganado.
   */
  ganado: function(estado) {
    if (estado.objetivos.length === 0) {
      return true; // No hay objetivos, se considera ganado por defecto
    }

    const cajasEnObjetivo = estado.cajas.every(caja => {
      // Comprueba si la caja está en alguna de las coordenadas objetivo
      return estado.objetivos.some(obj => obj.fila === caja.fila && obj.col === caja.col);
    });

    return cajasEnObjetivo;
  }
};
