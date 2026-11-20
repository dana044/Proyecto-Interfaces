/**
 * @file atoms.js
 * @description Átomos y enlaces 3D: esferas con color por elemento y cilindros para enlaces simples y dobles.
 * Agrega, mueve y elimina átomos; dibuja enlaces; emite eventos de escena según el contrato.
 * @author Citlaly Morales Viveros
 */

import * as THREE from 'three';
import { obtenerCamara, obtenerContenedorAtomos, obtenerLienzo } from './scene.js';
import { emit, on } from './bus.js';

const MAX_ATOMOS = 20;
const ALTURA_ENLACE_DOBLE = 0.08;
const FACTOR_TOLERANCIA_PELLIZCO = 1.5;
const PASO_TECLADO = 0.1;

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
let arrastre = null;
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

    // Borde brillante real: una esfera un poco más grande, solo su cara
    // trasera, que se ve como un contorno alrededor de la esfera.
    // Empieza oculta y solo se muestra cuando el átomo está seleccionado.
    const borde = new THREE.Mesh(
        new THREE.SphereGeometry(config.radio * 1.12, 32, 24),
        new THREE.MeshBasicMaterial({ color: COLOR_RESALTADO, side: THREE.BackSide, transparent: true, opacity: 0.9 })
    );
    borde.visible = false;
    grupo.add(borde);

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

    return { grupo, esfera, borde, radio: config.radio };
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
    if (!Object.hasOwn(ELEMENTOS, elemento)) {
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
    visual.grupo.userData.tipo = 'atomo';
    contenedor.add(visual.grupo);

    atomos.set(id, {
        id,
        elemento,
        grupo: visual.grupo,
        esfera: visual.esfera,
        borde: visual.borde,
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
    emit('escena:atomo-movido', { id, posicion: { x: posicion.x, y: posicion.y, z: posicion.z } });
    return true;
}

/** Quita un átomo y todos sus enlaces. */
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
    grupo.userData.tipo = 'enlace';
    grupo.userData.a = idA;
    grupo.userData.b = idB;
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

/** Quita todos los átomos y enlaces de la escena. */
export function limpiarEscena() {
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

/** Conecta el comando de agregar átomos con la escena. */
export function iniciarComandosDeAtomos() {
    on('voz:comando', ({ intencion, parametros }) => {
        if (intencion !== 'agregar-atomo') return;

        const { elemento, cantidad } = parametros ?? {};
        if (!Object.hasOwn(ELEMENTOS, elemento)) return;
        if (!Number.isSafeInteger(cantidad) || cantidad < 1) return;

        const disponibles = MAX_ATOMOS - atomos.size;
        const visibles = Math.min(cantidad, disponibles);
        const separacion = ELEMENTOS[elemento].radio * 2 + 0.15;

        for (let i = 0; i < cantidad; i++) {
            const x = (i - (visibles - 1) / 2) * separacion;
            if (agregarAtomo(elemento, { x, y: 0, z: 0 }) === null) break;
        }
    });
}

/**
 * Convierte coordenadas normalizadas (0 a 1, origen arriba a la izquierda)
 * en el rayo de la cámara, en coordenadas de dispositivo (-1 a 1).
 * @param {number} x
 * @param {number} y
 */
function prepararRayo(x, y) {
    rayo.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), obtenerCamara());
}

/**
 * Obtiene la posición de un evento del puntero sobre el lienzo en coordenadas normalizadas.
 * @param {PointerEvent} evento
 * @param {HTMLElement} lienzo
 * @returns {{x: number, y: number} | null} null si el lienzo no tiene tamaño visible
 */
function coordenadasDePuntero(evento, lienzo) {
    const rect = lienzo.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
        x: (evento.clientX - rect.left) / rect.width,
        y: (evento.clientY - rect.top) / rect.height
    };
}

/**
 * Busca el átomo más cercano al rayo que pasa por (x, y), dentro de
 * FACTOR_TOLERANCIA_PELLIZCO veces su radio. Ignora átomos detrás de la cámara.
 * @param {number} x - Coordenada normalizada horizontal (0 a 1)
 * @param {number} y - Coordenada normalizada vertical (0 a 1)
 * @returns {string | null} id del átomo o null si ninguno está lo bastante cerca
 */
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

/**
 * Hace que el átomo se dibuje por delante de los demás mientras se arrastra.
 * @param {Object} atomo - Entrada del mapa de átomos
 * @param {boolean} activo - true al agarrar, false al soltar
 */
function resaltarPorDelante(atomo, activo) {
    atomo.grupo.renderOrder = activo ? 10 : 0;
    atomo.esfera.material.depthTest = !activo;
    atomo.borde.material.depthTest = !activo;
}

/**
 * Agarra el átomo más cercano al punto (x, y). Mueve el átomo en un plano
 * paralelo a la cámara que pasa por su centro y guarda el desfase entre el
 * punto de agarre y el centro, para que no salte al primer movimiento.
 * @param {number} x - Coordenada normalizada horizontal (0 a 1)
 * @param {number} y - Coordenada normalizada vertical (0 a 1)
 * @returns {boolean} true si se agarró un átomo
 */
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
        desfase: new THREE.Vector3().subVectors(centro, impacto)
    };
    seleccionarAtomo(id);
    resaltarPorDelante(atomo, true);
    return true;
}

