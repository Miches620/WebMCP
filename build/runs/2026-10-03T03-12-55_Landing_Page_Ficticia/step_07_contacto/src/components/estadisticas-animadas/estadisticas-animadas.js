/**
 * Función para animar el contador de un elemento dado su valor objetivo.
 * @param {HTMLElement} element - El elemento H3 que debe contar.
 * @param {number} targetValue - El valor final al que debe llegar (ej: 350000).
 */
const animateCounter = (element, targetValue) => {
    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        
        // Calcular el valor actual basado en el tiempo transcurrido y la duración deseada.
        // Usamos un factor de aceleración para que parezca más natural.
        let progress = Math.min(1, elapsed / 2000); // Animación dura 2 segundos
        let currentValue = Math.floor(progress * targetValue);

        // Aplicar el valor al elemento
        element.innerText = currentValue.toLocaleString('en-US');

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Asegurar que el valor final sea exacto
            element.innerText = targetValue.toLocaleString('en-US');
        }
    };

    window.requestAnimationFrame(step);
};


/**
 * Inicializa la observación de elementos para animar las estadísticas al hacer scroll.
 */
const initializeStatsAnimation = () => {
    // 1. Seleccionar todos los contenedores de tarjetas de estadística
    const statCards = document.querySelectorAll('.stat-card');

    // 2. Configurar el Intersection Observer
    const observerOptions = {
        root: null, // Observar respecto al viewport
        rootMargin: '0px',
        threshold: 0.3 // Se dispara cuando el 30% del elemento es visible
    };

    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                const card = entry.target;
                const counterElement = card.querySelector('.counter');
                const metricValue = parseFloat(card.dataset.metric);

                // Marcar la tarjeta como animada para evitar re-ejecuciones
                card.dataset.animated = 'true'; 

                if (isNaN(metricValue)) {
                    console.error("Valor de métrica no encontrado en el atributo data-metric.");
                    return;
                }

                // Determinar si es un número entero o decimal para formatear correctamente
                let targetNumber;
                if (card.dataset.metric.includes('.')) {
                     targetNumber = metricValue * 100; // Multiplicamos por 100 y lo redondearemos después
                } else {
                    targetNumber = metricValue;
                }

                // Ejecutar la animación del contador
                animateCounter(counterElement, targetNumber);
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // 3. Observar cada tarjeta de estadística
    statCards.forEach(card => {
        observer.observe(card);
    });
};

// Ejecutar la inicialización cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', initializeStatsAnimation);
