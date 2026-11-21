/**
 * @file chemistry.js
 * @description Formación de enlaces por cercanía con validación de
 * valencias.
 *
 * Es el núcleo educativo: al soltar un átomo cerca de otro, solo se
 * unen si ambos tienen valencia libre. Repetir la unión convierte
 * un enlace simple en doble (necesario para O2 y CO2). Nunca se
 * excede la valencia (H 1, O 2, N 3, C 4).
 *
 * Este módulo es lógica pura + anillos de valencia: no importa
 * atoms.js, scene.js ni el bus, para que atoms.js pueda importarlo
 * sin crear una dependencia circular. atoms.js es quien llama a
 * evaluarUnion() al soltar un átomo y quien emite los eventos
 * escena:enlace-creado / escena:enlace-rechazado.
 *
 * @author Citlaly Morales Viveros
 */

import * as THREE from 'three';
import { ELEMENTOS } from './elementos.js';

/** Distancia máxima para intentar un enlace, en veces la suma de radios. */
export const FACTOR_PROXIMIDAD = 2;

const COLOR_ARO_COMPLETO = 0x15803d;
const COLOR_ARO_INCOMPLETO = 0x9ca3af;
const COLOR_PUNTO_LIBRE = 0xffffff;

/** Valencia de un elemento (0 si no está en el catálogo). */
export function valenciaDe(elemento) {
    return ELEMENTOS[elemento]?.valencia ?? 0;
}

/** Radio de un elemento (0.4 si no está en el catálogo). */
export function radioDe(elemento) {
    return ELEMENTOS[elemento]?.radio ?? 0.4;
}

/**
 * Suma de órdenes de enlace que ya tiene un átomo.
 * @param {string} id
 * @param {Array<{a: string, b: string, orden: number}>} enlaces
 */
export function enlacesUsados(id, enlaces) {
    let usados = 0;
    for (const enlace of enlaces) {
        if (enlace.a === id || enlace.b === id) usados += enlace.orden || 1;
    }
    return usados;
}

/** Valencia que le queda libre a un átomo (nunca negativa). */
export function valenciaLibre(elemento, usados) {
    return Math.max(valenciaDe(elemento) - usados, 0);
}

/** Motivo en lenguaje sencillo cuando un elemento ya no puede enlazarse. */
export function motivoValenciaLlena(elemento) {
    const nombre = (ELEMENTOS[elemento]?.nombre ?? elemento).toLowerCase();
    const valencia = valenciaDe(elemento);
    if (valencia === 0) return `El ${nombre} no puede hacer enlaces.`;
    if (valencia === 1) return `El ${nombre} solo puede hacer 1 enlace.`;
    return `El ${nombre} solo puede hacer ${valencia} enlaces.`;
}

/**
 * Símbolo del elemento con ese número atómico (Z = protones), o
 * null si no está entre los 10 elementos del prototipo.
 * @param {number} protones Cantidad de protones (número atómico).
 * @returns {string|null} El símbolo del elemento.
 */
export function elementoPorProtones(protones) {
    for (const [simbolo, config] of Object.entries(ELEMENTOS)) {
        if (config.z === protones) return simbolo;
    }
    return null;
}

/**
 * Identifica el elemento que se formó en el modelo de Bohr según
 * sus protones, y su masa aproximada (protones + neutrones). Los
 * neutrones no cambian el elemento, solo la masa.
 * @param {number} protones Cantidad de protones.
 * @param {number} neutrones Cantidad de neutrones.
 * @returns {{ simbolo: string, nombre: string, z: number, valencia: number, masa: number, mensaje: string } | { simbolo: null, motivo: string }}
 *   El elemento formado, o el motivo en lenguaje sencillo si no se
 *   formó ninguno.
 */
export function identificarElemento(protones, neutrones) {
    if (protones <= 0) {
        return { simbolo: null, motivo: 'Agrega protones para formar un elemento.' };
    }
    const simbolo = elementoPorProtones(protones);
    if (!simbolo) {
        return { simbolo: null, motivo: 'Todavía no conozco ese elemento hasta el neón.' };
    }
    const config = ELEMENTOS[simbolo];
    return {
        simbolo,
        nombre: config.nombre,
        z: config.z,
        valencia: config.valencia,
        masa: protones + neutrones,
        mensaje: `Formaste ${config.nombre.toLowerCase()} · Z = ${config.z}`,
    };
}

/**
 * Decide si dos átomos pueden unirse.
 *
 * @param {object} datos
 * @param {string} datos.idA
 * @param {string} datos.elementoA
 * @param {string} datos.idB
 * @param {string} datos.elementoB
 * @param {number} [datos.ordenActual=0] Orden del enlace que ya hay
 *   entre ellos (0 si no hay, 1 si es simple, 2 si es doble).
 * @param {Array} [datos.enlaces=[]] Enlaces actuales de la escena.
 * @returns {{ok: boolean, accion: 'crear'|'convertir-doble'|'nada'|'rechazado',
 *   nuevoOrden: number, motivo: string|null}}
 */
