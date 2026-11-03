// sin lógica: solo se puede hacer clic
document.querySelectorAll('td').forEach((td) => td.addEventListener('click', () => td.focus()));
