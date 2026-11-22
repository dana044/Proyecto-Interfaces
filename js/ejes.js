/**
 * @file ejes.js
 * @description Indicador de ejes dentro de la escena 3D, arriba a la derecha.
 * Las flechas X, Y, Z eligen el plano de movimiento: Y la base (horizontal)
 * y X o Z un plano vertical. Base y Altura también lo eligen, y la casita
 * vuelve a la vista inicial. Los átomos se mueven en 2D sobre ese plano.
 * Teclas: X, Y, Z eligen el plano, B la base, V la altura e Inicio (Home)
 * vuelve a la vista inicial.
 * @author Citlaly Morales Viveros
 */

import * as THREE from 'three';
import { emit } from './bus.js';
import { obtenerCamara, vistaInicial } from './scene.js';

const NS = 'http://www.w3.org/2000/svg';
const CENTRO = 60;
const LONGITUD_FLECHA = 36;

/**
 * Cuando la cámara mira hacia abajo con al menos este componente en Y
 * (-1 es mirando directo hacia abajo), el plano por defecto es la base.
 * Si no, es el plano vertical de frente a la cámara (altura).
 */
export const UMBRAL_ARRIBA = -0.25;

/**
 * Ejes del mundo con su color, igual que el indicador de referencia:
 * X rojo, Y azul y Z verde.
 */
export const EJES = [
    { nombre: 'X', color: '#dc2626', vector: new THREE.Vector3(1, 0, 0) },
    { nombre: 'Y', color: '#2563eb', vector: new THREE.Vector3(0, 1, 0) },
    { nombre: 'Z', color: '#16a34a', vector: new THREE.Vector3(0, 0, 1) },
];

/**
 * Modo de movimiento: 'auto' (según la cámara), 'base' (plano horizontal)
 * o 'altura' (plano vertical). En altura, normalFija indica el eje normal
 * del plano (0 para X, 2 para Z); si es null, el plano mira a la cámara.
 */
let modo = 'auto';
let normalFija = null;

let cajaEjes = null;
let lineas = [];
let botones = [];
let botonesPlano = {};
let leyenda = null;
let textoLeyenda = '';

/** Plano horizontal (base): normal Y. */
function planoBase() {
    return { tipo: 'plano', normal: EJES[1].vector.clone() };
}

/** Normal del plano vertical que mira a la cámara: X o Z, el más de frente. */
function normalAltura() {
    const camara = obtenerCamara();
    if (!camara) return EJES[2].vector.clone();

    const mirada = camara.getWorldDirection(new THREE.Vector3());
    return Math.abs(mirada.x) >= Math.abs(mirada.z)
        ? EJES[0].vector.clone()
        : EJES[2].vector.clone();
}

/**
 * Plano de movimiento que está activo ahora: { tipo: 'plano', normal }.
 * Los átomos se mueven en 2D sobre ese plano, con cuatro direcciones.
 * @returns {{tipo: string, normal: THREE.Vector3}}
 */
export function restriccionActiva() {
    if (modo === 'base') return planoBase();
    if (modo === 'altura') {
        return {
            tipo: 'plano',
            normal: normalFija !== null ? EJES[normalFija].vector.clone() : normalAltura(),
        };
    }

    const camara = obtenerCamara();
    if (camara) {
        const mirada = camara.getWorldDirection(new THREE.Vector3());
        if (mirada.y <= UMBRAL_ARRIBA) return planoBase();
    }
    return { tipo: 'plano', normal: normalAltura() };
}

/** Texto que describe un plano, para mensajes y la leyenda. */
function describirPlano(normal) {
    if (Math.abs(normal.y) > 0.5) return 'base (plano XZ)';
    return Math.abs(normal.x) > 0.5 ? 'altura (plano ZY)' : 'altura (plano XY)';
}

/**
 * Cambia el modo. Si el modo pedido ya estaba activo, vuelve al automático.
 * @param {'base' | 'altura'} nuevo
 * @param {number | null} normal Índice del eje normal en altura, o null.
 */
function fijarModo(nuevo, normal = null) {
    const igual = modo === nuevo && normalFija === normal;
    modo = igual ? 'auto' : nuevo;
    normalFija = igual ? null : normal;
    anunciarCambio();
}

/**
 * Las flechas del indicador: Y elige la base; X y Z eligen el plano
 * vertical con esa normal (ZY y XY respectivamente).
 * @param {number} indice 0 para X, 1 para Y, 2 para Z.
 */
export function elegirEje(indice) {
    if (indice === 1) fijarModo('base');
    else fijarModo('altura', indice);
}

