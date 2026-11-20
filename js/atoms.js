/**
 * @file atoms.js
 * @description Átomos, enlaces y arrastre en la escena 3D de MolecuLab.
 * @author Citlaly Morales Viveros
 */

import * as THREE from 'three';
import { obtenerCamara, obtenerContenedorAtomos, obtenerLienzo } from './scene.js';
import { emit, on } from './bus.js';
import { AVISO_ELEMENTO_DESCONOCIDO, ELEMENTOS, MAX_ATOMOS } from './elementos.js';
import { setUltimaAccion } from './state.js';

const ALTURA_ENLACE_DOBLE = 0.08;
const FACTOR_TOLERANCIA_PELLIZCO = 1.5;
const PASO_TECLADO = 0.1;
const COLOR_RESALTADO = 0xfacc15;
const EJE_UP = new THREE.Vector3(0, 1, 0);

const atomos = new Map();
const enlaces = new Map();
const contadores = Object.fromEntries(
    Object.keys(ELEMENTOS).map((simbolo) => [simbolo, 0])
);

let seleccionado = null;
let arrastre = null;

/* Historial para Deshacer (HU-16, versión mínima): fotos de la escena
   antes de cada agregado y de cada limpieza. Solo deshace agregar y
   limpiar; mover átomos con el arrastre todavía no se deshace. */
const historial = [];
let restaurando = false;
let catalogoMoleculas = null;

function guardarFoto() {
    if (restaurando) return;
    historial.push(obtenerListaAtomos());
    if (historial.length > 50) historial.shift();
}
let arrastreIniciado = false;
const rayo = new THREE.Raycaster();

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
        depthTest: false,
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
        new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: 0.4,
        })
    );
    grupo.add(esfera);

    // El contorno de selección empieza oculto.
    const borde = new THREE.Mesh(
        new THREE.SphereGeometry(config.radio * 1.12, 32, 24),
        new THREE.MeshBasicMaterial({
            color: COLOR_RESALTADO,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.9,
        })
    );
    borde.visible = false;
    grupo.add(borde);

    if (config.bordeOscuro) {
        const contorno = new THREE.Mesh(
            new THREE.SphereGeometry(config.radio * 1.02, 32, 24),
            new THREE.MeshBasicMaterial({
                color: 0x202331,
                wireframe: true,
                transparent: true,
                opacity: 0.25,
            })
        );
        grupo.add(contorno);
    }

    const etiqueta = crearEtiqueta(elemento);
    etiqueta.position.set(0, config.radio + 0.25, 0);
    grupo.add(etiqueta);

    return { grupo, esfera, borde, radio: config.radio };
}

function generarId(elemento) {
    contadores[elemento] += 1;
    return `${elemento}${contadores[elemento]}`;
}

function enviarMensaje(tipo, texto) {
    emit('ui:mensaje', { tipo, texto });
}

function buscarPosicionLibre(radio) {
    const paso = 1.15;
    const margen = 0.15;
    const existentes = [...atomos.values()];

    for (let anillo = 0; ; anillo++) {
        for (let fila = -anillo; fila <= anillo; fila++) {
            for (let columna = -anillo; columna <= anillo; columna++) {
                if (Math.max(Math.abs(fila), Math.abs(columna)) !== anillo) continue;

                const posicion = { x: columna * paso, y: 0, z: fila * paso };
                const ocupada = existentes.some((atomo) => {
                    const actual = atomo.grupo.position;
                    const distancia = Math.hypot(
                        posicion.x - actual.x,
                        posicion.y - actual.y,
                        posicion.z - actual.z
                    );
                    return distancia < radio + atomo.radio + margen;
                });

                if (!ocupada) return posicion;
            }
        }
    }
}

/**
 * Agrega un átomo en la posición indicada o en un espacio libre.
 * Devuelve el id del átomo o null si no se pudo agregar.
 */
