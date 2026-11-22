/**
 * @file io.js
 * @description Exporta e importa la escena de MolecuLab en un archivo .json.
 * El archivo guarda los átomos con su id, elemento y posición, y los enlaces
 * con sus dos átomos y su orden, igual que la foto de deshacer. Al importar,
 * el archivo se valida antes de tocar la escena.
 * @author Citlaly Morales Viveros
 */

import { emit } from './bus.js';
import { importarFoto, obtenerListaAtomos, obtenerListaEnlaces } from './atoms.js';
import { ELEMENTOS, MAX_ATOMOS } from './elementos.js';

const FORMATO = 'moleculab-escena';
const VERSION = 1;
/** Tamaño máximo del archivo que se acepta al importar, en bytes. */
const TAMANO_MAXIMO = 200 * 1024;
/** Decimales de las posiciones al exportar, para que el archivo sea corto. */
const DECIMALES = 3;

const ICONO_EXPORTAR = `url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d=%22M12 4v11%22/%3E%3Cpath d=%22m7 10 5 5 5-5%22/%3E%3Cpath d=%22M4 20h16%22/%3E%3C/svg%3E")`;
const ICONO_IMPORTAR = `url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d=%22M12 15V4%22/%3E%3Cpath d=%22m7 9 5-5 5 5%22/%3E%3Cpath d=%22M4 20h16%22/%3E%3C/svg%3E")`;

/**
 * Valida los datos de un archivo antes de importarlos. Revisa el formato,
 * los elementos, que los ids sean únicos, que las posiciones sean números,
 * que ningún par de átomos se encime, que los enlaces apunten a átomos
 * existentes y que ningún átomo tenga más enlaces que su valencia. No exige valencia completa: un archivo puede
 * guardar una molécula a medio armar, igual que deshacer.
 * @param {*} datos Objeto leído del archivo JSON.
 * @returns {{ ok: true, foto: { atomos: Array, enlaces: Array } } | { ok: false, error: string }}
 */
function validarFoto(datos) {
    const fallo = (error) => ({ ok: false, error });

    if (!datos || typeof datos !== 'object' || datos.formato !== FORMATO) {
        return fallo('El archivo no es una molécula de MolecuLab');
    }
    if (!Array.isArray(datos.atomos) || !Array.isArray(datos.enlaces)) {
        return fallo('Al archivo le faltan los átomos o los enlaces');
    }
    if (datos.atomos.length > MAX_ATOMOS) {
        return fallo(`Una molécula puede tener como máximo ${MAX_ATOMOS} átomos`);
    }

    const elementoDe = new Map();
    const atomos = [];
    for (const atomo of datos.atomos) {
        const { id, elemento, posicion } = atomo ?? {};
        if (typeof id !== 'string' || typeof elemento !== 'string'
            || !Object.hasOwn(ELEMENTOS, elemento)
            || !id.startsWith(elemento) || !/^\d+$/.test(id.slice(elemento.length))) {
            return fallo(`El átomo ${id ?? '(sin id)'} no tiene un elemento válido`);
        }
        if (elementoDe.has(id)) return fallo(`El id ${id} está repetido`);
        if (!['x', 'y', 'z'].every((eje) => Number.isFinite(posicion?.[eje]))) {
            return fallo(`La posición de ${id} no es válida`);
        }
        elementoDe.set(id, elemento);
        atomos.push({ id, elemento, posicion: { x: posicion.x, y: posicion.y, z: posicion.z } });
    }

    // Dos átomos se encimarían si sus centros están más cerca que la suma
    // de sus radios (con el mismo margen que usa la escena al arrastrar).
    for (let i = 0; i < atomos.length; i++) {
        for (let j = i + 1; j < atomos.length; j++) {
            const p = atomos[i].posicion;
            const q = atomos[j].posicion;
            const distancia = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
            const minimo = ELEMENTOS[atomos[i].elemento].radio
                + ELEMENTOS[atomos[j].elemento].radio + 0.02;
            if (distancia < minimo) {
                return fallo(`${atomos[i].id} y ${atomos[j].id} se encimarían`);
            }
        }
    }

    const usados = new Map();
    const claves = new Set();
    const enlaces = [];
    for (const enlace of datos.enlaces) {
        const { a, b, orden } = enlace ?? {};
        if (!elementoDe.has(a) || !elementoDe.has(b) || a === b) {
            return fallo('Hay un enlace que apunta a átomos que no existen');
        }
        if (orden !== 1 && orden !== 2) return fallo(`El orden del enlace ${a}–${b} debe ser 1 o 2`);

        const clave = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (claves.has(clave)) return fallo(`El enlace ${a}–${b} está repetido`);
        claves.add(clave);

        usados.set(a, (usados.get(a) ?? 0) + orden);
        usados.set(b, (usados.get(b) ?? 0) + orden);
        enlaces.push({ a, b, orden });
    }

    for (const [id, elemento] of elementoDe) {
        const valencia = ELEMENTOS[elemento].valencia;
        if ((usados.get(id) ?? 0) > valencia) {
            return fallo(`${id} tiene más enlaces que su valencia (${valencia})`);
        }
    }

    return { ok: true, foto: { atomos, enlaces } };
}

