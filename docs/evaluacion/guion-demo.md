# Plan de evaluación de MolecuLab 3D

**Historia de usuario:** HU-13  
**Responsable:** Stephanie Hernández Prieto  
**Revisión de avances:** viernes 20 de noviembre de 2026

## Objetivo

Evaluar si estudiantes que usan MolecuLab 3D por primera vez pueden realizar
las tareas principales, cuánto tardan, qué errores encuentran y cómo
perciben la facilidad de uso.

## Participantes

Participarán al menos 3 estudiantes de secundaria o bachillerato, o personas
de esa edad, que no hayan usado MolecuLab 3D. La meta es de 6 participantes,
dos por integrante del equipo. Se identificarán como P01, P02, P03, etc.

Antes de las sesiones se hará una prueba piloto con una compañera. La
sesión piloto se registrará por separado de las sesiones con participantes.

## Consentimiento

Leer antes de comenzar:

> Esta prueba es voluntaria. Estamos evaluando MolecuLab 3D. Durante
> algunas tareas puedes usar la cámara o el micrófono. Registraremos
> tiempos, resultados y comentarios con un código de participante.
> El equipo no guardará grabaciones de audio ni de video. Puedes pedir
> una pausa, omitir una actividad o terminar la sesión cuando quieras.
> ¿Aceptas participar y usar la cámara o el micrófono en las tareas
> que lo requieran?

Registrar la aceptación antes de activar cámara o micrófono. Si la persona
prefiere omitir alguna modalidad, usar una alternativa cuando mida el
mismo objetivo. Si la modalidad es indispensable, marcar la tarea como
«No aplicada» y anotar el motivo. Para participantes menores, seguir
el procedimiento de autorización que indique el curso.

## Preparación

- Abrir la misma versión de MolecuLab 3D para todos los participantes.
- Revisar previamente el sonido, los permisos y las funciones de la sesión.
- Tener a la mano el cronómetro, la hoja de registro y el cuestionario.
- Preparar los estados iniciales de cada tarea. Evitar demostrar la
  solución antes de cronometrar.

## Tareas de evaluación

| ID  | Preparación                                            | Instrucción exacta que leerá la moderadora                                               | Criterio de éxito                                                                                       | Tiempo máximo |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------: |
| T1  | Escena vacía.                                          | «Agrega un átomo de oxígeno usando el panel de átomos».                                  | Aparece una esfera identificada con el símbolo O.                                                       |          30 s |
| T2  | Preparar una molécula con un enlace visible.           | «Mueve uno de los átomos y gira la vista para observar la molécula desde otro ángulo».   | Cambia la posición de un átomo, el enlace sigue unido y la vista gira.                                  |          40 s |
| T3  | Preparar dos hidrógenos separados en la escena.        | «Une estos dos átomos de hidrógeno».                                                     | Aparece un enlace simple entre ambos.                                                                   |          40 s |
| T4  | Micrófono disponible.                                  | «Pregúntale por voz a MolecuLab qué es un protón».                                       | El sistema muestra y lee en voz alta la definición de protón.                                           |          30 s |
| T5  | Escena vacía.                                          | «Construye una molécula de agua con dos hidrógenos y un oxígeno».                        | Hay un oxígeno unido mediante un enlace simple a cada hidrógeno.                                        |          70 s |
| T6  | Usar el resultado de T5 si es correcto.                | «Usa el sistema para verificar que la molécula sea agua».                                | El sistema identifica la molécula como agua y muestra H₂O.                                              |          25 s |
| T7  | Modo Bohr disponible y contador de partículas en cero. | «Construye un átomo neutro de helio-4 con dos protones, dos neutrones y dos electrones». | El sistema identifica helio, He, Z = 2. Los contadores muestran 2 protones, 2 neutrones y 2 electrones. |          60 s |

Si T5 no se completa, preparar una molécula de agua antes de T6 y registrar
esa preparación. T6 evalúa el uso de la función de verificación. Si el
modo Bohr todavía no está disponible, registrar T7 como «No aplicada».

## Moderación y registro

- Iniciar el cronómetro cuando se termine de leer la instrucción.
- Detenerlo al alcanzar el criterio de éxito, llegar al tiempo máximo
  o abandonar la tarea.
- Se puede repetir la instrucción tal como está escrita. Dar una pista
  sobre qué botón, gesto o comando usar cuenta como ayuda.
- Registrar un error cuando una acción equivocada cause un resultado
  distinto del esperado. Registrar por separado los intentos de voz
  o gesto que el sistema no reconoce o no ejecuta.
- Registrar una fila por participante y tarea en `resultados.xlsx`.
  Usar «Sin ayuda», «Con ayuda», «No completada» o «No aplicada».

## Métricas

- **Eficacia:** tareas completadas sin ayuda ÷ tareas aplicadas × 100.
  Las tareas «Con ayuda» y «No completada» cuentan como aplicadas.
  Las tareas «No aplicada» se excluyen del cálculo.
- **Eficiencia:** tiempo en segundos por tarea, número de errores e
  intentos fallidos de voz o gesto. Al resumir tiempos, indicar si se
  incluyeron tareas que alcanzaron el tiempo máximo.
- **Satisfacción:** puntaje SUS de 0 a 100 por participante y respuestas
  a tres preguntas abiertas. El puntaje se reporta como puntos SUS.

## Cuestionario posterior

Aplicar los 10 ítems en el orden de la versión validada en español
del Sistema de Escalas de Usabilidad (SUS). Usar una escala de 1
(totalmente en desacuerdo) a 5 (totalmente de acuerdo).

Para calcular el puntaje, restar 1 a cada respuesta impar y restar
cada respuesta par de 5. Sumar los diez resultados y multiplicar
por 2.5. Calcular el puntaje cuando estén las diez respuestas.

1. ¿Qué te gustó de MolecuLab 3D?
2. ¿Qué te confundió mientras lo usabas?
3. ¿Qué cambiarías para que fuera más fácil de usar?

Fuente del cuestionario: Sevilla-González et al. (2020), versión
validada en español, Multimedia Appendix 2.
https://humanfactors.jmir.org/2020/4/e21161/

## Guion de la moderadora de 10 minutos

| Minuto     | Acción y guion                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–1:00  | Leer el consentimiento. «Durante la prueba puedes decir en voz alta qué estás intentando hacer. Si algo te confunde, también nos sirve saberlo».                              |
| 1:00–7:00  | Leer cada tarea y cronometrarla. Si la persona se detiene, preguntar «¿Qué intentarías ahora?». Al llegar al máximo, decir «Gracias, vamos a pasar a la siguiente actividad». |
| 7:00–9:00  | «Marca qué tanto estás de acuerdo con cada afirmación según tu experiencia de hoy». Aplicar el SUS.                                                                           |
| 9:00–10:00 | Hacer las tres preguntas abiertas. «Gracias por participar. Tus comentarios nos ayudarán a mejorar MolecuLab 3D».                                                             |

## Sesión piloto

Realizar una sesión con una compañera antes de invitar a los participantes.
Probar el consentimiento, leer las tareas, usar el cronómetro y llenar
el registro. Verificar si las instrucciones se entienden, si los tiempos
son realistas y si se pueden distinguir los errores de los fallos de
reconocimiento. Registrar la fecha, lo observado y los ajustes acordados.

**Estado del piloto:** pendiente de realizar.