export function agregarAtomo(elemento, posicion) {
    if (!Object.hasOwn(ELEMENTOS, elemento)) {
        enviarMensaje('aviso', AVISO_ELEMENTO_DESCONOCIDO);
        return null;
    }

    if (atomos.size >= MAX_ATOMOS) {
        enviarMensaje('aviso', 'Ya llegaste al límite de 20 átomos');
        return null;
    }

    const contenedor = obtenerContenedorAtomos();
    if (!contenedor) return null;

    guardarFoto();
    const destino = posicion ?? buscarPosicionLibre(ELEMENTOS[elemento].radio);
    const id = generarId(elemento);
    const visual = crearAtomoVisual(elemento);

    visual.grupo.position.set(destino.x, destino.y, destino.z);
    visual.grupo.userData.id = id;
    visual.grupo.userData.tipo = 'atomo';
    contenedor.add(visual.grupo);

    atomos.set(id, {
        id,
        elemento,
        grupo: visual.grupo,
        esfera: visual.esfera,
        borde: visual.borde,
        radio: visual.radio,
        enlaces: new Set(),
    });

    emit('escena:atomo-agregado', { id, elemento });
    setUltimaAccion(`Agregaste ${ELEMENTOS[elemento].nombre} (${id})`);
    return id;
}

/** Mueve el átomo y actualiza sus enlaces. */
export function moverAtomo(id, posicion) {
    const atomo = atomos.get(id);
    if (!atomo) return false;

    atomo.grupo.position.set(posicion.x, posicion.y, posicion.z);
    for (const otroId of atomo.enlaces) {
        actualizarEnlace(id, otroId);
    }

    emit('escena:atomo-movido', {
        id,
        posicion: { x: posicion.x, y: posicion.y, z: posicion.z },
    });
    return true;
}

/** Quita un átomo y sus enlaces. */
export function eliminarAtomo(id, emitirEvento = true) {
    const atomo = atomos.get(id);
    if (!atomo) return false;

    for (const otroId of [...atomo.enlaces]) {
        quitarEnlace(id, otroId, emitirEvento);
    }

    obtenerContenedorAtomos().remove(atomo.grupo);
    liberarGrupo(atomo.grupo);
    atomos.delete(id);

    if (seleccionado === id) seleccionado = null;
    if (arrastre?.id === id) arrastre = null;
    if (emitirEvento) emit('escena:atomo-eliminado', { id, elemento: atomo.elemento });
    return true;
}

/** Dibuja un enlace simple o doble entre dos átomos. */
export function crearEnlace(idA, idB, orden = 1) {
    if (!atomos.has(idA) || !atomos.has(idB) || idA === idB) return false;

    const clave = claveEnlace(idA, idB);
    if (enlaces.has(clave)) quitarEnlace(idA, idB);

    const grupo = new THREE.Group();
    grupo.userData.tipo = 'enlace';
    grupo.userData.a = idA;
    grupo.userData.b = idB;

    const material = new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        roughness: 0.6,
    });
    const cilindros = [];
    const cantidad = orden === 2 ? 2 : 1;

    for (let i = 0; i < cantidad; i++) {
        const cilindro = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 1, 16),
            material
        );
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

function quitarEnlace(idA, idB, emitirEvento = true) {
    const clave = claveEnlace(idA, idB);
    const enlace = enlaces.get(clave);
    if (!enlace) return;

    obtenerContenedorAtomos().remove(enlace.grupo);
    liberarGrupo(enlace.grupo);
    enlaces.delete(clave);
    atomos.get(idA)?.enlaces.delete(idB);
    atomos.get(idB)?.enlaces.delete(idA);
    if (emitirEvento) emit('escena:enlace-eliminado', { a: idA, b: idB });
}

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

    const eje = Math.abs(normal.dot(EJE_UP)) > 0.99
        ? new THREE.Vector3(1, 0, 0)
        : EJE_UP;
    const desplazamiento = new THREE.Vector3()
        .crossVectors(normal, eje)
        .normalize()
        .multiplyScalar(ALTURA_ENLACE_DOBLE);
    const orientacion = new THREE.Quaternion().setFromUnitVectors(EJE_UP, normal);

    enlace.cilindros.forEach((cilindro, i) => {
        const separacion = enlace.cilindros.length === 2 ? (i === 0 ? 1 : -1) : 0;
        cilindro.position.copy(medio).addScaledVector(desplazamiento, separacion);
        cilindro.quaternion.copy(orientacion);
        cilindro.scale.set(1, longitud, 1);
    });
}

/** Resalta el átomo seleccionado. Pasa null para quitar la selección. */
export function seleccionarAtomo(id) {
    if (seleccionado && atomos.has(seleccionado)) {
        const anterior = atomos.get(seleccionado);
        anterior.esfera.material.emissive.setHex(0x000000);
        if (anterior.borde) anterior.borde.visible = false;
    }
    seleccionado = null;

    const atomo = atomos.get(id);
    if (atomo) {
        atomo.esfera.material.emissive.setHex(COLOR_RESALTADO);
        atomo.esfera.material.emissiveIntensity = 0.4;
        if (atomo.borde) atomo.borde.visible = true;
        seleccionado = id;
    }

    emit('escena:atomo-seleccionado', { id: seleccionado });
    return seleccionado;
}

