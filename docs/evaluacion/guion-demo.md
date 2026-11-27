# Guion de demostración para la evaluación (HU-13)

**Historia de usuario:** HU-13
**Responsable:** Stephanie Hernández Prieto
**Revisión de avances:** viernes 20 de noviembre de 2026

> **Nota (27 de noviembre de 2026):** este archivo contenía una copia
> completa del plan de evaluación (`plan.md`). Se reemplazó por el
> guion de demostración que le correspondía: el plan completo, con
> sus 7 tareas, sus métricas y el cuestionario SUS, sigue en
> `plan.md`. El guion general del proyecto, de 10 minutos, está en
> `docs/guion-demo.md`.

## Para qué sirve este guion

En la evaluación no se demuestra la solución antes de cronometrar:
la moderadora lee cada tarea tal como está escrita en `plan.md` y
solo ayuda si la persona se detiene. Este guion cubre lo que pasa
**antes** de las tareas (presentación y consentimiento) y **después**
(cierre), y lo que se puede mostrar si la sesión lo pide, sin
contaminar las tareas.

## Antes de la sesión

- Abrir la misma versión de MolecuLab 3D para todos los participantes.
- Revisar previamente el sonido, los permisos y las funciones de la sesión.
- Tener a la mano el cronómetro, la hoja de registro y el cuestionario.
- Preparar los estados iniciales de cada tarea (ver `plan.md`).
- Tarjetas impresas a 8 × 8 cm si se va a mostrar la RA al final:
  llevar `ar/card.png` **y** `ar/marcador-moleculab.png`, porque el
  código carga `ar/card.mind` (`js/ra.js`) y el marcador definitivo
  está pendiente de prueba con el teléfono. Probar cuál reconoce la
  versión que se va a usar y anotarlo.

## Presentación (1 minuto)

Leer el consentimiento de `plan.md` antes de activar cámara o
micrófono, y registrar la aceptación:

> «Esta prueba es voluntaria. Estamos evaluando MolecuLab 3D. Durante
> algunas tareas puedes usar la cámara o el micrófono. Registraremos
> tiempos, resultados y comentarios con un código de participante.
> El equipo no guardará grabaciones de audio ni de video. Puedes pedir
> una pausa, omitir una actividad o terminar la sesión cuando quieras.
> ¿Aceptas participar y usar la cámara o el micrófono en las tareas
> que lo requieran?»

Después, sin demostrar ninguna solución:

> «Durante la prueba puedes decir en voz alta qué estás intentando
> hacer. Si algo te confunde, también nos sirve saberlo. No hay
> respuestas correctas o incorrectas para ti: estamos probando la
> aplicación, no a ti.»

## Tareas (6 minutos)

Leer cada tarea de `plan.md` (T1–T7) tal como está escrita, en orden,
y cronometrarla:

| ID  | Instrucción exacta                                                                       |
| --- | ---------------------------------------------------------------------------------------- |
| T1  | «Agrega un átomo de oxígeno usando el panel de átomos».                                  |
| T2  | «Mueve uno de los átomos y gira la vista para observar la molécula desde otro ángulo».   |
| T3  | «Une estos dos átomos de hidrógeno».                                                     |
| T4  | «Pregúntale por voz a MolecuLab qué es un protón».                                       |
| T5  | «Construye una molécula de agua con dos hidrógenos y un oxígeno».                        |
| T6  | «Usa el sistema para verificar que la molécula sea agua».                                |
| T7  | «Construye un átomo neutro de helio-4 con dos protones, dos neutrones y dos electrones». |

Reglas de moderación (detalle en `plan.md`):

- Iniciar el cronómetro cuando se termine de leer la instrucción;
  detenerlo al alcanzar el criterio de éxito, llegar al tiempo
  máximo o abandonar la tarea.
- Se puede repetir la instrucción tal como está escrita. Dar una
  pista sobre qué botón, gesto o comando usar cuenta como ayuda.
- Si la persona se detiene, preguntar «¿Qué intentarías ahora?».
  Al llegar al máximo, decir «Gracias, vamos a pasar a la siguiente
  actividad».
- Si T5 no se completa, preparar una molécula de agua antes de T6 y
  registrar esa preparación. Si el modo Bohr todavía no está
  disponible, registrar T7 como «No aplicada» (en la versión actual
  el modo Bohr sí está disponible en el panel **Átomos**).
- Registrar una fila por participante y tarea en `resultados.xlsx`:
  «Sin ayuda», «Con ayuda», «No completada» o «No aplicada».

## Qué se puede mostrar al final (opcional, fuera de tiempo)

Si queda tiempo y la persona lo pide, mostrar brevemente, sin
cronometrar: el modo reto (6 retos, 1 estrella por reto), la pizarra
de fórmulas (`C2H6O` ofrece etanol y dimetiléter) y la RA sobre la
tarjeta impresa. Esto **no** se registra como tarea.

## Cierre (3 minutos)

- Aplicar el SUS (10 ítems, escala de 1 a 5) y las tres preguntas
  abiertas de `plan.md`:
  1. ¿Qué te gustó de MolecuLab 3D?
  2. ¿Qué te confundió mientras lo usabas?
  3. ¿Qué cambiarías para que fuera más fácil de usar?
- «Gracias por participar. Tus comentarios nos ayudarán a mejorar
  MolecuLab 3D».

## Sesión piloto

Realizar una sesión con una compañera antes de invitar a los
participantes. Probar el consentimiento, leer las tareas, usar el
cronómetro y llenar el registro. Verificar si las instrucciones se
entienden, si los tiempos son realistas y si se pueden distinguir
los errores de los fallos de reconocimiento. Registrar la fecha, lo
observado y los ajustes acordados.

**Estado del piloto:** pendiente de realizar.
