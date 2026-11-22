/**
 * @file voice.js
 * @author Dana Carmona Santamaria
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Citlaly Morales Viveros 
 */

import { emit } from './bus.js';

const AVISO_COMPATIBILIDAD = 'Usa Chrome o Edge para los comandos de voz';

/**
 * Frases que interrumpen una respuesta hablada. Se exportan para
 * que commands.js entienda exactamente las mismas que el
 * reconocimiento deja pasar mientras suena la locución.
 */
export const FRASES_PARAR = ['para', 'parar', 'calla', 'callate', 'silencio', 'basta'];

/**
 * Respuestas cortas que también pasan mientras suena una locución:
 * sin ellas, el "¿Seguro? Di sí o no." de limpiar nunca se podía
 * contestar, porque la propia pregunta tapaba la respuesta.
 */
export const FRASES_RESPUESTA = ['si', 'no'];

let reconocimiento;
let inicializada = false;
let escuchaSolicitada = false;
let sesion = 'inactiva';
let estadoMicrofono;
let reinicio;
let locucion;

function publicarEstado(estado) {
    if (estadoMicrofono === estado) return;

    estadoMicrofono = estado;
    emit('estado:microfono', { estado });
}

function informarError(texto) {
    escuchaSolicitada = false;
    clearTimeout(reinicio);
    publicarEstado('error');
    emit('ui:mensaje', { tipo: 'error', texto });
}

function iniciarEscucha() {
    if (!escuchaSolicitada || locucion || sesion !== 'inactiva') return;

    try {
        sesion = 'iniciando';
        reconocimiento.start();
    } catch (error) {
        sesion = 'inactiva';
        informarError(
            error.name === 'NotAllowedError' || error.name === 'SecurityError'
                ? AVISO_COMPATIBILIDAD
                : 'No pudimos activar el micrófono. Inténtalo de nuevo.'
        );
    }
}

function detenerEscucha() {
    clearTimeout(reinicio);
    if (sesion === 'inactiva' || sesion === 'cerrando') return;

    sesion = 'cerrando';
    reconocimiento.abort();
}

export function alternarMicrofono() {
    if (!reconocimiento) {
        informarError(AVISO_COMPATIBILIDAD);
        return;
    }

    escuchaSolicitada = !escuchaSolicitada;
    publicarEstado('pausado');

    if (escuchaSolicitada) iniciarEscucha();
    else detenerEscucha();
}

export function iniciarVoz() {
    if (inicializada) return;
    inicializada = true;

    const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Reconocimiento) {
        informarError(AVISO_COMPATIBILIDAD);
        return;
    }

    reconocimiento = new Reconocimiento();
    reconocimiento.lang = 'es-MX';
    reconocimiento.continuous = true;
    reconocimiento.interimResults = false;

    reconocimiento.onstart = () => {
        if (sesion === 'cerrando') return;

        sesion = 'activa';
        publicarEstado('escuchando');
    };

    reconocimiento.onresult = ({ resultIndex, results }) => {
        for (let i = resultIndex; i < results.length; i++) {
            if (!escuchaSolicitada || sesion !== 'activa') break;

            const resultado = results[i];
            if (!resultado.isFinal) continue;

            const texto = resultado[0].transcript
                .toLocaleLowerCase('es-MX')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();

            if (!texto) continue;

            // Mientras suena una respuesta, el micrófono sigue abierto
            // solo para "para" y para un "sí"/"no" (la confirmación
            // de limpiar se contesta mientras suena la pregunta):
            // todo lo demás se ignora para que la propia voz de la
            // app no se tome por un comando.
            if (locucion && !FRASES_PARAR.includes(texto) && !FRASES_RESPUESTA.includes(texto)) continue;

            emit('voz:texto', { texto });
        }
    };

    reconocimiento.onerror = ({ error }) => {
        if (error === 'no-speech' || error === 'aborted') return;

        const permisoDenegado = error === 'not-allowed' || error === 'service-not-allowed';

        informarError(
            permisoDenegado
                ? AVISO_COMPATIBILIDAD
                : 'El micrófono dejó de funcionar. Intenta activarlo de nuevo.'
        );
    };

    reconocimiento.onend = () => {
        sesion = 'inactiva';

        // Si hay una locución sonando, no se hace nada: al terminar,
        // el onend de la frase reabre el micrófono.
        if (locucion) return;

        if (escuchaSolicitada) {
            publicarEstado('pausado');
            reinicio = setTimeout(iniciarEscucha, 250);
        }
    };

    publicarEstado('pausado');
}

function reproducirLocucion() {
    const frase = locucion;

    try {
        window.speechSynthesis.speak(frase);
    } catch {
        frase.onerror();
    }
}

export function hablar(texto) {
    const sintesis = window.speechSynthesis;

    if (!texto?.trim()) return;

    if (!sintesis || !window.SpeechSynthesisUtterance) {
        emit('ui:mensaje', { tipo: 'aviso', texto: AVISO_COMPATIBILIDAD });
        return;
    }

    const frase = new window.SpeechSynthesisUtterance(texto);
    frase.lang = 'es-MX';

    const voces = sintesis.getVoices();
    const voz = voces.find(({ lang }) => lang.toLowerCase() === 'es-mx')
        || voces.find(({ lang }) => /^es(-|$)/i.test(lang));

    if (voz) frase.voice = voz;

    frase.onend = frase.onerror = () => {
        if (locucion !== frase) return;

        locucion = undefined;
        iniciarEscucha();
    };

    locucion = frase;
    sintesis.cancel();

    // El micrófono sigue abierto mientras suena la respuesta: onresult
    // solo deja pasar "para", así se puede interrumpir la locución
    // por voz y la propia voz de la app no se toma por un comando.
    reproducirLocucion();
}

/**
 * Para la respuesta hablada en curso, si la hay, y deja el
 * micrófono escuchando. Devuelve true si había algo que parar.
 * Lo usan el comando de voz "para" y el botón de silencio.
 */
export function detenerLocucion() {
    if (!locucion) return false;

    const frase = locucion;
    locucion = undefined;
    frase.onend = null;
    frase.onerror = null;
    window.speechSynthesis?.cancel();

    // Si el micrófono estaba cerrado, se reabre aquí; si estaba
    // abierto, sigue escuchando sin interrupción.
    iniciarEscucha();
    return true;
}