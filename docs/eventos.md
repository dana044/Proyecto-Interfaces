# Contrato de eventos

Coordenadas x, y: normalizadas de 0 a 1, con la cámara en espejo.

## Gestos (js/gestures.js)

La detección de manos es HU-09: la cámara y el detector viven en
`js/gestures.js`, que publica `estado:camara` y `estado:manos` y deja las
manos del último cuadro en `obtenerManos()` (21 puntos por mano, x, y, z
normalizados de 0 a 1). Los eventos `gesto:*` se emiten en HU-14
(pellizco) y HU-21 (rotar, zoom y listo), no en HU-09.

| Evento                | Datos    |
| --------------------- | -------- |
| gesto:pellizco-inicio | {x, y}   |
| gesto:pellizco-mover  | {x, y}   |
| gesto:pellizco-fin    | {x, y}   |
| gesto:rotar           | {dx, dy} |
| gesto:zoom            | {factor} |
| gesto:listo           | —        |

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

`estado:camara` es `activa`, `denegada` o `sin-dispositivo` (HU-09).
`estado:manos` es el número de manos visibles en el último cuadro
(0 cuando se pierde la mano).
