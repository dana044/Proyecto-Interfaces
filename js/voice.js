/**
 * @file voice.js
 * @author Dana Carmona Santamaria
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Citlaly Morales Viveros 
 */

import { emit } from './bus.js';

const AVISO_COMPATIBILIDAD = 'Usa Chrome o Edge para los comandos de voz';

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
            if (!escuchaSolicitada || locucion || sesion !== 'activa') break;

            const resultado = results[i];
            if (!resultado.isFinal) continue;

            const texto = resultado[0].transcript
                .toLocaleLowerCase('es-MX')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();

            if (texto) emit('voz:texto', { texto });
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

        if (locucion) {
            reproducirLocucion();
        } else if (escuchaSolicitada) {
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

    if (escuchaSolicitada) publicarEstado('pausado');

    // Esperar a que se cierre el micrófono antes de reproducir el audio.
    detenerEscucha();

    if (sesion === 'inactiva') reproducirLocucion();
}