/**
 * @file ra.js
 * @description Modo de realidad aumentada (RA) dentro de MolecuLab. Abre la
 * cámara, reconoce la tarjeta con MindAR y dibuja sobre ella la molécula del
 * editor, actualizada en vivo. Mientras la RA está activa, la detección de manos
 * se pausa, porque MindAR y MediaPipe no pueden usar la cámara a la vez. Al salir
 * se libera la cámara y se reanudan las manos.
 * @author Citlaly Morales Viveros
 */

import * as THREE from 'three';
import { emit, on } from './bus.js';
import { detenerGestos, iniciarGestos } from './gestures.js';
import { actualizarMallaEnlace, crearAtomoVisual, crearMallaEnlace, liberarGrupo } from './modelos.js';
import { obtenerListaAtomos, obtenerListaEnlaces } from './atoms.js';
import { actualizarAnilloValencia, enlacesUsados, valenciaDe } from './chemistry.js';
import { setUltimaAccion } from './state.js';

/** Núcleo de MindAR. El puente con Three lo hace este módulo, como en el prototipo. */
const URL_MINDAR = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';

/** Marcador de la tarjeta. Es el prototipo; se reemplazará por el definitivo de 8 × 8 cm. */
const RUTA_MARCADOR = 'ar/marcador.mind';

/** Resolución que se pide a la cámara. MindAR usa la real del video, no esta. */
const ANCHO_ENTRADA = 640;
const ALTO_ENTRADA = 480;

/** Tamaño de la molécula respecto a la tarjeta (1 unidad = ancho de la tarjeta). */
const ESCALA_MOLECULA = 0.3;

/** Vistas posibles del área de trabajo cuando la RA está activa. */
const VISTAS = ['dividida', 'editor', 'ra'];

/** @type {{boton: HTMLElement, lienzo: HTMLElement, area: HTMLElement, selector: HTMLElement, estado: HTMLElement} | null} */
let elementos = null;
let activa = false;
let ocupado = false;
let vista = 'dividida';
let ultimoEstado = '';
let oyentesRegistrados = false;

let video = null;
let flujo = null;
let controlador = null;
let renderer = null;
let escena = null;
let camara = null;
let ancla = null;
let estructura = null;
let postMatrix = null;
let observador = null;

/** Átomos dibujados en la RA: id → { grupo, anillo, radio, elemento }. */
const atomosRA = new Map();
/** Enlaces dibujados en la RA: clave «a|b» → { grupo, cilindros, a, b, orden }. */
const enlacesRA = new Map();
/** Ids de átomos con cambios que se aplican en el siguiente cuadro. */
const atomosPendientes = new Set();
/** true cuando hay que reconstruir toda la estructura (limpiar, importar, deshacer, rehacer). */
let reconstruirTodo = false;

/**
 * Conecta el botón de RA, el selector de vista y los eventos de la escena.
 * Debe llamarse después de iniciarGestos, porque la RA pausa y reanuda esa detección.
 * @returns {boolean} true si quedó lista.
 * @throws {Error} Si falta alguno de los elementos de la RA en la página.
 */
export function iniciarRA() {
    if (elementos) return true;

    const boton = document.querySelector('[data-accion="ra"]');
    const lienzo = document.getElementById('lienzo-ra');
    const area = document.getElementById('area-escena');
    const selector = document.getElementById('selector-vista');
    const estado = document.getElementById('estado-ra');
    if (!boton || !lienzo || !area || !selector || !estado) {
        throw new Error('faltan elementos de la realidad aumentada en la página');
    }

    elementos = { boton, lienzo, area, selector, estado };
    boton.addEventListener('click', alternarRA);
    selector.querySelectorAll('[data-vista]').forEach((opcion) => {
        opcion.addEventListener('click', () => cambiarVista(opcion.dataset.vista));
    });
    registrarEventosDeEscena();
    return true;
}

/**
 * Escucha los cambios del editor. Cada evento solo marca lo que cambió; la
 * actualización se aplica en el cuadro siguiente. La reconstrucción completa
 * se pide con limpiar, importar, deshacer y rehacer (escena:reconstruir).
 */
