# Herramientas de RA de MolecuLab

Compilan la tarjeta marcador a formato `.mind`, prueban si se
reconoce y generan los modelos 3D (GLB y USDZ) de la página móvil.
No forman parte de la web: solo se usan en tu computadora.

Hay dos grupos de herramientas, con requisitos distintos:

| Herramienta                                                                                                       | Para qué                                                                    | Requisitos                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Compilar el marcador y probar su reconocimiento (`compilar.mjs`, `prueba-reconocimiento.mjs`, `generar-tomas.py`) | Crear el `.mind` de la tarjeta y comprobar que MindAR lo reconoce           | Node.js 18 o más reciente (probado con Node 22); Python 3 con `pillow` y `numpy` solo para generar las tomas de prueba |
| Generar los modelos (`generar-modelos.html`)                                                                      | Crear los 22 GLB y 22 USDZ de `ar-moleculas/` desde la geometría del editor | Un servidor local (por ejemplo, `python -m http.server`) e internet para los CDN de Three.js                           |

## Archivos de la tarjeta (nombres reales)

Los archivos que existen en el repositorio son:

| Archivo                                                    | Qué es                                                                                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ar/marcador-moleculab.png` / `ar/marcador-moleculab.mind` | Marcador definitivo según la documentación (tercera versión, paleta de `card.png`); **pendiente de prueba con el teléfono**. |
| `ar/card.png` / `ar/card.mind`                             | Marcador que carga el código hoy (`RUTA_MARCADOR` en `js/ra.js`); es el que sí se reconocía con la cámara del teléfono.      |
| `ar/marcador.png` / `ar/marcador.mind`                     | Versión anterior del marcador (también está `ar/marcador-moleculab1.png` / `.mind`).                                         |

⚠️ No existe ningún `ar/marcador-impresion.png` ni `ar/marcador.mind`
con ese nombre como archivo de trabajo actual: los ejemplos de abajo
usan `marcador-moleculab`, que es el nombre del marcador definitivo.
Si vas a recompilar el marcador que usa el código, usa `card.png` /
`card.mind` en su lugar, y anota cuál probaste.

## Compilar la tarjeta

### Instalación (una vez)

Desde la carpeta `herramientas`:

```bash
npm install
npm run preparar
```

`npm install` descarga MindAR 1.2.5 y TensorFlow.js. `preparar` crea
`compiler-base-node.js`, necesario para leer archivos `.mind` en Node.
No instala nada nativo, así que no hace falta Visual Studio ni librerías de Cairo.

Los scripts disponibles (`package.json`) son: `preparar`
(`node preparar.mjs`), `compilar` (`node compilar.mjs`) y `probar`
(`node prueba-reconocimiento.mjs`).

### Compilar

```bash
npm run compilar -- ../ar/marcador-moleculab.png ../ar/marcador-moleculab.mind
```

O directamente con Node (es lo mismo):

```bash
node compilar.mjs ../ar/marcador-moleculab.png ../ar/marcador-moleculab.mind
```

Tarda unos 45 segundos con una tarjeta de 2000 × 2000 px.

## Probar el reconocimiento

1. Genera tomas simuladas (o toma fotos reales con tu cámara y ponlas en una carpeta):

   ```bash
   python generar-tomas.py ../ar/marcador-moleculab.png tomas 24
   ```

   Por defecto genera 24 tomas (tercer argumento opcional) con
   rotación, inclinación, distintos tamaños, luz variable, desenfoque
   y ruido, y tres negativos que **no** deben reconocerse (ruido, gris
   liso y la tarjeta en espejo).

2. Ejecuta la prueba:

   ```bash
   npm run probar -- ../ar/marcador-moleculab.mind tomas/*.png
   ```

Cada imagen dice si se reconoció y cuántos puntos de referencia encontró.
Las imágenes `negativo_*.png` **no deben** reconocerse. Si una sí se reconoce, avísame.

Para probar con fotos reales de tu cámara, imprime la tarjeta a 8 × 8 cm,
tómale fotos a distintas distancias (25, 40 y 60 cm) y ponlas en la carpeta `tomas`.

## Generar los modelos GLB y USDZ

`generar-modelos.html` genera un modelo GLB (Android) y un USDZ
(iPhone) por cada molécula del catálogo, con la misma geometría de
MolecuLab (`js/molecules.js`, `js/elementos.js` y `js/modelos.js`).

1. Desde la raíz del repositorio, levanta un servidor local:

   ```bash
   python -m http.server 8000
   ```

2. Abre http://localhost:8000/herramientas/generar-modelos.html
   y pulsa **Generar y descargar modelos**.

3. Se descarga `modelos-ar.zip` con `glb/`, `usdz/` y
   `catalogo.json`. Descomprímelo dentro de `ar-moleculas/`.

Detalles:

- **Escala:** 1 unidad de MolecuLab = 10 cm (`ESCALA_METROS = 0.1`
  en el generador). Así una molécula de tamaño típico mide unos
  centímetros en AR.
- **USDZ:** necesita las matrices calculadas (`updateMatrixWorld`) y
  un nodo padre para conservar la escala del grupo. Ambas cosas ya
  están en el generador.
- Usa Three.js 0.183.2 y JSZip 3.10.1 por CDN, igual que la app.

## En Windows (PowerShell)

Los comandos son los mismos, con barras invertidas. Desde la carpeta `herramientas`:

```powershell
npm install
npm run preparar
npm run compilar -- ..\ar\marcador-moleculab.png ..\ar\marcador-moleculab.mind
python generar-tomas.py ..\ar\marcador-moleculab.png tomas 24
node prueba-reconocimiento.mjs ..\ar\marcador-moleculab.mind $(Get-ChildItem tomas\*.png)
```

Esta última línea usa `node` directamente, porque PowerShell no expande
`tomas\*.png` dentro de `npm run`. Si Python no se reconoce, prueba con `py` en lugar de `python`.

## Archivos que no se suben al repositorio

Ya están en el `.gitignore` de la raíz, no hay que agregarlos:

```
herramientas/node_modules/
herramientas/tomas/
herramientas/compiler-base-node.js
```
