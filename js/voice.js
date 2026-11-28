
/**
 * @file voice.js
 * @author Dana Carmona Santamaria
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Citlaly Morales Viveros
 */

import { emit } from './bus.js';

const AVISO_COMPATIBILIDAD = 'Usa Chrome o Edge para los comandos de voz';

export const FRASES_PARAR = [
    'para', 'parar', 'calla', 'callate', 'silencio', 'basta'
];

export const FRASES_RESPUESTA = ['si', 'no'];

let reconocimiento;
let inicializada = false;
let escuchaSolicitada = false;
let modoMicrofono = 'escuchando';
let sesion = 'inactiva';
let estadoMicrofono;
let reinicio;
let locucion;

// Medidor de nivel del micrófono (solo visual, ver abajo).
let flujoNivel;
let contextoAudio;
let analizadorNivel;
let temporizadorNivel;

function publicarEstado(estado) {
    if (estadoMicrofono === estado) return;

    estadoMicrofono = estado;
    emit('estado:microfono', { estado });
}

function informarError(texto) {
    escuchaSolicitada = false;
    detenerNivelMicrofono();
    clearTimeout(reinicio);
    publicarEstado('error');
    emit('ui:mensaje', { tipo: 'error', texto });
}

function iniciarEscucha() {
    // El micrófono sigue escuchando mientras la app habla: si no, "para"
    // nunca llega, porque la sesión termina en mitad de la respuesta y
    // antes no se reiniciaba hasta que la locución acababa. Mientras hay
    // locución, onresult solo deja pasar "para" y "sí"/"no".
    if (!escuchaSolicitada || sesion !== 'inactiva') return;

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

export function establecerModoMicrofono(encender) {
    if (!reconocimiento) {
        informarError(AVISO_COMPATIBILIDAD);
        return;
    }

    if (!escuchaSolicitada) {
        if (!encender) return;

        escuchaSolicitada = true;
        modoMicrofono = 'escuchando';
        publicarEstado('pausado');
        iniciarEscucha();
        iniciarNivelMicrofono();
        return;
    }

    modoMicrofono = encender ? 'escuchando' : 'espera';
    publicarEstado(modoMicrofono);
}

export function alternarMicrofono() {
    if (!reconocimiento) {
        informarError(AVISO_COMPATIBILIDAD);
        return;
    }

    if (escuchaSolicitada) {
        establecerModoMicrofono(modoMicrofono !== 'escuchando');
    } else {
        establecerModoMicrofono(true);
    }
}

function limpiarTexto(transcripcion) {
    return transcripcion
        .toLocaleLowerCase('es-MX')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

export function iniciarVoz() {
    if (inicializada) return;
    inicializada = true;

    const Reconocimiento =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Reconocimiento) {
        informarError(AVISO_COMPATIBILIDAD);
        return;
    }

    reconocimiento = new Reconocimiento();
    reconocimiento.lang = 'es-MX';
    reconocimiento.continuous = true;
    reconocimiento.interimResults = false;
    // Con ruido, la frase correcta muchas veces no es la primera
    // hipótesis: se piden 5 y se prueban todas, en orden.
    reconocimiento.maxAlternatives = 5;

    reconocimiento.onstart = () => {
        if (sesion === 'cerrando') return;

        sesion = 'activa';
        publicarEstado(modoMicrofono);
    };

    reconocimiento.onresult = ({ resultIndex, results }) => {
        for (let i = resultIndex; i < results.length; i++) {
            if (!escuchaSolicitada || sesion !== 'activa') break;

            const resultado = results[i];
            if (!resultado.isFinal) continue;

            const candidatos = [];
            for (let j = 0; j < resultado.length; j++) {
                const texto = limpiarTexto(resultado[j].transcript);
                if (texto && !candidatos.includes(texto)) candidatos.push(texto);
            }
            if (!candidatos.length) continue;

            if (modoMicrofono === 'espera') {
                const activar = candidatos.some((texto) =>
                    /^(?:enciende|encender|activa|activar|prende|prender) (?:el )?microfono[.!?]*$/.test(texto));

                if (activar) {
                    establecerModoMicrofono(true);
                    emit('ui:mensaje', {
                        tipo: 'correcto',
                        texto: 'Micrófono activado. Ya puedes dar comandos.'
                    });
                }
                continue;
            }

            // Mientras la app habla, solo pasan "para" y "sí"/"no":
            // si alguna hipótesis es una de esas, se contempla.
            const audibles = locucion
                ? candidatos.filter((texto) =>
                    FRASES_PARAR.includes(texto) || FRASES_RESPUESTA.includes(texto))
                : candidatos;
            if (!audibles.length) continue;

            emit('voz:texto', { texto: audibles[0], alternativas: audibles });
        }
    };

    reconocimiento.onerror = ({ error }) => {
        if (error === 'no-speech' || error === 'aborted') return;

        const permisoDenegado =
            error === 'not-allowed' || error === 'service-not-allowed';

        informarError(
            permisoDenegado
                ? AVISO_COMPATIBILIDAD
                : 'El micrófono dejó de funcionar. Intenta activarlo de nuevo.'
        );
    };

    reconocimiento.onend = () => {
        sesion = 'inactiva';

        // Se reinicia también mientras la app habla, por lo mismo de arriba.
        if (escuchaSolicitada) {
            publicarEstado(modoMicrofono);
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
        emit('ui:mensaje', {
            tipo: 'aviso',
            texto: AVISO_COMPATIBILIDAD
        });
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
    reproducirLocucion();
}

export function detenerLocucion() {
    if (!locucion) return false;

    const frase = locucion;
    locucion = undefined;
    frase.onend = null;
    frase.onerror = null;
    window.speechSynthesis?.cancel();

    iniciarEscucha();
    return true;
}

/*
 * Medidor de nivel del micrófono: un flujo aparte del reconocimiento,
 * solo para mostrar si entra voz o solo ruido. Si falla (sin permiso,
 * sin AudioContext), la voz sigue funcionando igual: el medidor es
 * solo visual y nunca bloquea nada. Se enciende con el micrófono y
 * se apaga cuando el micrófono da error o se apaga.
 */
function iniciarNivelMicrofono() {
    if (
        flujoNivel || temporizadorNivel
        || typeof navigator === 'undefined'
        || !navigator.mediaDevices?.getUserMedia
        || typeof window === 'undefined'
        || !(window.AudioContext || window.webkitAudioContext)
    ) return;

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then((flujo) => {
            flujoNivel = flujo;
            const ContextoAudio = window.AudioContext || window.webkitAudioContext;
            contextoAudio = new ContextoAudio();
            const fuente = contextoAudio.createMediaStreamSource(flujo);
            analizadorNivel = contextoAudio.createAnalyser();
            analizadorNivel.fftSize = 512;
            fuente.connect(analizadorNivel);
            const datos = new Uint8Array(analizadorNivel.fftSize);
            temporizadorNivel = setInterval(() => {
                analizadorNivel.getByteTimeDomainData(datos);
                let suma = 0;
                for (const valor of datos) {
                    const desviacion = (valor - 128) / 128;
                    suma += desviacion * desviacion;
                }
                const nivel = Math.min(1, Math.sqrt(suma / datos.length) * 3);
                emit('voz:nivel', { nivel });
            }, 100);
        })
        .catch(() => {
            // Sin medidor, pero la voz sigue: no se informa error.
        });
}

function detenerNivelMicrofono() {
    clearInterval(temporizadorNivel);
    temporizadorNivel = undefined;
    if (flujoNivel) {
        for (const pista of flujoNivel.getTracks()) pista.stop();
        flujoNivel = undefined;
    }
    if (contextoAudio) {
        try { contextoAudio.close(); } catch { /* ya cerrado */ }
        contextoAudio = undefined;
    }
    analizadorNivel = undefined;
    emit('voz:nivel', { nivel: 0 });
}