/**
 * Elige el plano a mano: 'base' o 'altura' (de frente a la cámara).
 * @param {'base' | 'altura'} nombre
 */
export function elegirPlano(nombre) {
    fijarModo(nombre);
}

function anunciarCambio() {
    const descripcion = describirPlano(restriccionActiva().normal);
    const texto = modo === 'auto'
        ? `Movimiento automático en ${descripcion}`
        : `Los átomos se mueven en ${descripcion}`;
    emit('ui:mensaje', { tipo: 'aviso', texto });
    emit('ejes:cambio', { modo, normalFija });
}

/**
 * Crea el indicador de ejes dentro de #lienzo-3d y empieza a seguir la
 * cámara. Devuelve true si se creó y false si no hay escena o ya existía.
 */
export function iniciarEjes() {
    const lienzo = document.getElementById('lienzo-3d');
    if (!lienzo || document.getElementById('indicador-ejes')) return false;

    const estilo = document.createElement('style');
    estilo.id = 'estilos-ejes';
    estilo.textContent = `
        #indicador-ejes { position: absolute; top: 16px; right: 16px; z-index: 20; width: 132px; display: flex; flex-direction: column; align-items: center; gap: 8px; font-family: Inter, system-ui, sans-serif; }
        #indicador-ejes .ejes-caja { position: relative; width: 120px; height: 120px; border-radius: 50%; background: var(--superficie, #ffffff); border: 1px solid var(--borde, #d1d5db); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15); }
        #indicador-ejes svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        #indicador-ejes .ejes-eje { position: absolute; width: 24px; height: 24px; margin: -12px 0 0 -12px; padding: 0; border: 2px solid #fff; border-radius: 50%; color: #fff; font: 700 12px/1 Inter, system-ui, sans-serif; cursor: pointer; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); }
        #indicador-ejes .ejes-eje.activo { box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.45); }
        #indicador-ejes .ejes-fila { display: flex; gap: 6px; align-items: center; }
        #indicador-ejes .ejes-plano { padding: 4px 10px; border: 1px solid var(--borde, #d1d5db); border-radius: 999px; background: var(--superficie, #ffffff); color: var(--texto, #111827); font: 600 12px/1.2 Inter, system-ui, sans-serif; cursor: pointer; }
        #indicador-ejes .ejes-plano.activo { background: var(--accion, #111827); color: #fff; border-color: transparent; }
        #indicador-ejes .ejes-casita { width: 30px; height: 30px; border: none; border-radius: 50%; background: var(--accion, #111827); color: #fff; display: grid; place-items: center; cursor: pointer; }
        #indicador-ejes .ejes-leyenda { font-size: 12px; color: var(--texto-secundario, #374151); background: var(--superficie, #ffffff); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
        #indicador-ejes button:focus-visible { outline: 2px solid var(--accion, #111827); outline-offset: 2px; }
    `;
    document.head.appendChild(estilo);

    const contenedor = document.createElement('div');
    contenedor.id = 'indicador-ejes';

    cajaEjes = document.createElement('div');
    cajaEjes.className = 'ejes-caja';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('aria-hidden', 'true');
    lineas = EJES.map((eje) => {
        const linea = document.createElementNS(NS, 'line');
        linea.setAttribute('x1', CENTRO);
        linea.setAttribute('y1', CENTRO);
        linea.setAttribute('stroke', eje.color);
        linea.setAttribute('stroke-width', '3');
        linea.setAttribute('stroke-linecap', 'round');
        svg.appendChild(linea);
        return linea;
    });
    const punto = document.createElementNS(NS, 'circle');
    punto.setAttribute('cx', CENTRO);
    punto.setAttribute('cy', CENTRO);
    punto.setAttribute('r', '3');
    punto.setAttribute('fill', '#374151');
    svg.appendChild(punto);
    cajaEjes.appendChild(svg);

    botones = EJES.map((eje, i) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'ejes-eje';
        boton.textContent = eje.nombre;
        boton.style.background = eje.color;
        const descripcion = i === 1
            ? 'Base: mover los átomos sobre el plano horizontal'
            : `Altura: mover los átomos sobre el plano vertical de ${eje.nombre}`;
        boton.title = descripcion;
        boton.setAttribute('aria-label', descripcion);
        boton.addEventListener('click', () => elegirEje(i));
        cajaEjes.appendChild(boton);
        return boton;
    });

    const fila = document.createElement('div');
    fila.className = 'ejes-fila';

    const planos = [
        ['base', 'Base', 'Plano horizontal: los átomos se mueven sobre la base'],
        ['altura', 'Altura', 'Plano vertical: los átomos se mueven de frente a la cámara'],
    ];
    botonesPlano = {};
    planos.forEach(([nombre, texto, descripcion]) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'ejes-plano';
        boton.textContent = texto;
        boton.title = descripcion;
        boton.setAttribute('aria-label', descripcion);
        boton.addEventListener('click', () => elegirPlano(nombre));
        fila.appendChild(boton);
        botonesPlano[nombre] = boton;
    });

    const casita = document.createElement('button');
    casita.type = 'button';
    casita.className = 'ejes-casita';
    casita.setAttribute('aria-label', 'Volver a la vista inicial');
    casita.title = 'Vista inicial (Inicio)';
    casita.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg>';
    casita.addEventListener('click', () => {
        vistaInicial();
        emit('ui:mensaje', { tipo: 'aviso', texto: 'Vista inicial: desde arriba, sobre el eje Y' });
    });
    fila.appendChild(casita);

    leyenda = document.createElement('div');
    leyenda.className = 'ejes-leyenda';
    leyenda.setAttribute('aria-live', 'polite');

    contenedor.append(cajaEjes, fila, leyenda);
    lienzo.appendChild(contenedor);

    document.addEventListener('keydown', manejarTeclas);
    requestAnimationFrame(actualizarEjes);
    return true;
}

