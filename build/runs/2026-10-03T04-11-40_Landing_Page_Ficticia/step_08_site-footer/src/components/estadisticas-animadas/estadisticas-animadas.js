/**
 * Función para animar un número de forma ascendente (counting up).
 * @param {HTMLElement} element - El elemento que contiene el número a animar.
 * @param {number} targetValue - El valor final al que debe llegar el contador.
 */
const animateCounter = (element, targetValue) => {
    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        // Calcula el valor actual basado en el tiempo transcurrido y un factor de aceleración.
        const value = Math.min(targetValue, Math.floor((elapsed / 1000) * targetValue / 2));

        element.textContent = value.toLocaleString('es-ES');

        if (value < targetValue) {
            window.requestAnimationFrame(step);
        }
    };

    // Usamos requestAnimationFrame para una animación suave y nativa del navegador
    window.requestAnimationFrame(step);
};


/**
 * Inicializa la funcionalidad de las estadísticas: 
 * 1. Animación al hacer scroll (Intersection Observer).
 * 2. Contador animado al entrar en vista.
 */
const initializeStats = () => {
    const statCards = document.querySelectorAll('.stat-card');

    // 1. Intersection Observer para detectar cuándo la sección es visible
    const observerOptions = {
        root: null, // Observa respecto a la ventana de visualización
        rootMargin: '0px',
        threshold: 0.3 // Se activa cuando el 30% del elemento es visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Si la sección está visible, añadimos la clase 'visible' para la animación CSS
                entry.target.querySelectorAll('.reveal-item').forEach(el => {
                    el.classList.add('visible');
                });

                // 2. Ejecutar el contador en cada tarjeta al entrar en vista
                const statCards = entry.target.querySelectorAll('.stat-card');
                statCards.forEach((card, index) => {
                    const targetElement = card.querySelector('.number');
                    const metricValue = parseFloat(card.dataset.metric);

                    // Pequeño retraso para que los contadores no salten todos a la vez
                    setTimeout(() => {
                        animateCounter(targetElement, metricValue);
                    }, index * 150); // Retraso de 150ms entre cada contador
                });

                // Detener la observación una vez activado para evitar re-ejecuciones innecesarias
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observar el contenedor principal de estadísticas
    const statsSection = document.getElementById('estadisticas-animadas');
    if (statsSection) {
        observer.observe(statsSection);
    }
};

initializeStats();