function registrarEventosDeEscena() {
    if (oyentesRegistrados) return;
    oyentesRegistrados = true;

    const marcarAtomo = ({ id }) => { if (activa) atomosPendientes.add(id); };
    const marcarEnlace = ({ a, b }) => {
        if (!activa) return;
        atomosPendientes.add(a);
        atomosPendientes.add(b);
    };
    const pedirReconstruccion = () => { if (activa) reconstruirTodo = true; };

    on('escena:atomo-agregado', marcarAtomo);
    on('escena:atomo-movido', marcarAtomo);
    on('escena:atomo-desplazado', marcarAtomo);
    on('escena:atomo-eliminado', marcarAtomo);
    on('escena:enlace-creado', marcarEnlace);
    on('escena:enlace-eliminado', marcarEnlace);
    on('escena:escena-limpia', pedirReconstruccion);
    on('escena:reconstruir', pedirReconstruccion);
}

/** Enciende la RA si está apagada, o la apaga si está encendida. */
function alternarRA() {
    if (ocupado) return;
    if (activa) desactivarRA();
    else activarRA();
}

/**
 * Enciende la RA: muestra la vista dividida, pausa las manos y abre la
 * cámara con MindAR. Si algo falla, apaga la RA, deja el editor como estaba
 * y explica la alternativa.
 */
async function activarRA() {
    ocupado = true;
    vista = 'dividida';
    reconstruirTodo = true;
    atomosPendientes.clear();
    mostrarRA(true);
    cambiarEstado('Abriendo la cámara…');

    // MindAR necesita la cámara: se libera la de las manos antes de abrirla.
    detenerGestos();
    emit('estado:manos', { cantidad: 0 });

    try {
        video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.muted = true;
        video.style.position = 'absolute';
        elementos.lienzo.insertBefore(video, elementos.estado);

        await abrirCamara();
        await iniciarMindAR();

        activa = true;
        cambiarEstado('Buscando marcador…');
        setUltimaAccion('Realidad aumentada activa');
    } catch (error) {
        console.error('[ra] No se pudo iniciar la realidad aumentada:', error);
        desactivarRA();
        emit('ui:mensaje', { tipo: 'aviso', texto: mensajeDeError(error) });
    } finally {
        ocupado = false;
    }
}

/**
 * Apaga la RA: detiene MindAR y el render, libera la cámara y los modelos,
 * oculta el área de RA y reanuda la detección de manos del editor.
 * Es seguro llamarla aunque la RA no haya llegado a encenderse.
 */
function desactivarRA() {
    if (!elementos) return;
    const estabaActiva = activa;
    activa = false;

    observador?.disconnect();
    observador = null;
    renderer?.setAnimationLoop(null);
    controlador?.stopProcessVideo?.();

    flujo?.getTracks().forEach((pista) => pista.stop());
    flujo = null;

    if (video) {
        video.srcObject = null;
        video.remove();
        video = null;
    }

    for (const id of [...atomosRA.keys()]) quitarAtomoRA(id);
    for (const clave of [...enlacesRA.keys()]) quitarEnlaceRA(clave);
    atomosPendientes.clear();

    if (estructura) {
        ancla?.remove(estructura);
        estructura = null;
    }
    if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
    }
    escena = null;
    camara = null;
    ancla = null;
    postMatrix = null;
    controlador = null;

    mostrarRA(false);
    cambiarEstado('');
    iniciarGestos();

    if (estabaActiva) setUltimaAccion('Realidad aumentada apagada');
}

/**
 * Muestra u oculta el área de RA, el selector de vista y el estado del botón.
 * Al mostrarla aplica la vista actual.
 * @param {boolean} mostrar
 */
function mostrarRA(mostrar) {
    document.body.classList.toggle('modo-ra', mostrar);
    elementos.lienzo.hidden = !mostrar;
    elementos.selector.hidden = !mostrar;
    elementos.boton.setAttribute('aria-pressed', String(mostrar));

    if (mostrar) {
        cambiarVista(vista);
    } else {
        VISTAS.forEach((nombre) => elementos.area.classList.remove(`vista-${nombre}`));
    }
}

/**
 * Cambia entre vista dividida, solo editor y solo RA. No toca la escena ni
 * la RA: solo oculta una de las dos áreas, así que ambas conservan su estado.
 * @param {string} nueva Una de «dividida», «editor» o «ra».
 */
function cambiarVista(nueva) {
    if (!VISTAS.includes(nueva)) return;
    vista = nueva;
    if (!document.body.classList.contains('modo-ra')) return;

    VISTAS.forEach((nombre) => elementos.area.classList.toggle(`vista-${nombre}`, nombre === nueva));
    elementos.selector.querySelectorAll('[data-vista]').forEach((opcion) => {
        opcion.setAttribute('aria-pressed', String(opcion.dataset.vista === nueva));
    });
}