/** Teclas: X, Y, Z eligen el plano; B la base; V la altura; Inicio, la vista inicial. */
function manejarTeclas(evento) {
    if (evento.defaultPrevented || evento.repeat || evento.isComposing
        || evento.altKey || evento.ctrlKey || evento.metaKey) return;

    const objetivo = evento.target;
    if (objetivo instanceof HTMLElement && (objetivo.isContentEditable
        || objetivo.closest('input, textarea, select, [contenteditable]'))) return;
    if (document.querySelector('dialog[open]')) return;

    const eje = { KeyX: 0, KeyY: 1, KeyZ: 2 }[evento.code];
    if (eje !== undefined) {
        evento.preventDefault();
        elegirEje(eje);
        return;
    }
    if (evento.code === 'KeyB' || evento.code === 'KeyV') {
        evento.preventDefault();
        elegirPlano(evento.code === 'KeyB' ? 'base' : 'altura');
        return;
    }
    if (evento.code === 'Home') {
        evento.preventDefault();
        vistaInicial();
    }
}

/** Redibuja flechas, botones y leyenda según la orientación de la cámara. */
function actualizarEjes() {
    requestAnimationFrame(actualizarEjes);

    const camara = obtenerCamara();
    if (!camara) return;

    const derecha = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 0);
    const arriba = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 1);
    const haciaCamara = camara.getWorldDirection(new THREE.Vector3()).negate();
    const activa = restriccionActiva();
    const esBase = Math.abs(activa.normal.y) > 0.5;
    const ejeActivo = esBase ? 1 : (Math.abs(activa.normal.x) > 0.5 ? 0 : 2);

    EJES.forEach((eje, i) => {
        const x = eje.vector.dot(derecha);
        const y = eje.vector.dot(arriba);
        const finX = CENTRO + x * LONGITUD_FLECHA;
        const finY = CENTRO - y * LONGITUD_FLECHA;

        lineas[i].setAttribute('x2', finX.toFixed(2));
        lineas[i].setAttribute('y2', finY.toFixed(2));

        const boton = botones[i];
        boton.style.left = `${finX.toFixed(2)}px`;
        boton.style.top = `${finY.toFixed(2)}px`;
        boton.style.zIndex = String(Math.round(10 + eje.vector.dot(haciaCamara) * 5));
        boton.classList.toggle('activo', i === ejeActivo);
        const pulsado = (i === 1 && modo === 'base') || (i !== 1 && modo === 'altura' && normalFija === i);
        boton.setAttribute('aria-pressed', String(pulsado));
    });

    botonesPlano.base.classList.toggle('activo', esBase);
    botonesPlano.altura.classList.toggle('activo', !esBase);
    botonesPlano.base.setAttribute('aria-pressed', String(modo === 'base'));
    botonesPlano.altura.setAttribute('aria-pressed', String(modo === 'altura'));

    const texto = `Mover en ${describirPlano(activa.normal)}${modo === 'auto' ? ' · automático' : ' · fijo'}`;
    if (texto !== textoLeyenda) {
        textoLeyenda = texto;
        leyenda.textContent = texto;
    }
}