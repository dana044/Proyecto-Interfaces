# Guion de demostración de MolecuLab

Guion para presentar el proyecto en unos 10 minutos. No es el plan de
evaluación (ese está en `docs/evaluacion/plan.md`, con sus 7 tareas
cronometradas): esto es una demo guiada, en la que la persona que
presenta sí muestra cada función.

**Antes de empezar, leer la sección «Antes de la demo».** La RA depende
de la tarjeta impresa y de la cámara, y hay una discrepancia pendiente
entre el marcador que carga el código y el marcador definitivo de la
documentación (ver abajo).

## Antes de la demo (preparación)

- [ ] Abrir la versión publicada (https://dana044.github.io/Proyecto-Interfaces/)
      o la misma versión en local con `python -m http.server 8000`.
      No demostrar desde una rama distinta a la que se va a evaluar.
- [ ] Probar en Chrome: cámara, micrófono y sonido. Cerrar otras apps
      que usen la cámara.
- [ ] **Tarjetas impresas a 8 × 8 cm exactos, sin ajustar a la hoja:**
      imprimir `ar/card.png` **y** `ar/marcador-moleculab.png`, y probar
      cuál reconoce la versión publicada. El código todavía carga
      `ar/card.mind` (`RUTA_MARCADOR` en `js/ra.js`); la documentación
      dice que el definitivo es `ar/marcador-moleculab.mind`, pero esa
      tercera versión está pendiente de prueba con el teléfono y en las
      pruebas anteriores solo `card` se reconocía. Llevar las dos y usar
      la que funcione; no cambiar el código a última hora sin probarlo.
- [ ] Tener a mano un celular Android con Chrome para la página móvil
      (`ar-moleculas/ar.html`) o su código QR del panel de información
      (`ar/qr-moleculas.png`). El Quick Look de iPhone no se ha probado.
- [ ] Escena vacía al empezar. Tener preparada en la cabeza la
      molécula de agua (H₂O) y el reto 1 (hidrógeno, H₂).
- [ ] Buena luz sobre la tarjeta y fondo sin muchos contrastes detrás.

## Guion (10 minutos)

### 0:00–1:00 — Qué es MolecuLab

> «MolecuLab es una app web para estudiantes de secundaria que
> construyen moléculas en 3D. Se puede usar con el mouse, con gestos
> de la mano, por voz o escribiendo una fórmula, y después se ve la
> molécula en realidad aumentada. No tiene backend: es un sitio
> estático en GitHub Pages.»

Mostrar la pantalla principal: panel **Átomos** a la izquierda, escena
3D en el centro y panel de información a la derecha.

### 1:00–3:00 — Construir agua con el mouse

1. Agregar un oxígeno desde el panel **Átomos**.
2. Agregar dos hidrógenos y acercarlos al oxígeno hasta que se unan.
   Explicar en voz alta la regla: «solo se unen si los dos tienen
   valencia libre; el oxígeno tiene valencia 2 y cada hidrógeno 1».
3. Pulsar **Verificar molécula**: el sistema identifica el agua y
   muestra H₂O, su geometría angular (104.5°) y su dato curioso.
4. Si se intenta un enlace imposible (por ejemplo, un tercer enlace
   al oxígeno), mostrar que el sistema lo rechaza y explica el motivo.

### 3:00–4:30 — Gestos y voz

- Abrir el tutorial o hacer dos gestos en vivo: **seleccionar** con el
  índice arriba y **mover** con una pinza. Decir que el tutorial guía
  los 14 gestos en orden, en 3 minutos como máximo.
- Por voz (Chrome o Edge, micrófono activo): «agrega oxígeno» y
  «¿qué es un protón?». El sistema muestra y lee la definición del
  glosario. Si el reconocimiento de voz falla en la sala, no
  insistir: pasar al siguiente bloque y decirlo en voz alta
  («la voz depende del micrófono y del ruido de la sala»).

### 4:30–5:30 — Modelo de Bohr y modo reto

1. En el panel **Átomos**, sección **Modelo de Bohr**: agregar 2
   protones, 2 neutrones y 2 electrones. El sistema identifica helio
   (He, Z = 2).
2. Entrar al **Modo reto** (botón o gesto «I love you»): el reto 1 es
   construir hidrógeno (H₂). Mostrar la sugerencia del siguiente paso
   y la pista («Ver pista» o decir «ayuda»); tras 2 intentos fallidos
   la pista pasa a ser directa. Al completar un reto se gana 1
   estrella y se pasa al siguiente; son 6 retos en total.

### 5:30–6:30 — Pizarra de fórmulas

1. Botón **Pizarra** y escribir `C2H6O`. Mostrar que ofrece etanol
   (y dimetiléter, su isómero, con la misma fórmula) y agregarlo a
   la escena sin borrar lo construido.
2. Escribir una estructura con guiones, por ejemplo `CH3-CH2-OH`,
   y mostrar que la pizarra completa los hidrógenos que faltan para
   cumplir la valencia.

### 6:30–8:30 — Realidad aumentada en el editor

1. Con una estructura construida (por ejemplo, el agua), pulsar
   **Realidad aumentada**. La detección de manos se pausa mientras
   la RA está activa.
2. Apuntar la cámara a la tarjeta impresa (8 × 8 cm) y mostrar la
   molécula plana sobre la tarjeta. Cambiar de estructura en el
   selector si hay más de una, y usar **Centrar** si hace falta.
3. Mover un átomo en el editor y mostrar que la RA se actualiza
   en vivo, sin reconstruir toda la estructura.
4. Mostrar el selector de vista **Dividida / Solo editor / Solo RA**.

### 8:30–9:30 — Moléculas en AR en el celular

1. Escanear el QR del panel de información o abrir
   `ar-moleculas/ar.html` en el celular.
2. Elegir una molécula del selector (las 22 del catálogo) y tocar el
   botón de AR del visor: en Android se abre Scene Viewer y la
   molécula se coloca sobre la mesa. Mostrar el subtítulo con la
   composición («2 H (hidrógeno) y 1 O (oxígeno)») y las tarjetas de
   elementos, que solo se ven en la página, no dentro de AR.

### 9:30–10:00 — Cierre

> «El catálogo tiene 22 moléculas y 10 elementos, con enlaces simples
> y dobles. Lo que queda pendiente es probar el marcador definitivo de
> MolecuLab con el teléfono, probar el Quick Look en iPhone y
> contrastar los datos con el libro del curso. ¿Preguntas?»

Mostrar, si preguntan, dónde está cada cosa: `docs/quimica.md`
(catálogo), `docs/eventos.md` (contrato de eventos) y
`docs/evaluacion/realidad-aumentada.md` (decisiones y etapas de RA).

## Plan B (si algo falla en vivo)

| Falla                           | Qué hacer en la demo                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La RA no reconoce la tarjeta    | Medir la impresión (8 × 8 cm), mejorar la luz, probar con la otra tarjeta impresa (`card` o `marcador-moleculab`). Si ninguna funciona, seguir la demo en el editor y decir que el reconocimiento depende de la impresión, la luz y la cámara. |
| Cámara denegada o sin cámara    | La RA se apaga sola y muestra un aviso; seguir con el editor con mouse o teclado, que es la alternativa prevista.                                                                                                                              |
| La voz no entiende              | No insistir más de dos veces; hacer la misma acción con el botón y decir que depende del micrófono y del ruido.                                                                                                                                |
| Scene Viewer no abre en Android | Comprobar que la página esté en HTTPS y que `model-viewer` sea 4.4.0; mostrar la molécula en el visor 3D de la página en su lugar.                                                                                                             |
| No hay internet / CDN caído     | Three.js, MediaPipe, MindAR y `model-viewer` se cargan por CDN; sin internet la app no arranca. Tener preparadas las capturas de `docs/evaluacion/ra/` como respaldo.                                                                          |

## Material para la demo

- Laptop con Chrome, cámara y micrófono.
- Tarjetas `ar/card.png` y `ar/marcador-moleculab.png` impresas a
  8 × 8 cm.
- Celular Android con Chrome (para Scene Viewer) y, si hay, un iPhone
  (Quick Look sin probar: avisar antes de intentarlo).
- Este guion y, como respaldo, `docs/evaluacion/plan.md` si la demo se
  convierte en sesión de evaluación.
