// Compila una imagen de la tarjeta a formato .mind con el compilador de MindAR 1.2.5 (sin navegador).
// Uso: node compilar.mjs marcador.png marcador.mind
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';
import { loadImage } from 'canvas';
import fs from 'fs';

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
    console.error('Uso: node compilar.mjs <imagen.png> <salida.mind>');
    process.exit(1);
}

const img = await loadImage(fs.readFileSync(entrada));
const compilador = new OfflineCompiler();
const t0 = Date.now();
let ultimo = -1;
await compilador.compileImageTargets([img], (p) => {
    const porcentaje = Math.floor(p);
    if (porcentaje % 25 === 0 && porcentaje !== ultimo) {
        ultimo = porcentaje;
        process.stdout.write(`${porcentaje}% `);
    }
});
const buffer = Buffer.from(new Uint8Array(compilador.exportData()));
fs.writeFileSync(salida, buffer);
console.log(`\nListo: ${salida} (${(buffer.length / 1024).toFixed(1)} KB) en ${((Date.now() - t0) / 1000).toFixed(1)} s`);