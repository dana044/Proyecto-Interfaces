/**
 * @file reto.js
 * @description Modo reto «construye una molécula» con pistas.
 * Los retos son las 6 primeras moléculas del catálogo
 * (data/moleculas.json), en orden de dificultad. Cada reto muestra
 * su fórmula y el siguiente átomo sugerido; al verificar bien se
 * gana 1 estrella y se pasa al siguiente; tras 2 intentos fallidos
 * la pista pasa a ser directa. Por reto se guardan los intentos y
 * el tiempo en el estado, para la evaluación. Se puede salir al
 * modo libre y volver sin perder lo construido.
 * @author Citlaly Morales Viveros
 */

import { emit, on } from './bus.js';
import { estado, setModo } from './state.js';
import { hablar } from './voice.js';
import { ELEMENTOS } from './elementos.js';
import { identificarMolecula, descripcionEnlace } from './molecules.js';
import { limpiarEscena, obtenerListaAtomos, obtenerListaEnlaces } from './atoms.js';

/** Retos en orden de dificultad: las 6 primeras del catálogo. */
export const RETOS_IDS = ['h2', 'o2', 'h2o', 'co2', 'ch4', 'nh3'];

/** Intentos fallidos tras los que la pista pasa a ser directa. */
const INTENTOS_PARA_PISTA_DIRECTA = 2;

/**
 * Espera antes de mostrar el mensaje del reto, para que no tape el
 * mensaje de la verificación, que llega justo después de verificar.
 */
const RETRASO_MENSAJE_RETO_MS = 1200;

let retos = [];
let retosCargados = false;
let procesandoExito = false;

/**
 * Tiempo como minutos y segundos («0:07», «1:23»).
 * @param {number} ms Milisegundos.
 * @returns {string} El tiempo en formato m:ss.
 */
export function formatearTiempo(ms) {
    const totalSegundos = Math.max(0, Math.floor(ms / 1000));
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = String(totalSegundos % 60).padStart(2, '0');
    return `${minutos}:${segundos}`;
}

/**
 * Nombre de un elemento en minúscula, en singular o en plural.
 * @param {string} elemento Símbolo del elemento.
 * @param {number} cantidad Cuántos hay.
 * @returns {string} El nombre («oxígeno», «2 hidrógenos»).
 */
function nombreElemento(elemento, cantidad) {
    const datos = ELEMENTOS[elemento];
    if (!datos) return elemento;
    return cantidad === 1
        ? datos.nombre.toLowerCase()
        : datos.plural;
}

/**
 * Une una lista con comas y «y» antes del último
 * («1 oxígeno y 2 hidrógenos»).
 * @param {string[]} partes Las partes a unir.
 * @returns {string} La lista unida.
 */
