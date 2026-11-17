# Contrato de eventos

Coordenadas x, y: normalizadas de 0 a 1, con la cámara en espejo.

## Gestos (js/gestures.js)

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
| escena:enlace-creado         | {a, b, orden}               |
| escena:enlace-rechazado      | {motivo}                    |
| escena:molecula-identificada | {nombre, formula, completa} |

## Interfaz y estado

| Evento           | Datos         |
| ---------------- | ------------- |
| ui:mensaje       | {tipo, texto} |
| estado:camara    | {estado}      |
| estado:microfono | {estado}      |
