# Realidad aumentada en MolecuLab: propuesta, decisiones y avances

Documento de seguimiento del módulo de realidad aumentada (RA). Resume la propuesta acordada, las decisiones tomadas, los cambios de cada etapa y lo que queda pendiente. Para el funcionamiento técnico, ver `como-funciona-ra.md`.

Última actualización: 22 de noviembre de 2026.

---

## 1. Propuesta original

La propuesta busca que MolecuLab muestre las moléculas construidas en el editor sobre una tarjeta impresa, usando la cámara del equipo y la biblioteca MindAR (reconocimiento de imágenes) con Three.js.

Puntos principales de la propuesta:

1. **RA integrada en MolecuLab**, como un modo del editor, no como una aplicación aparte.
2. **Vista dividida** por defecto: editor a la izquierda, RA a la derecha. Se puede cambiar a solo editor o solo RA.
3. **Marcador propio** de 8 × 8 cm, compilado en formato `.mind`.
4. **Actualización incremental**: al mover un átomo solo se actualiza su representación y sus enlaces.
5. **Pausa de la detección de manos** mientras la RA está activa, porque MindAR y MediaPipe no pueden usar la cámara al mismo tiempo.
6. **Android con Scene Viewer** como segunda fase, con un catálogo de archivos GLB.
7. **Gestos en RA** como trabajo posterior.

Las etapas previstas fueron:

| Etapa | Contenido                                                                                |
| ----- | ---------------------------------------------------------------------------------------- |
| 0     | Preparación de la arquitectura (extraer geometría a `modelos.js`, eventos nuevos).       |
| 1     | Investigación y prototipo aislado: Scene Viewer, marcador y compatibilidad MindAR–Three. |
| 2     | Modo RA dentro de MolecuLab: botón, vistas, pausa de manos y molécula de prueba.         |
| 3     | Estructura viva: mapa de objetos y actualización incremental.                            |
| 4     | Selección de estructuras a visualizar.                                                   |
| 5     | Etiquetas de los átomos en RA.                                                           |
| 6     | Página móvil (Android y iPhone) con model-viewer y catálogo de modelos.                  |
| 7     | Gestos en RA y estructuras personalizadas en Android (posterior).                        |

---

## 2. Decisiones tomadas

### Marcador

- **Marcador universal de 8 × 8 cm**, único para todas las moléculas (catálogo y construcciones del estudiante).
- **Marcador definitivo: `ar/marcador-moleculab.mind`**, compilado con MindAR 1.2.5 a partir de `ar/marcador-moleculab.png`. Se imprime a 8 × 8 cm exactos.
- **Paleta del marcador: azul `#0094C6`, amarillo `#F8E85E` y negro `#1A1919`**, los colores de `card.png`, que es el marcador que sí se reconoce con la cámara del teléfono. La paleta morada del proyecto se usa en la interfaz web, pero no en el marcador: en la cámara del teléfono el morado se veía azul y el reconocimiento empeoraba.
- **Historial de diseños del marcador:** tres versiones. La primera tenía trazos finos y puntos diminutos, y no se reconocía. La segunda tenía alto contraste en morado, amarillo y negro, y tampoco se reconoció. La tercera usa la paleta de `card.png`.
- **Escala fija:** 1 unidad = ancho de la tarjeta; la estructura usa una escala de 0.3.
- **Orientación:** las estructuras se giran 90° sobre el eje X para quedar **planas sobre la tarjeta**, como en el tablero del editor.

### Interfaz

- **Vista dividida** por defecto, con selector «Dividida / Solo editor / Solo RA» en el encabezado (visible solo con la RA activa).
- El **botón «Realidad aumentada»** está en la barra de respaldo, junto a «Pizarra».
- La **cámara flotante de manos** se oculta mientras la RA está activa.
- El **mensaje de escena vacía** aparece sobre la tarjeta.
- El **panel de información** incluye un bloque «Moléculas en AR» con un código QR que abre la página móvil.

### Cámara y recursos

- La RA **reutiliza la cámara** solo mientras está activa: al entrar se pausa la detección de manos y al salir se liberan las pistas de la cámara y se reanudan las manos.
- Si se **niega la cámara**, la RA se apaga sola y aparece un aviso con la alternativa (editor con mouse o teclado).
- MindAR se **importa al encender la RA**, no al cargar la página.

### Datos y editor

- **No se modifica el editor.** La RA lee la estructura con `obtenerListaAtomos()` y `obtenerListaEnlaces()`, y escucha los eventos existentes del bus.
- **No se añaden eventos nuevos** al contrato, salvo `escena:atomo-desplazado` y `escena:reconstruir`, añadidos en la Etapa 0.

