# Pruebas de integración antes de la evaluación

Pruebas que hay que pasar **antes** de invitar a participantes de la
evaluación (HU-13). La lista completa de pruebas, con los pasos y el
resultado esperado de cada una, está en
`docs/pruebas-integracion.md`; este archivo es el checklist mínimo
para la evaluación, con lo que bloquea una sesión y lo que no.

**Cómo usarlo:** recorrerlo en orden con la misma versión que se va
a usar en las sesiones. Anotar fecha, commit, navegador y dispositivo.
Un fallo en la sección 1 bloquea las sesiones hasta corregirlo; un
fallo en la sección 2 se registra y se decide si esa tarea se marca
como «No aplicada» o se usa una alternativa que mida lo mismo.

## 1. Bloqueante: lo que usan las tareas T1–T7

Las tareas del plan (`docs/evaluacion/plan.md`) dependen de esto:

| #   | Prueba                                                 | Resultado esperado                                                                 | Tareas que dependen               |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------- |
| 1.1 | Abrir la app en Chrome (misma versión para todos)      | Carga la escena 3D, el panel de átomos con los 10 elementos y la barra de respaldo | Todas                             |
| 1.2 | Agregar un oxígeno desde el panel de átomos            | Aparece una esfera con el símbolo O                                                | T1                                |
| 1.3 | Mover un átomo y girar la vista                        | Cambia la posición, el enlace sigue unido y la vista gira                          | T2                                |
| 1.4 | Unir dos hidrógenos por cercanía                       | Aparece un enlace simple entre ambos                                               | T3                                |
| 1.5 | Voz: «¿qué es un protón?»                              | El sistema muestra y lee en voz alta la definición de protón                       | T4                                |
| 1.6 | Construir agua (2 H + 1 O) y verificar                 | El sistema identifica el agua y muestra H₂O                                        | T5, T6                            |
| 1.7 | Modelo de Bohr: 2 protones, 2 neutrones y 2 electrones | El sistema identifica helio, He, Z = 2; los contadores muestran 2/2/2              | T7                                |
| 1.8 | Deshacer y rehacer                                     | La escena vuelve al estado anterior y luego al posterior                           | Todas (si la persona se equivoca) |

## 2. No bloqueante: funciones que se muestran al final

| #   | Prueba                                            | Resultado esperado                                                           |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2.1 | Modo reto: entrar y construir H₂                  | Se gana 1 estrella y se pasa al reto 2                                       |
| 2.2 | Pizarra: escribir `C2H6O`                         | Ofrece etanol y dimetiléter                                                  |
| 2.3 | Exportar e importar una escena                    | La escena importada queda igual que la exportada                             |
| 2.4 | RA en el editor con la tarjeta impresa a 8 × 8 cm | La molécula aparece plana sobre la tarjeta y se actualiza en vivo            |
| 2.5 | Página móvil `ar-moleculas/ar.html` en Android    | El selector muestra las 22 moléculas y Scene Viewer abre la molécula elegida |

⚠️ **RA y marcador:** el código carga `ar/card.mind` (`js/ra.js`)
y la documentación dice que el definitivo es
`ar/marcador-moleculab.mind`, pendiente de prueba con el teléfono.
Probar con ambas tarjetas y anotar cuál reconoce la versión usada.
Si ninguna funciona, la RA no se muestra en la sesión y se registra
como «No aplicada» con el motivo.

## 3. Comprobaciones automáticas de RA (reportadas)

Según `docs/evaluacion/realidad-aumentada.md`, sección 5:

| Etapa                                    | Comprobaciones | Resultado reportado |
| ---------------------------------------- | -------------- | ------------------- |
| 2 — Modo RA dentro de MolecuLab          | 38             | Pasan               |
| 3 — Estructura viva                      | 19             | Pasan               |
| 4 — Selección de estructuras (corregida) | 24             | Pasan               |

Son comprobaciones con dobles de MindAR, Three.js, la cámara y el
editor en un DOM simulado (jsdom) y no reemplazan la prueba con
cámara real. **Estado al revisar el 27 de noviembre de 2026:** en el
repositorio no hay una carpeta de tests ni un script que las ejecute,
así que no se pudieron volver a correr en esta revisión; hay que
localizar el procedimiento con el que se ejecutaron y documentarlo
en `docs/pruebas-integracion.md`.

## 4. Qué registrar

- Fecha, commit, URL o puerto local, navegador y versión, dispositivo.
- Tarjeta usada en RA (`card` o `marcador-moleculab`) y tamaño real
  de impresión.
- Resultado por prueba: Pasa / Falla / No aplicada, y el error exacto
  si falló.
- Si un fallo obliga a marcar una tarea como «No aplicada», anotar
  el motivo en `resultados.xlsx` y en el plan, para que no se cuente
  en la eficacia.
