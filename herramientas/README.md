# Herramientas de RA de MolecuLab

Compilan la tarjeta marcador a formato `.mind` y prueban si se reconoce.
No forman parte de la web: solo se usan en tu computadora.

## Requisitos

- Node.js 18 o más reciente (probado con Node 22).
- Python 3 con `pillow` y `numpy` (solo para generar las tomas de prueba).

## Instalación (una vez)

```bash
npm install
npm run preparar
```

`npm install` descarga MindAR 1.2.5 y TensorFlow.js. `preparar` crea
`compiler-base-node.js`, necesario para leer archivos `.mind` en Node.
No instala nada nativo, así que no hace falta Visual Studio ni librerías de Cairo.

## Compilar la tarjeta

```bash
npm run compilar -- ../ar/marcador-impresion.png ../ar/marcador.mind
```

Tarda unos 45 segundos con una tarjeta de 2000 × 2000 px.

## Probar el reconocimiento

1. Genera tomas simuladas (o toma fotos reales con tu cámara y ponlas en una carpeta):

   ```bash
   python generar-tomas.py ../ar/marcador-impresion.png tomas 24
   ```

2. Ejecuta la prueba:

   ```bash
   npm run probar -- ../ar/marcador.mind tomas/*.png
   ```

Cada imagen dice si se reconoció y cuántos puntos de referencia encontró.
Las imágenes `negativo_*.png` **no deben** reconocerse. Si una sí se reconoce, avísame.

Para probar con fotos reales de tu cámara, imprime la tarjeta a 8 × 8 cm,
tómale fotos a distintas distancias (25, 40 y 60 cm) y ponlas en la carpeta `tomas`.

## En Windows (PowerShell)

Los comandos son los mismos, con barras invertidas. Desde la carpeta `herramientas`:

```powershell
npm install
npm run preparar
npm run compilar -- ..\ar\marcador-impresion.png ..\ar\marcador.mind
python generar-tomas.py ..\ar\marcador-impresion.png tomas 24
node prueba-reconocimiento.mjs ..\ar\marcador.mind $(Get-ChildItem tomas\*.png)
```

Esta última línea usa `node` directamente, porque PowerShell no expande
`tomas\*.png` dentro de `npm run`. Si Python no se reconoce, prueba con `py` en lugar de `python`.

## Archivos que no se suben al repositorio

Agrega esto a `.gitignore` para no subir dependencias ni imágenes de prueba:

```
herramientas/node_modules/
herramientas/tomas/
herramientas/compiler-base-node.js
```
