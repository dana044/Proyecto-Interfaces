# Contrato de eventos

Coordenadas x, y: normalizadas de 0 a 1, con la cámara en espejo.

## Gestos (js/gestures.js)

La cámara y el detector viven en `js/gestures.js`, que publica
`estado:camara` y `estado:manos` y deja las manos del último cuadro en
`obtenerManos()` (21 puntos por mano, x, y, z normalizados de 0 a 1).

El cursor es un ratón virtual que vive en toda la ventana y sigue la
punta del índice. Las coordenadas (x, y) de los gestos son de la
ventana (0 a 1). El tablero o la interfaz se decide por lo que hay bajo
el cursor: sobre el tablero el índice selecciona átomos; sobre la
interfaz, el índice pulsa o toma un elemento de la paleta.

Gestos:
- Seleccionar: índice arriba (con los demás dedos plegados) inicia la
  selección. Emite `gesto:seleccionar-inicio`, `gesto:seleccionar-mover`
  y `gesto:seleccionar-fin`. Con el pulgar muy cerca del índice (pinza)
  o con la palma abierta no arranca. Si el índice baja 5 cuadros
  seguidos, termina.
- Mover: una mano en pinza arrastrando emite `gesto:mover` {dx, dy}.
  La vista va al lado contrario de la mano.
- Girar: índice, medio y anular estirados, con el meñique plegado, que se
  mueven emiten `gesto:rotar` {dx, dy}: la vista gira hacia donde se mueve la
  mano (derecha, izquierda, arriba o abajo). Si la mano se detiene, deja de
  girar. Para invertir el sentido, cambia `SENTIDO_GIRO` en `js/gestures.js`.
  Al detectar la pose, la consola muestra un mensaje.
- Acercar: dos pinzas (pulgar e índice juntos en cada mano) emiten
  `gesto:zoom` {factor}, entre 0.5× y 3×, según cambie la distancia entre
  las pinzas. Separarlas acerca; juntarlas aleja.
- Paleta: pulgar hacia un lado medio segundo emite `gesto:paleta`.
- Tomar y colocar: con el cursor sobre un botón de la paleta (o de un
  botón + de Bohr), el índice arriba toma el elemento. Se arrastra al
  tablero con el índice. Al abrir la mano, `gesto:soltar` {x, y,
  cancelado}: dentro del tablero se coloca; fuera se cancela. Si la mano
  se pierde con algo en la mano, se emite con `cancelado: true`.
- Eliminar: índice y medio levantados medio segundo, con el cursor sobre
  un átomo, emite `gesto:eliminar-pedido` {x, y}. atoms.js elimina solo ese
  átomo y emite `gesto:eliminar` {id}.
- Deshacer: pulgar tocando el dedo medio medio segundo emite `gesto:deshacer`.
- Rehacer: pulgar tocando el anular medio segundo emite `gesto:rehacer`.
  Cada uno se emite una vez hasta que se suelta la pose.
- Micrófono: meñique arriba un instante (0.8 s) emite `gesto:microfono`.
- Listo: pulgar arriba 1 s emite `gesto:listo` y confirma la molécula.

Los gestos con espera muestran un círculo de progreso mientras se
mantienen y se oculta en cuanto la pose se rompe. Si el índice está
arriba y la selección no arranca, se escribe en la consola el motivo
(`pinza` o `palma abierta`).

El tutorial inicial (`js/tutorial.js`) guía los 9 gestos en orden y pide
un átomo de ejemplo en un punto libre; emite `tutorial:atomo-ejemplo`
{mostrar} al abrirse y al cerrarse. La paleta emite `ui:paleta` {abierta}
al cambiar, y el elemento o partícula en la mano se muestra en el cursor
con `cursor:elemento` {simbolo, color}.

| Evento                  | Datos             |
| ----------------------- | ----------------- |
| gesto:seleccionar-inicio | {x, y}           |
| gesto:seleccionar-mover | {x, y}            |
| gesto:seleccionar-fin   | {x, y}            |
| gesto:mover             | {dx, dy}          |
| gesto:rotar             | {dx, dy}          |
| gesto:zoom              | {factor}          |
| gesto:paleta            | —                 |
| gesto:soltar            | {x, y, cancelado} |
| gesto:eliminar-pedido   | {x, y}            |
| gesto:eliminar          | {id}              |
| gesto:deshacer         | —                 |
| gesto:rehacer          | —                 |
| gesto:microfono         | —                 |
| gesto:listo             | —                 |
| ui:paleta               | {abierta}         |
| cursor:elemento         | {simbolo, color}  |
| tutorial:atomo-ejemplo  | {mostrar}         |

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