/**
 * Descarga la escena actual como archivo .json. No cambia la escena.
 * @returns {boolean} false si no hay átomos que exportar.
 */
export function exportarMolecula() {
    const atomos = obtenerListaAtomos();
    if (atomos.length === 0) {
        emit('ui:mensaje', { tipo: 'aviso', texto: 'Todavía no hay átomos para exportar' });
        return false;
    }

    const redondear = (valor) => Number(valor.toFixed(DECIMALES));
    const datos = {
        formato: FORMATO,
        version: VERSION,
        creado: new Date().toISOString(),
        atomos: atomos.map((atomo) => ({
            id: atomo.id,
            elemento: atomo.elemento,
            posicion: {
                x: redondear(atomo.posicion.x),
                y: redondear(atomo.posicion.y),
                z: redondear(atomo.posicion.z),
            },
        })),
        enlaces: obtenerListaEnlaces(),
    };

    const archivo = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(archivo);
    const marca = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `molecula-${marca}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    emit('ui:mensaje', { tipo: 'aviso', texto: 'Molécula exportada' });
    return true;
}

/**
 * Lee un archivo elegido por el usuario, lo valida y reemplaza la escena.
 * Si ya hay átomos, pide confirmación antes de reemplazarlos.
 * @param {File} archivo
 */
async function importarArchivo(archivo) {
    if (archivo.size > TAMANO_MAXIMO) {
        emit('ui:mensaje', { tipo: 'error', texto: 'El archivo es demasiado grande para ser una molécula' });
        return;
    }

    let datos;
    try {
        datos = JSON.parse(await archivo.text());
    } catch {
        emit('ui:mensaje', { tipo: 'error', texto: 'No pude leer el archivo: no es un JSON válido' });
        return;
    }

    const resultado = validarFoto(datos);
    if (!resultado.ok) {
        emit('ui:mensaje', { tipo: 'error', texto: `No se importó la molécula: ${resultado.error}` });
        return;
    }

    if (obtenerListaAtomos().length > 0
        && !window.confirm('¿Reemplazar la escena actual con la molécula del archivo?')) {
        return;
    }
    importarFoto(resultado.foto);
}

/**
 * Conecta los botones Exportar e Importar de la barra de respaldo y
 * agrega sus íconos. Devuelve true si los botones existen.
 */
export function iniciarIO() {
    const botonExportar = document.querySelector('[data-accion="exportar"]');
    const botonImportar = document.querySelector('[data-accion="importar"]');
    const entrada = document.getElementById('entrada-molecula');
    if (!botonExportar || !botonImportar || !entrada) return false;

    const estilo = document.createElement('style');
    estilo.id = 'estilos-io';
    estilo.textContent = `
        .respaldo [data-accion="exportar"]::before { mask-image: ${ICONO_EXPORTAR}; -webkit-mask-image: ${ICONO_EXPORTAR}; }
        .respaldo [data-accion="importar"]::before { mask-image: ${ICONO_IMPORTAR}; -webkit-mask-image: ${ICONO_IMPORTAR}; }
    `;
    document.head.appendChild(estilo);

    botonExportar.addEventListener('click', () => exportarMolecula());
    botonImportar.addEventListener('click', () => entrada.click());
    entrada.addEventListener('change', async () => {
        const archivo = entrada.files?.[0];
        if (archivo) await importarArchivo(archivo);
        entrada.value = '';
    });
    return true;
}