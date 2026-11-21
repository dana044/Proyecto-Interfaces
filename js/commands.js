/**
 * @file commands.js
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Citlaly Morales Viveros
 */

import { emit, on } from './bus.js';
import { hablar, detenerLocucion, FRASES_PARAR } from './voice.js';
import { estado } from './state.js';
import { AVISO_ELEMENTO_DESCONOCIDO, ELEMENTOS, MAX_ATOMOS } from './elementos.js';
import { GLOSARIO } from './glosario.js';

const numeros = [
    'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
    'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
];

const cantidades = new Map(numeros.map((texto, indice) => [texto, indice + 1]));
cantidades.set('un', 1);
cantidades.set('una', 1);
cantidades.set('cien', 100);
cantidades.set('mil', 1000);

const elementosPorVoz = new Map();

for (const [simbolo, datos] of Object.entries(ELEMENTOS)) {
    elementosPorVoz.set(normalizar(simbolo), simbolo);
    elementosPorVoz.set(normalizar(datos.nombre), simbolo);
    elementosPorVoz.set(normalizar(datos.plural), simbolo);
}

elementosPorVoz.delete('fluoruros');

const VERBO_AGREGAR = /^(?:agrega(?:r)?|pon(?:er)?|anade|anadir)\s+/;
const VERBO_QUITAR = /^(?:quita(?:r)?|saca(?:r)?)\s+/;
const CONSULTA_MOLECULA = /^(?:que es esto|que molecula es esta)$/;
const PREGUNTA_GLOSARIO = /^(?:que es|define)\s+(?:(?:el|la|un|una)\s+)?(.+)$/;
const GIRO = /^(?:gira|gire|rota|rotar)\s*(?:a\s+la\s+)?(izquierda|derecha)?$/;
const POR_QUE_SE_UNEN = /^(?:por\s?que|porque)\s+se\s+unen(?:\s+los\s+atomos)?$/;

/** Partículas del modelo de Bohr, en singular y en plural. */
const PARTICULAS_POR_VOZ = new Map([
    ['proton', 'proton'],
    ['protones', 'proton'],
    ['neutron', 'neutron'],
    ['neutrones', 'neutron'],
    ['electron', 'electron'],
    ['electrones', 'electron'],
]);

let moleculaIdentificada = null;