/**
 * Pide la cámara trasera o la disponible y fija el tamaño de origen del video
 * a su resolución real. MindAR dibuja el video con ese tamaño; si no coincide,
 * el cuadro sale recortado y no se reconoce la tarjeta.
 * @throws {DOMException|Error} Si el navegador no tiene cámara o se niega el permiso.
 */
async function abrirCamara() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('El navegador no ofrece acceso a la cámara.', 'NotSupportedError');
    }
    flujo = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'environment',
            width: { ideal: ANCHO_ENTRADA },
            height: { ideal: ALTO_ENTRADA },
        },
        audio: false,
    });
    video.srcObject = flujo;
    await video.play();
    video.setAttribute('width', video.videoWidth);
    video.setAttribute('height', video.videoHeight);
}

/**
 * Carga MindAR, registra el marcador, crea la escena de Three y empieza a
 * procesar el video. MindAR se importa aquí, al encender la RA, para no
 * descargarlo si el usuario nunca la usa.
 */
async function iniciarMindAR() {
    const { Controller } = await import(URL_MINDAR);

    // La entrada de MindAR debe tener la misma proporción que el video real de la cámara.
    controlador = new Controller({
        inputWidth: video.videoWidth,
        inputHeight: video.videoHeight,
        maxTrack: 1,
        onUpdate: recibirActualizacion,
    });

    const { dimensions } = await controlador.addImageTargets(RUTA_MARCADOR);
    const [anchoMarcador, altoMarcador] = dimensions[0];
    // Lleva el marcador al espacio del ancla: 1 unidad = ancho de la tarjeta, centrada en el marcador.
    postMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(anchoMarcador / 2, anchoMarcador / 2 + (altoMarcador - anchoMarcador) / 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(anchoMarcador, anchoMarcador, anchoMarcador),
    );

    crearEscena();
    ajustarVista();
    observador = new ResizeObserver(ajustarVista);
    observador.observe(elementos.lienzo);

    await controlador.dummyRun(video);
    controlador.processVideo(video);
    renderer.setAnimationLoop(() => {
        sincronizarEstructura();
        renderer.render(escena, camara);
    });
}

/**
 * Crea el renderizador de la RA, su luz y el ancla de la estructura.
 * La estructura se gira 90° sobre el eje X: en el editor, las moléculas están
 * sobre el plano del tablero (x, z); así quedan planas sobre la tarjeta.
 */
function crearEscena() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // El video va debajo del canvas: ambos están posicionados y el orden es por z-index.
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '1';
    elementos.lienzo.appendChild(renderer.domElement);

    escena = new THREE.Scene();
    camara = new THREE.PerspectiveCamera();
    escena.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2));

    ancla = new THREE.Group();
    ancla.matrixAutoUpdate = false;
    ancla.visible = false;
    escena.add(ancla);

    estructura = new THREE.Group();
    estructura.rotation.x = Math.PI / 2;
    estructura.scale.setScalar(ESCALA_MOLECULA);
    ancla.add(estructura);
}

/**
 * Sincroniza la RA con el editor en cada cuadro. Si hubo una reconstrucción,
 * la hace completa; si no, aplica solo los cambios marcados por los eventos.
 */
function sincronizarEstructura() {
    if (!activa || !estructura) return;

    if (reconstruirTodo) {
        reconstruirEstructura();
        return;
    }
    if (atomosPendientes.size === 0) return;
    aplicarCambios();
}

/**
 * Reconstruye toda la estructura desde el editor. Se usa al encender la RA y
 * después de limpiar, importar, deshacer o rehacer.
 */
function reconstruirEstructura() {
    for (const id of [...atomosRA.keys()]) quitarAtomoRA(id);
    for (const clave of [...enlacesRA.keys()]) quitarEnlaceRA(clave);

    const enlaces = obtenerListaEnlaces();
    for (const atomo of obtenerListaAtomos()) crearAtomoRA(atomo);
    for (const enlace of enlaces) crearEnlaceRA(enlace);
    actualizarAnillosRA(enlaces);

    reconstruirTodo = false;
    atomosPendientes.clear();
}

