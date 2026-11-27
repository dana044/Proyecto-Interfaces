# Contrato de eventos

Coordenadas x, y: normalizadas de 0 a 1, con la cámara en espejo.

> **Nota (27 de noviembre de 2026):** este archivo estaba desactualizado:
> solo listaba el pellizco, rotar, zoom y listo. Se actualizó para
> alinearlo con el contrato vigente en `docs/eventos.md`, que es el
> documento canónico. Si hay una diferencia entre ambos, vale
> `docs/eventos.md` y hay que corregir este archivo.

## Gestos (js/gestures.js)

La detección de manos es HU-09: la cámara y el detector viven en
`js/gestures.js`, que publica `estado:camara` y `estado:manos` y deja las
manos del último cuadro en `obtenerManos()` (21 puntos por mano, x, y, z
normalizados de 0 a 1). El cursor sigue la punta del índice con una
ganancia de 2.0 alrededor del centro (`GANANCIA_CURSOR`) y suavizado
0.5. Las coordenadas (x, y) de los gestos son de la ventana (0 a 1).
Sobre el tablero el índice selecciona átomos; sobre la interfaz, pulsa
o toma un elemento de la paleta.

Los eventos `gesto:*` se emiten en HU-14 (pellizco) y HU-21 (rotar,
zoom y listo), no en HU-09; el resto de gestos se añadió después, por
eso la versión anterior de este archivo no los tenía.

Gestos:

- Seleccionar: índice arriba (con los demás dedos plegados). Emite
  `gesto:seleccionar-inicio`, `gesto:seleccionar-mover` y
  `gesto:seleccionar-fin`. Con la pinza o la palma abierta no arranca.
- Mover: una mano en pinza arrastrando emite `gesto:mover` {dx, dy}. La vista
  va al lado contrario de la mano; `SENSIBILIDAD_MOVER` (2.0) amplifica el movimiento.
- Girar: índice, medio y anular estirados, con el meñique plegado, que se
  mueven emiten `gesto:rotar` {dx, dy} a `VELOCIDAD_GIRO` (0.03).
- Acercar: dos pinzas emiten `gesto:zoom` {factor}, de 0.5× a 3×.
- Paleta: pulgar hacia un lado medio segundo emite `gesto:paleta`.
- Tomar y colocar: índice arriba sobre un botón de la paleta toma el
  elemento; al abrir la mano, `gesto:soltar` {x, y, cancelado}.
- Eliminar: índice y medio levantados medio segundo emite
  `gesto:eliminar-pedido` {x, y}; atoms.js elimina ese átomo y emite
  `gesto:eliminar` {id}.
- Deshacer: llamada (🤙) con la mano derecha, meñique hacia la izquierda, medio
  segundo, emite `gesto:deshacer`.
- Rehacer: llamada con la mano izquierda, meñique hacia la derecha, medio
  segundo, emite `gesto:rehacer`.
- Reto: «I love you» (pulgar, índice y meñique estirados; medio y anular
  plegados) medio segundo emite `gesto:reto`. `ui.js` entra al modo reto o
  sale de él, igual que el botón.
- Limpiar: índice, medio, anular y meñique estirados con el pulgar dentro de
  la palma, un segundo, emite `gesto:limpiar`; `atoms.js` borra átomos,
  enlaces y partículas, salvo que se lleve algo en la mano.
- Micrófono: meñique arriba 0.8 s emite `gesto:microfono`.
- Listo: puño con pulgar arriba (👍) un segundo emite `gesto:listo`.
- Realidad aumentada: pulgar abajo (👎) medio segundo emite `gesto:ra`.

Los gestos con espera muestran un círculo de progreso que se oculta en
cuanto la pose se rompe.

El tutorial (`js/tutorial.js`) guía los gestos en orden (14 pasos, 3
minutos como máximo, una sola vez por sesión) y pide un átomo de
ejemplo; emite `tutorial:atomo-ejemplo` {mostrar} al abrirse y al
cerrarse, y `tutorial:terminado` {completo} al cerrarse. La paleta
emite `ui:paleta` {abierta}, y el elemento en la mano se muestra en el
cursor con `cursor:elemento` {simbolo, color}.