function unirConY(partes) {
    if (partes.length <= 1) return partes.join('');
    if (partes.length === 2) return `${partes[0]} y ${partes[1]}`;
    return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/**
 * Cuenta cuántos átomos hay de cada elemento.
 * @param {Array<{ elemento: string }>} atomos Átomos a contar.
 * @returns {Map<string, number>} Elemento → cantidad.
 */
function contarPorElemento(atomos) {
    const conteo = new Map();
    for (const atomo of atomos || []) {
        conteo.set(atomo.elemento, (conteo.get(atomo.elemento) || 0) + 1);
    }
    return conteo;
}

/**
 * El siguiente paso sugerido para el reto: el primer átomo que
 * falta, el primer enlace que falta, o que ya está lista para
 * verificar. Es lógica pura, sin escena, para poder probarla.
 * @param {object} molecula Molécula del reto, del catálogo.
 * @param {{ atomos: Array, enlaces: Array }} escena Átomos y enlaces actuales.
 * @returns {{ tipo: 'atomo' | 'enlace' | 'listo', texto: string }} La sugerencia.
 */
export function sugerirSiguiente(molecula, escena) {
    const resultado = identificarMolecula(escena, [molecula]);
    if (resultado.estado === 'completa') {
        return { tipo: 'listo', texto: 'Ya está lista. Pulsa Verificar molécula.' };
    }
    if (resultado.estado === 'incompleta') {
        const { falta } = resultado;
        if (falta.atomos.length > 0) {
            const { elemento, cantidad } = falta.atomos[0];
            return cantidad === 1
                ? { tipo: 'atomo', texto: `Agrega un ${nombreElemento(elemento, 1)}.` }
                : { tipo: 'atomo', texto: `Agrega ${cantidad} ${nombreElemento(elemento, cantidad)}.` };
        }
        if (falta.enlaces.length > 0) {
            const { a, b, orden, cantidad } = falta.enlaces[0];
            return { tipo: 'enlace', texto: `Une ${descripcionEnlace(a, b, orden || 1, cantidad)}.` };
        }
    }
    // Combinación desconocida o imposible: se sugiere por conteo de átomos.
    const conteoEscena = contarPorElemento(escena.atomos);
    const conteoReto = contarPorElemento(molecula.atomos);
    for (const [elemento, cantidad] of conteoReto) {
        const faltan = cantidad - (conteoEscena.get(elemento) || 0);
        if (faltan > 0) {
            return faltan === 1
                ? { tipo: 'atomo', texto: `Agrega un ${nombreElemento(elemento, 1)}.` }
                : { tipo: 'atomo', texto: `Agrega ${faltan} ${nombreElemento(elemento, faltan)}.` };
        }
    }
    for (const [elemento, cantidad] of conteoEscena) {
        if (cantidad > (conteoReto.get(elemento) || 0)) {
            return { tipo: 'atomo', texto: 'Hay átomos de más para este reto. Limpia la escena y vuelve a empezar.' };
        }
    }
    return { tipo: 'enlace', texto: 'Une los átomos para formar los enlaces de la fórmula.' };
}

/**
 * La pista directa: la receta completa del reto, con los átomos
 * que lleva y cómo unirlos. Es lógica pura, sin escena.
 * @param {object} molecula Molécula del reto, del catálogo.
 * @returns {string} La pista directa.
 */
export function pistaDirecta(molecula) {
    const nombre = molecula.nombre.toLowerCase();
    const conteo = contarPorElemento(molecula.atomos);
    const partesAtomos = [...conteo.entries()].map(([elemento, cantidad]) => (
        cantidad === 1
            ? `1 ${nombreElemento(elemento, 1)}`
            : `${cantidad} ${nombreElemento(elemento, cantidad)}`
    ));
    const gruposEnlace = new Map();
    for (const enlace of molecula.enlaces || []) {
        const elementoDesde = (molecula.atomos || []).find((at) => at.id === enlace.desde)?.elemento;
        const elementoHasta = (molecula.atomos || []).find((at) => at.id === enlace.hasta)?.elemento;
        if (!elementoDesde || !elementoHasta) continue;
        const clave = [elementoDesde, elementoHasta].sort().join('|') + `|${enlace.orden || 1}`;
        const grupo = gruposEnlace.get(clave) || {
            a: elementoDesde,
            b: elementoHasta,
            orden: enlace.orden || 1,
            cantidad: 0,
        };
        grupo.cantidad += 1;
        gruposEnlace.set(clave, grupo);
    }
    const frasesEnlaces = [...gruposEnlace.values()].map(({ a, b, orden, cantidad }) => (
        `Une ${descripcionEnlace(a, b, orden, cantidad)}.`
    ));
    return `Para ${nombre} necesitas ${unirConY(partesAtomos)}. ${frasesEnlaces.join(' ')}`;
}

/**
 * Registro nuevo de un reto: sus intentos, su tiempo y si ya se
 * completó. Es lógica pura, sin escena.
 * @param {object} molecula Molécula del reto, del catálogo.
 * @returns {{ id: string, nombre: string, intentos: number, tiempoMs: number | null, completado: boolean }} El registro.
 */
export function crearRegistroReto(molecula) {
    return {
        id: molecula.id,
        nombre: molecula.nombre,
        intentos: 0,
        tiempoMs: null,
        completado: false,
    };
}

/**
 * Tiempo del reto actual: lo acumulado en pausas más lo que lleva
 * corriendo desde que empezó (0 si está en pausa).
 * @param {number | null} inicioMs Cuándo empezó el reto actual.
 * @param {number} tiempoAcumuladoMs Tiempo acumulado en pausas.
 * @param {number} ahora Momento actual en milisegundos.
 * @returns {number} El tiempo total en milisegundos.
 */
export function tiempoTranscurrido(inicioMs, tiempoAcumuladoMs, ahora) {
    return tiempoAcumuladoMs + (inicioMs === null ? 0 : Math.max(0, ahora - inicioMs));
}

/**
 * Carga los 6 retos desde el catálogo, en orden de dificultad.
 * Un reto que no esté en el catálogo o esté incompleto se salta
 * con un aviso en consola y los demás siguen.
 * @returns {Promise<object[]>} Las moléculas de los retos.
 */
async function cargarRetos() {
    try {
        const respuesta = await fetch('data/moleculas.json');
        if (!respuesta.ok) throw new Error('catálogo no disponible');
        const catalogo = await respuesta.json();
        const lista = [];
        for (const id of RETOS_IDS) {
            const molecula = (catalogo.moleculas || []).find((m) => m.id === id);
            if (!molecula || !Array.isArray(molecula.atomos) || molecula.atomos.length === 0
                || !Array.isArray(molecula.enlaces)) {
                console.warn(`[reto] El reto ${id} no está en el catálogo o está incompleto.`);
                continue;
            }
            lista.push(molecula);
        }
        return lista;
    } catch {
        return [];
    }
}

/** Molécula del reto actual, o null si no hay reto. */
function retoActual() {
    return retos[estado.reto.indice] || null;
}

/** Registro del reto actual; lo crea si todavía no existe. */
function registroActual() {
    const reto = retoActual();
    if (!reto) return null;
    let registro = estado.reto.resultados[estado.reto.indice];
    if (!registro || registro.id !== reto.id) {
        registro = crearRegistroReto(reto);
        estado.reto.resultados[estado.reto.indice] = registro;
    }
    return registro;
}

/** Átomos y enlaces de la escena, como los espera identificarMolecula(). */
function escenaActual() {
    return { atomos: obtenerListaAtomos(), enlaces: obtenerListaEnlaces() };
}

/** Para el temporizador del reto actual y acumula su tiempo. */
function pausarTemporizador() {
    if (estado.reto.inicioMs !== null) {
        estado.reto.tiempoAcumuladoMs = tiempoTranscurrido(
            estado.reto.inicioMs,
            estado.reto.tiempoAcumuladoMs,
            Date.now(),
        );
        estado.reto.inicioMs = null;
    }
}

/** Vuelve a empezar la lista de retos desde el primero. */
function reiniciarProgreso() {
    estado.reto.indice = 0;
    estado.reto.estrellas = 0;
    estado.reto.resultados = [];
    estado.reto.inicioMs = null;
    estado.reto.tiempoAcumuladoMs = 0;
}

/**
 * Publica el estado del reto para que la interfaz lo muestre:
 * reto actual, sugerencia, estrellas, intentos y tiempo.
 */
function publicarActualizacion() {
    const activo = estado.modo === 'reto';
    const reto = activo ? retoActual() : null;
    const registro = activo ? registroActual() : null;
    const terminado = activo && estado.reto.indice >= retos.length;
    emit('reto:actualizado', {
        activo,
        indice: estado.reto.indice,
        total: retos.length,
        titulo: terminado
            ? 'Retos terminados'
            : reto
                ? `Reto ${estado.reto.indice + 1} de ${retos.length}: ${reto.nombre}`
                : 'Modo reto',
        nombre: reto?.nombre || '',
        formula: reto?.formula || '',
        sugerencia: activo && reto && !terminado
            ? sugerirSiguiente(reto, escenaActual()).texto
            : '',
        estrellas: estado.reto.estrellas,
        intentos: registro?.intentos || 0,
        tiempoMs: tiempoTranscurrido(
            estado.reto.inicioMs,
            estado.reto.tiempoAcumuladoMs,
            Date.now(),
        ),
        terminado,
    });
}

/**
 * Entra al modo reto: carga los retos si es la primera vez y
 * sigue por el reto en el que iba. La escena no se toca: si ya
 * hay átomos construidos, cuentan para el reto. Devuelve false
 * si no se pudieron cargar los retos.
 * @returns {Promise<boolean>} true si entró al modo reto.
 */
export async function entrarModoReto() {
    if (estado.modo === 'reto') return true;
    if (!retosCargados) {
        retos = await cargarRetos();
        retosCargados = true;
    }
    if (retos.length === 0) {
        emit('ui:mensaje', { tipo: 'error', texto: 'No pude cargar los retos (data/moleculas.json).' });
        return false;
    }
    if (estado.reto.indice >= retos.length) reiniciarProgreso();
    registroActual();
    estado.reto.inicioMs = Date.now();
    setModo('reto');
    const reto = retoActual();
    publicarActualizacion();
    emit('ui:mensaje', {
        tipo: 'correcto',
        texto: `Reto ${estado.reto.indice + 1} de ${retos.length}: construye ${reto.nombre} (${reto.formula}). ${sugerirSiguiente(reto, escenaActual()).texto}`,
    });
    return true;
}

/**
 * Sale al modo libre sin perder nada: la escena queda como está
 * y el reto queda en pausa, con sus intentos y su tiempo, para
 * seguirlo al volver. Devuelve false si no estaba en modo reto.
 * @returns {boolean} true si salió al modo libre.
 */
export function salirModoReto() {
    if (estado.modo !== 'reto') return false;
    pausarTemporizador();
    setModo('libre');
    publicarActualizacion();
    emit('ui:mensaje', { tipo: 'aviso', texto: 'Saliste al modo libre. Lo que construiste se queda como está.' });
    return true;
}

/**
 * Da la pista del reto, por voz y en pantalla: la sugerencia
 * normal, o la pista directa si ya lleva 2 intentos fallidos.
 * Devuelve false si no está en modo reto.
 * @returns {boolean} true si dio la pista.
 */
export function darPista() {
    if (estado.modo !== 'reto') return false;
    const reto = retoActual();
    const registro = registroActual();
    if (!reto || !registro) return false;
    const texto = registro.intentos >= INTENTOS_PARA_PISTA_DIRECTA
        ? pistaDirecta(reto)
        : `Construye ${reto.formula}. ${sugerirSiguiente(reto, escenaActual()).texto}`;
    hablar(texto);
    emit('ui:mensaje', { tipo: 'aviso', texto });
    return true;
}

/**
 * Atiende el resultado de una verificación en modo reto: si la
 * molécula es la del reto, suma 1 estrella y pasa al siguiente
 * (limpiando la escena para el reto nuevo); si no, cuenta un
 * intento fallido y, al llegar a 2, ofrece la pista directa.
 * @param {{ nombre: string | null, formula: string | null, completa: boolean }} datos Resultado emitido.
 */
function alVerificar({ nombre, formula, completa }) {
    if (estado.modo !== 'reto' || procesandoExito) return;
    const reto = retoActual();
    const registro = registroActual();
    if (!reto || !registro) return;

    if (completa && formula === reto.formula) {
        procesandoExito = true;
        registro.completado = true;
        registro.tiempoMs = tiempoTranscurrido(
            estado.reto.inicioMs,
            estado.reto.tiempoAcumuladoMs,
            Date.now(),
        );
        estado.reto.estrellas += 1;
        pausarTemporizador();
        publicarActualizacion();
        setTimeout(() => {
            procesandoExito = false;
            if (estado.modo !== 'reto') {
                // Salió al modo libre antes de avanzar: la estrella
                // ya quedó guardada y al volver se sigue por el
                // siguiente reto, sin tocar la escena libre.
                estado.reto.indice = Math.min(estado.reto.indice + 1, retos.length);
                estado.reto.tiempoAcumuladoMs = 0;
                estado.reto.inicioMs = null;
                return;
            }
            if (estado.reto.indice + 1 < retos.length) {
                estado.reto.indice += 1;
                estado.reto.tiempoAcumuladoMs = 0;
                estado.reto.inicioMs = Date.now();
                registroActual();
                // La escena se limpia para el reto nuevo; el
                // deshacer lo puede recuperar si hace falta.
                limpiarEscena({ confirmar: false });
                publicarActualizacion();
                const siguiente = retoActual();
                emit('ui:mensaje', {
                    tipo: 'correcto',
                    texto: `¡Ganaste 1 estrella! Ahora construye ${siguiente.nombre} (${siguiente.formula}). ${sugerirSiguiente(siguiente, escenaActual()).texto}`,
                });
            } else {
                estado.reto.indice = retos.length;
                publicarActualizacion();
                emit('ui:mensaje', {
                    tipo: 'correcto',
                    texto: `¡Terminaste los 6 retos! Ganaste ${estado.reto.estrellas} estrellas.`,
                });
            }
        }, RETRASO_MENSAJE_RETO_MS);
        return;
    }

    registro.intentos += 1;
    publicarActualizacion();
    setTimeout(() => {
        if (estado.modo !== 'reto') return;
        if (registro.intentos >= INTENTOS_PARA_PISTA_DIRECTA) {
            const texto = `Llevas ${registro.intentos} intentos. Te doy una pista más directa: ${pistaDirecta(reto)}`;
            hablar(texto);
            emit('ui:mensaje', { tipo: 'aviso', texto });
        } else {
            emit('ui:mensaje', {
                tipo: 'aviso',
                texto: `Intento ${registro.intentos} de este reto. Si quieres una pista, di «ayuda» o pulsa Ayuda.`,
            });
        }
    }, RETRASO_MENSAJE_RETO_MS);
}

/**
 * Inicia el modo reto: escucha los comandos de voz (modo reto,
 * modo libre y ayuda), el resultado de cada verificación y los
 * cambios de la escena, para mantener la sugerencia al día.
 */
export function iniciarReto() {
    on('voz:comando', ({ intencion }) => {
        if (intencion === 'modo-reto') entrarModoReto();
        else if (intencion === 'modo-libre') salirModoReto();
        else if (intencion === 'ayuda') darPista();
    });
    on('escena:molecula-identificada', alVerificar);
    for (const evento of [
        'escena:atomo-agregado', 'escena:atomo-eliminado',
        'escena:enlace-creado', 'escena:enlace-eliminado', 'escena:escena-limpia',
    ]) {
        on(evento, () => {
            if (estado.modo === 'reto') publicarActualizacion();
        });
    }
}
