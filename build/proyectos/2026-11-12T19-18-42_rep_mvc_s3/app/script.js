// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = {};
const CLAVE = "app";
let selectedRowId = null; 

/**
 * Inicializa el objeto estado con todas las celdas posibles (A1 a J20) vacías.
 */
function initializeEstado() {
    estado = {};
    // Generamos combinaciones de columnas A-J y filas 1-20
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    for (let r = 1; r <= 20; r++) {
        for (let cIndex = 0; cIndex < columns.length; cIndex++) {
            const column = columns[cIndex];
            const cellId = `${column}${r}`;
            estado[cellId] = ''; // Inicializa cada celda con un valor vacío
        }
    }
}

function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) {
             // Si hay datos guardados, los cargamos y los fusionamos sobre el estado inicializado
            const loadedState = JSON.parse(s);
            Object.keys(estado).forEach(key => {
                if (loadedState[key] !== undefined) {
                    estado[key] = loadedState[key];
                }
            });
        } else {
             // Si no hay datos, aseguramos que el estado esté inicializado correctamente
             initializeEstado();
        }
    } catch (e) { 
        console.error("Error al cargar el estado:", e); 
        initializeEstado(); // Fallback si localStorage falla
    } 
}

function guardar() { 
    try { 
        localStorage.setItem(CLAVE, JSON.stringify(estado)); 
    } catch (e) { 
        console.error("Error al guardar el estado:", e); 
    } 
}

// ===== LÓGICA: funciones que cambian `estado` (o calculan con él). NO tocan la página: sin document. =====

/**
 * Actualiza el valor de una celda específica en el estado.
 * @param {string} cellId - El identificador único de la celda (ej: "A1").
 * @param {string} newValue - El nuevo texto ingresado por el usuario.
 */
function updateCell(cellId, newValue) {
    if (estado[cellId] !== undefined) {
        estado[cellId] = newValue;
    } else {
        console.warn(`Celda ${cellId} no encontrada en el estado.`);
    }
}

/**
 * Elimina todo el contenido de la fila seleccionada del estado y guarda los cambios.
 */
function handleDeleteRow() {
    if (!selectedRowId) return;

    // 1. Lógica: Borrar contenido de toda la fila seleccionada en el estado
    for (let cIndex = 0; cIndex < 10; cIndex++) { // Columnas A-J
        const columnLetter = String.fromCharCode('A'.charCodeAt(0) + cIndex);
        const cellId = `${columnLetter}${selectedRowId}`;
        estado[cellId] = ''; 
    }

    // 2. Guardar y Dibujar
    guardar();
    render();
}

/**
 * Borra el contenido de la fila seleccionada (funcionalmente idéntico a handleDeleteRow).
 */
function handleClearContentRow() {
    if (!selectedRowId) return;
    handleDeleteRow();
}


/**
 * Aplica un estilo visual de resaltado a la fila seleccionada.
 */