function normalizar(texto) {
    return texto.toLocaleLowerCase('es-MX')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[¿?¡!.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function responder(texto, tipo = 'aviso') {
    emit('ui:mensaje', { tipo, texto });
    hablar(texto);
}

function interpretarAgregar(frase) {
    const tieneVerbo = VERBO_AGREGAR.test(frase);
    const pedido = frase.replace(VERBO_AGREGAR, '');
    const coincidencia = pedido.match(/^(?:(\S+)\s+)?(?:atomos?\s+de\s+)?([a-z]+)$/);
    if (!coincidencia) return;

    const [, palabraCantidad, nombre] = coincidencia;
    const elemento = elementosPorVoz.get(nombre);
    if (!tieneVerbo && (!palabraCantidad || !elemento)) return;

    const cantidad = palabraCantidad === undefined
        ? 1
        : cantidades.get(palabraCantidad)
        ?? (/^\d+$/.test(palabraCantidad) ? Number(palabraCantidad) : NaN);

    if (Number.isNaN(cantidad) || cantidad < 1) return;

    if (!elemento) {
        responder(AVISO_ELEMENTO_DESCONOCIDO);
        return;
    }

    emit('voz:comando', {
        intencion: 'agregar-atomo',
        parametros: { elemento, cantidad: Math.min(cantidad, MAX_ATOMOS) },
    });

    if (cantidad > MAX_ATOMOS) {
        emit('ui:mensaje', {
            tipo: 'aviso',
            texto: 'La escena admite hasta 20 átomos.',
        });
    }
}

/**
 * Interpreta "agrega/pon/quita [cantidad] protón/neutrón/electrón"
 * y emite el comando de partículas. Devuelve true si era una
 * frase de partículas (aunque la cantidad no fuera válida).
 * @param {string} frase Frase ya normalizada.
 * @returns {boolean} true si la frase era de partículas.
 */
function interpretarParticulas(frase) {
    let verbo = null;
    let pedido = frase;
    if (VERBO_AGREGAR.test(frase)) {
        verbo = 'agregar';
        pedido = frase.replace(VERBO_AGREGAR, '');
    } else if (VERBO_QUITAR.test(frase)) {
        verbo = 'quitar';
        pedido = frase.replace(VERBO_QUITAR, '');
    } else {
        return false;
    }

    const coincidencia = pedido.match(/^(?:(\S+)\s+)?(proton(?:es)?|neutron(?:es)?|electron(?:es)?)$/);
    if (!coincidencia) return false;

    const [, palabraCantidad, nombre] = coincidencia;
    const tipo = PARTICULAS_POR_VOZ.get(nombre);
    if (!tipo) return false;

    const cantidad = palabraCantidad === undefined
        ? 1
        : cantidades.get(palabraCantidad)
        ?? (/^\d+$/.test(palabraCantidad) ? Number(palabraCantidad) : NaN);

    if (Number.isNaN(cantidad) || cantidad < 1) return true;

    emit('voz:comando', {
        intencion: verbo === 'quitar' ? 'quitar-particula' : 'agregar-particula',
        parametros: { tipo, cantidad },
    });
    return true;
}

function interpretarVoz({ texto }) {
    if (typeof texto !== 'string') return;
    const frase = normalizar(texto);

    if (CONSULTA_MOLECULA.test(frase)) {
        if (!moleculaIdentificada) {
            responder('Todavía no hay una molécula identificada. Construye una y pulsa Verificar molécula.');
            return;
        }

        const { nombre, formula } = moleculaIdentificada;
        responder(`La molécula es ${nombre}. Su fórmula es ${formula}.`, 'correcto');
        return;
    }

    if (frase === 'deshacer') {
        emit('voz:comando', { intencion: 'deshacer', parametros: {} });
        return;
    }

    if (frase === 'rehacer' || frase === 'rehaz') {
        emit('voz:comando', { intencion: 'rehacer', parametros: {} });
        return;
    }

    if (frase === 'limpiar' || frase === 'limpia la escena') {
        emit('voz:comando', { intencion: 'limpiar', parametros: {} });
        return;
    }

    if (frase === 'verificar' || frase === 'verifica' || frase === 'verifica la molecula') {
        emit('voz:comando', { intencion: 'verificar', parametros: {} });
        return;
    }

    if (frase === 'modo reto') {
        emit('voz:comando', { intencion: 'modo-reto', parametros: {} });
        return;
    }

    if (frase === 'modo libre') {
        emit('voz:comando', { intencion: 'modo-libre', parametros: {} });
        return;
    }

    // Interrumpir una respuesta hablada: funciona también a mitad
    // de la locución, porque el micrófono sigue abierto y deja
    // pasar solo estas frases mientras suena la respuesta.
    if (FRASES_PARAR.includes(frase)) {
        if (detenerLocucion()) {
            emit('ui:mensaje', { tipo: 'aviso', texto: 'Paré la respuesta.' });
        }
        return;
    }

    const giro = frase.match(GIRO);
    if (giro) {
        emit('voz:comando', {
            intencion: 'rotar',
            parametros: { direccion: giro[1] === 'izquierda' ? 'izquierda' : 'derecha' },
        });
        return;
    }

    if (['acercar', 'acerca', 'acercar la camara', 'acerca la camara'].includes(frase)) {
        emit('voz:comando', { intencion: 'acercar', parametros: {} });
        return;
    }

    if (['alejar', 'aleja', 'alejar la camara', 'aleja la camara'].includes(frase)) {
        emit('voz:comando', { intencion: 'alejar', parametros: {} });
        return;
    }

    if (frase === 'ayuda') {
        // En modo reto la pista la da el reto (sugerencia o pista
        // directa); en modo libre, la ayuda general de voz.
        if (estado.modo === 'reto') {
            emit('voz:comando', { intencion: 'ayuda', parametros: {} });
            return;
        }
        responder('Puedes decir: agrega oxígeno, agrega dos hidrógenos, deshacer, rehacer, limpiar, verificar o modo reto.');
        return;
    }

    if (POR_QUE_SE_UNEN.test(frase)) {
        responder('Dos átomos se unen porque al compartir electrones los dos completan su capa externa. Así quedan más estables que cuando están solos.');
        return;
    }

    const consulta = frase.match(PREGUNTA_GLOSARIO);
    if (consulta) {
        const definicion = GLOSARIO.get(consulta[1]);
        responder(definicion
            ?? 'Esa todavía no la sé, pregúntale a tu profesor. Puedes preguntar qué es un protón, qué es un ion o qué es la valencia.');
        return;
    }

    if (interpretarParticulas(frase)) return;

    interpretarAgregar(frase);
}

export function iniciarComandos() {
    on('voz:texto', interpretarVoz);

    on('escena:molecula-identificada', ({ nombre, formula, completa }) => {
        moleculaIdentificada = completa && nombre && formula ? { nombre, formula } : null;
    });

    for (const evento of [
        'escena:atomo-agregado', 'escena:atomo-eliminado',
        'escena:enlace-creado', 'escena:enlace-eliminado', 'escena:escena-limpia',
    ]) {
        on(evento, () => {
            moleculaIdentificada = null;
        });
    }
}