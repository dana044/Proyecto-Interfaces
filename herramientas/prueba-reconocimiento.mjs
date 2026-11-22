// Prueba de reconocimiento: repite el flujo de MindAR (detector -> emparejador -> estimador)
// sobre imágenes de cámara y dice cuáles reconoce. Usa los mismos módulos del paquete.
// Uso: node prueba-reconocimiento.mjs marcador.mind toma1.png toma2.png ...
import '@tensorflow/tfjs';
import * as tf from '@tensorflow/tfjs';
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';
import { CompilerBase as Compilador } from './compiler-base-node.js';
import { CropDetector } from 'mind-ar/src/image-target/detector/crop-detector.js';
import { Matcher } from 'mind-ar/src/image-target/matching/matcher.js';
import { Estimator } from 'mind-ar/src/image-target/estimation/estimator.js';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';

const [, , rutaMind, ...tomas] = process.argv;
if (!rutaMind || tomas.length === 0) {
    console.error('Uso: node prueba-reconocimiento.mjs <marcador.mind> <imagen1.png> [imagen2.png ...]');
    process.exit(1);
}

// Igual que el controlador de MindAR en la web: entrada de 640 x 480.
const W = 640, H = 480;
const mind = fs.readFileSync(rutaMind);
const datos = new Compilador().importData(mind.buffer.slice(mind.byteOffset, mind.byteOffset + mind.byteLength));
const matchingData = datos[0].matchingData;
const f = (H / 2) / Math.tan((45 * Math.PI / 180) / 2);
const projectionTransform = [[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]];
const detectorRecorte = new CropDetector(W, H, false);
const emparejador = new Matcher(W, H, false);
const estimador = new Estimator(projectionTransform);

// Equivalente en Node a InputLoader.loadInput: escala a W x H y pasa a gris (0.299 R + 0.587 G + 0.114 B).
function cargarEntrada(img) {
    const lienzo = createCanvas(W, H);
    const ctx = lienzo.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const gris = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
        gris[i] = 0.299 * px[4 * i] + 0.587 * px[4 * i + 1] + 0.114 * px[4 * i + 2];
    }
    return tf.tensor2d(gris, [H, W]);
}

let tomasOk = 0, tomas_ = 0, negativosFalsos = 0, negativos = 0;
const tiempos = [];
for (const ruta of tomas) {
    const img = await loadImage(fs.readFileSync(ruta));
    const inicio = Date.now();
    const entrada = cargarEntrada(img);
    const { featurePoints } = await detectorRecorte.detect(entrada);
    entrada.dispose();
    const r = emparejador.matchDetection(matchingData, featurePoints);
    let reconocida = false, z = '-';
    if (r.keyframeIndex !== -1) {
        const mvt = estimador.estimate({ screenCoords: r.screenCoords, worldCoords: r.worldCoords });
        if (mvt) { reconocida = true; z = mvt[2][3].toFixed(0); }
    }
    tiempos.push(Date.now() - inicio);
    // Las imágenes 'negativo_*' son las que NO deben reconocerse.
    const esNegativo = ruta.includes('negativo');
    if (esNegativo) { negativos++; if (reconocida) negativosFalsos++; }
    else { tomas_++; if (reconocida) tomasOk++; }
    console.log(`${ruta.padEnd(28)} puntos=${String(featurePoints.length).padStart(4)}  ${reconocida ? 'RECONOCIDA' : 'no        '}  z=${z}`);
}
const media = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length);
if (tomas_ > 0) console.log(`\nTomas del marcador reconocidas: ${tomasOk}/${tomas_}.`);
if (negativos > 0) console.log(`Negativos reconocidos por error: ${negativosFalsos}/${negativos} (deben ser 0).`);
console.log(`Tiempo medio por imagen: ${media} ms.`);