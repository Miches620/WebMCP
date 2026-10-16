// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "pendiente",
      "title": "Pendiente",
      "counter": 2,
      "tarjetas": [
        {
          "id": "t1",
          "titulo": "Diseñar wireframes iniciales",
          "descripcion": "Crear bocetos de la interfaz principal.",
          "prioridad": "alta"
        },
        {
          "id": "t2",
          "titulo": "Revisión de requisitos del cliente",
          "descripcion": "Confirmar alcance y funcionalidades clave.",
          "prioridad": "media"
        }
      ]
    },
    {
      "id": "en_curso",
      "title": "En Curso",
      "counter": 1,
      "tarjetas": [
        {
          "id": "t3",
          "titulo": "Implementar estructura base",
          "descripcion": "Configurar el esqueleto HTML y CSS.",
          "prioridad": "alta"
        }
      ]
    },
    {
      "id": "completa",
      "title": "Completa",
      "counter": 1,
      "tarjetas": [
        {
          "id": "t4",
          "titulo": "Pruebas de usabilidad iniciales",
          "descripcion": "Recoger feedback de usuarios beta.",
          "prioridad": "baja"
        }
      ]
    }
  ],
  "columnaActivaId": "pendiente"
};
