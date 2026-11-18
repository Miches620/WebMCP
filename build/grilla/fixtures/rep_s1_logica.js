// logica.js — la lógica de la hoja. Funciones sueltas: el núcleo las encuentra por su nombre.
// valorDe(estado, id): lo que muestra la celda id ("A1", "B2"…). Si el texto empieza con "=", acá se calcula.
function valorDe(estado, id) {
  const c = estado.celdas[id];
  if (!c || c.texto == null) return "";

  let texto = String(c.texto).trim();

  if (texto.startsWith('=')) {
    // 1. Extract the formula body: everything after '='
    let formulaBody = texto.substring(1);

    try {
      let result;
      
      // --- Handle SUMA function calls ---
      const sumMatch = formulaBody.toUpperCase().match(/^SUMA\((.*)\)$/i);
      if (sumMatch) {
        let argsString = sumMatch[1];
        let valuesToSum = [];

        // Arguments are separated by comma or semicolon, and can be ranges or single cells.
        const arguments = argsString.split(/,\s*|\;\s*/).filter(Boolean);

        for (const arg of arguments) {
          let valueToAdd = 0;
          
          if (arg.includes(':')) {
            // Range handling: A1:A3
            const rangeParts = arg.toUpperCase().split(':');
            let startId = rangeParts[0];
            let endId = rangeParts[1];

            // Determine column and row numbers for iteration (assuming standard spreadsheet structure)
            let colMatch = startId.match(/([A-Z])/);
            let startRowNum = parseInt(startId.replace(/[A-Z]/g, ''));
            let endRowNum = parseInt(endId.replace(/[A-Z]/g, ''));

            if (colMatch && !isNaN(startRowNum) && !isNaN(endRowNum)) {
                const col = colMatch[1];
                let sumForRange = 0;
                for (let r = Math.min(startRowNum, endRowNum); r <= Math.max(startRowNum, endRowNum); r++) {
                    const id = col + r; // e.g., A1, A2, A3
                    if (estado.celdas[id]) {
                        sumForRange += parseFloat(valorDe(estado, id)) || 0;
                    }
                }
                valuesToSum.push(sumForRange);

            } else {
                // Fallback if range parsing fails (treat as single cell reference)
                let cellId = startId.toUpperCase();
                 if (estado.celdas[cellId]) {
                    valuesToSum.push(parseFloat(valorDe(estado, cellId)) || 0);
                } else {
                     throw new Error("Invalid range format");
                }
            }

          } else {
            // Single cell reference (e.g., A1, B2)
            let cellId = arg.toUpperCase();
             if (estado.celdas[cellId]) {
                const value = parseFloat(valorDe(estado, cellId)) || 0;
                valuesToSum.push(value);
            } else {
                 throw new Error(`Cell reference ${arg} not found`);
            }
          }
        }
        result = valuesToSum.reduce((acc, val) => acc + val, 0).toString();

      } else {
        // --- Handle general arithmetic expressions (A1-B2*C3/D4) ---
        let expressionToEval = formulaBody;

        // Regex to find potential cell IDs: letters followed by numbers.
        const cellRegex = /([A-Z]+\d+)/g; 

        expressionToEval = expressionToEval.replace(cellRegex, (match) => {
          const upperMatch = match.toUpperCase();
          if (estado.celdas[upperMatch]) {
            // Replace the reference with its value string representation
            const value = parseFloat(valorDe(estado, upperMatch)) || 0;
            return value.toString(); 
          }
          return match; // Keep original if resolution fails
        });

        try {
          // Evaluate the sanitized expression using JS eval
          result = eval(expressionToEval);
          if (isNaN(result) || !isFinite(result)) {
             return "#VALOR!";
          }
          return result.toString();
        } catch (e) {
          console.error("Evaluation error:", e);
          return "#ERROR!";
        }
      }

      // Return the calculated result if successful
      if (typeof result === 'string') return result;
      return String(result);

    } catch (e) {
      // Catch all calculation errors
      console.error("ValorDe error:", e);
      return "#ERROR!"; 
    }
  } else {
    // Not a formula, return original text
    return texto || "";
  }
}

