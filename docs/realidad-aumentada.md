# Cómo funciona la realidad aumentada de MolecuLab

Referencia técnica del módulo de realidad aumentada (RA) y de la página móvil. Describe qué hace cada archivo, en qué orden ocurren las cosas y cómo reproducir cada parte. Para la historia del proyecto y las decisiones, ver `docs/evaluacion/realidad-aumentada.md`.

> ⚠️ **Discrepancia pendiente (revisada el 27 de noviembre de 2026):**
> este documento dice que el marcador definitivo es
> `ar/marcador-moleculab.mind`, pero el código todavía carga
> `ar/card.mind` (`RUTA_MARCADOR` en `js/ra.js`, con el comentario
> «Es el prototipo; se reemplazará por el definitivo de 8 × 8 cm»).
> En las pruebas con el teléfono, además, solo el marcador `card` se
> reconocía. Antes de una demo, probar con ambas tarjetas impresas a
> 8 × 8 cm y anotar cuál reconoce la versión publicada.

---

## 1. Vista general

MolecuLab tiene dos formas de mostrar una molécula en AR:

| Forma               | Dónde                                     | Cómo funciona                                                                                                                                                              |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RA en el editor** | `index.html` → botón «Realidad aumentada» | El estudiante construye la molécula en el editor. Al activar la RA, la cámara reconoce la tarjeta impresa y dibuja encima la estructura seleccionada, actualizada en vivo. |
| **Página móvil**    | `ar-moleculas/ar.html` (Android y iPhone) | Un visor con las 22 moléculas del catálogo. Al tocar el botón de AR, el sistema del celular abre la cámara y coloca la molécula sobre la mesa.                             |

La RA del editor usa la cámara del navegador y un marcador impreso. La página móvil no usa marcador: el sistema operativo del celular (Scene Viewer en Android, Quick Look en iPhone) se encarga de la AR.

---

## 2. RA en el editor

### 2.1. Archivos