export function limpiarEscena() {
    guardarFoto();
    for (const clave of [...enlaces.keys()]) {
        const [a, b] = clave.split('|');
        quitarEnlace(a, b, false);
    }

    for (const id of [...atomos.keys()]) {
        eliminarAtomo(id, false);
    }

    seleccionado = null;
    for (const elemento of Object.keys(contadores)) {
        contadores[elemento] = 0;
    }

    emit('escena:escena-limpia');
    setUltimaAccion('Limpiaste la escena');
}

export function obtenerListaAtomos() {
    return [...atomos.values()].map((atomo) => ({
        id: atomo.id,
        elemento: atomo.elemento,
        posicion: {
            x: atomo.grupo.position.x,
            y: atomo.grupo.position.y,
            z: atomo.grupo.position.z,
        },
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

/**
 * Deshace el último agregado o la última limpieza, restaurando la foto
 * anterior de la escena. Devuelve false si no hay nada que deshacer.
 */
export function deshacer() {
    const foto = historial.pop();
    if (!foto) {
        enviarMensaje('aviso', 'No hay nada que deshacer todavía');
        return false;
    }

    restaurando = true;
    limpiarEscena();
    for (const atomo of foto) {
        agregarAtomo(atomo.elemento, atomo.posicion);
    }
    restaurando = false;
    enviarMensaje('aviso', 'Se deshizo la última acción');
    setUltimaAccion('Deshiciste la última acción');
    return true;
}

function mismoConteo(a, b) {
    const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const clave of claves) {
        if ((a[clave] || 0) !== (b[clave] || 0)) return false;
    }
    return true;
}

/**
 * Verifica la molécula construida comparando sus átomos con el catálogo
 * (data/moleculas.json). Versión provisional hasta HU-15/HU-22: como los
 * enlaces todavía no se crean en la escena, la comparación es por
 * cantidad de átomos de cada elemento, no por enlaces ni valencias.
 * Si coincide, emite escena:molecula-identificada y devuelve la molécula;
 * si no, avisa que todavía no es una molécula completa del catálogo.
 */
export async function verificarMolecula() {
    const actuales = obtenerListaAtomos();
    if (actuales.length === 0) {
        enviarMensaje('aviso', 'La escena está vacía. Agrega átomos y pulsa Verificar molécula.');
        return null;
    }

    try {
        if (!catalogoMoleculas) {
            const respuesta = await fetch('data/moleculas.json');
            if (!respuesta.ok) throw new Error('catálogo no disponible');
            catalogoMoleculas = await respuesta.json();
        }
    } catch {
        enviarMensaje('error', 'No pude leer el catálogo de moléculas (data/moleculas.json).');
        return null;
    }

    const conteo = {};
    for (const atomo of actuales) {
        conteo[atomo.elemento] = (conteo[atomo.elemento] || 0) + 1;
    }

    const encontrada = (catalogoMoleculas.moleculas || []).find((molecula) => {
        const esperado = {};
        for (const atomo of molecula.atomos || []) {
            esperado[atomo.elemento] = (esperado[atomo.elemento] || 0) + 1;
        }
        return mismoConteo(conteo, esperado);
    });

    if (!encontrada) {
        enviarMensaje('aviso', 'Todavía no es una molécula completa del catálogo. Revisa los átomos que agregaste.');
        setUltimaAccion('Verificación: molécula incompleta');
        return null;
    }

    emit('escena:molecula-identificada', {
        nombre: encontrada.nombre,
        formula: encontrada.formula,
        completa: true,
        geometria: encontrada.geometria,
        descripcion: encontrada.descripcion,
    });
    enviarMensaje('correcto', `¡Es ${encontrada.nombre}! Su fórmula es ${encontrada.formula}.`);
    setUltimaAccion(`Verificaste ${encontrada.nombre}`);
    return encontrada;
}

export function iniciarComandosDeAtomos() {
    on('voz:comando', ({ intencion, parametros }) => {
        if (intencion === 'deshacer') {
            deshacer();
            return;
        }
        if (intencion === 'limpiar') {
            limpiarEscena();
            enviarMensaje('aviso', 'Se limpió la escena');
            return;
        }
        if (intencion === 'verificar') {
            verificarMolecula();
            return;
        }
        if (intencion !== 'agregar-atomo') return;

        const { elemento, cantidad } = parametros ?? {};
        if (!Object.hasOwn(ELEMENTOS, elemento)) return;
        if (!Number.isSafeInteger(cantidad) || cantidad < 1) return;

        for (let i = 0; i < cantidad; i++) {
            if (agregarAtomo(elemento) === null) break;
        }
    });
}

function prepararRayo(x, y) {
    rayo.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), obtenerCamara());
}

function coordenadasDePuntero(evento, lienzo) {
    const rect = lienzo.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
        x: (evento.clientX - rect.left) / rect.width,
        y: (evento.clientY - rect.top) / rect.height,
    };
}