function cambiarColor(estado, sel, color) {
  // Crear una copia profunda del estado para asegurar inmutabilidad
  let nuevoEstado = JSON.parse(JSON.stringify(estado));

  if (!nuevoEstado.celdas) {
      return estado; // No hay celdas en el estado
  }

  // Aplicar el color de fondo a todas las celdas seleccionadas
  for (const id of sel.celdas) {
    if (nuevoEstado.celdas[id]) {
      nuevoEstado.celdas[id].color = color;
    }
  }

  return nuevoEstado;
}

function borrarContenidoColumna(estado, sel) {
    const nuevoEstado = JSON.parse(JSON.stringify(estado));

    sel.celdas.forEach(id => {
        if (nuevoEstado.celdas[id]) {
            // Resetear texto y color a valores por defecto/vacíos
            nuevoEstado.celdas[id] = {
                texto: "",
                color: "#ffffff" // Asumiendo que el blanco es el fondo por defecto
            };
        }
    });

    return nuevoEstado;
}

function borrarColumna(estado, sel) {
    // Si la columna está vacía de datos, no hacemos nada.
    if (sel.celdas.every(id => !estado.celdas[id] || estado.celdas[id].texto === "")) {
        return estado;
    }

    const newEstado = JSON.parse(JSON.stringify(estado));
    let celdasEliminadas = [];

    // 1. Eliminar la referencia de las celdas del estado
    sel.celdas.forEach(id => {
        if (newEstado.celdas[id]) {
            delete newEstado.celdas[id];
            celdasEliminadas.push(id);
        }
    });

    // 2. Limpiar la información de ocultas (aunque el núcleo debería manejar esto, lo hacemos por seguridad)
    if (newEstado.ocultas && newEstado.ocultas.columnas) {
         newEstado.ocultas.columnas = newEstado.ocultas.columnas.filter(colId => !sel.celdas.includes(`${colId}1`));
    }

    return newEstado;
}

function borrarContenidoCelda(estado, sel) {
    for (const id of sel.celdas) {
        if (estado.celdas[id]) {
            estado.celdas[id].texto = "";
        }
    }
    return estado;
}

function ocultarColumna(estado, sel) {
    // Si no hay celdas seleccionadas o si ya está oculta, devolvemos el estado original.
    if (!sel.celdas || sel.celdas.length === 0) return estado;

    const newEstado = JSON.parse(JSON.stringify(estado));
    const colId = sel.celdas[0].match(/[A-Z]+/)[0]; // Obtiene la letra de la columna (ej: 'A')

    if (!newEstado.ocultas) {
        newEstado.ocultas = {};
    }
    
    // Verificar si ya está oculta para evitar duplicados
    if (newEstado.ocultas.columnas && newEstado.ocultas.columnas.includes(colId)) {
        return estado; 
    }

    // Añadir la columna a la lista de ocultas
    if (!newEstado.ocultas.columnas) {
        newEstado.ocultas.columnas = [];
    }
    newEstado.ocultas.columnas.push(colId);

    return newEstado;
}

function ocultarFila(estado, sel) {
    // Si no hay celdas seleccionadas o si ya está oculta, devolvemos el estado original.
    if (!sel.celdas || sel.celdas.length === 0) return estado;

    const newEstado = JSON.parse(JSON.stringify(estado));
    // Obtiene el número de la fila (ej: '1')
    const rowId = sel.celdas[0].match(/(\d+)$/)[1]; 

    if (!newEstado.ocultas) {
        newEstado.ocultas = {};
    }
    
    // Verificar si ya está oculta para evitar duplicados
    if (newEstado.ocultas.filas && newEstado.ocultas.filas.includes(rowId)) {
        return estado; 
    }

    // Añadir la fila a la lista de ocultas
    if (!newEstado.ocultas.filas) {
        newEstado.ocultas.filas = [];
    }
    newEstado.ocultas.filas.push(rowId);

    return newEstado;
}