function handleColorizeRow() {
    if (!selectedRowId) return;
    const rowElement = document.querySelector(`[data-row-index="${selectedRowId}"]`);
    if (!rowElement) {
        console.warn(`No se encontró la fila con ID ${selectedRowId}`);
        return;
    }

    const colorPicker = document.getElementById('colorPicker');
    let isColorPicking = false;

    // Función que aplica el color a todos los <td> de la fila
    const applyColorToRow = (color) => {
        // Eliminar cualquier clase de resaltado anterior para asegurar limpieza
        rowElement.className = 'selected'; // Mantener la clase 'selected' si existe, o simplemente resetear estilos
        
        // Buscar todas las celdas <td> dentro del tr seleccionado
        const cells = rowElement.querySelectorAll('td');
        cells.forEach(cell => {
            // Aplicamos el color directamente para asegurar que se sobrescriban los estilos CSS
            cell.style.backgroundColor = color;
        });

        // Opcionalmente, también podríamos actualizar un estado de color si fuera necesario guardar la elección.
    };

    // Mostrar el picker y manejar eventos
    const showColorPicker = () => {
        colorPicker.value = '#ffffff'; // Resetear valor por defecto
        colorPicker.style.display = 'inline-block'; 
        isColorPicking = true;
        
        // Escuchar cambios en el color
        colorPicker.oninput = (event) => {
            const selectedColor = event.target.value;
            applyColorToRow(selectedColor);
        };

        // Limpiador: Si se hace clic fuera del picker, lo ocultamos y limpiamos la interacción de color.
        document.getElementById('spreadsheet-container').onclick = (e) => {
            if (!colorPicker.contains(e.target) && !e.target.closest('#colorize-row-btn')) {
                colorPicker.style.display = 'none';
                isColorPicking = false;
                document.getElementById('spreadsheet-container').onclick = null; // Remover el listener global
            }
        };
    };

    // Inicializar: Mostrar el picker y empezar a escuchar eventos de color
    showColorPicker();
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('.row-header + td[contenteditable="true"]');
    cells.forEach(cell => {
        // Obtenemos el ID de data-cell del elemento DOM para saber qué estado actualizar
        const cellId = cell.getAttribute('data-cell'); 
        if (estado[cellId] !== undefined) {
            cell.textContent = estado[cellId];
        } else {
             // Caso fallback si por algún motivo el ID no existe en el estado
            cell.textContent = '';
        }
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const editableCells = document.querySelectorAll('.row-header + td[contenteditable="true"]');

    if (editableCells.length === 0) {
        console.error("No se encontraron celdas editables en la grilla.");
        return;
    }
    
    // Listener para cambios de contenido en las celdas individuales
    editableCells.forEach(cell => {
        cell.addEventListener('input', (event) => {
            const cellId = event.target.getAttribute('data-cell');
            const newValue = event.target.textContent;

            // 1. Lógica: Actualizar estado
            updateCell(cellId, newValue);

            // 2. Guardar: Persistir el cambio
            guardar();

            // 3. Dibujar: Re-renderizar (aunque en este caso solo se actualiza la celda que disparó el evento)
            render();
        });
    });

    // Listener para hacer clic en los encabezados de columna (A, B, C...)
    const colHeaders = document.querySelectorAll('.col-header');
    colHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const columnLetter = this.getAttribute('data-column');
            if (!columnLetter) return;

            // Borrar contenido de toda la columna en el estado
            for (let r = 1; r <= 20; r++) {
                const cellId = `${columnLetter}${r}`;
                estado[cellId] = ''; 
            }

            // Guardar y redibujar para que los cambios se reflejen
            guardar();
            render();
        });
    });

    // Listener de selección de fila (Row Headers)
    const rowHeaders = document.querySelectorAll('.row-header');
    rowHeaders.forEach(header => {
        header.addEventListener('click', function() {
            // Deseleccionar todos los headers y resetear clases
            document.querySelectorAll('.row-header').forEach(h => h.classList.remove('selected'));

            // Seleccionar el actual
            this.classList.add('selected');
            selectedRowId = this.getAttribute('data-row');

            // Habilitar/deshabilitar botones de acción
            const deleteBtn = document.getElementById('delete-row-btn');
            const clearContentBtn = document.getElementById('clear-content-btn');
            const colorizeBtn = document.getElementById('colorize-row-btn');

            if (selectedRowId) {
                deleteBtn.disabled = false;
                clearContentBtn.disabled = false;
                colorizeBtn.disabled = false;
            } else {
                deleteBtn.disabled = true;
                clearContentBtn.disabled = true;
                colorizeBtn.disabled = true;
                selectedRowId = null; // Asegurar el reset si no hay selección
            }
        });
    });

    // Listeners para los botones de acción (usando las nuevas funciones)
    document.getElementById('delete-row-btn').addEventListener('click', handleDeleteRow);
    document.getElementById('clear-content-btn').addEventListener('click', handleClearContentRow);
    document.getElementById('colorize-row-btn').addEventListener('click', handleColorizeRow);
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
