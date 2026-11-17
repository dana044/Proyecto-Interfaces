/**
 * @file atoms.js
 * @description Átomos y enlaces 3D: esferas con color por elemento y cilindros para enlaces simples y dobles.
 * Agrega, mueve y elimina átomos; dibuja enlaces; emite eventos de escena según el contrato.
 * @author Citlaly Morales Viveros
 */

import * as THREE from 'three';
import { obtenerContenedorAtomos } from './scene.js';
import { emit } from './bus.js';

const MAX_ATOMOS = 20;
const ALTURA_ENLACE_DOBLE = 0.08;

const ELEMENTOS = {
    H: { color: 0xffffff, radio: 0.3, bordeOscuro: true },
    C: { color: 0x404040, radio: 0.45 },
    N: { color: 0x3050f8, radio: 0.42 },
    O: { color: 0xff0d0d, radio: 0.42 }
};

const COLOR_RESALTADO = 0xfacc15;
const EJE_UP = new THREE.Vector3(0, 1, 0);

const atomos = new Map();
const enlaces = new Map();
const contadores = { H: 0, C: 0, N: 0, O: 0 };
let seleccionado = null;

function claveEnlace(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function crearEtiqueta(simbolo) {
    const lienzo = document.createElement('canvas');
    lienzo.width = 128;
    lienzo.height = 128;
    const ctx = lienzo.getContext('2d');
    ctx.font = 'bold 84px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = simbolo === 'H' ? '#202331' : '#ffffff';
    ctx.strokeStyle = simbolo === 'H' ? '#202331' : '#000000';
    ctx.lineWidth = 6;
    ctx.strokeText(simbolo, 64, 64);
    ctx.fillText(simbolo, 64, 64);

    const material = new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(lienzo),
        depthTest: false
    });
    const etiqueta = new THREE.Sprite(material);
    etiqueta.scale.set(0.5, 0.5, 1);
    etiqueta.renderOrder = 2;
    return etiqueta;
}

function crearAtomoVisual(elemento) {
    const config = ELEMENTOS[elemento];
    const grupo = new THREE.Group();

    const esfera = new THREE.Mesh(
        new THREE.SphereGeometry(config.radio, 32, 24),
        new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.4 })
    );
    grupo.add(esfera);

    if (config.bordeOscuro) {
        const contorno = new THREE.Mesh(
            new THREE.SphereGeometry(config.radio * 1.02, 32, 24),
            new THREE.MeshBasicMaterial({ color: 0x202331, wireframe: true, transparent: true, opacity: 0.25 })
        );
        grupo.add(contorno);
    }

    const etiqueta = crearEtiqueta(elemento);
    etiqueta.position.set(0, config.radio + 0.25, 0);
    grupo.add(etiqueta);

    return { grupo, esfera, radio: config.radio };
}

function generarId(elemento) {
    contadores[elemento] += 1;
    return `${elemento}${contadores[elemento]}`;
}

function enviarMensaje(tipo, texto) {
    emit('ui:mensaje', { tipo, texto });
}

/**
 * Agrega un átomo del elemento indicado en la posición {x, y, z}.
 * Devuelve el id del átomo o null si no se pudo agregar.
 */
export function agregarAtomo(elemento, posicion = { x: 0, y: 0, z: 0 }) {
    if (!ELEMENTOS[elemento]) {
        enviarMensaje('aviso', 'Todavía no conozco ese elemento; puedo agregar hidrógeno, carbono, nitrógeno u oxígeno');
        return null;
    }
    if (atomos.size >= MAX_ATOMOS) {
        enviarMensaje('aviso', 'Ya llegaste al límite de 20 átomos');
        return null;
    }

    const contenedor = obtenerContenedorAtomos();
    if (!contenedor) return null;

    const id = generarId(elemento);
    const visual = crearAtomoVisual(elemento);
    visual.grupo.position.set(posicion.x, posicion.y, posicion.z);
    visual.grupo.userData.id = id;
    contenedor.add(visual.grupo);

    atomos.set(id, {
        id,
        elemento,
        grupo: visual.grupo,
        esfera: visual.esfera,
        radio: visual.radio,
        enlaces: new Set()
    });

    emit('escena:atomo-agregado', { id, elemento });
    return id;
}

/** Mueve un átomo a la posición {x, y, z} y actualiza sus enlaces. */
export function moverAtomo(id, posicion) {
    const atomo = atomos.get(id);
    if (!atomo) return false;

    atomo.grupo.position.set(posicion.x, posicion.y, posicion.z);
    for (const otroId of atomo.enlaces) {
        actualizarEnlace(id, otroId);
    }
    return true;
}

/** Quita un átomo y todos sus enlaces. */
export function eliminarAtomo(id) {
    const atomo = atomos.get(id);
    if (!atomo) return false;

    for (const otroId of [...atomo.enlaces]) {
        quitarEnlace(id, otroId);
    }
    obtenerContenedorAtomos().remove(atomo.grupo);
    liberarGrupo(atomo.grupo);
    atomos.delete(id);

    if (seleccionado === id) seleccionado = null;
    return true;
}

