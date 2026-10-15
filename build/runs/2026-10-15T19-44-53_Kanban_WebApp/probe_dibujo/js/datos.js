// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "pendiente",
      "titulo": "Pendiente",
      "tarjetas": [
        {
          "id": 101,
          "titulo": "Configurar base de datos",
          "descripcion": "Definir la estructura inicial del estado y las columnas.",
          "contenido_adicional": null,
          "labels": [
            {
              "nombre": "Backend",
              "color": "#ff6347"
            }
          ],
          "comentarios": [
            {
              "autor": "Admin",
              "contenido": "Recordar validar el contrato antes de escribir código.",
              "timestamp": 1678886400
            },
            {
              "autor": "Usuario A",
              "contenido": "Necesitamos que este paso quede documentado en la wiki.",
              "timestamp": 1678972800
            }
          ]
        },
        {
          "id": 102,
          "titulo": "Diseño UI Oscuro",
          "descripcion": null,
          "contenido_adicional": "Usar paleta de colores oscura e industrial.",
          "labels": [],
          "comentarios": []
        }
      ]
    },
    {
      "id": "en_curso",
      "titulo": "En Curso",
      "tarjetas": [
        {
          "id": 201,
          "titulo": "Implementar lógica de movimiento",
          "descripcion": "Mover tarjetas entre columnas usando la función App.moverTarjeta.",
          "contenido_adicional": null,
          "labels": [],
          "comentarios": []
        }
      ]
    },
    {
      "id": "completado",
      "titulo": "Completado",
      "tarjetas": [
        {
          "id": 301,
          "titulo": "Definir contrato inicial",
          "descripcion": "Contrato JSON completado y validado.",
          "contenido_adicional": null,
          "labels": [
            {
              "nombre": "Diseño",
              "color": "#4682b4"
            }
          ],
          "comentarios": []
        }
      ]
    }
  ]
};
