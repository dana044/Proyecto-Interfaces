/**
 * @file io.js
 * @description Exporta e importa la escena de MolecuLab en un archivo .json.
 * Versión 2: átomos, enlaces, partículas (libres y del modelo de Bohr) y la
 * posición del modelo. La versión 1 (solo átomos y enlaces) sigue siendo válida
 * al importar y deja la escena sin partículas. El archivo se valida antes de
 * tocar la escena.
 * @author Citlaly Morales Viveros
 */

import { emit } from './bus.js';
import {
    MAX_PARTICULAS,
    importarFoto,
    obtenerConteoParticulas,
    obtenerFotoParaArchivo,
    obtenerListaAtomos,
} from './atoms.js';
import { ELEMENTOS, MAX_ATOMOS } from './elementos.js';
import { CAPACIDADES_CAPAS, asignarCapasElectrones, obtenerCapasElectronicas } from './configuracionElectronica.js';

const FORMATO = 'moleculab-escena';
const VERSION = 2;
const VERSIONES_ACEPTADAS = [1, 2];
/** Tamaño máximo del archivo que se acepta al importar, en bytes. */
const TAMANO_MAXIMO = 200 * 1024;
/** Decimales de las posiciones al exportar, para que el archivo sea corto. */
const DECIMALES = 3;
/** Primera letra del id de cada tipo de partícula (P1, N1, E1...). */
const PREFIJO_PARTICULA = { proton: 'P', neutron: 'N', electron: 'E' };

const ICONO_EXPORTAR = `url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d=%22M12 4v11%22/%3E%3Cpath d=%22m7 10 5 5 5-5%22/%3E%3Cpath d=%22M4 20h16%22/%3E%3C/svg%3E")`;
const ICONO_IMPORTAR = `url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d=%22M12 15V4%22/%3E%3Cpath d=%22m7 9 5-5 5 5%22/%3E%3Cpath d=%22M4 20h16%22/%3E%3C/svg%3E")`;

/**
 * Dice si un objeto tiene x, y y z como números finitos.
 * @param {*} posicion Objeto a revisar.
 * @returns {boolean}
 */
function tienePosicionValida(posicion) {
    return ['x', 'y', 'z'].every((eje) => Number.isFinite(posicion?.[eje]));
}

/**
 * Valida las partículas de un archivo versión 2. Revisa tipo, id único, que
 * las libres no sean protones y que el modelo tenga protones si tiene
 * partículas. Las capas guardadas se comparan con la distribución del estado:
 * si no coinciden, se recalculan. Si la distribución no está disponible, el
 * archivo no se importa.
 * @param {*} lista Campo `particulas` del archivo.
 * @returns {{ ok: true, particulas: Array, aproximada: boolean } | { ok: false, error: string }}
 */
function validarParticulas(lista) {
    const fallo = (error) => ({ ok: false, error });
    if (!Array.isArray(lista)) return fallo('Al archivo le faltan las partículas');
    if (lista.length > MAX_PARTICULAS) {
        return fallo(`Una molécula puede tener como máximo ${MAX_PARTICULAS} partículas`);
    }

    const ids = new Set();
    const particulas = [];
    let protonesModelo = 0;
    let particulasModelo = 0;

    for (const dato of lista) {
        const { id, tipo, libre, capa, posicion } = dato ?? {};
        const prefijo = Object.hasOwn(PREFIJO_PARTICULA, tipo) ? PREFIJO_PARTICULA[tipo] : null;
        if (typeof id !== 'string' || !prefijo || !id.startsWith(prefijo)
            || !/^\d+$/.test(id.slice(prefijo.length))) {
            return fallo(`La partícula ${id ?? '(sin id)'} no es válida`);
        }
        if (ids.has(id)) return fallo(`El id ${id} está repetido`);
        ids.add(id);
        if (typeof libre !== 'boolean') return fallo(`La partícula ${id} no indica si está suelta`);
        if (!tienePosicionValida(posicion)) return fallo(`La posición de ${id} no es válida`);

        if (libre) {
            if (tipo === 'proton') return fallo(`El protón ${id} no puede estar suelto: se une al núcleo`);
        } else {
            particulasModelo += 1;
            if (tipo === 'proton') protonesModelo += 1;
        }
        particulas.push({
            id,
            tipo,
            libre,
            capa: !libre && tipo === 'electron' && Number.isInteger(capa) ? capa : -1,
            posicion: { x: posicion.x, y: posicion.y, z: posicion.z },
        });
    }

    if (particulasModelo > 0 && protonesModelo === 0) {
        return fallo('Hay partículas en el modelo de Bohr sin protones: el modelo necesita al menos un protón');
    }

    const electrones = particulas.filter((p) => !p.libre && p.tipo === 'electron');
    const distribucion = obtenerCapasElectronicas(protonesModelo, electrones.length);
    if (!distribucion.disponible) {
        return fallo('No hay una distribución electrónica disponible para este estado');
    }

    const guardadas = CAPACIDADES_CAPAS.map(() => 0);
    let fueraDeRango = false;
    for (const electron of electrones) {
        if (electron.capa >= 0 && electron.capa < guardadas.length) guardadas[electron.capa] += 1;
        else fueraDeRango = true;
    }
    const esperadas = CAPACIDADES_CAPAS.map((_, capa) => distribucion.capas[capa] ?? 0);
    const coincide = !fueraDeRango && guardadas.every((cantidad, capa) => cantidad === esperadas[capa]);
    if (!coincide) asignarCapasElectrones(electrones, distribucion.capas);

    return { ok: true, particulas, aproximada: distribucion.aproximada };
}

