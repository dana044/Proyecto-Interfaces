# Contrato de eventos

Coordenadas x, y: normalizadas de 0 a 1, con la cámara en espejo.

## Gestos (js/gestures.js)

La cámara y el detector viven en `js/gestures.js`, que publica
`estado:camara` y `estado:manos` y deja las manos del último cuadro en
`obtenerManos()` (21 puntos por mano, x, y, z normalizados de 0 a 1).

El cursor es un ratón virtual que vive en toda la ventana y sigue
la punta del índice; la palma abierta solo lo mueve. Las coordenadas
(x, y) de los gestos son de la ventana (0 a 1), y el arrastre las
convierte a coordenadas del tablero.

Gestos:
- Agarrar: índice arriba toma el átomo y al bajar el índice 3 cuadros
seguidos lo suelta. 
- Mover: una mano en pinza arrastrando emite
`gesto:mover` con el desplazamiento; no mueve la vista mientras se
agarra. 
- Girar: dos manos en pinza que giran alrededor del centro
entre ellas emiten `gesto:rotar` con el cambio de ángulo (dx es la
fracción de vuelta, 0.5 = media); al soltar una pinza termina.
- Acercar: dos manos en marco (pulgar e índice estirados y abiertos entre sí) emiten `gesto:zoom` con el factor de cambio desde que se
formó el marco, entre 0.5× y 3×. El pellizco se mide como la
distancia pulgar-índice en fracción del ancho del video (0.05 para agarrar, 0.08 para soltar) y el tutorial lo calibra por persona.
- Paleta: pulgar hacia un lado medio segundo emite `gesto:paleta` y abre o cierra la paleta de moléculas. 
- Micrófono: meñique arriba un instante emite `gesto:microfono` y enciende o apaga el micrófono.
- Tablero: puño cerrado medio segundo emite `gesto:canvas` {dentro} y entra o sale del tablero. Dentro del tablero el índice agarra átomos o coloca el elemento en la mano; fuera, el índice pulsa la interfaz y un botón de la paleta toma el elemento en la mano para colocarlo con el índice. 
- Listo: pulgar arriba 1 s emite `gesto:listo`. Los
gestos con espera muestran un círculo de progreso mientras se
mantienen y solo se emiten una vez hasta que la pose se rompe.

El tutorial inicial (`js/tutorial.js`) guía los 9 gestos en orden,
calibra el pellizco y pide un átomo de ejemplo si la escena está
vacía; emite `tutorial:atomo-ejemplo` {mostrar} al abrirse y al
cerrarse. La paleta emite `ui:paleta` {abierta} al cambiar, y el
elemento en la mano se muestra en el cursor con `cursor:elemento`
{simbolo, color}.

| Evento                | Datos         |
| --------------------- | ------------- |
| gesto:pellizco-inicio | {x, y}        |
| gesto:pellizco-mover  | {x, y}        |
| gesto:pellizco-fin    | {x, y}        |
| gesto:mover           | {dx, dy}      |
| gesto:rotar           | {dx, dy}      |
| gesto:zoom            | {factor}      |
| gesto:paleta          | —             |
| gesto:microfono       | —             |
| gesto:canvas          | {dentro}      |
| gesto:listo           | —             |
| ui:paleta             | {abierta}     |
| cursor:elemento       | {simbolo, color} |
| tutorial:atomo-ejemplo | {mostrar}    |

## Voz (js/voice.js y js/commands.js)

| Evento      | Datos                   |
| ----------- | ----------------------- |
| voz:texto   | {texto}                 |
| voz:comando | {intencion, parametros} |

Intenciones acordadas: agregar-atomo, deshacer, rehacer, limpiar, rotar, acercar, alejar, verificar, ayuda, que-es-esto, definir, modo-reto, modo-libre.

## Escena (js/atoms.js, js/chemistry.js, js/molecules.js)

| Evento                       | Datos                                    |
| ---------------------------- | ---------------------------------------- |
| escena:atomo-agregado        | {id, elemento}                           |
| escena:atomo-movido          | {id, posicion}                           |
| escena:atomo-eliminado       | {id, elemento}                           |
| escena:atomo-seleccionado    | {id}                                     |
| escena:enlace-creado         | {a, b, orden}                            |
| escena:electrones-compartidos | {a, b, pares, elementoA, elementoB}      |
| escena:enlace-eliminado      | {a, b}                                   |
| escena:enlace-rechazado      | {motivo}                                 |
| escena:particula-agregada    | {id, tipo, capa}                         |
| escena:particula-quitada     | {id, tipo}                               |
| escena:particulas-cambiadas  | {protones, neutrones, electrones, total} |
| escena:molecula-identificada | {nombre, formula, completa}              |
| escena:escena-limpia         | —                                        |

Una verificación fallida (molécula incompleta, desconocida o
imposible) también emite `escena:molecula-identificada`, con
`completa: false`; en los dos últimos casos sin nombre ni fórmula,
para que el modo reto cuente el intento fallido.

## Reto (js/reto.js)

| Evento           | Datos                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| reto:actualizado | {activo, indice, total, titulo, nombre, formula, sugerencia, estrellas, intentos, tiempoMs, terminado} |

`reto:actualizado` se emite al entrar o salir del modo reto, al
verificar, al avanzar de reto y al cambiar la escena en modo reto,
para que la interfaz muestre el reto actual y su progreso. Las
intenciones de voz `modo-reto`, `modo-libre` y `ayuda` (en modo
reto, la pista del reto) llegan por `voz:comando`.

## Interfaz y estado

| Evento           | Datos         |
| ---------------- | ------------- |
| ui:mensaje       | {tipo, texto} |
| estado:camara    | {estado}      |
| estado:manos     | {cantidad}    |
| estado:microfono | {estado}      |

`estado:camara` es `activa`, `denegada` o `sin-dispositivo`.
`estado:manos` es el número de manos visibles en el último cuadro
(0 cuando se pierde la mano).