/**
 * Aplica solo lo que cambió: quita y agrega átomos, mueve los que cambiaron de
 * posición, crea y quita enlaces, y actualiza la geometría de los enlaces
 * tocados y los anillos de valencia.
 */
function aplicarCambios() {
    const atomos = obtenerListaAtomos();
    const enlaces = obtenerListaEnlaces();

    const idsActuales = new Set(atomos.map((atomo) => atomo.id));
    for (const id of [...atomosRA.keys()]) {
        if (!idsActuales.has(id)) quitarAtomoRA(id);
    }

    for (const atomo of atomos) {
        if (!atomosRA.has(atomo.id)) crearAtomoRA(atomo);
        else if (atomosPendientes.has(atomo.id)) posicionarAtomoRA(atomo);
    }

    const clavesActuales = new Map(enlaces.map((enlace) => [clave(enlace.a, enlace.b), enlace]));
    for (const [claveEnlace, enlace] of [...enlacesRA]) {
        const actual = clavesActuales.get(claveEnlace);
        if (!actual || actual.orden !== enlace.orden) quitarEnlaceRA(claveEnlace);
    }
    for (const [claveEnlace, enlace] of clavesActuales) {
        if (!enlacesRA.has(claveEnlace)) crearEnlaceRA(enlace);
    }

    for (const enlace of enlacesRA.values()) {
        if (atomosPendientes.has(enlace.a) || atomosPendientes.has(enlace.b)) actualizarEnlaceRA(enlace);
    }

    actualizarAnillosRA(enlaces);
    atomosPendientes.clear();
}

/**
 * Crea la representación de un átomo del editor, con su posición.
 * @param {{id: string, elemento: string, posicion: {x: number, y: number, z: number}}} atomo
 */
function crearAtomoRA(atomo) {
    const { grupo, anillo, radio } = crearAtomoVisual(atomo.elemento);
    grupo.position.set(atomo.posicion.x, atomo.posicion.y, atomo.posicion.z);
    estructura.add(grupo);
    atomosRA.set(atomo.id, { grupo, anillo, radio, elemento: atomo.elemento });
}

/**
 * Mueve la representación de un átomo a su nueva posición.
 * @param {{id: string, posicion: {x: number, y: number, z: number}}} atomo
 */
function posicionarAtomoRA(atomo) {
    const representacion = atomosRA.get(atomo.id);
    if (!representacion) return;
    representacion.grupo.position.set(atomo.posicion.x, atomo.posicion.y, atomo.posicion.z);
}

/**
 * Quita un átomo de la RA, junto con los enlaces que lo tocan.
 * @param {string} id
 */
function quitarAtomoRA(id) {
    for (const [claveEnlace, enlace] of [...enlacesRA]) {
        if (enlace.a === id || enlace.b === id) quitarEnlaceRA(claveEnlace);
    }
    const representacion = atomosRA.get(id);
    if (!representacion) return;
    estructura.remove(representacion.grupo);
    liberarGrupo(representacion.grupo);
    atomosRA.delete(id);
}

/**
 * Crea un enlace simple o doble entre dos átomos ya dibujados.
 * @param {{a: string, b: string, orden: number}} enlace
 */
function crearEnlaceRA(enlace) {
    const { grupo, cilindros } = crearMallaEnlace(enlace.orden, enlace.a, enlace.b);
    estructura.add(grupo);
    const representacion = { grupo, cilindros, a: enlace.a, b: enlace.b, orden: enlace.orden };
    enlacesRA.set(clave(enlace.a, enlace.b), representacion);
    actualizarEnlaceRA(representacion);
}

/**
 * Coloca un enlace entre las posiciones actuales de sus dos átomos.
 * @param {{a: string, b: string, cilindros: THREE.Mesh[]}} enlace
 */
function actualizarEnlaceRA(enlace) {
    const atomoA = atomosRA.get(enlace.a);
    const atomoB = atomosRA.get(enlace.b);
    if (!atomoA || !atomoB) return;
    actualizarMallaEnlace(enlace, atomoA.grupo.position, atomoB.grupo.position);
}

/**
 * Quita un enlace de la RA y libera su geometría.
 * @param {string} claveEnlace Clave «a|b» del enlace.
 */
function quitarEnlaceRA(claveEnlace) {
    const enlace = enlacesRA.get(claveEnlace);
    if (!enlace) return;
    estructura.remove(enlace.grupo);
    liberarGrupo(enlace.grupo);
    enlacesRA.delete(claveEnlace);
}