| Evento                   | Datos             |
| ------------------------ | ----------------- |
| gesto:seleccionar-inicio | {x, y}            |
| gesto:seleccionar-mover  | {x, y}            |
| gesto:seleccionar-fin    | {x, y}            |
| gesto:mover              | {dx, dy}          |
| gesto:rotar              | {dx, dy}          |
| gesto:zoom               | {factor}          |
| gesto:paleta             | —                 |
| gesto:soltar             | {x, y, cancelado} |
| gesto:eliminar-pedido    | {x, y}            |
| gesto:eliminar           | {id}              |
| gesto:deshacer           | —                 |
| gesto:rehacer            | —                 |
| gesto:reto               | —                 |
| gesto:limpiar            | —                 |
| gesto:microfono          | —                 |
| gesto:listo              | —                 |
| gesto:ra                 | —                 |
| ui:paleta                | {abierta}         |
| cursor:elemento          | {simbolo, color}  |
| tutorial:atomo-ejemplo   | {mostrar}         |
| tutorial:terminado       | {completo}        |

## Voz (js/voice.js y js/commands.js)

| Evento                 | Datos                   |
| ---------------------- | ----------------------- |
| voz:texto              | {texto}                 |
| voz:comando            | {intencion, parametros} |
| voz:consultar-molecula | — («¿qué es esto?»)     |
| voz:respuesta          | {texto, tipo}           |
| voz:hablar             | {texto}                 |

Intenciones que llegan como `voz:comando`: agregar-atomo,
quitar-atomo, agregar-particula, quitar-particula, unir-atomo,
crear-molecula (las 22 del catálogo), deshacer, rehacer, limpiar,
verificar, rotar, acercar, alejar, vista-inicial, modo-reto,
modo-libre, ayuda, panel-atomos, panel-info, microfono, exportar,
importar, abrir-pizarra, silenciar-tonos, modo-oscuro y modo-claro.
Las preguntas al glosario («¿qué es un protón?», «define valencia»)
se responden directamente desde `js/glosario.js` (16 términos) y no
llegan como `voz:comando`. La voz solo funciona en Chrome o Edge.

## Escena (js/atoms.js, js/chemistry.js, js/molecules.js)

| Evento                        | Datos                                                            |
| ----------------------------- | ---------------------------------------------------------------- |
| escena:atomo-agregado         | {id, elemento}                                                   |
| escena:atomo-movido           | {id, posicion}                                                   |
| escena:atomo-desplazado       | {id, posicion} (en cada cuadro del arrastre con mouse o teclado) |
| escena:atomo-eliminado        | {id, elemento}                                                   |
| escena:atomo-seleccionado     | {id}                                                             |
| escena:enlace-creado          | {a, b, orden}                                                    |
| escena:electrones-compartidos | {a, b, pares, elementoA, elementoB}                              |
| escena:enlace-eliminado       | {a, b}                                                           |
| escena:enlace-rechazado       | {motivo}                                                         |
| escena:particula-agregada     | {id, tipo, capa}                                                 |
| escena:particula-quitada      | {id, tipo}                                                       |
| escena:particulas-cambiadas   | {protones, neutrones, electrones, total}                         |
| escena:molecula-identificada  | {nombre, formula, completa}                                      |
| escena:escena-limpia          | —                                                                |
| escena:reconstruir            | — (al restaurar una foto: deshacer, rehacer, importar)           |

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
reto, la pista del reto) llegan por `voz:comando`. Los retos son las
6 primeras moléculas del catálogo (H₂, O₂, H₂O, CO₂, CH₄, NH₃), con
1 estrella por reto y pista directa tras 2 intentos fallidos.

## Interfaz y estado

| Evento           | Datos         |
| ---------------- | ------------- |
| ui:mensaje       | {tipo, texto} |
| estado:camara    | {estado}      |
| estado:manos     | {cantidad}    |
| estado:microfono | {estado}      |

`estado:camara` es `activa`, `denegada` o `sin-dispositivo` (HU-09).
`estado:manos` es el número de manos visibles en el último cuadro
(0 cuando se pierde la mano).