### Estructuras (Etapa 4 corregida)

- Una **estructura** es un grupo de átomos unidos por enlaces (incluye átomos sueltos y estructuras incompletas).
- Se detectan con **búsqueda de componentes conexos** sobre los ids y los enlaces que ya expone el editor.
- La **selección sigue al átomo ancla**: si se unen estructuras, se conserva la que contiene el ancla; si se separan, la que lo contiene; si el ancla se elimina, se elige la más grande.
- Si hay **una sola estructura**, se selecciona automáticamente.
- Cada estructura se **centra en el origen** al seleccionarla, al cambiar su composición y con el botón «Centrar». Mover átomos no la recentra.
- El **nombre** de cada estructura es su **fórmula por conteo** (sin comparar con el catálogo), con el orden de Hill, por ejemplo `CH₄ · 5 átomos`.
- El **catálogo** (`data/moleculas.json`) se conserva para el editor, la verificación y el modo reto, pero **no se usa en la RA**.

### Colores

- **Se mantienen los colores por grupo de `elementos.js`** en el editor, la RA y los modelos. Son los colores del proyecto. Como H, C, N y O comparten el mismo azul, la letra es lo que distingue cada átomo.
- La Guía visual propone colores estándar, pero no se adoptan.

### Página móvil (Etapa 6)

- **Android:** Scene Viewer, con `model-viewer` 4.4.0.
- **iPhone:** AR Quick Look, con archivos USDZ generados desde el mismo modelo.
- Las dos plataformas usan **una misma página**, con un selector de las 22 moléculas.

### Otras decisiones

- El **modelo de Bohr** no se muestra en RA.
- Los **ids de átomos** son fiables dentro de una sesión: `elemento + número`, sin reutilizarse, y la importación valida que no se repitan.

---

## 3. Avances por etapa

### Etapa 0 — Preparación de la arquitectura · **Cerrada**

- Geometría de átomos y enlaces extraída a `js/modelos.js`.
- Eventos `escena:atomo-desplazado` (en cada cuadro del arrastre) y `escena:reconstruir` (deshacer, rehacer, importar).
- Verificado por el equipo.

### Etapa 1 — Investigación y prototipo · **Cerrada**

- Prototipo en `pruebas/ar-prototipo.html` con MindAR 1.2.5 y Three.js 0.183.2 (compatibles).
- Verificación de compatibilidad MindAR–Three.
- **Web Share:** disponible en Chrome de Windows (`navigator.share` y `canShare` con archivos devuelven `true`).
- **Scene Viewer:** `agua.glb` abre en AR desde la página publicada en GitHub Pages, en un Samsung Galaxy S20 FE (Android 13) y en un X7 Pro (Android 16), con Chrome 157.
- **Versión que funciona:** `model-viewer` 4.4.0 desde Google APIs, con el atributo `ar`. El archivo `pruebas/scene-viewer.html` conserva esa versión.
- **Lo que no funcionó:** `model-viewer` 3.5.0 (el modelo cargaba, pero no se abría Scene Viewer) y los enlaces `intent://` (Chrome bloqueaba la navegación con `about:blank#blocked`). Las páginas que fallaron tenían `ar-modes="scene-viewer"`, que tampoco se necesita.
- **Diagnóstico:** el archivo `agua.glb` era válido desde el inicio (validador de Khronos sin errores, 118 KB, `model/gltf-binary` desde GitHub Pages). El fallo estaba en la versión de la biblioteca y en el método de lanzamiento, no en el modelo.
- Control de la prueba: el astronauta de `modelviewer.dev` abrió AR en ambos teléfonos y sirvió de referencia.

### Etapa 2 — Modo RA dentro de MolecuLab · **Cerrada**

Archivos: `js/ra.js` (nuevo), `index.html`, `css/styles.css`, `css/responsive.css`, `js/main.js`.

- Botón de RA, selector de vistas, contenedor `#lienzo-ra` y clase `modo-ra`.
- Pausa de manos al encender y reanudación al apagar.
- Verificado en Chrome por el equipo: el marcador se reconoce.

**Problemas encontrados y resueltos durante la etapa:**

| Problema                    | Causa                                                                                            | Solución                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| El marcador no se reconocía | La entrada de MindAR tenía 640 × 480 fijos, distinta de la resolución real de la cámara          | Usar `videoWidth` y `videoHeight` reales                                 |
| El cuadro salía recortado   | Los atributos `width` y `height` del video no se fijaban; MindAR dibuja el cuadro con ese tamaño | Fijar los atributos a la resolución nativa, igual que el ejemplo oficial |
| Firefox no funcionaba       | Problemas del navegador con MediaPipe y MindAR                                                   | Usar Chrome (navegador de pruebas del proyecto)                          |

