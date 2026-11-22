/**
 * @file atoms.js
 * @description Átomos, enlaces y arrastre en la escena 3D de MolecuLab.
 * @author Citlaly Morales Viveros
 * @author Stephanie Elizdeth Hernández Prieto
 */

import * as THREE from 'three';
import { acercar, obtenerCamara, obtenerContenedorAtomos, obtenerLienzo, rotarVista } from './scene.js';
import { emit, on } from './bus.js';
import { AVISO_ELEMENTO_DESCONOCIDO, ELEMENTOS, MAX_ATOMOS } from './elementos.js';
import { setUltimaAccion } from './state.js';
import {
    actualizarAnilloValencia,
    animarHasta,
    animarSacudida,
    buscarVecinoMasCercano,
    crearAnilloValencia,
    enlacesUsados,
    evaluarUnion,
    valenciaDe,
} from './chemistry.js';
import { calcularGeometria, identificarMolecula } from './molecules.js';

/** Separación de cada cilindro del centro en un enlace doble: los
 * dos cilindros tienen radio 0.08, así que con menos de 0.08 se
 * tocan y se ven como una sola barra gruesa; con 0.16 sus centros
 * quedan a 0.32 y queda un hueco claro de 0.16 entre ellos. */
const ALTURA_ENLACE_DOBLE = 0.16;
const FACTOR_TOLERANCIA_PELLIZCO = 1.5;
const PASO_TECLADO = 0.1;
const COLOR_RESALTADO = 0xfacc15;
const COLOR_VISTA_PREVIA_POSIBLE = 0x15803d;
const COLOR_VISTA_PREVIA_RECHAZO = 0xb91c1c;
const EJE_UP = new THREE.Vector3(0, 1, 0);

const atomos = new Map();
const enlaces = new Map();
const contadores = Object.fromEntries(
    Object.keys(ELEMENTOS).map((simbolo) => [simbolo, 0])
);

let seleccionado = null;
let arrastre = null;
let vistaPrevia = null;

/* Historial para Deshacer y Rehacer: fotos de la escena antes de
   cada acción (agregar, mover, enlazar y limpiar). Cada entrada es
   { foto, descripcion }, la foto guarda átomos y enlaces, y el
   límite es de 30 acciones. La pila de rehacer se llena al deshacer
   y se vacía en cuanto se hace una acción nueva. */
const historial = [];
const pilaRehacer = [];
let restaurando = false;
let catalogoMoleculas = null;
/* Foto del arrastre en curso: se guarda al empezar a mover un átomo
   y se quita si al soltarlo resulta que no se movió. */
let fotoArrastrePendiente = null;

/**
 * Guarda una foto de la escena antes de una acción, con su
 * descripción para el mensaje («enlace O–H», «agregar O»...).
 * Vacía la pila de rehacer: una acción nueva hace obsoletas las
 * que se habían deshecho. Devuelve la entrada guardada o null
 * si se está restaurando una foto.
 * @param {string} descripcion Descripción corta de la acción.
 * @returns {{ foto: object, descripcion: string } | null} La entrada guardada.
 */
function guardarFoto(descripcion = 'cambio') {
    if (restaurando) return null;
    const entrada = { foto: obtenerFotoEscena(), descripcion };
    historial.push(entrada);
    if (historial.length > 30) historial.shift();
    pilaRehacer.length = 0;
    return entrada;
}

/**
 * Foto completa de la escena: los átomos (con su id, elemento y
 * posición) y los enlaces (con sus dos átomos y su orden).
 * @returns {{ atomos: Array, enlaces: Array }} La foto de la escena.
 */
function obtenerFotoEscena() {
    return {
        atomos: obtenerListaAtomos(),
        enlaces: [...enlaces.values()].map((enlace) => ({
            a: enlace.a,
            b: enlace.b,
            orden: enlace.orden,
        })),
    };
}

/**
 * Reconstruye la escena desde una foto: primero los átomos con
 * sus ids originales y después sus enlaces. Al crear cada enlace
 * se actualizan solos los anillos de valencia, así que deshacer
 * un enlace devuelve la valencia a los átomos.
 * @param {{ atomos: Array, enlaces: Array }} foto La foto a restaurar.
 */
function restaurarFoto(foto) {
    limpiarEscena({ confirmar: false });
    for (const atomo of foto.atomos) {
        agregarAtomo(atomo.elemento, atomo.posicion, atomo.id);
    }
    for (const enlace of foto.enlaces) {
        crearEnlace(enlace.a, enlace.b, enlace.orden, { explicar: false });
    }
}

/**
 * Quita la foto que se guardó al empezar un arrastre, cuando al
 * final el átomo no se movió (o el movimiento se canceló).
 */
function descartarFotoArrastre() {
    if (!fotoArrastrePendiente) return;
    const indice = historial.indexOf(fotoArrastrePendiente);
    if (indice !== -1) historial.splice(indice, 1);
    fotoArrastrePendiente = null;
}
let arrastreIniciado = false;
const rayo = new THREE.Raycaster();

function claveEnlace(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Crea la etiqueta con el símbolo del elemento. La letra es oscura
 * solo si el color de la esfera es claro; con los colores de grupo
 * actuales, todos son oscuros y la letra es blanca.
 * @param {string} simbolo Símbolo del elemento.
 * @param {number} color Color de la esfera, en hexadecimal.
 * @param {number} [escala=0.5] Tamaño de la etiqueta en la escena.
 */
function crearEtiqueta(simbolo, color, escala = 0.5) {
    const lienzo = document.createElement('canvas');
    lienzo.width = 128;
    lienzo.height = 128;

    const rojo = (color >> 16) & 0xff;
    const verde = (color >> 8) & 0xff;
    const azul = color & 0xff;
    const luminancia = 0.2126 * rojo + 0.7152 * verde + 0.0722 * azul;
    const claro = luminancia > 180;

    const ctx = lienzo.getContext('2d');
    ctx.font = 'bold 84px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = claro ? '#202331' : '#ffffff';
    ctx.strokeStyle = claro ? '#202331' : '#000000';
    ctx.lineWidth = 6;
    ctx.strokeText(simbolo, 64, 64);
    ctx.fillText(simbolo, 64, 64);

    const material = new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(lienzo),
        depthTest: false,
    });
    const etiqueta = new THREE.Sprite(material);
    etiqueta.scale.set(escala, escala, 1);
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

    const etiqueta = crearEtiqueta(elemento, config.color);
    etiqueta.position.set(0, config.radio + 0.25, 0);
    grupo.add(etiqueta);

    // Aro de valencia (js/chemistry.js): verde si la valencia está
    // completa, gris con un punto por cada enlace que aún le queda.
    const anillo = crearAnilloValencia(config.radio, config.valencia);
    grupo.add(anillo);

    return { grupo, esfera, borde, anillo, radio: config.radio };
}