export function evaluarUnion({ idA, elementoA, idB, elementoB, ordenActual = 0, enlaces = [] }) {
    if (!idA || !idB || idA === idB || !elementoA || !elementoB) {
        return { ok: false, accion: 'rechazado', nuevoOrden: ordenActual, motivo: 'No se pueden unir dos átomos iguales a sí mismos.' };
    }

    // Ya tienen un enlace doble: no hay triple en este prototipo, pero
    // tampoco es un error del estudiante, solo estaba moviendo la
    // molécula. No se hace nada, no se sacude y no se rechaza.
    if (ordenActual >= 2) {
        return { ok: true, accion: 'nada', nuevoOrden: 2, motivo: null };
    }

    const libresA = valenciaLibre(elementoA, enlacesUsados(idA, enlaces));
    const libresB = valenciaLibre(elementoB, enlacesUsados(idB, enlaces));

    if (libresA < 1 || libresB < 1) {
        const motivos = [];
        if (libresA < 1) motivos.push(motivoValenciaLlena(elementoA));
        if (libresB < 1) motivos.push(motivoValenciaLlena(elementoB));
        return { ok: false, accion: 'rechazado', nuevoOrden: ordenActual, motivo: motivos.join(' ') };
    }

    if (ordenActual === 1) {
        return { ok: true, accion: 'convertir-doble', nuevoOrden: 2, motivo: null };
    }
    return { ok: true, accion: 'crear', nuevoOrden: 1, motivo: null };
}

/**
 * Busca el átomo más cercano al soltado, dentro del umbral de
 * 1.2 veces la suma de los radios. Devuelve null si no hay ninguno.
 *
 * @param {{id: string, elemento: string, posicion: {x: number, y: number, z: number}}} soltado
 * @param {Array} listaAtomos Lista de obtenerListaAtomos().
 */
export function buscarVecinoMasCercano(soltado, listaAtomos) {
    let mejor = null;
    let mejorDistancia = Infinity;

    for (const otro of listaAtomos) {
        if (otro.id === soltado.id) continue;
        const distancia = Math.hypot(
            otro.posicion.x - soltado.posicion.x,
            otro.posicion.y - soltado.posicion.y,
            otro.posicion.z - soltado.posicion.z
        );
        const umbral = FACTOR_PROXIMIDAD * (radioDe(soltado.elemento) + radioDe(otro.elemento));
        if (distancia < umbral && distancia < mejorDistancia) {
            mejorDistancia = distancia;
            mejor = { vecino: otro, distancia, umbral };
        }
    }
    return mejor;
}

/** Quita los hijos de un grupo liberando su geometría y su material. */
function vaciarGrupo(grupo) {
    for (const hijo of [...grupo.children]) {
        grupo.remove(hijo);
        if (hijo.geometry) hijo.geometry.dispose();
        if (hijo.material) hijo.material.dispose();
    }
}

/**
 * Dibuja el aro de valencia de un átomo.
 * - Valencia completa: aro verde sólido, sin puntos.
 * - Si le quedan enlaces: aro gris con un punto blanco por cada
 *   enlace que aún le queda.
 */
export function actualizarAnilloValencia(grupo, radio, libres) {
    if (!grupo) return;
    vaciarGrupo(grupo);

    const completa = libres <= 0;
    const aro = new THREE.Mesh(
        new THREE.TorusGeometry(radio + 0.18, 0.03, 8, 48),
        new THREE.MeshBasicMaterial({
            color: completa ? COLOR_ARO_COMPLETO : COLOR_ARO_INCOMPLETO,
        })
    );
    aro.rotation.x = Math.PI / 2;
    grupo.add(aro);

    for (let i = 0; i < libres; i++) {
        const angulo = (i / libres) * Math.PI * 2;
        const punto = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 12, 8),
            new THREE.MeshBasicMaterial({ color: COLOR_PUNTO_LIBRE })
        );
        punto.position.set(
            Math.cos(angulo) * (radio + 0.18),
            0,
            Math.sin(angulo) * (radio + 0.18)
        );
        grupo.add(punto);
    }

    grupo.userData.libres = libres;
    grupo.userData.completa = completa;
}

/** Crea el grupo del aro de valencia de un átomo recién agregado. */
export function crearAnilloValencia(radio, libres) {
    const grupo = new THREE.Group();
    grupo.name = 'anillo-valencia';
    actualizarAnilloValencia(grupo, radio, libres);
    return grupo;
}

/** Mueve un grupo a un destino en `duracionMs` milisegundos. */
export function animarHasta(grupo, destino, duracionMs = 180) {
    const fin = new THREE.Vector3(destino.x, destino.y, destino.z);
    if (typeof requestAnimationFrame === 'undefined') {
        grupo.position.copy(fin);
        return Promise.resolve();
    }

    const inicio = grupo.position.clone();
    const inicioTiempo = performance.now();

    return new Promise((resolver) => {
        function paso(ahora) {
            const progreso = Math.min((ahora - inicioTiempo) / duracionMs, 1);
            grupo.position.lerpVectors(inicio, fin, progreso);
            if (progreso < 1) requestAnimationFrame(paso);
            else resolver();
        }
        requestAnimationFrame(paso);
    });
}

/**
 * Sacude un grupo y lo devuelve a su origen. Se usa cuando se
 * rechaza un enlace: el átomo se sacude y vuelve a su sitio.
 */
export function animarSacudida(grupo, origen, duracionMs = 350) {
    const fin = new THREE.Vector3(origen.x, origen.y, origen.z);
    if (typeof requestAnimationFrame === 'undefined') {
        grupo.position.copy(fin);
        return Promise.resolve();
    }

    const inicioTiempo = performance.now();

    return new Promise((resolver) => {
        function paso(ahora) {
            const progreso = Math.min((ahora - inicioTiempo) / duracionMs, 1);
            const sacudida = Math.sin(progreso * Math.PI * 4) * 0.08 * (1 - progreso);
            grupo.position.set(fin.x + sacudida, fin.y, fin.z);
            if (progreso < 1) requestAnimationFrame(paso);
            else {
                grupo.position.copy(fin);
                resolver();
            }
        }
        requestAnimationFrame(paso);
    });
}

/**
 * Inicio del módulo de química. No hay estado que arrancar: la
 * validación es pura y los anillos se crean con cada átomo. Solo
 * deja constancia de que el módulo está activo.
 */
export function iniciarQuimica() {
    return true;
}