/**
 * Crea un enlace entre dos átomos.
 * orden 1 dibuja un cilindro y orden 2 dibuja dos cilindros paralelos.
 * Esta función solo dibuja: la validación de valencias se hace en el módulo de química.
 */
export function crearEnlace(idA, idB, orden = 1) {
    if (!atomos.has(idA) || !atomos.has(idB) || idA === idB) return false;

    const clave = claveEnlace(idA, idB);
    if (enlaces.has(clave)) quitarEnlace(idA, idB);

    const grupo = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.6 });
    const cilindros = [];
    const cantidad = orden === 2 ? 2 : 1;

    for (let i = 0; i < cantidad; i++) {
        const cilindro = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 16), material);
        grupo.add(cilindro);
        cilindros.push(cilindro);
    }

    obtenerContenedorAtomos().add(grupo);
    enlaces.set(clave, { a: idA, b: idB, orden: cantidad, grupo, cilindros });
    atomos.get(idA).enlaces.add(idB);
    atomos.get(idB).enlaces.add(idA);

    actualizarEnlace(idA, idB);
    emit('escena:enlace-creado', { a: idA, b: idB, orden: cantidad });
    return true;
}

function quitarEnlace(idA, idB) {
    const clave = claveEnlace(idA, idB);
    const enlace = enlaces.get(clave);
    if (!enlace) return;

    obtenerContenedorAtomos().remove(enlace.grupo);
    liberarGrupo(enlace.grupo);
    enlaces.delete(clave);
    atomos.get(idA)?.enlaces.delete(idB);
    atomos.get(idB)?.enlaces.delete(idA);
}

/** Recalcula posición, longitud y dirección de los cilindros de un enlace. */
function actualizarEnlace(idA, idB) {
    const enlace = enlaces.get(claveEnlace(idA, idB));
    const atomoA = atomos.get(idA);
    const atomoB = atomos.get(idB);
    if (!enlace || !atomoA || !atomoB) return;

    const pA = atomoA.grupo.position;
    const pB = atomoB.grupo.position;
    const direccion = new THREE.Vector3().subVectors(pB, pA);
    const longitud = Math.max(direccion.length() - atomoA.radio - atomoB.radio, 0.05);
    const normal = direccion.clone().normalize();
    const medio = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);

    const eje = Math.abs(normal.dot(EJE_UP)) > 0.99 ? new THREE.Vector3(1, 0, 0) : EJE_UP;
    const desplazamiento = new THREE.Vector3().crossVectors(normal, eje).normalize().multiplyScalar(ALTURA_ENLACE_DOBLE);
    const orientacion = new THREE.Quaternion().setFromUnitVectors(EJE_UP, normal);

    enlace.cilindros.forEach((cilindro, i) => {
        const separacion = enlace.cilindros.length === 2 ? (i === 0 ? 1 : -1) : 0;
        cilindro.position.copy(medio).addScaledVector(desplazamiento, separacion);
        cilindro.quaternion.copy(orientacion);
        cilindro.scale.set(1, longitud, 1);
    });
}

/** Marca un átomo como seleccionado con un borde brillante. Pasa null para quitar la selección. */
export function seleccionarAtomo(id) {
    if (seleccionado && atomos.has(seleccionado)) {
        atomos.get(seleccionado).esfera.material.emissive.setHex(0x000000);
    }
    seleccionado = null;

    const atomo = atomos.get(id);
    if (atomo) {
        atomo.esfera.material.emissive.setHex(COLOR_RESALTADO);
        atomo.esfera.material.emissiveIntensity = 0.4;
        seleccionado = id;
    }
    return seleccionado;
}

/** Quita todos los átomos y enlaces de la escena. */
export function limpiarEscena() {
    for (const clave of [...enlaces.keys()]) {
        const [a, b] = clave.split('|');
        quitarEnlace(a, b);
    }
    for (const id of [...atomos.keys()]) {
        eliminarAtomo(id);
    }
    seleccionado = null;
    for (const elemento of Object.keys(contadores)) {
        contadores[elemento] = 0;
    }
}

/** Devuelve la lista de átomos con su id, elemento y posición actual. */
export function obtenerListaAtomos() {
    return [...atomos.values()].map((a) => ({
        id: a.id,
        elemento: a.elemento,
        posicion: { x: a.grupo.position.x, y: a.grupo.position.y, z: a.grupo.position.z }
    }));
}

function liberarGrupo(grupo) {
    grupo.traverse((objeto) => {
        if (objeto.geometry) objeto.geometry.dispose();
        if (objeto.material) {
            if (objeto.material.map) objeto.material.map.dispose();
            objeto.material.dispose();
        }
    });
}