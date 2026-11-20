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

| Evento                       | Datos                       |
| ---------------------------- | --------------------------- |
| escena:atomo-agregado        | {id, elemento}              |
| escena:atomo-movido          | {id, posicion}              |
| escena:atomo-eliminado       | {id, elemento}              |
| escena:atomo-seleccionado    | {id}                        |
| escena:enlace-creado         | {a, b, orden}               |
| escena:enlace-eliminado      | {a, b}                      |
| escena:enlace-rechazado      | {motivo}                    |
| escena:molecula-identificada | {nombre, formula, completa} |
| escena:escena-limpia         | —                           |

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