/**
 * Mueve el átomo arrastrado hacia el punto (x, y) y actualiza sus enlaces
 * visuales. No hace nada si no hay arrastre activo.
 * @param {number} x - Coordenada normalizada horizontal (0 a 1)
 * @param {number} y - Coordenada normalizada vertical (0 a 1)
 */
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

/**
 * Termina el arrastre activo: quita el resalte de dibujo y emite
 * escena:atomo-movido una sola vez con la posición final. El átomo
 * conserva la selección.
 * @param {string} id - Id del átomo arrastrado
 */
function terminarArrastre(id) {
    arrastre = null;
    const atomo = atomos.get(id);
    if (!atomo) return;

    resaltarPorDelante(atomo, false);
    const p = atomo.grupo.position;
    moverAtomo(id, { x: p.x, y: p.y, z: p.z });
}

/**
 * Suelta el átomo arrastrado con pellizco o mouse. Si se reciben coordenadas,
 * primero lo lleva a ese punto. No actúa sobre un arrastre de teclado.
 * @param {number} [x] - Coordenada normalizada horizontal (0 a 1)
 * @param {number} [y] - Coordenada normalizada vertical (0 a 1)
 */
function soltarArrastre(x, y) {
    if (!arrastre || arrastre.teclado) return;

    const id = arrastre.id;
    if (typeof x === 'number' && typeof y === 'number') {
        moverArrastre(x, y);
    }
    terminarArrastre(id);
}

/**
 * Cambia la selección al átomo anterior o siguiente, en el orden en que se agregaron.
 * @param {number} sentido - 1 para el siguiente, -1 para el anterior
 * @returns {boolean} false si no hay átomo en esa dirección
 */
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

/**
 * Agarra el átomo seleccionado para moverlo con el teclado.
 * @param {string} id - Id del átomo seleccionado
 */
function iniciarArrastreTeclado(id) {
    const atomo = atomos.get(id);
    if (!atomo) return;

    arrastre = { id, teclado: true, origen: atomo.grupo.position.clone() };
    resaltarPorDelante(atomo, true);
    enviarMensaje('aviso', `${id} agarrado. Flechas para moverlo, Enter para soltarlo, Escape para cancelar`);
}

/**
 * Mueve el átomo agarrado por teclado en el plano de la cámara. Las flechas
 * usan la dirección de la vista, así que "derecha" siempre es hacia la derecha de la pantalla.
 * @param {string} id - Id del átomo agarrado
 * @param {number} dx - -1, 0 o 1 en horizontal
 * @param {number} dy - -1, 0 o 1 en vertical (positivo hacia arriba)
 */
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

/**
 * Cancela el arrastre por teclado y regresa el átomo a su posición inicial.
 * No emite escena:atomo-movido porque la posición no cambió.
 */
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

/**
 * Atiende el teclado cuando el lienzo tiene el foco. Tab y Shift+Tab eligen átomo;
 * Enter agarra o suelta; las flechas mueven; Escape cancela. Tab solo se intercepta
 * cuando cambia la selección, para no atrapar el foco del navegador. Espacio no se
 * usa porque activa el micrófono.
 * @param {KeyboardEvent} evento
 */
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
        ArrowDown: [0, -1]
    };
    const direccion = direcciones[evento.key];
    if (direccion && esTeclado) {
        evento.preventDefault();
        desplazarAtomoTeclado(arrastre.id, direccion[0], direccion[1]);
    }
}

/**
 * Conecta el pellizco, el mouse y el teclado con el arrastre de átomos.
 * El lienzo recibe foco de teclado (tabIndex 0). Si el puntero no encuentra un átomo,
 * el evento sigue hacia OrbitControls y la vista gira como antes.
 * @returns {boolean} false si el lienzo de la escena todavía no existe
 */
export function iniciarArrastreDeAtomos() {
    if (arrastreIniciado) return true;

    const lienzo = obtenerLienzo();
    if (!lienzo) return false;
    arrastreIniciado = true;

    on('gesto:pellizco-inicio', ({ x, y }) => iniciarArrastre(x, y));
    on('gesto:pellizco-mover', ({ x, y }) => moverArrastre(x, y));
    on('gesto:pellizco-fin', ({ x, y }) => soltarArrastre(x, y));

    lienzo.tabIndex = 0;
    lienzo.setAttribute('aria-label', 'Escena 3D. Tab elige un átomo, Enter lo agarra, flechas lo mueven y Enter lo suelta');
    lienzo.addEventListener('keydown', manejarTeclado);

    // Fase de captura: se ejecuta antes que OrbitControls, que escucha pointerdown
    // en el mismo lienzo. Si hay átomo bajo el puntero, se detiene para no girar la vista.
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