| Archivo                        | Responsabilidad                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/ra.js`                     | Módulo principal de la RA: cámara, MindAR, escena de Three.js, selección de estructuras y sincronización con el editor.                     |
| `js/modelos.js`                | Geometría compartida de átomos y enlaces (la usan el editor y la RA). Incluye las etiquetas de los átomos.                                  |
| `js/chemistry.js`              | Valencias y anillos de valencia. Lo usan el editor y la RA.                                                                                 |
| `js/atoms.js`                  | Editor: crea, mueve y enlaza átomos. La RA no lo modifica; solo lee su estado.                                                              |
| `js/bus.js`                    | Bus de eventos: los módulos se avisan de los cambios sin importarse entre sí.                                                               |
| `ar/marcador-moleculab.mind`   | Marcador compilado que MindAR busca en la imagen de la cámara (definitivo según la documentación; ver la nota al inicio de este documento). |
| `ar/marcador-moleculab.png`    | Imagen del marcador para imprimir a 8 × 8 cm.                                                                                               |
| `ar/card.mind` / `ar/card.png` | Marcador que carga el código hoy (`RUTA_MARCADOR` en `js/ra.js`); es el que sí se reconocía con la cámara del teléfono.                     |

### 2.2. Flujo al activar la RA

1. **Se usa la cámara de los gestos** (`gestures.js`). La cámara se abre al arrancar la página y no se apaga; la RA no abre otra, para que MindAR y MediaPipe no compitan por ella.
2. **Se toma el flujo de esa cámara** (la trasera tiene prioridad) y se usa la resolución real del video (`videoWidth` y `videoHeight`); mientras la RA está encendida no se baja la resolución. MindAR necesita que la entrada tenga la misma proporción que el video real, o no reconoce el marcador.
3. **Se importa MindAR** (solo al encender la RA, no al cargar la página) y se registra el marcador `ar/marcador-moleculab.mind`.
4. **Se crea la escena de Three.js:** un renderizador encima del video, una luz y un grupo ancla que MindAR mueve cuando reconoce el marcador.
5. **Cada cuadro,** MindAR informa la posición del marcador. El ancla se coloca sobre la tarjeta, y la estructura se dibuja en su interior.

Si algo falla al encender (cámara denegada, sin cámara, MindAR no carga), la RA se apaga sola, deja el editor como estaba y muestra un aviso con la alternativa.

### 2.3. Sincronización con el editor

La RA no tiene su propia copia de la molécula. En cada cuadro lee el estado del editor y aplica solo lo que cambió:

- **Eventos del bus:** `escena:atomo-agregado`, `escena:atomo-movido`, `escena:atomo-desplazado`, `escena:atomo-eliminado`, `escena:enlace-creado` y `escena:enlace-eliminado` marcan los átomos que cambiaron.
- **Reconstrucción completa:** `escena:escena-limpia` y `escena:reconstruir` (deshacer, rehacer, importar) obligan a redibujar toda la estructura.
- **Actualización incremental:** si solo se movieron átomos, se actualizan sus posiciones, sus enlaces y sus anillos de valencia, sin redibujar todo.

### 2.4. Estructuras

Una **estructura** es un grupo de átomos unidos por enlaces. Un átomo suelto también es una estructura.

- **Detección:** `calcularGrupos` agrupa los átomos por conexión (búsqueda de componentes conexos sobre los ids y los enlaces del editor).
- **Selección:** la RA muestra una sola estructura a la vez, la que elige el estudiante en el selector. La selección sigue a un **átomo ancla**: si se unen dos estructuras, se conserva la que contiene el ancla; si se separan, la que lo contiene; si el ancla se elimina, se elige la más grande.
- **Nombre:** la fórmula por conteo de átomos, con el orden de Hill (C primero, H después y el resto alfabético). Por ejemplo, `CH₄`. No se compara con el catálogo.
- **Centrado:** la estructura se centra en el origen de la tarjeta al seleccionarla, al cambiar su composición y con el botón «Centrar».

### 2.5. Orientación y escala

- La estructura del editor vive en el plano (x, z). En la RA se gira 90° sobre el eje X, para que quede **plana sobre la tarjeta**.
- **1 unidad = ancho de la tarjeta.** La estructura usa una escala de 0.3, para que quepa en la tarjeta.

### 2.6. Etiquetas de los átomos

`modelos.js` ofrece tres formas de etiqueta. En la RA se usa `sprite` (`MODO_ETIQUETA` en `js/ra.js`):

| Modo       | Cómo funciona                                                                 | Estado                                                                              |
| ---------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `sprite`   | Un sprite con el símbolo, siempre de frente a la cámara, encima de la esfera. | **Elegido.** Es la misma etiqueta del editor.                                       |
| `cruzados` | Dos planos con el símbolo, a 45°.                                             | Descartado: desde arriba, los planos se superponen y las letras se ven comprimidas. |
| `esfera`   | El símbolo impreso en la cara de la esfera que mira a la cámara.              | Alternativa. Se lee bien desde arriba, pero se distorsiona al inclinar la tarjeta.  |

Para cambiar el modo, edita `MODO_ETIQUETA` en `js/ra.js` y recarga la página.

### 2.7. Colores

Los colores vienen de `js/elementos.js`, y son por grupo de la tabla periódica. H, C, N y O comparten el mismo azul, así que la letra es lo que distingue cada átomo.

---

## 3. Página móvil (`ar-moleculas/`)

### 3.1. Archivos

| Archivo          | Responsabilidad                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ar.html`        | Estructura de la página: selector, visor de `model-viewer` y pie con el subtítulo y las tarjetas de los elementos.                 |
| `ar.css`         | Estilos de la página.                                                                                                              |
| `ar.js`          | Carga el catálogo, llena el selector, cambia el modelo del visor, muestra el subtítulo, las etiquetas y las tarjetas de elementos. |
| `catalogo.json`  | Lista de las 22 moléculas: id, nombre, fórmula, archivo GLB, archivo USDZ y posición de cada átomo.                                |
| `elementos.json` | Datos de los elementos que aparecen en el catálogo: nombre, número atómico, valencia, masa y descripción corta.                    |
| `glb/`           | 22 modelos para Android (Scene Viewer).                                                                                            |
| `usdz/`          | 22 modelos para iPhone (Quick Look).                                                                                               |

### 3.2. Qué hace `model-viewer`