/**
 * Valida los datos de un archivo antes de importarlos. Revisa el formato y la
 * versión, los elementos, que los ids sean únicos, que las posiciones sean
 * números, que ningún par de átomos se encime, que los enlaces apunten a
 * átomos existentes, que ningún átomo tenga más enlaces que su valencia y, en
 * la versión 2, las partículas. No exige valencia completa: un archivo puede
 * guardar una molécula a medio armar, igual que deshacer.
 * @param {*} datos Objeto leído del archivo JSON.
 * @returns {{ ok: true, foto: { atomos: Array, enlaces: Array, particulas: Array, modeloBohr: Object | null } } | { ok: false, error: string }}
 */
function validarFoto(datos) {
    const fallo = (error) => ({ ok: false, error });

    if (!datos || typeof datos !== 'object' || datos.formato !== FORMATO) {
        return fallo('El archivo no es una molécula de MolecuLab');
    }
    if (!VERSIONES_ACEPTADAS.includes(datos.version)) {
        return fallo('La versión del archivo no es compatible con esta app');
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
        if (!tienePosicionValida(posicion)) return fallo(`La posición de ${id} no es válida`);
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

    const particulas = [];
    let modeloBohr = null;
    let aproximada = false;
    if (datos.version === 2) {
        const resultadoParticulas = validarParticulas(datos.particulas);
        if (!resultadoParticulas.ok) return fallo(resultadoParticulas.error);
        particulas.push(...resultadoParticulas.particulas);
        aproximada = resultadoParticulas.aproximada;

        if (datos.modeloBohr != null) {
            if (!tienePosicionValida(datos.modeloBohr)) {
                return fallo('La posición del modelo de Bohr no es válida');
            }
            modeloBohr = { x: datos.modeloBohr.x, y: datos.modeloBohr.y, z: datos.modeloBohr.z };
        }
    }

    return { ok: true, foto: { atomos, enlaces, particulas, modeloBohr }, aproximada };
}

/**
 * Descarga la escena actual como archivo .json. No cambia la escena ni el
 * historial. Se puede exportar aunque todavía falte completar un átomo.
 * @returns {boolean} false si no hay átomos ni partículas que exportar.
 */
export function exportarMolecula() {
    const foto = obtenerFotoParaArchivo();
    if (foto.atomos.length === 0 && foto.particulas.length === 0) {
        emit('ui:mensaje', { tipo: 'aviso', texto: 'Todavía no hay nada para exportar' });
        return false;
    }

    const redondear = (valor) => Number(valor.toFixed(DECIMALES));
    const redondearPosicion = (p) => ({ x: redondear(p.x), y: redondear(p.y), z: redondear(p.z) });
    const datos = {
        formato: FORMATO,
        version: VERSION,
        creado: new Date().toISOString(),
        atomos: foto.atomos.map((atomo) => ({
            id: atomo.id,
            elemento: atomo.elemento,
            posicion: redondearPosicion(atomo.posicion),
        })),
        enlaces: foto.enlaces,
        particulas: foto.particulas.map((particula) => ({
            id: particula.id,
            tipo: particula.tipo,
            libre: particula.libre,
            capa: particula.capa,
            posicion: redondearPosicion(particula.posicion),
        })),
        modeloBohr: foto.modeloBohr ? redondearPosicion(foto.modeloBohr) : null,
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
 * Si la escena tiene átomos, enlaces o partículas, pide confirmación antes.
 * Si se cancela o el archivo no es válido, la escena no cambia.
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

    const hayContenido = obtenerListaAtomos().length > 0 || obtenerConteoParticulas().total > 0;
    if (hayContenido
        && !window.confirm('¿Reemplazar la escena actual con la molécula del archivo?')) {
        return;
    }
    importarFoto(resultado.foto);
    if (resultado.aproximada) {
        emit('ui:mensaje', { tipo: 'aviso', texto: 'Distribución electrónica aproximada. No se dispone de una configuración de referencia para este estado.' });
    }
}

/**
 * Conecta los botones Exportar e Importar de la barra de respaldo y
 * agrega sus íconos. Devuelve true si los botones existen.
 * @returns {boolean}
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