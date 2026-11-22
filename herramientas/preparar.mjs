// Prepara las herramientas después de 'npm install': crea compiler-base-node.js, una copia de la
// clase base del compilador de MindAR con la clase exportada. MindAR no la exporta, y la necesita
// para leer el archivo .mind en Node. La copia se hace fuera de node_modules, que no se modifica.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const aquí = path.dirname(fileURLToPath(import.meta.url));
const origen = path.join(aquí, 'node_modules/mind-ar/src/image-target/compiler-base.js');
const destino = path.join(aquí, 'compiler-base-node.js');

if (!fs.existsSync(origen)) {
  console.error('No encuentro MindAR. Ejecuta primero: npm install');
  process.exit(1);
}

let codigo = fs.readFileSync(origen, 'utf8');
// Las importaciones relativas se vuelven paquetes de MindAR, para que la copia funcione desde esta carpeta.
codigo = codigo.replace(/from '\.\//g, "from 'mind-ar/src/image-target/");
// MindAR ya trae un 'export { CompilerBase }' al final: se quita para no duplicar la exportación.
codigo = codigo.replace(/export\s*\{\s*CompilerBase\s*\};?/g, '');
codigo = codigo.replace(/^class CompilerBase \{/m, 'export class CompilerBase {');

if (!codigo.includes('export class CompilerBase')) {
  console.error('No pude exportar CompilerBase: la versión de MindAR cambió. Revisa compiler-base.js.');
  process.exit(1);
}
fs.writeFileSync(destino, codigo);
console.log('Listo: compiler-base-node.js creado.');