[`model-viewer`](https://modelviewer.dev/) es un componente web de Google. Con el atributo `ar`:

- En **Android** con Chrome, el botón de AR abre **Scene Viewer** con el archivo `src` (el GLB).
- En **iPhone** con Safari, el botón abre **Quick Look** con el archivo `ios-src` (el USDZ).

Por eso `ar.js` cambia dos atributos al elegir una molécula: `src` (GLB) y `ios-src` (USDZ).

**Versión:** `model-viewer` 4.4.0 desde Google APIs. La versión 3.5.0 no abría Scene Viewer con los modelos de MolecuLab.

### 3.3. Flujo de la página

1. `ar.js` carga `elementos.json` y `catalogo.json`.
2. Llena el selector con las 22 moléculas y muestra la primera.
3. Al elegir una molécula:
   - Cambia `src` e `ios-src` del visor.
   - Escribe el nombre y la fórmula en el pie.
   - Escribe el subtítulo con la composición, por ejemplo «2 H (hidrógeno) y 1 O (oxígeno)».
   - Coloca una etiqueta con el símbolo sobre cada átomo, en la vista 3D del visor (no aparece dentro de AR).
   - Muestra una tarjeta por cada elemento de la molécula, con su descripción.

Los símbolos de la molécula se sacan de su fórmula (por ejemplo, `C₂H₆O` da C, H y O).

### 3.4. Qué se ve en cada lugar

| Elemento                                 | En el visor 3D   | En AR (Scene Viewer / Quick Look) |
| ---------------------------------------- | ---------------- | --------------------------------- |
| Molécula 3D                              | Sí               | Sí                                |
| Subtítulo con la composición             | Sí, en la página | No                                |
| Etiqueta con el símbolo sobre cada átomo | Sí               | No                                |
| Tarjetas de elementos                    | Sí, en la página | No                                |

---

## 4. Generación de modelos y marcador

### 4.1. Modelos (GLB y USDZ)

`herramientas/generar-modelos.html` genera los modelos desde el mismo código de MolecuLab (`js/molecules.js`, `js/elementos.js` y `js/modelos.js`), así que coinciden con lo que se ve en el editor.

- **Ejecución:** desde la raíz del repositorio, con `python -m http.server 8000`, abre `http://localhost:8000/herramientas/generar-modelos.html` y pulsa el botón.
- **Salida:** `modelos-ar.zip` con `glb/`, `usdz/` y `catalogo.json`. Se descomprime dentro de `ar-moleculas/`.
- **Escala:** 1 unidad de MolecuLab = 10 cm. Así una molécula de tamaño típico mide unos centímetros en AR.
- **USDZ:** necesita las matrices calculadas (`updateMatrixWorld`) y un nodo padre para conservar la escala del grupo. Ambas cosas ya están en el generador.

### 4.2. Marcador

El marcador se compila a partir de la imagen con el compilador de MindAR:

```
cd herramientas
npm install
npm run preparar
node compilar.mjs ../ar/marcador-moleculab.png ../ar/marcador-moleculab.mind
```

- Para que MindAR reconozca una imagen, necesita **contornos gruesos, bloques grandes y alto contraste**. Los detalles finos y los puntos diminutos no ayudan con la cámara del teléfono.
- El color que ve la cámara puede cambiar los tonos. Por eso el marcador usa la paleta de `card.png` (azul, amarillo y negro), que es la que sí se reconoce.
- La imagen se imprime a **8 × 8 cm exactos**, sin ajustar a la hoja.

### 4.3. Código QR

`ar/qr-moleculas.png` apunta a `https://dana044.github.io/Proyecto-Interfaces/ar-moleculas/ar.html`. Si cambia la dirección de la página, hay que generarlo de nuevo.

---

## 5. Publicación

- **Sitio:** GitHub Pages, desde la raíz del repositorio.
- **Requisito:** HTTPS. Scene Viewer y Quick Look no funcionan con `localhost` desde el celular.
- **Tipos de archivo:** GitHub Pages sirve los `.glb` como `model/gltf-binary`. Para los `.usdz`, revisa el tipo con `curl.exe -I <url>` después de subirlos.
- **Caché:** si cambias un archivo y no se refleja en el celular, borra los datos del sitio en Chrome.

---

## 6. Solución de problemas

| Síntoma                                             | Causa probable                                                                               | Qué revisar                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| La RA no reconoce el marcador                       | Impresión con tamaño distinto, luz, o diseño con pocos contornos gruesos                     | Mide la hoja (8 × 8 cm), prueba con buena luz, y compara con `card`                                                          |
| La RA reconoce `card` pero no `marcador-moleculab`  | El código carga `ar/card.mind` (`js/ra.js`); el marcador definitivo está pendiente de prueba | Imprime ambas tarjetas a 8 × 8 cm, prueba cuál reconoce la versión publicada y anota el resultado antes de cambiar el código |
| El marcador se ve azul y no morado                  | La cámara cambia los tonos                                                                   | Usa la paleta de `card.png` (ver 4.2)                                                                                        |
| La RA se apaga al encender                          | Cámara denegada o sin cámara                                                                 | Permisos del navegador; el aviso indica la alternativa                                                                       |
| En Android no abre Scene Viewer                     | Versión de `model-viewer`, o URL sin HTTPS                                                   | Usa 4.4.0 y revisa que la página esté en HTTPS                                                                               |
| En iPhone no aparece Quick Look                     | Falta el USDZ, o el tipo de archivo no es el esperado                                        | Revisa `ios-src` en el visor y el tipo del `.usdz` con `curl`                                                                |
| El selector dice «No se pudo cargar el catálogo»    | `catalogo.json` o `glb/` no están publicados                                                 | Revisa que la carpeta `ar-moleculas/` esté completa en GitHub                                                                |
| No aparecen etiquetas ni subtítulo en la página     | El `catalogo.json` es anterior al generador actualizado                                      | Regenera el zip y descomprímelo otra vez                                                                                     |
| El QR abre una página que no existe                 | La carpeta cambió de nombre                                                                  | Genera de nuevo el QR con la dirección correcta                                                                              |
| Las letras de la RA se ven comprimidas desde arriba | Modo `cruzados`                                                                              | Usa `sprite` (ver 2.6)                                                                                                       |