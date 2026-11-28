/**
 * @file configuracionElectronica.js
 * @description Distribución electrónica por capas para el modelo de Bohr.
 * Un estado usa el catálogo de referencia (data/configuraciones-electronicas.json)
 * si lo tiene. Si no, usa una distribución provisional por subniveles (orden de
 * llenado de Madelung), marcada como aproximada. Las capacidades son 2n²: son
 * límites máximos, no el orden de llenado.
 * @author Citlaly Morales Viveros
 */

/** Capacidad máxima de cada capa, 2n². */
export const CAPACIDADES_CAPAS = [2, 8, 18, 32, 50, 72, 98];

/** Electrones que caben en cada tipo de subnivel. */
const CAPACIDAD_SUBNIVEL = { s: 2, p: 6, d: 10, f: 14 };

/** Orden de llenado provisional (regla de Madelung). */
const ORDEN_LLENADO = [
    '1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f',
    '5d', '6p', '7s', '5f', '6d', '7p',
];

/** Catálogo de referencia ya validado, o null mientras no se haya leído. */
let catalogo = null;

/**
 * Dice si una entrada del catálogo es consistente: subniveles válidos y
 * electrones que suman z - carga.
 * @param {{z: number, carga: number, subniveles: Object}} entrada
 * @returns {boolean}
 */
function entradaValida({ z, carga, subniveles } = {}) {
    if (!Number.isInteger(z) || z < 1 || !Number.isInteger(carga) || !subniveles) return false;
    let total = 0;
    for (const [subnivel, cantidad] of Object.entries(subniveles)) {
        if (!/^[1-7][spdf]$/.test(subnivel) || !Number.isInteger(cantidad)
            || cantidad < 0 || cantidad > CAPACIDAD_SUBNIVEL[subnivel[1]]) {
            return false;
        }
        total += cantidad;
    }
    return total === z - carga;
}

/**
 * Lee el catálogo de referencia. Si no se puede leer, las distribuciones
 * quedan no disponibles en lugar de usar datos incompletos.
 * @returns {Promise<void>}
 */
async function cargarCatalogo() {
    try {
        const respuesta = await fetch('data/configuraciones-electronicas.json');
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const datos = await respuesta.json();
        catalogo = (datos.entradas ?? []).filter(entradaValida);
    } catch (error) {
        console.error('[configuracionElectronica] No se pudo cargar el catálogo:', error);
    }
}

cargarCatalogo();

/**
 * Suma los electrones de los subniveles por nivel principal y devuelve la
 * cantidad por capa, sin capas vacías al final.
 * @param {Object<string, number>} subniveles Electrones por subnivel, como "2p": 4.
 * @returns {number[]} Electrones de cada capa, desde la 1.
 */
function capasDesdeSubniveles(subniveles) {
    const porNivel = [];
    for (const [subnivel, cantidad] of Object.entries(subniveles)) {
        const nivel = Number(subnivel[0]);
        porNivel[nivel - 1] = (porNivel[nivel - 1] ?? 0) + cantidad;
    }
    const capas = Array.from(porNivel, (valor) => valor ?? 0);
    while (capas.length > 0 && capas[capas.length - 1] === 0) capas.pop();
    return capas;
}

/**
 * Reparte electrones en subniveles siguiendo el orden de llenado provisional.
 * @param {number} electrones Cantidad de electrones.
 * @returns {Object<string, number> | null} Subniveles, o null si no alcanzan los subniveles.
 */
function repartirProvisional(electrones) {
    const subniveles = {};
    let restantes = electrones;
    for (const subnivel of ORDEN_LLENADO) {
        if (restantes === 0) break;
        const cantidad = Math.min(CAPACIDAD_SUBNIVEL[subnivel[1]], restantes);
        subniveles[subnivel] = cantidad;
        restantes -= cantidad;
    }
    return restantes === 0 ? subniveles : null;
}

/**
 * Distribución electrónica por capas de un estado del modelo de Bohr. Siempre
 * representa exactamente la cantidad de electrones recibida. Usa el catálogo
 * si el estado está en él (no es aproximada); si no, una distribución
 * provisional marcada como aproximada. Aproximada significa que no hay una
 * configuración de referencia, no que el ion sea inestable.
 * Un estado sin electrones (por ejemplo H⁺) no tiene distribución que calcular:
 * se reporta como disponible, sin capas y sin aproximación. Los neutrones no entran aquí: no
 * alteran las capas.
 * @param {number} protones Protones del modelo.
 * @param {number} electrones Electrones del modelo.
 * @returns {{ capas: number[], disponible: boolean, aproximada: boolean }}
 */
export function obtenerCapasElectronicas(protones, electrones) {
    const sinDistribucion = { capas: [], disponible: false, aproximada: false };
    if (!Number.isInteger(protones) || !Number.isInteger(electrones)
        || protones < 0 || electrones < 0) {
        return sinDistribucion;
    }
    if (protones === 0 || electrones === 0) {
        return { capas: [], disponible: true, aproximada: false };
    }
    if (catalogo === null) return sinDistribucion;

    const referencia = catalogo.find((entrada) =>
        entrada.z === protones && entrada.carga === protones - electrones);
    const subniveles = referencia ? referencia.subniveles : repartirProvisional(electrones);
    if (!subniveles) return sinDistribucion;

    const capas = capasDesdeSubniveles(subniveles);
    const suma = capas.reduce((total, cantidad) => total + cantidad, 0);
    const cabe = capas.every((cantidad, capa) => cantidad <= CAPACIDADES_CAPAS[capa]);
    if (suma !== electrones || !cabe) return sinDistribucion;

    return { capas, disponible: true, aproximada: !referencia };
}

/**
 * Asigna a cada electrón la capa que le corresponde según la distribución.
 * Conserva el orden relativo: los que ya tenían capa siguen en la misma
 * posición y los nuevos (sin capa) quedan en la última.
 * @param {Array<{capa: number}>} electrones Electrones del modelo, modificados en su lugar.
 * @param {number[]} capas Electrones de cada capa; su suma debe ser electrones.length.
 */
export function asignarCapasElectrones(electrones, capas) {
    const clave = (electron) => (Number.isInteger(electron.capa) && electron.capa >= 0 ? electron.capa : 999);
    const ordenados = [...electrones].sort((a, b) => clave(a) - clave(b));
    let indice = 0;
    capas.forEach((cantidad, capa) => {
        for (let i = 0; i < cantidad; i++) ordenados[indice++].capa = capa;
    });
}