### Etapa 3 — Estructura viva · **Cerrada**

Archivo: `js/ra.js`.

- La RA muestra la molécula del editor, actualizada en vivo.
- **Actualización incremental:** mover un átomo solo cambia su representación y sus enlaces.
- **Reconstrucción completa** solo al limpiar, importar, deshacer o rehacer.
- Anillos de valencia calculados con `chemistry.js`, igual que en el editor.
- Pruebas automáticas: 19 comprobaciones pasaron.

### Etapa 4 — Selección de estructuras · **Cerrada**

Archivos: `js/ra.js`, `index.html`, `css/styles.css`.

Hubo una versión intermedia con selector de catálogo. Se reemplazó por la versión final, que se describe aquí.

- Selector de estructuras con fórmula por conteo y número de átomos.
- Detección de grupos conectados, selección por átomo ancla y reglas de unión, separación y eliminación.
- Centrado de la estructura elegida, con botón «Centrar».
- Mensaje de escena vacía y selección automática con una sola estructura.
- Pruebas automáticas: 24 comprobaciones pasaron. Las etapas 2 y 3 siguen pasando.
- **Verificación del editor:** los módulos del editor no cambiaron respecto a sus originales.
- **Verificada en Chrome por el equipo:** el flujo completo con la cámara y el marcador funciona.

### Etapa 5 — Etiquetas · **Cerrada**

Archivos: `js/modelos.js` (nuevas `crearEtiquetaCruzada` y `crearEtiquetaEsfera`) y `js/ra.js` (constante `MODO_ETIQUETA`, función `aplicarEtiquetaRA`). La función `crearEtiqueta` del editor no cambió.

Se compararon tres formas de etiqueta en la RA, con la misma molécula (H₂O) y la misma tarjeta de prueba, en Chrome:

| Modo     | Vista desde arriba                            | Vista inclinada                   | Resultado   |
| -------- | --------------------------------------------- | --------------------------------- | ----------- |
| sprite   | Letras nítidas, derechas y centradas          | Letras nítidas y derechas         | **Elegido** |
| cruzados | Letras angostas: los dos planos se superponen | Letras pequeñas y sesgadas        | Descartado  |
| esfera   | Legible, con la curvatura de la esfera        | Difícil de leer en algunos átomos | Alternativa |

- **Decisión: sprite.** Es la más legible desde arriba y de lado, conserva la misma apariencia que las etiquetas del editor y no requiere cambios en la geometría.
- **Cruzados se descartó.** Desde arriba, los dos planos quedan en el mismo lugar y cada letra se ve comprimida a unos 70 % de su ancho, así que no forman una X visible.
- **Esfera queda como alternativa.** Se lee bien desde arriba, pero al inclinar la tarjeta la letra se distorsiona.
- Las opciones `cruzados` y `esfera` se conservan en el código, detrás de `MODO_ETIQUETA`, para futuras comparaciones.

**Capturas de la comparación** (H₂O, panel de RA; ver `docs/ra/`):

| Vista        | sprite                                                     | cruzados                                                     | esfera                                                     |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Desde arriba | <img src="docs/ra/vista-arriba-sprite.png" width="240">    | <img src="docs/ra/vista-arriba-cruzados.png" width="240">    | <img src="docs/ra/vista-arriba-esfera.png" width="240">    |
| Inclinada    | <img src="docs/ra/vista-inclinada-sprite.png" width="240"> | <img src="docs/ra/vista-inclinada-cruzados.png" width="240"> | <img src="docs/ra/vista-inclinada-esfera.png" width="240"> |

Las capturas de etanol (vista desde arriba e inclinada) se tomaron con sprite y sirven como referencia de una molécula más compleja. No se incluyó metano en la comparación.

### Etapa 6 — Página móvil (Android y iPhone) · **Cerrada**

Carpeta publicada: `ar-moleculas/` (antes `android/`). Archivos: `ar.html`, `ar.css`, `ar.js`, `catalogo.json`, `elementos.json`, `glb/` (22 modelos Android) y `usdz/` (22 modelos iPhone).

- **Android:** cada molécula abre en Scene Viewer, con `model-viewer` 4.4.0 y el atributo `ar`.
- **iPhone:** cada molécula abre en Vista Rápida de AR de Safari, con su archivo USDZ, que `ar.js` pasa a `model-viewer` como `ios-src`.
- **Catálogo:** se usan las 22 moléculas de `data/moleculas.json`.
- **Generación:** `herramientas/generar-modelos.html` crea los 22 GLB y los 22 USDZ con la misma geometría del editor, y los empaqueta en `modelos-ar.zip`. Ese zip se descomprime dentro de la carpeta publicada.
- **Subtítulo** bajo el nombre de la molécula, con su composición. Por ejemplo: «2 H (hidrógeno) y 1 O (oxígeno)».
- **Etiquetas con el símbolo** sobre cada átomo, en la vista 3D de la página. Usan las posiciones guardadas en `catalogo.json`.
- **Tarjetas de elementos** con la descripción de cada átomo de la molécula, desde `elementos.json` (H, C, N, O, F, Li, Be y B).
- **Los 22 GLB abren en AR** en el X7 Pro y en el Samsung S20 FE.