/**
 * Recalcula el anillo de valencia de cada átomo, igual que en el editor:
 * la valencia que le queda libre según sus enlaces.
 * @param {Array<{a: string, b: string, orden: number}>} enlaces
 */
function actualizarAnillosRA(enlaces) {
    for (const [id, representacion] of atomosRA) {
        const libres = Math.max(valenciaDe(representacion.elemento) - enlacesUsados(id, enlaces), 0);
        actualizarAnilloValencia(representacion.anillo, representacion.radio, libres);
    }
}

/**
 * Clave estable de un enlace, sin importar el orden de sus átomos.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function clave(a, b) {
    return [a, b].sort().join('|');
}

/**
 * Recibe las actualizaciones de MindAR: coloca el ancla cuando reconoce el
 * marcador y la oculta cuando lo pierde.
 * @param {{type: string, targetIndex: number, worldMatrix?: number[]}} dato
 */
function recibirActualizacion(dato) {
    if (!ancla || dato.type !== 'updateMatrix' || dato.targetIndex !== 0) return;

    if (dato.worldMatrix) {
        ancla.matrix.fromArray(dato.worldMatrix).multiply(postMatrix);
        ancla.visible = true;
        cambiarEstado('Marcador reconocido');
    } else {
        ancla.visible = false;
        cambiarEstado('Buscando marcador…');
    }
}

/**
 * Ajusta el video y la cámara de Three al tamaño del área de RA. Usa el mismo
 * criterio que el prototipo de MindAR para que la molécula quede alineada con
 * el video. No hace nada mientras el área está oculta (tamaño cero).
 */
function ajustarVista() {
    if (!renderer || !camara || !controlador || !video?.videoWidth) return;

    const anchoC = elementos.lienzo.clientWidth;
    const altoC = elementos.lienzo.clientHeight;
    if (!anchoC || !altoC) return;

    const relacionVideo = video.videoWidth / video.videoHeight;
    const relacionC = anchoC / altoC;
    let vw;
    let vh;
    if (relacionVideo > relacionC) {
        vh = altoC;
        vw = vh * relacionVideo;
    } else {
        vw = anchoC;
        vh = vw / relacionVideo;
    }
    video.style.width = `${vw}px`;
    video.style.height = `${vh}px`;
    video.style.left = `${-(vw - anchoC) / 2}px`;
    video.style.top = `${-(vh - altoC) / 2}px`;

    const proyeccion = controlador.getProjectionMatrix();
    const anchoEntrada = controlador.inputWidth;
    const altoEntrada = controlador.inputHeight;
    const relacionEntrada = anchoEntrada / altoEntrada;
    const ajusteEntrada = relacionEntrada > relacionC
        ? video.videoWidth / anchoEntrada
        : video.videoHeight / altoEntrada;
    const altoVisible = relacionEntrada > relacionC
        ? altoC * ajusteEntrada
        : (anchoC / anchoEntrada * altoEntrada) * ajusteEntrada;
    const ajusteCampo = altoC / altoVisible;

    camara.fov = 2 * Math.atan(1 / proyeccion[5] * ajusteCampo) * 180 / Math.PI;
    camara.near = proyeccion[14] / (proyeccion[10] - 1.0);
    camara.far = proyeccion[14] / (proyeccion[10] + 1.0);
    camara.aspect = anchoC / altoC;
    camara.updateProjectionMatrix();
    renderer.setSize(anchoC, altoC);
}

/**
 * Muestra un texto de estado en el área de RA, solo cuando cambia.
 * @param {string} texto
 */
function cambiarEstado(texto) {
    if (texto === ultimoEstado || !elementos) return;
    ultimoEstado = texto;
    elementos.estado.textContent = texto;
}

/**
 * Traduce un error de cámara o de MindAR en un aviso con la alternativa.
 * @param {Error} error
 * @returns {string}
 */
function mensajeDeError(error) {
    const alternativa = 'Puedes seguir con el editor, que funciona con mouse o teclado.';
    if (error?.name === 'NotAllowedError') {
        return `Cámara denegada: la realidad aumentada no puede usarla. ${alternativa}`;
    }
    if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
        return `No encontré una cámara disponible. ${alternativa}`;
    }
    return `No pude iniciar la realidad aumentada. ${alternativa}`;
}