function atomoBajoPuntero(x, y) {
    if (!obtenerCamara()) return null;
    prepararRayo(x, y);

    const origen = rayo.ray.origin;
    const direccion = rayo.ray.direction;
    const centro = new THREE.Vector3();
    let mejorId = null;
    let mejorDistancia = Infinity;

    for (const atomo of atomos.values()) {
        atomo.grupo.getWorldPosition(centro);
        if (centro.clone().sub(origen).dot(direccion) <= 0) continue;

        const distancia = rayo.ray.distanceToPoint(centro);
        const tolerancia = atomo.radio * FACTOR_TOLERANCIA_PELLIZCO;
        if (distancia <= tolerancia && distancia < mejorDistancia) {
            mejorDistancia = distancia;
            mejorId = atomo.id;
        }
    }

    return mejorId;
}

function resaltarPorDelante(atomo, activo) {
    atomo.grupo.renderOrder = activo ? 10 : 0;
    atomo.esfera.material.depthTest = !activo;
    atomo.borde.material.depthTest = !activo;
}

function iniciarArrastre(x, y) {
    const camaraActual = obtenerCamara();
    if (arrastre || !camaraActual) return false;

    const id = atomoBajoPuntero(x, y);
    if (!id) return false;

    const atomo = atomos.get(id);
    const centro = atomo.grupo.position.clone();
    const normal = camaraActual.getWorldDirection(new THREE.Vector3());
    const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, centro);

    prepararRayo(x, y);
    const impacto = rayo.ray.intersectPlane(plano, new THREE.Vector3());
    if (!impacto) return false;

    arrastre = {
        id,
        plano,
        desfase: new THREE.Vector3().subVectors(centro, impacto),
    };
    seleccionarAtomo(id);
    resaltarPorDelante(atomo, true);
    return true;
}

function moverArrastre(x, y) {
    if (!arrastre || arrastre.teclado) return;

    const atomo = atomos.get(arrastre.id);
    if (!atomo || !obtenerCamara()) {
        arrastre = null;
        return;
    }

    prepararRayo(x, y);
    const impacto = rayo.ray.intersectPlane(arrastre.plano, new THREE.Vector3());
    if (!impacto) return;

    atomo.grupo.position.copy(impacto.add(arrastre.desfase));
    for (const otroId of atomo.enlaces) {
        actualizarEnlace(arrastre.id, otroId);
    }
}

function terminarArrastre(id) {
    arrastre = null;
    const atomo = atomos.get(id);
    if (!atomo) return;

    resaltarPorDelante(atomo, false);
    const p = atomo.grupo.position;
    moverAtomo(id, { x: p.x, y: p.y, z: p.z });
}

function soltarArrastre(x, y) {
    if (!arrastre || arrastre.teclado) return;

    const id = arrastre.id;
    if (typeof x === 'number' && typeof y === 'number') {
        moverArrastre(x, y);
    }
    terminarArrastre(id);
}

function cambiarSeleccionTeclado(sentido) {
    const ids = [...atomos.keys()];
    if (ids.length === 0) return false;

    const indice = ids.indexOf(seleccionado);
    const destino = indice === -1
        ? (sentido > 0 ? 0 : ids.length - 1)
        : indice + sentido;

    if (destino < 0 || destino >= ids.length) return false;

    seleccionarAtomo(ids[destino]);
    return true;
}

function iniciarArrastreTeclado(id) {
    const atomo = atomos.get(id);
    if (!atomo) return;

    arrastre = { id, teclado: true, origen: atomo.grupo.position.clone() };
    resaltarPorDelante(atomo, true);
    enviarMensaje('aviso', `${id} agarrado. Flechas para moverlo, Enter para soltarlo, Escape para cancelar`);
}