### Etapa 7 — Posterior · **Pendiente**

- Gestos en RA y estructuras personalizadas en Android.
- Se deja como mejora futura, por el tiempo que queda para la entrega.

---

## 4. Limitaciones conocidas

- **Escala fija en RA:** una estructura de hasta 20 átomos puede salirse de la tarjeta de 8 × 8 cm o amontonar las etiquetas.
- **Fórmula por conteo:** una estructura incompleta puede mostrar una fórmula que no corresponde a ninguna molécula conocida.
- **Recentrado al cambiar la composición:** agregar o quitar un átomo de la estructura elegida la recentra; mover átomos no.
- **Editor sin pausar en «Solo editor»:** la RA sigue procesando el video en segundo plano para volver rápido.
- **Chip de cámara:** muestra «Activa» mientras la RA usa la cámara, porque el contrato de eventos no tiene un estado para eso.
- **Recursos de `gestures.js`:** al reanudar las manos se crea un nuevo `HandLandmarker` y el anterior no se cierra. No se corrigió porque el módulo está fuera del alcance de la RA.
- **Etiquetas sobre los enlaces (RA):** la etiqueta sprite se dibuja encima de los enlaces, aunque estén detrás del átomo. Es el mismo comportamiento del editor y se aceptó por legibilidad.
- **Colores de grupo:** H, C, N y O tienen el mismo azul en el editor y en la RA. La letra es lo único que los distingue.
- **Etiquetas solo en el visor, no en AR (página móvil):** las etiquetas con el símbolo y el subtítulo se ven en la página, pero no dentro de Scene Viewer ni de Quick Look.
- **Marcador:** el reconocimiento depende de la impresión, la luz y la cámara. Hay que imprimirlo a 8 × 8 cm exactos, sin ajustar a la hoja.
- **Navegador de RA:** la RA se probó en Chrome. Firefox no es compatible por ahora.
- **iPhone sin probar:** la vista de Quick Look todavía no se ha probado en un iPhone.

---

## 5. Pruebas realizadas

Las comprobaciones automáticas usan dobles de MindAR, Three.js, la cámara y el editor, en un DOM simulado (jsdom). No reemplazan la prueba con cámara real.

| Etapa         | Comprobaciones | Resultado                                                   |
| ------------- | -------------- | ----------------------------------------------------------- |
| 2             | 38             | Pasan (encender, vistas, apagar, cámara denegada)           |
| 3             | 19             | Pasan (alta, movimiento, enlaces, reconstrucción, limpieza) |
| 4 (corregida) | 24             | Pasan (grupos, selección, unión, separación, centrado)      |

Además, la geometría real de `molecules.js` se verificó sobre las 22 moléculas del catálogo: todos los átomos reciben posición válida.

**Pruebas en el equipo (Chrome):**

- Reconocimiento del marcador confirmado, y flujo completo de la Etapa 4 verificado con la cámara.
- Comparación de etiquetas de la Etapa 5, con seis capturas.
- Página móvil: los 22 modelos abren en AR en Android (X7 Pro y Samsung S20 FE).

**Pruebas con marcadores (en el equipo):** solo el marcador `card` se reconocía con la cámara del teléfono. Las dos primeras versiones del marcador de MolecuLab no se reconocían. La tercera versión, con la paleta de `card`, está pendiente de prueba.

---

## 6. Pendientes y próximos pasos

1. **Probar el marcador de MolecuLab** (tercera versión) con la cámara del teléfono. Si no se reconoce, usar `card` para la demostración y revisar el diseño.
2. **Confirmar la escala** con el marcador impreso a 8 × 8 cm.
3. **Probar la página móvil en iPhone**, con Quick Look. Revisar también el tipo de archivo `.usdz` en GitHub Pages.
4. **Probar el código QR** del panel de información, escaneándolo con un celular.
5. **Confirmar con la docente** el catálogo de 22 moléculas. El documento de alcance dice 15 con H, C, N y O.
6. **Revisar las descripciones de los elementos** en `elementos.json` contra el libro de texto.
7. **Etapa 7:** dejar como mejora futura, salvo que el equipo decida otra cosa.