function generarId(elemento) {
    contadores[elemento] += 1;
    return `${elemento}${contadores[elemento]}`;
}

function enviarMensaje(tipo, texto) {
    emit('ui:mensaje', { tipo, texto });
}

/** Suma de órdenes de enlace que ya tiene un átomo (su valencia usada). */
function valenciaUsada(id) {
    return enlacesUsados(id, [...enlaces.values()]);
}

/** Redibuja el aro de valencia de un átomo según sus enlaces actuales. */
function actualizarAnillo(id) {
    const atomo = atomos.get(id);
    if (!atomo || !atomo.anillo) return;
    const libres = Math.max(valenciaDe(atomo.elemento) - valenciaUsada(id), 0);
    actualizarAnilloValencia(atomo.anillo, atomo.radio, libres);
}

/** Quita el resaltado de la vista previa, si había uno activo. */
function limpiarVistaPrevia() {
    if (!vistaPrevia) return;
    const objetivo = atomos.get(vistaPrevia.idB);
    if (objetivo && objetivo.id !== seleccionado) {
        objetivo.esfera.material.emissive.setHex(0x000000);
    }
    vistaPrevia = null;
}

/**
 * Muestra qué pasaría si se soltara el átomo arrastrado aquí, sin
 * crear todavía el enlace. El vecino más cercano se ilumina en
 * verde si se puede unir, o en rojo si se rechazaría, y la barra
 * de estado dice qué pasaría. Se actualiza en cada movimiento del
 * arrastre y solo cambia cuando cambia la pareja o el resultado.
 *
 * @param {string} id Id del átomo que se está arrastrando.
 * @returns {{idA: string, idB: string, posible: boolean, motivo: string|null}|null}
 */
export function actualizarVistaPrevia(id) {
    const atomo = atomos.get(id);
    if (!atomo) {
        limpiarVistaPrevia();
        return null;
    }

    const lista = obtenerListaAtomos();
    const soltado = lista.find((item) => item.id === id);
    if (!soltado) {
        limpiarVistaPrevia();
        return null;
    }

    const cercano = buscarVecinoMasCercano(soltado, lista);
    if (!cercano) {
        limpiarVistaPrevia();
        return null;
    }

    const vecino = cercano.vecino;
    const ordenActual = enlaces.get(claveEnlace(id, vecino.id))?.orden ?? 0;
    const resultado = evaluarUnion({
        idA: id,
        elementoA: soltado.elemento,
        idB: vecino.id,
        elementoB: vecino.elemento,
        ordenActual,
        enlaces: [...enlaces.values()],
    });

    // Ya tienen un enlace doble: solo se está moviendo la molécula.
    if (resultado.accion === 'nada') {
        limpiarVistaPrevia();
        return null;
    }

    if (vistaPrevia
        && vistaPrevia.idA === id
        && vistaPrevia.idB === vecino.id
        && vistaPrevia.posible === resultado.ok) {
        return vistaPrevia;
    }

    limpiarVistaPrevia();
    const objetivo = atomos.get(vecino.id);
    if (!objetivo) return null;

    objetivo.esfera.material.emissive.setHex(
        resultado.ok ? COLOR_VISTA_PREVIA_POSIBLE : COLOR_VISTA_PREVIA_RECHAZO
    );
    objetivo.esfera.material.emissiveIntensity = 0.5;

    vistaPrevia = {
        idA: id,
        idB: vecino.id,
        posible: resultado.ok,
        motivo: resultado.motivo,
    };
    setUltimaAccion(resultado.ok
        ? (resultado.accion === 'convertir-doble'
            ? `Suelta para convertir el enlace entre ${id} y ${vecino.id} en doble`
            : `Suelta para unir ${id} con ${vecino.id}`)
        : `No se puede unir: ${resultado.motivo}`);
    return vistaPrevia;
}

/**
 * Al soltar un átomo, evalúa si se une al átomo más cercano
 * (js/chemistry.js). Se llama desde terminarArrastre(), así que
 * vale para mouse, pellizco y teclado.
 */
