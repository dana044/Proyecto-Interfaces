import { emit, on } from './bus.js';
import { hablar } from './voice.js';
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
const CONSULTA_MOLECULA = /^(?:que es esto|que molecula es esta)$/;
const PREGUNTA_GLOSARIO = /^(?:que es|define)\s+(?:(?:el|la|un|una)\s+)?(.+)$/;

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

    const consulta = frase.match(PREGUNTA_GLOSARIO);
    if (consulta) {
        const definicion = GLOSARIO.get(consulta[1]);
        responder(definicion
            ?? 'Esa todavía no la sé, pregúntale a tu profesor. Puedes preguntar qué es un protón, qué es un ion o qué es la valencia.');
        return;
    }

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