function desplazarAtomoTeclado(id, dx, dy) {
    const atomo = atomos.get(id);
    const camaraActual = obtenerCamara();
    if (!atomo || !camaraActual) return;

    const derecha = new THREE.Vector3().setFromMatrixColumn(camaraActual.matrixWorld, 0);
    const arriba = new THREE.Vector3().setFromMatrixColumn(camaraActual.matrixWorld, 1);

    atomo.grupo.position
        .addScaledVector(derecha, dx * PASO_TECLADO)
        .addScaledVector(arriba, dy * PASO_TECLADO);

    for (const otroId of atomo.enlaces) {
        actualizarEnlace(id, otroId);
    }
}

function cancelarArrastreTeclado() {
    const { id, origen } = arrastre;
    arrastre = null;
    const atomo = atomos.get(id);
    if (!atomo) return;

    atomo.grupo.position.copy(origen);
    for (const otroId of atomo.enlaces) {
        actualizarEnlace(id, otroId);
    }
    resaltarPorDelante(atomo, false);
    enviarMensaje('aviso', `Movimiento de ${id} cancelado`);
}

function manejarTeclado(evento) {
    const esTeclado = arrastre?.teclado === true;

    if (evento.key === 'Tab') {
        if (arrastre) {
            evento.preventDefault();
            enviarMensaje('aviso', 'Suelta el átomo con Enter antes de elegir otro');
        } else if (cambiarSeleccionTeclado(evento.shiftKey ? -1 : 1)) {
            evento.preventDefault();
        }
        return;
    }

    if (evento.key === 'Enter') {
        evento.preventDefault();

        if (arrastre) {
            if (!esTeclado) return;
            const id = arrastre.id;
            terminarArrastre(id);
            enviarMensaje('aviso', `${id} soltado`);
            return;
        }

        if (!seleccionado) {
            enviarMensaje('aviso', 'Usa Tab para elegir un átomo y Enter para agarrarlo');
            return;
        }

        iniciarArrastreTeclado(seleccionado);
        return;
    }

    if (evento.key === 'Escape') {
        if (!esTeclado) return;

        evento.preventDefault();
        cancelarArrastreTeclado();
        return;
    }

    const direcciones = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
    };
    const direccion = direcciones[evento.key];

    if (direccion && esTeclado) {
        evento.preventDefault();
        desplazarAtomoTeclado(arrastre.id, direccion[0], direccion[1]);
    }
}

/** Conecta el arrastre con pellizco, mouse y teclado. */
export function iniciarArrastreDeAtomos() {
    if (arrastreIniciado) return true;

    const lienzo = obtenerLienzo();
    if (!lienzo) return false;
    arrastreIniciado = true;

    on('gesto:pellizco-inicio', ({ x, y }) => iniciarArrastre(x, y));
    on('gesto:pellizco-mover', ({ x, y }) => moverArrastre(x, y));
    on('gesto:pellizco-fin', ({ x, y }) => soltarArrastre(x, y));

    lienzo.tabIndex = 0;
    lienzo.setAttribute(
        'aria-label',
        'Escena 3D. Tab elige un átomo, Enter lo agarra, flechas lo mueven y Enter lo suelta'
    );
    lienzo.addEventListener('keydown', manejarTeclado);

    // El átomo recibe el arrastre antes que OrbitControls.
    lienzo.addEventListener('pointerdown', (evento) => {
        if (evento.button !== 0) return;

        const punto = coordenadasDePuntero(evento, lienzo);
        if (!punto || !iniciarArrastre(punto.x, punto.y)) return;

        evento.preventDefault();
        evento.stopImmediatePropagation();
        lienzo.setPointerCapture(evento.pointerId);
    }, { capture: true });

    lienzo.addEventListener('pointermove', (evento) => {
        if (!arrastre || arrastre.teclado) return;

        const punto = coordenadasDePuntero(evento, lienzo);
        if (punto) moverArrastre(punto.x, punto.y);
    });

    const finalizar = (evento) => {
        if (!arrastre || arrastre.teclado) return;

        const punto = coordenadasDePuntero(evento, lienzo);
        soltarArrastre(punto?.x, punto?.y);
    };

    lienzo.addEventListener('pointerup', finalizar);
    lienzo.addEventListener('pointercancel', finalizar);

    return true;
}