function evaluarUnionAlSoltar(id, origen) {
    const atomo = atomos.get(id);
    if (!atomo) return;

    const lista = obtenerListaAtomos();
    const soltado = lista.find((item) => item.id === id);
    if (!soltado) return;

    const cercano = buscarVecinoMasCercano(soltado, lista);
    if (!cercano) return;

    const vecino = cercano.vecino;
    const ordenActual = enlaces.get(claveEnlace(id, vecino.id))?.orden ?? 0;
    const resultado = evaluarUnion({
        idA: id,
        elementoA: soltado.elemento,
        idB: vecino.id,
        elementoB: vecino.elemento,
        ordenActual,
        enlaces: [...enlaces.values()],
    });

    // Ya tienen un enlace doble: solo estaba moviendo la molécula.
    if (resultado.accion === 'nada') return;

    if (!resultado.ok) {
        emit('escena:enlace-rechazado', { motivo: resultado.motivo });
        enviarMensaje('aviso', resultado.motivo);
        setUltimaAccion(`Enlace rechazado: ${resultado.motivo}`);
        // Se sacude y vuelve a su sitio antes del arrastre.
        animarSacudida(atomo.grupo, origen).then(() => {
            moverAtomo(id, { x: origen.x, y: origen.y, z: origen.z });
        });
        return;
    }

    // Se acerca hasta tocar al vecino y ahí se crea (o se duplica) el enlace.
    // La foto va antes de la animación: es el estado sin ese enlace.
    guardarFoto(resultado.accion === 'convertir-doble'
        ? `enlace doble ${soltado.elemento}–${vecino.elemento}`
        : `enlace ${soltado.elemento}–${vecino.elemento}`);
    const direccion = new THREE.Vector3(
        soltado.posicion.x - vecino.posicion.x,
        soltado.posicion.y - vecino.posicion.y,
        soltado.posicion.z - vecino.posicion.z
    );
    if (direccion.lengthSq() === 0) direccion.set(1, 0, 0);
    direccion.normalize();
    const distanciaContacto = atomo.radio + (ELEMENTOS[vecino.elemento]?.radio ?? 0.4);
    const destino = {
        x: vecino.posicion.x + direccion.x * distanciaContacto,
        y: vecino.posicion.y + direccion.y * distanciaContacto,
        z: vecino.posicion.z + direccion.z * distanciaContacto,
    };

    animarHasta(atomo.grupo, destino).then(() => {
        moverAtomo(id, destino);
        if (crearEnlace(id, vecino.id, resultado.nuevoOrden)) {
            const accion = resultado.accion === 'convertir-doble'
                ? 'Convertiste el enlace en doble'
                : 'Creaste un enlace';
            setUltimaAccion(`${accion} entre ${id} y ${vecino.id}`);
            enviarMensaje('correcto', resultado.nuevoOrden === 2
                ? 'Enlace doble creado: comparten 2 electrones cada uno.'
                : 'Enlace creado: comparten 1 electrón cada uno.');
        }
    });
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
                // Si el modelo de Bohr tiene partículas, el centro está
                // ocupado por el núcleo y sus órbitas: no se pone un
                // átomo encima.
                const centroOcupado = obtenerConteoParticulas().total > 0
                    && Math.hypot(posicion.x, posicion.y, posicion.z) < 2;
                const ocupada = centroOcupado || existentes.some((atomo) => {
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
 * @param {string} elemento Símbolo del elemento.
 * @param {{ x: number, y: number, z: number }} [posicion] Posición del átomo.
 * @param {string} [idFijo] Id a usar en lugar de generar uno nuevo;
 * solo lo usa la restauración de una foto, para que los enlaces
 * de la foto sigan apuntando a los mismos átomos.
 * @returns {string | null} El id del átomo.
 */
export function agregarAtomo(elemento, posicion, idFijo) {
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

    guardarFoto(`agregar ${elemento}`);
    const destino = posicion ?? buscarPosicionLibre(ELEMENTOS[elemento].radio);
    const id = idFijo ?? generarId(elemento);
    if (idFijo) {
        // El contador queda por delante del id restaurado, para que
        // el siguiente átomo nuevo no repita un id que ya existe.
        const numero = Number.parseInt(idFijo.slice(elemento.length), 10);
        if (Number.isSafeInteger(numero) && numero > contadores[elemento]) {
            contadores[elemento] = numero;
        }
    }
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
        anillo: visual.anillo,
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

    if (vistaPrevia && (vistaPrevia.idA === id || vistaPrevia.idB === id)) {
        limpiarVistaPrevia();
    }

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
 * Dibuja un enlace simple o doble entre dos átomos. Al formarse de
 * verdad (no al restaurar una foto con deshacer/rehacer), emite
 * escena:electrones-compartidos para que se explique, se lea en voz
 * y se animen los electrones que se comparten.
 */
export function crearEnlace(idA, idB, orden = 1, { explicar = true } = {}) {
    if (!atomos.has(idA) || !atomos.has(idB) || idA === idB) return false;

    const clave = claveEnlace(idA, idB);
    // Al convertir un enlace simple en doble no se emite
    // escena:enlace-eliminado: solo se emite el creado con orden 2.
    if (enlaces.has(clave)) quitarEnlace(idA, idB, false);

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
    actualizarAnillo(idA);
    actualizarAnillo(idB);
    emit('escena:enlace-creado', { a: idA, b: idB, orden: cantidad });
    if (explicar) {
        emit('escena:electrones-compartidos', {
            a: idA,
            b: idB,
            pares: cantidad,
            elementoA: atomos.get(idA)?.elemento,
            elementoB: atomos.get(idB)?.elemento,
        });
    }
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
    if (atomos.has(idA)) actualizarAnillo(idA);
    if (atomos.has(idB)) actualizarAnillo(idB);
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
        // Vuelve a su color de grupo: el amarillo es solo mientras
        // está seleccionado.
        anterior.esfera.material.color.setHex(ELEMENTOS[anterior.elemento].color);
        anterior.esfera.material.emissive.setHex(0x000000);
        if (anterior.borde) anterior.borde.visible = false;
    }
    seleccionado = null;

    const atomo = atomos.get(id);
    if (atomo) {
        atomo.esfera.material.color.setHex(COLOR_RESALTADO);
        atomo.esfera.material.emissive.setHex(COLOR_RESALTADO);
        atomo.esfera.material.emissiveIntensity = 0.4;
        if (atomo.borde) atomo.borde.visible = true;
        seleccionado = id;
    }

    emit('escena:atomo-seleccionado', { id: seleccionado });
    return seleccionado;
}

/**
 * Borra todos los átomos y enlaces de la escena. Con más de 2
 * átomos pide confirmación, para no perder la escena por accidente.
 * Las llamadas internas (deshacer y rehacer) pasan confirmar: false.
 * @param {{ confirmar?: boolean }} [opciones] Opciones de limpieza.
 * @returns {boolean} true si la escena se limpió, false si se canceló.
 */
export function limpiarEscena({ confirmar = true } = {}) {
    if (confirmar && atomos.size > 2
        && !window.confirm('¿Borrar todos los átomos de la escena?')) {
        return false;
    }

    ocultarTarjetaAtomo();
    limpiarVistaPrevia();
    guardarFoto('limpiar la escena');
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
    return true;
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

/**
 * Lista de enlaces de la escena, con sus dos átomos y su orden
 * (1 simple, 2 doble). Es solo lectura: no cambia la escena.
 */
export function obtenerListaEnlaces() {
    return [...enlaces.values()].map((enlace) => ({
        a: enlace.a,
        b: enlace.b,
        orden: enlace.orden,
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
 * Deshace la última acción, restaurando la foto anterior de la
 * escena (átomos y enlaces). Guarda el estado actual en la pila
 * de rehacer, para poder volver con rehacer(). Devuelve false
 * si no hay nada que deshacer.
 */
export function deshacer() {
    const entrada = historial.pop();
    if (!entrada) {
        enviarMensaje('aviso', 'No hay nada que deshacer todavía');
        return false;
    }

    pilaRehacer.push({ foto: obtenerFotoEscena(), descripcion: entrada.descripcion });
    restaurando = true;
    restaurarFoto(entrada.foto);
    restaurando = false;
    enviarMensaje('aviso', `Deshiciste: ${entrada.descripcion}`);
    setUltimaAccion(`Deshiciste: ${entrada.descripcion}`);
    return true;
}

/**
 * Rehace la última acción deshecha, restaurando la foto que
 * guardó deshacer(). Devuelve false si no hay nada que rehacer.
 */
export function rehacer() {
    const entrada = pilaRehacer.pop();
    if (!entrada) {
        enviarMensaje('aviso', 'No hay nada que rehacer todavía');
        return false;
    }

    historial.push({ foto: obtenerFotoEscena(), descripcion: entrada.descripcion });
    if (historial.length > 30) historial.shift();
    restaurando = true;
    restaurarFoto(entrada.foto);
    restaurando = false;
    enviarMensaje('aviso', `Rehiciste: ${entrada.descripcion}`);
    setUltimaAccion(`Rehiciste: ${entrada.descripcion}`);
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
 * Valida que cada molécula del catálogo cumpla la valencia de sus átomos.
 * Devuelve una copia del catálogo solo con las moléculas válidas; si una
 * no cumple, se omite y se avisa en consola, sin romper el resto.
 * @param {object} catalogo Catálogo leído de data/moleculas.json.
 * @returns {object} El mismo catálogo, con solo las moléculas válidas.
 */
function validarCatalogo(catalogo) {
    const moleculas = catalogo?.moleculas;
    if (!Array.isArray(moleculas)) return catalogo;

    const validas = moleculas.filter((molecula) => {
        const atomos = new Map((molecula.atomos || []).map((a) => [a.id, a.elemento]));
        const usados = new Map();
        for (const enlace of molecula.enlaces || []) {
            if (!atomos.has(enlace.desde) || !atomos.has(enlace.hasta)) {
                console.warn(`[MolecuLab] Molécula omitida del catálogo: ${molecula.id} — el enlace ${enlace.desde}–${enlace.hasta} menciona un átomo que no existe.`);
                return false;
            }
            usados.set(enlace.desde, (usados.get(enlace.desde) || 0) + enlace.orden);
            usados.set(enlace.hasta, (usados.get(enlace.hasta) || 0) + enlace.orden);
        }
        for (const [id, elemento] of atomos) {
            const valencia = ELEMENTOS[elemento]?.valencia;
            if (valencia === undefined) {
                console.warn(`[MolecuLab] Molécula omitida del catálogo: ${molecula.id} — el átomo ${id} usa el elemento ${elemento}, que no está en el catálogo de elementos.`);
                return false;
            }
            const usadosPorAtomo = usados.get(id) || 0;
            if (usadosPorAtomo !== valencia) {
                console.warn(`[MolecuLab] Molécula omitida del catálogo: ${molecula.id} (${molecula.nombre}) — ${id} (${elemento}) tiene ${usadosPorAtomo} enlaces y su valencia es ${valencia}.`);
                return false;
            }
        }
        return true;
    });

    return { ...catalogo, moleculas: validas };
}

/**
 * Acomoda los átomos a las posiciones indicadas en 1 segundo, todos
 * a la vez, actualizando los enlaces en cada cuadro para que sigan
 * unidos a sus átomos mientras se mueven.
 * @param {Object<string, { x: number, y: number, z: number }>} destinos Posición por id de átomo.
 * @param {number} [duracionMs=1000] Duración de la animación.
 * @returns {Promise<void>} Se resuelve cuando termina la animación.
 */
function acomodarGeometria(destinos, duracionMs = 1000) {
    const movimientos = Object.entries(destinos)
        .map(([id, destino]) => {
            const atomo = atomos.get(id);
            if (!atomo) return null;
            return {
                atomo,
                inicio: atomo.grupo.position.clone(),
                fin: new THREE.Vector3(destino.x, destino.y, destino.z),
            };
        })
        .filter(Boolean);
    if (movimientos.length === 0) return Promise.resolve();

    if (typeof requestAnimationFrame === 'undefined') {
        for (const { atomo, fin } of movimientos) {
            atomo.grupo.position.copy(fin);
            for (const otroId of atomo.enlaces) actualizarEnlace(atomo.id, otroId);
        }
        return Promise.resolve();
    }

    const inicioTiempo = performance.now();
    return new Promise((resolver) => {
        function paso(ahora) {
            const crudo = Math.min((ahora - inicioTiempo) / duracionMs, 1);
            // Desacelera al final, para que el acomodo no se vea brusco.
            const progreso = 1 - (1 - crudo) * (1 - crudo);
            for (const { atomo, inicio, fin } of movimientos) {
                atomo.grupo.position.lerpVectors(inicio, fin, progreso);
                for (const otroId of atomo.enlaces) actualizarEnlace(atomo.id, otroId);
            }
            if (crudo < 1) requestAnimationFrame(paso);
            else resolver();
        }
        requestAnimationFrame(paso);
    });
}

/**
 * Verifica la molécula construida comparando su fórmula y su
 * conectividad con el catálogo (data/moleculas.json). Si está
 * completa, emite escena:molecula-identificada, acomoda los átomos
 * a su geometría real en 1 segundo y felicita. Si está incompleta,
 * dice qué falta con palabras sencillas. Si no está en el catálogo,
 * dice que no la reconoce o explica por qué no se puede armar.
 * Devuelve la molécula cuando está completa, o null si no.
 */
export async function verificarMolecula() {
  // Destello morado del botón Verificar al usarlo (clic, voz o gesto).
  const botonVerificar = document.querySelector('[data-accion="verificar"]');
  if (botonVerificar) {
    botonVerificar.classList.add('destello');
    setTimeout(() => botonVerificar.classList.remove('destello'), 1200);
  }

    const actuales = obtenerListaAtomos();
    if (actuales.length === 0) {
        enviarMensaje('aviso', 'La escena está vacía. Agrega átomos y pulsa Verificar molécula.');
        return null;
    }

    try {
        if (!catalogoMoleculas) {
            const respuesta = await fetch('data/moleculas.json');
            if (!respuesta.ok) throw new Error('catálogo no disponible');
            catalogoMoleculas = validarCatalogo(await respuesta.json());
        }
    } catch {
        enviarMensaje('error', 'No pude leer el catálogo de moléculas (data/moleculas.json).');
        return null;
    }

    const enlacesActuales = [...enlaces.values()].map((enlace) => ({
        a: enlace.a,
        b: enlace.b,
        orden: enlace.orden,
    }));
    const resultado = identificarMolecula(
        { atomos: actuales, enlaces: enlacesActuales },
        catalogoMoleculas.moleculas || [],
    );

    if (resultado.estado === 'completa') {
        const { molecula, mapeo } = resultado;
        emit('escena:molecula-identificada', {
            nombre: molecula.nombre,
            formula: molecula.formula,
            completa: true,
            geometria: molecula.geometria,
            descripcion: molecula.descripcion,
            datoCurioso: molecula.dato_curioso ?? null,
        });
        const destinos = calcularGeometria(molecula, mapeo);
        const hayQueMover = Object.entries(destinos).some(([id, destino]) => {
            const atomo = atomos.get(id);
            if (!atomo) return false;
            const posicion = atomo.grupo.position;
            return Math.hypot(posicion.x - destino.x, posicion.y - destino.y, posicion.z - destino.z) > 0.001;
        });
        if (hayQueMover) guardarFoto(`acomodar ${molecula.nombre.toLowerCase()}`);
        await acomodarGeometria(destinos);
        enviarMensaje('correcto', `¡Muy bien! Es ${molecula.nombre} y su fórmula es ${molecula.formula}.`);
        setUltimaAccion(`Verificaste ${molecula.nombre}`);
        return molecula;
    }

    if (resultado.estado === 'incompleta') {
        const { molecula, mensaje } = resultado;
        emit('escena:molecula-identificada', {
            nombre: molecula.nombre,
            formula: molecula.formula,
            completa: false,
            geometria: molecula.geometria,
            descripcion: molecula.descripcion,
            falta: resultado.falta,
            datoCurioso: molecula.dato_curioso ?? null,
            mensaje,
        });
        enviarMensaje('aviso', mensaje);
        setUltimaAccion('Verificación: molécula incompleta');
        return null;
    }

    if (resultado.estado === 'imposible') {
        // También se emite el evento, con completa: false y sin
        // molécula, para que el modo reto cuente el intento fallido.
        emit('escena:molecula-identificada', {
            nombre: null,
            formula: null,
            completa: false,
            geometria: null,
            descripcion: null,
        });
        enviarMensaje('aviso', resultado.motivo);
        setUltimaAccion('Verificación: combinación imposible');
        return null;
    }

    // También se emite el evento, con completa: false y sin
    // molécula, para que el modo reto cuente el intento fallido.
    emit('escena:molecula-identificada', {
        nombre: null,
        formula: null,
        completa: false,
        geometria: null,
        descripcion: null,
    });
    enviarMensaje('aviso', resultado.mensaje);
    setUltimaAccion('Verificación: molécula no reconocida');
    return null;
}

/* Modelo de Bohr: protones y neutrones en el núcleo, electrones
   en órbitas circulares. Las órbitas son un modelo sencillo para
   aprender, no la forma real de los átomos. */
const MAX_PARTICULAS = 30;
const CAPACIDADES_CAPAS = [2, 8, 8];
const RADIOS_ORBITAS = [0.9, 1.3, 1.7];
const RADIO_PARTICULA_NUCLEO = 0.16;
const RADIO_ELECTRON = 0.14;
const RADIO_NUCLEO = 0.32;
const COLOR_PROTON = 0xdc2626;
const COLOR_NEUTRON = 0x9ca3af;
const COLOR_ELECTRON = 0x2563eb;
const COLOR_ORBITA = 0x9ca3af;

const NOMBRES_PARTICULA = {
    proton: { nombre: 'protón', plural: 'protones', prefijo: 'P' },
    neutron: { nombre: 'neutrón', plural: 'neutrones', prefijo: 'N' },
    electron: { nombre: 'electrón', plural: 'electrones', prefijo: 'E' },
};

let grupoBohr = null;
let grupoNucleo = null;
let grupoOrbitas = null;
let grupoElectrones = null;
let bohrIniciado = false;
const particulas = { proton: [], neutron: [], electron: [] };
const contadoresParticula = { proton: 0, neutron: 0, electron: 0 };

/**
 * Primera capa con lugar libre para un electrón nuevo, o -1 si las
 * tres capas están llenas. Es lógica pura, sin escena, para poder
 * probarla sin WebGL.
 * @param {number[]} porCapa Electrones que ya hay en cada capa.
 * @returns {number} Índice de la capa (0, 1 o 2) o -1.
 */
function capaConLugarLibre(porCapa) {
    for (let capa = 0; capa < CAPACIDADES_CAPAS.length; capa++) {
        if ((porCapa[capa] || 0) < CAPACIDADES_CAPAS[capa]) return capa;
    }
    return -1;
}

/** Número de partículas de cada tipo y en total. */
export function obtenerConteoParticulas() {
    const protones = particulas.proton.length;
    const neutrones = particulas.neutron.length;
    const electrones = particulas.electron.length;
    return { protones, neutrones, electrones, total: protones + neutrones + electrones };
}

function emitirConteoParticulas() {
    emit('escena:particulas-cambiadas', obtenerConteoParticulas());
}

/** Reparte las partículas del núcleo en una esfera pequeña. */
function reorganizarNucleo() {
    const nucleo = [...particulas.proton, ...particulas.neutron];
    const total = nucleo.length;
    nucleo.forEach((particula, indice) => {
        if (total === 1) {
            particula.grupo.position.set(0, 0, 0);
            return;
        }
        const y = 1 - (indice / (total - 1)) * 2;
        const radio = Math.sqrt(Math.max(1 - y * y, 0));
        const angulo = indice * 2.39996;
        particula.grupo.position.set(
            Math.cos(angulo) * radio * RADIO_NUCLEO,
            y * RADIO_NUCLEO,
            Math.sin(angulo) * radio * RADIO_NUCLEO
        );
    });
}

/** Reparte los electrones en sus órbitas, en su capa. */
function reorganizarElectrones() {
    const porCapa = [0, 0, 0];
    for (const electron of particulas.electron) {
        const capa = electron.capa;
        const enCapa = particulas.electron.filter((otro) => otro.capa === capa);
        const indice = enCapa.indexOf(electron);
        const angulo = (indice / enCapa.length) * Math.PI * 2 + capa * 0.5;
        electron.grupo.position.set(
            Math.cos(angulo) * RADIOS_ORBITAS[capa],
            Math.sin(angulo) * RADIOS_ORBITAS[capa],
            0
        );
        porCapa[capa] += 1;
    }
    grupoOrbitas.children.forEach((orbita, capa) => {
        orbita.visible = porCapa[capa] > 0;
    });
}

function crearParticulaVisual(tipo) {
    const color = tipo === 'proton'
        ? COLOR_PROTON
        : tipo === 'neutron' ? COLOR_NEUTRON : COLOR_ELECTRON;
    const radio = tipo === 'electron' ? RADIO_ELECTRON : RADIO_PARTICULA_NUCLEO;
    const grupo = new THREE.Group();
    const esfera = new THREE.Mesh(
        new THREE.SphereGeometry(radio, 24, 18),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
    );
    grupo.add(esfera);
    if (tipo === 'proton') {
        const signo = crearEtiqueta('+', color, 0.22);
        signo.position.set(0, 0, radio + 0.02);
        grupo.add(signo);
    }
    if (tipo === 'electron') {
        const signo = crearEtiqueta('−', color, 0.2);
        signo.position.set(0, 0, radio + 0.02);
        grupo.add(signo);
    }
    return grupo;
}

/**
 * Crea el grupo del modelo de Bohr en la escena: núcleo en el centro
 * y tres órbitas. Las órbitas empiezan ocultas y aparecen cuando hay
 * al menos un electrón en su capa.
 * Devuelve true si el modelo quedó listo y false si falta el contenedor.
 */
export function iniciarModeloBohr() {
    if (bohrIniciado) return true;
    const contenedor = obtenerContenedorAtomos();
    if (!contenedor) return false;

    grupoBohr = new THREE.Group();
    grupoBohr.name = 'bohr';
    grupoBohr.userData.tipo = 'bohr';
    grupoNucleo = new THREE.Group();
    grupoNucleo.name = 'nucleo';
    grupoOrbitas = new THREE.Group();
    grupoOrbitas.name = 'orbitas';
    grupoElectrones = new THREE.Group();
    grupoElectrones.name = 'electrones';
    for (const radio of RADIOS_ORBITAS) {
        const orbita = new THREE.Mesh(
            new THREE.TorusGeometry(radio, 0.015, 8, 64),
            new THREE.MeshBasicMaterial({
                color: COLOR_ORBITA, transparent: true, opacity: 0.55,
            })
        );
        orbita.visible = false;
        grupoOrbitas.add(orbita);
    }
    grupoBohr.add(grupoNucleo, grupoOrbitas, grupoElectrones);
    contenedor.add(grupoBohr);
    bohrIniciado = true;
    return true;
}

/**
 * Agrega una partícula al modelo de Bohr. Los protones y neutrones van
 * al núcleo; cada electrón nuevo va a la primera capa con lugar libre.
 * Devuelve el id de la partícula o null si no se pudo agregar.
 * @param {string} tipo 'proton', 'neutron' o 'electron'.
 */
export function agregarParticula(tipo) {
    if (!Object.hasOwn(NOMBRES_PARTICULA, tipo)) {
        enviarMensaje('aviso', 'Esa partícula no existe. Solo hay protones, neutrones y electrones.');
        return null;
    }
    if (!bohrIniciado && !iniciarModeloBohr()) return null;

    const conteo = obtenerConteoParticulas();
    if (conteo.total >= MAX_PARTICULAS) {
        enviarMensaje('aviso', `Ya llegaste al límite de ${MAX_PARTICULAS} partículas. Quita una para agregar otra.`);
        return null;
    }

    let capa = -1;
    if (tipo === 'electron') {
        const porCapa = [0, 0, 0];
        for (const electron of particulas.electron) porCapa[electron.capa] += 1;
        capa = capaConLugarLibre(porCapa);
        if (capa === -1) {
            enviarMensaje('aviso', 'Las tres capas ya están llenas. Quita un electrón para agregar otro.');
            return null;
        }
    }

    contadoresParticula[tipo] += 1;
    const id = `${NOMBRES_PARTICULA[tipo].prefijo}${contadoresParticula[tipo]}`;
    const grupo = crearParticulaVisual(tipo);
    grupo.userData.id = id;
    grupo.userData.tipo = 'particula';
    grupo.userData.particula = tipo;
    if (tipo === 'electron') {
        grupoElectrones.add(grupo);
    } else {
        grupoNucleo.add(grupo);
    }
    const particula = { id, tipo, capa, grupo };
    particulas[tipo].push(particula);
    if (tipo === 'electron') reorganizarElectrones();
    else reorganizarNucleo();

    const nuevoConteo = obtenerConteoParticulas();
    emit('escena:particula-agregada', { id, tipo, capa });
    emitirConteoParticulas();
    const datos = NOMBRES_PARTICULA[tipo];
    enviarMensaje('aviso', `Agregaste un ${datos.nombre}. Ahora tienes ${nuevoConteo.protones} protones, ${nuevoConteo.neutrones} neutrones y ${nuevoConteo.electrones} electrones.`);
    setUltimaAccion(`Agregaste un ${datos.nombre} (${id})`);
    return id;
}

/**
 * Quita la última partícula agregada de ese tipo. Para los electrones
 * quita la de la capa más alta que tenga electrones.
 * Devuelve true si quitó una y false si no había ninguna.
 * @param {string} tipo 'proton', 'neutron' o 'electron'.
 */
export function quitarParticula(tipo) {
    if (!Object.hasOwn(NOMBRES_PARTICULA, tipo)) {
        enviarMensaje('aviso', 'Esa partícula no existe. Solo hay protones, neutrones y electrones.');
        return false;
    }
    const lista = particulas[tipo];
    if (lista.length === 0) {
        const datos = NOMBRES_PARTICULA[tipo];
        enviarMensaje('aviso', `No hay ${datos.plural} para quitar.`);
        return false;
    }

    const particula = lista.pop();
    particula.grupo.parent?.remove(particula.grupo);
    liberarGrupo(particula.grupo);
    if (tipo === 'electron') reorganizarElectrones();
    else reorganizarNucleo();

    const conteo = obtenerConteoParticulas();
    const datos = NOMBRES_PARTICULA[tipo];
    emit('escena:particula-quitada', { id: particula.id, tipo });
    emitirConteoParticulas();
    enviarMensaje('aviso', `Quitaste un ${datos.nombre}. Ahora tienes ${conteo.protones} protones, ${conteo.neutrones} neutrones y ${conteo.electrones} electrones.`);
    setUltimaAccion(`Quitaste un ${datos.nombre} (${particula.id})`);
    return true;
}

/** Quita todas las partículas del modelo de Bohr y deja el conteo en cero. */
export function limpiarParticulas() {
    for (const tipo of Object.keys(particulas)) {
        for (const particula of particulas[tipo]) {
            particula.grupo.parent?.remove(particula.grupo);
            liberarGrupo(particula.grupo);
        }
        particulas[tipo] = [];
        contadoresParticula[tipo] = 0;
    }
    if (grupoOrbitas) {
        grupoOrbitas.children.forEach((orbita) => { orbita.visible = false; });
    }
    emitirConteoParticulas();
    setUltimaAccion('Quitaste todas las partículas');
}

/**
 * Resalta el electrón de la capa externa de un átomo: los puntos
 * blancos de su aro de valencia se vuelven dorados durante 1 s y
 * luego el aro se reconstruye con su color normal.
 */
function resaltarAnillo(id) {
    const atomo = atomos.get(id);
    if (!atomo?.anillo) return;
    atomo.anillo.children.forEach((objeto) => {
        if (objeto.geometry?.type === 'SphereGeometry') {
            objeto.material.color.setHex(COLOR_RESALTADO);
        }
    });
    setTimeout(() => actualizarAnillo(id), 1000);
}

/**
 * Anima los electrones compartidos al formarse un enlace: un punto
 * dorado por cada par viaja entre los dos átomos durante 1 s (ida y
 * vuelta). Los dos pares van uno a cada lado del enlace, como los
 * dos cilindros del enlace doble; con un par, va centrado. Esta
 * animación es la parte que la HU asigna a Citlaly: vive aquí
 * porque este módulo tiene los átomos y la escena, y escucha el
 * mismo evento escena:electrones-compartidos que puede usar
 * cualquier otra animación en su lugar.
 */
async function animarElectronesCompartidos(a, b, pares) {
    const atomoA = atomos.get(a);
    const atomoB = atomos.get(b);
    const contenedor = obtenerContenedorAtomos();
    if (!atomoA || !atomoB || !contenedor) return;

    const pA = atomoA.grupo.position.clone();
    const pB = atomoB.grupo.position.clone();
    const normal = new THREE.Vector3().subVectors(pB, pA).normalize();
    const eje = Math.abs(normal.dot(EJE_UP)) > 0.99
        ? new THREE.Vector3(1, 0, 0)
        : EJE_UP;
    const desplazamiento = new THREE.Vector3()
        .crossVectors(normal, eje)
        .normalize()
        .multiplyScalar(ALTURA_ENLACE_DOBLE);

    resaltarAnillo(a);
    resaltarAnillo(b);

    const animaciones = [];
    for (let i = 0; i < pares; i++) {
        const separacion = pares === 2 ? (i === 0 ? 1 : -1) : 0;
        const inicio = pA.clone()
            .addScaledVector(normal, atomoA.radio + 0.1)
            .addScaledVector(desplazamiento, separacion);
        const fin = pB.clone()
            .addScaledVector(normal, -(atomoB.radio + 0.1))
            .addScaledVector(desplazamiento, separacion);
        const punto = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 12, 8),
            new THREE.MeshBasicMaterial({ color: COLOR_RESALTADO }),
        );
        // El segundo par empieza en el otro extremo: se cruzan a
        // mitad de camino, como dos electrones que se mueven entre
        // los dos átomos.
        const ida = i % 2 === 0 ? inicio : fin;
        const vuelta = i % 2 === 0 ? fin : inicio;
        punto.position.copy(ida);
        contenedor.add(punto);
        animaciones.push((async () => {
            await animarHasta(punto, vuelta, 500);
            await animarHasta(punto, ida, 500);
            contenedor.remove(punto);
            liberarGrupo(punto);
        })());
    }
    await Promise.all(animaciones);
}

export function iniciarComandosDeAtomos() {
    // Pulgar arriba un segundo: verifica la molécula construida.
    on('gesto:listo', () => {
        verificarMolecula();
    });
    // Electrones compartidos al formarse un enlace: la animación de
    // 1 s entre los dos átomos y el resaltado de su capa externa.
    on('escena:electrones-compartidos', ({ a, b, pares }) => {
        void animarElectronesCompartidos(a, b, pares);
    });
    on('voz:comando', ({ intencion, parametros }) => {
        if (intencion === 'deshacer') {
            deshacer();
            return;
        }
        if (intencion === 'rehacer') {
            rehacer();
            return;
        }
        if (intencion === 'limpiar') {
            // Si se cancela la confirmación, las partículas se quedan.
            if (limpiarEscena()) {
                limpiarParticulas();
                enviarMensaje('aviso', 'Se limpió la escena');
            }
            return;
        }
        if (intencion === 'verificar') {
            verificarMolecula();
            return;
        }
        if (intencion === 'rotar') {
            // Un cuarto de vuelta: rotarVista(0.5) es media vuelta.
            const direccion = parametros?.direccion === 'izquierda' ? -0.25 : 0.25;
            rotarVista(direccion, 0);
            return;
        }
        if (intencion === 'acercar') {
            acercar(1.25);
            return;
        }
        if (intencion === 'alejar') {
            acercar(0.8);
            return;
        }
        if (intencion === 'agregar-particula' || intencion === 'quitar-particula') {
            const { tipo, cantidad } = parametros ?? {};
            if (!Object.hasOwn(NOMBRES_PARTICULA, tipo)) return;
            if (!Number.isSafeInteger(cantidad) || cantidad < 1) return;
            // agregarParticula y quitarParticula ya avisan al llegar
            // al límite de 30 y confirman cada acción: al fallar una,
            // se para para no repetir el mismo aviso.
            for (let i = 0; i < cantidad; i++) {
                const ok = intencion === 'quitar-particula'
                    ? quitarParticula(tipo)
                    : agregarParticula(tipo);
                if (!ok) break;
            }
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
        origen: centro.clone(),
    };
    // La foto se guarda al empezar el arrastre: durante el arrastre
    // el átomo ya se mueve con cada pointermove, así que al soltarlo
    // sería tarde para guardar la posición de antes.
    fotoArrastrePendiente = guardarFoto(`mover ${id}`);
    seleccionarAtomo(id);
    resaltarPorDelante(atomo, true);
    actualizarVistaPrevia(id);
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
    actualizarVistaPrevia(arrastre.id);
}

function terminarArrastre(id) {
    const arrastreActual = arrastre;
    arrastre = null;
    const atomo = atomos.get(id);
    if (!atomo) return;

    ocultarTarjetaAtomo();
    limpiarVistaPrevia();
    resaltarPorDelante(atomo, false);
    const p = atomo.grupo.position.clone();
    moverAtomo(id, { x: p.x, y: p.y, z: p.z });
    // Si al final no se movió, la foto del arrastre no sirve:
    // deshacerla no cambiaría nada. Si sí se movió, se queda.
    if (arrastreActual?.origen && p.distanceTo(arrastreActual.origen) < 0.001) {
        descartarFotoArrastre();
    } else {
        fotoArrastrePendiente = null;
    }
    evaluarUnionAlSoltar(id, arrastreActual?.origen ?? p);
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
    // Igual que con el mouse: la foto va al empezar, porque cada
    // flecha ya mueve el átomo en el momento.
    fotoArrastrePendiente = guardarFoto(`mover ${id}`);
    resaltarPorDelante(atomo, true);
    actualizarVistaPrevia(id);
    enviarMensaje('aviso', `Agarraste un ${ELEMENTOS[atomo.elemento].nombre.toLowerCase()}. Flechas para moverlo, Enter para soltarlo, Escape para cancelar`);
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
    actualizarVistaPrevia(id);
}

function cancelarArrastreTeclado() {
    const { id, origen } = arrastre;
    arrastre = null;
    limpiarVistaPrevia();
    const atomo = atomos.get(id);
    if (!atomo) return;

    atomo.grupo.position.copy(origen);
    for (const otroId of atomo.enlaces) {
        actualizarEnlace(id, otroId);
    }
    // El átomo volvió a su sitio: el movimiento no ocurrió y su
    // foto no debe quedarse en el historial.
    descartarFotoArrastre();
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

/* Tarjeta de información del átomo: aparece solo al dejar el
   cursor quieto sobre un átomo en la escena. */
const ESPERA_TARJETA_MS = 500;
let tarjetaPendiente = null;
let tarjetaVisibleId = null;
let temporizadorTarjeta = null;
let tarjetaX = 0;
let tarjetaY = 0;

/** Oculta la tarjeta y cancela la espera, si había una en curso. */
function ocultarTarjetaAtomo() {
    if (temporizadorTarjeta !== null) {
        clearTimeout(temporizadorTarjeta);
        temporizadorTarjeta = null;
    }
    tarjetaPendiente = null;
    tarjetaVisibleId = null;
    const tarjeta = document.getElementById('tarjeta-atomo');
    if (tarjeta) tarjeta.hidden = true;
}

/**
 * Muestra la tarjeta con la información de un átomo, junto al cursor.
 * @param {string} id Id del átomo.
 */
function mostrarTarjetaAtomo(id) {
    const atomo = atomos.get(id);
    const tarjeta = document.getElementById('tarjeta-atomo');
    if (!atomo || !tarjeta) return;

    const datos = ELEMENTOS[atomo.elemento];
    const usados = valenciaUsada(id);
    const libres = Math.max(datos.valencia - usados, 0);
    const contenedor = document.getElementById('lienzo-3d');
    const rect = contenedor?.getBoundingClientRect();

    tarjeta.replaceChildren();
    const titulo = document.createElement('strong');
    titulo.textContent = `${datos.nombre} (${atomo.elemento})`;
    const grupo = document.createElement('span');
    grupo.textContent = datos.grupo;
    const valencia = document.createElement('span');
    valencia.textContent = `Valencia: ${datos.valencia} · Enlaces: ${usados} · Libres: ${libres}`;
    tarjeta.append(titulo, grupo, valencia);

    tarjeta.hidden = false;
    if (rect) {
        const izquierda = Math.min(
            Math.max(tarjetaX - rect.left + 16, 8),
            Math.max(rect.width - tarjeta.offsetWidth - 8, 8)
        );
        const arriba = Math.min(
            Math.max(tarjetaY - rect.top + 16, 8),
            Math.max(rect.height - tarjeta.offsetHeight - 8, 8)
        );
        tarjeta.style.left = `${izquierda}px`;
        tarjeta.style.top = `${arriba}px`;
    }
    tarjetaVisibleId = id;
    tarjetaPendiente = null;
    temporizadorTarjeta = null;
}

/**
 * Al mover el cursor sobre la escena, espera a que se quede quieto
 * sobre un átomo para mostrar su tarjeta. Si el cursor se mueve a
 * otro átomo o fuera de la escena, la espera empieza de nuevo.
 */
function manejarHover(evento) {
    if (arrastre) {
        ocultarTarjetaAtomo();
        return;
    }
    if (evento.pointerType && evento.pointerType !== 'mouse') return;

    const lienzo = obtenerLienzo();
    if (!lienzo) return;
    tarjetaX = evento.clientX;
    tarjetaY = evento.clientY;

    const punto = coordenadasDePuntero(evento, lienzo);
    const id = punto ? atomoBajoPuntero(punto.x, punto.y) : null;

    if (!id) {
        ocultarTarjetaAtomo();
        return;
    }
    if (id === tarjetaVisibleId) return;
    if (id === tarjetaPendiente) return;

    if (temporizadorTarjeta !== null) clearTimeout(temporizadorTarjeta);
    tarjetaPendiente = id;
    temporizadorTarjeta = setTimeout(() => mostrarTarjetaAtomo(id), ESPERA_TARJETA_MS);
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
        ocultarTarjetaAtomo();
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

    // Tarjeta de información: solo al dejar el cursor sobre un átomo.
    lienzo.addEventListener('pointermove', manejarHover);
    lienzo.addEventListener('pointerleave', ocultarTarjetaAtomo);

    const finalizar = (evento) => {
        if (!arrastre || arrastre.teclado) return;

        const punto = coordenadasDePuntero(evento, lienzo);
        soltarArrastre(punto?.x, punto?.y);
    };

    lienzo.addEventListener('pointerup', finalizar);
    lienzo.addEventListener('pointercancel', finalizar);

    return true;
}