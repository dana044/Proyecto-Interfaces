
/**
 * @file commands.js
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Citlaly Morales Viveros
 */

import { emit, on } from './bus.js';
import { hablar, detenerLocucion, establecerModoMicrofono, FRASES_PARAR } from './voice.js';
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

const PALABRA_CANTIDAD = [...cantidades.keys(), '\\d+'].join('|');
const ELEMENTO_CON_CANTIDAD = new RegExp(`^(?:(${PALABRA_CANTIDAD})\\s+)?(?:el\\s+|la\\s+|los\\s+|las\\s+)?([a-z]+)$`);
const ATOMOS_CON_CANTIDAD = new RegExp(`^(?:(${PALABRA_CANTIDAD})\\s+)?(?:atomos?\\s+de\\s+)?(?:el\\s+|la\\s+|los\\s+|las\\s+)?([a-z]+)$`);

const elementosPorVoz = new Map();

for (const [simbolo, datos] of Object.entries(ELEMENTOS)) {
    elementosPorVoz.set(normalizar(simbolo), simbolo);
    elementosPorVoz.set(normalizar(datos.nombre), simbolo);
    elementosPorVoz.set(normalizar(datos.plural), simbolo);
}

elementosPorVoz.delete('fluoruros');

const nombrePorSimbolo = new Map();
const pluralPorSimbolo = new Map();

for (const [simbolo, datos] of Object.entries(ELEMENTOS)) {
    nombrePorSimbolo.set(simbolo, datos.nombre);
    pluralPorSimbolo.set(simbolo, datos.plural);
}

const VERBO_AGREGAR = /^(?:agrega(?:r)?|pon(?:er)?|anade|anadir)\s+/;
const VERBO_QUITAR = /^(?:quita(?:r)?|saca(?:r)?)\s+/;
const CONSULTA_MOLECULA = /^(?:que es esto|que molecula es esta)$/;
const PREGUNTA_GLOSARIO = /^(?:que es|define)\s+(?:(?:el|la|un|una)\s+)?(.+)$/;
const GIRO = /^(?:gira|gire|girar|rota|rotar)\s*(?:a\s+la\s+)?(izquierda|derecha)?$/;
const POR_QUE_SE_UNEN = /^(?:por\s?que|porque)\s+se\s+unen(?:\s+los\s+atomos)?$/;
const VERBO_UNIR = /^(?:unir|une|enlazar|enlaza|conectar|conecta|crear|crea|hacer|haz)\s+/;
const VERBOS_CREAR = new Set(['crear', 'crea', 'hacer', 'haz']);
const VERBO_CREAR_MOLECULA = /^(?:anade|crea|crear|haz|hacer|agrega|pon(?:er)?)\s+/;
const VERBO_QUITAR_ATOMO = /^(?:quita(?:r)?|saca(?:r)?|elimina(?:r)?|borra(?:r)?)\s+/;

const MOLECULAS_POR_VOZ = new Map([
    ['hidrogeno', 'h2'], ['oxigeno', 'o2'], ['agua', 'h2o'],
    ['dioxido de carbono', 'co2'], ['metano', 'ch4'], ['amoniaco', 'nh3'],
    ['metanol', 'ch3oh'], ['etanol', 'c2h6o'], ['etileno', 'c2h4'],
    ['peroxido de hidrogeno', 'h2o2'], ['formaldehido', 'ch2o'],
    ['acido acetico', 'c2h4o2'], ['acetona', 'c3h6o'], ['urea', 'ch4n2o'],
    ['acido metanoico', 'hcooh'], ['dimetileter', 'c2h6o-dimetil'],
    ['fluoruro de hidrogeno', 'hf'], ['fluor', 'f2'], ['fluorometano', 'ch3f'],
    ['hidruro de litio', 'lih'], ['hidruro de berilio', 'beh2'], ['borano', 'bh3'],
]);

const PARTICULAS_POR_VOZ = new Map([
    ['proton', 'proton'],
    ['protones', 'proton'],
    ['neutron', 'neutron'],
    ['neutrones', 'neutron'],
    ['electron', 'electron'],
    ['electrones', 'electron'],
]);

let moleculaIdentificada = null;
let microfonoEscuchando = false;

function normalizar(texto) {
    return texto.toLocaleLowerCase('es-MX')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[¿?¡!.]+/g, ' ')
        .replace(/\b(por favor|porfavor|porfa)\b/g, ' ')
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
    const coincidencia = pedido.match(ATOMOS_CON_CANTIDAD);
    if (!coincidencia) return false;

    const [, palabraCantidad, nombre] = coincidencia;
    const elemento = elementosPorVoz.get(nombre);
    if (!tieneVerbo && (!palabraCantidad || !elemento)) return false;

    const cantidad = palabraCantidad === undefined
        ? 1
        : cantidades.get(palabraCantidad)
        ?? (/^\d+$/.test(palabraCantidad) ? Number(palabraCantidad) : NaN);

    if (Number.isNaN(cantidad) || cantidad < 1) return false;

    if (!elemento) {
        responder(AVISO_ELEMENTO_DESCONOCIDO);
        return true;
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
    return true;
}

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

function leerElementoConCantidad(parte) {
    const coincidencia = parte.match(ELEMENTO_CON_CANTIDAD);
    if (!coincidencia) return null;
    const [, palabraCantidad, nombre] = coincidencia;
    const elemento = elementosPorVoz.get(nombre);
    if (!elemento) return null;
    const cantidad = palabraCantidad === undefined
        ? 1
        : cantidades.get(palabraCantidad)
        ?? (/^\d+$/.test(palabraCantidad) ? Number(palabraCantidad) : NaN);
    if (Number.isNaN(cantidad) || cantidad < 1) return null;
    return { elemento, cantidad };
}

function interpretarUnir(frase) {
    const verbo = frase.match(VERBO_UNIR);
    if (!verbo) return false;
    const esCrear = VERBOS_CREAR.has(verbo[0].trim());
    let resto = frase.replace(VERBO_UNIR, '').replace(/^(?:un|una)\s+/, '');

    let orden = 1;
    if (/\bdoble\b/.test(resto)) {
        orden = 2;
        resto = resto.replace(/\bdoble\b\s*/, '');
    }
    resto = resto.replace(/^(?:enlace\s+)?(?:de\s+|entre\s+)?/, '');

    const partes = resto.split(/\s+(?:con|y|e|entre)\s+/);
    if (partes.length > 2) return false;

    const primero = leerElementoConCantidad(partes[0]);
    if (!primero) return false;

    if (partes.length === 1) {
        if (primero.cantidad < 2) {
            if (esCrear) return false;
            responder('Para unir necesito dos átomos. Di por ejemplo «unir dos hidrógenos» o «unir oxígeno con hidrógeno».');
            return true;
        }
        emit('voz:comando', {
            intencion: 'unir-atomo',
            parametros: { elementoA: primero.elemento, elementoB: primero.elemento, cantidadA: primero.cantidad, cantidadB: 0, orden },
        });
        return true;
    }

    const segundo = leerElementoConCantidad(partes[1]);
    if (!segundo) return false;
    emit('voz:comando', {
        intencion: 'unir-atomo',
        parametros: { elementoA: primero.elemento, elementoB: segundo.elemento, cantidadA: primero.cantidad, cantidadB: segundo.cantidad, orden },
    });
    return true;
}

function interpretarMolecula(frase) {
    const verbo = frase.match(VERBO_CREAR_MOLECULA);
    if (!verbo) return false;
    const esCrear = VERBOS_CREAR.has(verbo[0].trim());
    const resto = frase.replace(VERBO_CREAR_MOLECULA, '')
        .replace(/^(?:un|una)\s+/, '')
        .replace(/^molecula\s+de\s+/, '');
    const id = MOLECULAS_POR_VOZ.get(resto);
    if (!id) return false;
    if (!esCrear && elementosPorVoz.has(resto)) return false;
    emit('voz:comando', { intencion: 'crear-molecula', parametros: { id, nombre: resto } });
    return true;
}

function interpretarQuitarAtomo(frase) {
    if (!VERBO_QUITAR_ATOMO.test(frase)) return false;
    const pedido = frase.replace(VERBO_QUITAR_ATOMO, '');
    const coincidencia = pedido.match(ELEMENTO_CON_CANTIDAD);
    if (!coincidencia) return false;
    const [, palabraCantidad, nombre] = coincidencia;
    const elemento = elementosPorVoz.get(nombre);
    if (!elemento) return false;
    const cantidad = palabraCantidad === undefined
        ? 1
        : cantidades.get(palabraCantidad)
        ?? (/^\d+$/.test(palabraCantidad) ? Number(palabraCantidad) : NaN);
    if (Number.isNaN(cantidad) || cantidad < 1) return false;
    emit('voz:comando', { intencion: 'quitar-atomo', parametros: { elemento, cantidad } });
    return true;
}

/*
 * Rescate: cuando ninguna hipótesis encaja exacta, se contempla lo que
 * se escuchó antes de rendirse. Primero por palabras clave (un elemento
 * y un verbo) y luego por parecido con las frases conocidas (distancia
 * de Levenshtein). Solo se ejecuta si el parecido es alto; si no, se
 * pide que lo repita.
 */
function distanciaLevenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const actual = [i];
        for (let j = 1; j <= b.length; j++) {
            actual[j] = Math.min(
                anterior[j] + 1,
                actual[j - 1] + 1,
                anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        anterior = actual;
    }
    return anterior[b.length];
}

function parecido(a, b) {
    const mayor = Math.max(a.length, b.length);
    if (!mayor) return 1;
    return 1 - distanciaLevenshtein(a, b) / mayor;
}

const FRASES_CONOCIDAS = [
    'agrega un oxigeno', 'agrega dos hidrogenos', 'agrega un carbono',
    'unir dos hidrogenos', 'unir oxigeno con hidrogeno',
    'crear un doble enlace de dos hidrogenos', 'crea agua', 'anade agua',
    'crea dioxido de carbono', 'verificar molecula', 'verifica la molecula',
    'limpiar', 'deshacer', 'rehacer', 'modo reto', 'modo libre', 'ayuda',
    'exportar', 'importar', 'abre la pizarra', 'silencia los tonos',
    'modo oscuro', 'modo claro', 'vista inicial', 'acercar', 'alejar',
    'gira a la izquierda', 'gira a la derecha', 'que es un proton',
    'quita un oxigeno', 'que molecula es esta',
    'crear atomo', 'realidad aumentada', 'centra la molecula',
];

const UMBRAL_PARECIDO = 0.65;

function buscarElementosEnFrase(frase) {
    const encontrados = [];
    for (const palabra of frase.split(/\s+/)) {
        const elemento = elementosPorVoz.get(palabra);
        if (elemento && !encontrados.includes(elemento)) encontrados.push(elemento);
    }
    return encontrados;
}

function intentarRescate(frase) {
    const elementos = buscarElementosEnFrase(frase);
    if (elementos.length) {
        const primero = elementos[0];
        const nombre = nombrePorSimbolo.get(primero) ?? primero;
        const plural = pluralPorSimbolo.get(primero) ?? primero;

        if (/\b(unir|une|enlazar|enlaza|conectar|conecta|enlace)\b/.test(frase)) {
            if (elementos.length > 1) {
                const segundo = elementos[1];
                return procesarVoz(`unir ${nombre} con ${nombrePorSimbolo.get(segundo) ?? segundo}`);
            }
            return procesarVoz(`unir dos ${plural}`);
        }

        if (/\b(quita|saca|elimina|borra)\b/.test(frase)) {
            return procesarVoz(`quita un ${nombre}`);
        }

        if (/\b(agrega|agregar|pon|poner|anade|anadir|crea|crear|haz|hacer)\b/.test(frase)) {
            return procesarVoz(`agrega un ${nombre}`);
        }

        // Solo el elemento, sin verbo: lo más probable es agregarlo.
        if (/^(?:(?:un|una|el|la|dos|tres|cuatro|cinco|\d+)\s+)?[a-z]+$/.test(frase)) {
            return procesarVoz(`agrega ${frase.replace(/^(?:el|la)\s+/, '')}`);
        }
    }

    // Solo el nombre de una molécula: lo más probable es crearla.
    if (MOLECULAS_POR_VOZ.has(frase)) {
        return procesarVoz(`crea ${frase}`);
    }

    let mejor = null;
    let mejorParecido = 0;
    for (const conocida of FRASES_CONOCIDAS) {
        const similitud = parecido(frase, conocida);
        if (similitud > mejorParecido) {
            mejorParecido = similitud;
            mejor = conocida;
        }
    }
    if (mejor && mejorParecido >= UMBRAL_PARECIDO) {
        return procesarVoz(mejor);
    }

    return false;
}

function procesarVoz(frase) {

    if (CONSULTA_MOLECULA.test(frase)) {
        emit('voz:consultar-molecula');
        return true;
    }

    if (frase === 'deshacer') {
        emit('voz:comando', { intencion: 'deshacer', parametros: {} });
        return true;
    }

    if (frase === 'rehacer' || frase === 'rehaz') {
        emit('voz:comando', { intencion: 'rehacer', parametros: {} });
        return true;
    }

    if (frase === 'limpiar' || frase === 'limpia la escena') {
        emit('voz:comando', { intencion: 'limpiar', parametros: {} });
        return true;
    }

    if ([
        'verificar', 'verifica', 'verifica la molecula',
        'verificar molecula', 'verificar la molecula',
        'comprueba', 'comprueba la molecula', 'comprobar'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'verificar', parametros: {} });
        return true;
    }

    if (frase === 'modo reto') {
        emit('voz:comando', { intencion: 'modo-reto', parametros: {} });
        return true;
    }

    if (frase === 'modo libre') {
        emit('voz:comando', { intencion: 'modo-libre', parametros: {} });
        return true;
    }

    if (FRASES_PARAR.includes(frase)) {
        if (detenerLocucion()) {
            emit('ui:mensaje', { tipo: 'aviso', texto: 'Paré la respuesta.' });
        }
        return true;
    }

    const giro = frase.match(GIRO);
    if (giro) {
        emit('voz:comando', {
            intencion: 'rotar',
            parametros: { direccion: giro[1] === 'izquierda' ? 'izquierda' : 'derecha' },
        });
        return true;
    }

    if ([
        'acercar', 'acerca', 'acercar la camara',
        'acerca la camara', 'acercar la vista', 'acerca la vista'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'acercar', parametros: {} });
        return true;
    }

    if ([
        'alejar', 'aleja', 'alejar la camara',
        'aleja la camara', 'alejar la vista', 'aleja la vista'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'alejar', parametros: {} });
        return true;
    }

    if (frase === 'exportar' || frase === 'exporta la molecula' || frase === 'exportar molecula') {
        emit('voz:comando', { intencion: 'exportar', parametros: {} });
        return true;
    }

    if (frase === 'importar' || frase === 'importa una molecula' || frase === 'importar molecula') {
        emit('voz:comando', { intencion: 'importar', parametros: {} });
        return true;
    }

    if (frase === 'abre la pizarra' || frase === 'abrir pizarra' || frase === 'pizarra') {
        emit('voz:comando', { intencion: 'abrir-pizarra', parametros: {} });
        return true;
    }

    if ([
        'silencia los tonos', 'silenciar tonos',
        'apaga los tonos', 'activa los tonos', 'enciende los tonos'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'silenciar-tonos', parametros: {} });
        return true;
    }

    if (frase === 'modo oscuro') {
        emit('voz:comando', { intencion: 'modo-oscuro', parametros: {} });
        return true;
    }

    if (frase === 'modo claro') {
        emit('voz:comando', { intencion: 'modo-claro', parametros: {} });
        return true;
    }

    if ([
        'vista inicial', 'vuelve a la vista inicial', 'vista de inicio'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'vista-inicial', parametros: {} });
        return true;
    }

    if ([
        'abre el panel de atomos', 'abre la paleta', 'abre los atomos'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'panel-atomos', parametros: { abrir: true } });
        return true;
    }

    if (frase === 'cierra el panel de atomos' || frase === 'cierra la paleta') {
        emit('voz:comando', { intencion: 'panel-atomos', parametros: { abrir: false } });
        return true;
    }

    if (frase === 'abre la informacion' || frase === 'abre el panel de informacion') {
        emit('voz:comando', { intencion: 'panel-info', parametros: { abrir: true } });
        return true;
    }

    if (frase === 'cierra la informacion' || frase === 'cierra el panel de informacion') {
        emit('voz:comando', { intencion: 'panel-info', parametros: { abrir: false } });
        return true;
    }

    // Crear un átomo con las partículas del modelo de Bohr. Va antes
    // de interpretarMolecula para que "crear átomo" no se lea como
    // "crea agua" ni como ningún nombre de molécula.
    if ([
        'crear atomo', 'crea un atomo', 'forma el atomo', 'arma el atomo'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'crear-atomo', parametros: {} });
        return true;
    }

    if ([
        'realidad aumentada', 'activa la realidad aumentada',
        'apaga la realidad aumentada', 'salir de la realidad aumentada',
        'sal de la realidad aumentada'
    ].includes(frase)) {
        const accion = frase === 'realidad aumentada' ? 'alternar'
            : frase.includes('apaga') || frase.includes('salir') || frase.includes('sal de')
                ? 'desactivar' : 'activar';
        emit('voz:comando', { intencion: 'realidad-aumentada', parametros: { accion } });
        return true;
    }

    if (frase === 'centra la molecula' || frase === 'centrar la molecula') {
        emit('voz:comando', { intencion: 'centrar-ra', parametros: {} });
        return true;
    }

    if ([
        'abre la ayuda', 'abre la ayuda de voz', 'ayuda de voz'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'panel-ayuda', parametros: { abrir: true, pestana: 'voz' } });
        return true;
    }

    if ([
        'abre la ayuda de gestos', 'ayuda de gestos'
    ].includes(frase)) {
        emit('voz:comando', { intencion: 'panel-ayuda', parametros: { abrir: true, pestana: 'gestos' } });
        return true;
    }

    if (frase === 'cierra la ayuda') {
        emit('voz:comando', { intencion: 'panel-ayuda', parametros: { abrir: false } });
        return true;
    }

    if (frase === 'apaga el microfono' || frase === 'apagar microfono') {
        emit('voz:comando', { intencion: 'microfono', parametros: { encender: false } });
        return true;
    }

    if (frase === 'enciende el microfono' || frase === 'encender microfono') {
        emit('voz:comando', { intencion: 'microfono', parametros: { encender: true } });
        return true;
    }

    if (frase === 'ayuda' || frase === 'que puedo decir') {
        if (estado.modo === 'reto') {
            emit('voz:comando', { intencion: 'ayuda', parametros: {} });
            return true;
        }
        // La lista vive en la pestaña Ayuda: se abre sola y se dice
        // dónde está, en vez de recitarla.
        emit('voz:comando', { intencion: 'panel-ayuda', parametros: { abrir: true, pestana: 'voz' } });
        responder('Mira la pestaña Ayuda, ahí está todo lo que puedes decir.');
        return true;
    }

    if (POR_QUE_SE_UNEN.test(frase)) {
        responder('Dos átomos se unen porque al compartir electrones los dos completan su capa externa. Así quedan más estables que cuando están solos.');
        return true;
    }

    const consulta = frase.match(PREGUNTA_GLOSARIO);
    if (consulta) {
        const definicion = GLOSARIO.get(consulta[1]);
        responder(definicion
            ?? 'Esa todavía no la sé, pregúntale a tu profesor. Puedes preguntar qué es un protón, qué es un ion o qué es la valencia.');
        return true;
    }

    if (interpretarUnir(frase)) return true;
    if (interpretarMolecula(frase)) return true;
    if (interpretarParticulas(frase)) return true;
    if (interpretarQuitarAtomo(frase)) return true;

    return interpretarAgregar(frase);
}

const LIMPIAR_VOZ = [
    'limpiar', 'limpia', 'limpia la escena', 'limpiar todo',
    'limpia todo', 'borra todo', 'borrar todo'
];

let pendienteLimpiar = false;
let temporizadorConfirmacion = null;

function interpretarVoz({ texto, alternativas }) {
    if (typeof texto !== 'string') return;
    // Todas las hipótesis del reconocimiento, en orden y sin duplicados:
    // con ruido, la correcta muchas veces no es la primera.
    const candidatos = [texto, ...(Array.isArray(alternativas) ? alternativas : [])]
        .map((candidato) => (typeof candidato === 'string' ? normalizar(candidato) : ''))
        .filter(Boolean);
    const vistos = new Set();
    const unicos = candidatos.filter((candidato) => {
        if (vistos.has(candidato)) return false;
        vistos.add(candidato);
        return true;
    });
    if (!unicos.length) return;

    // Confirmación de limpiar: aquí "sí" y "no" sí cuentan, y solo
    // cuenta la mejor hipótesis (como antes).
    if (pendienteLimpiar) {
        pendienteLimpiar = false;
        clearTimeout(temporizadorConfirmacion);
        if (unicos[0] === 'si') {
            emit('voz:comando', { intencion: 'limpiar', parametros: { confirmada: true } });
            return;
        }
        if (unicos[0] === 'no') {
            responder('Ok, no borro nada.');
            return;
        }
        // Otra frase mientras se esperaba sí/no: se sigue probando.
    }

    // Un "sí" o "no" suelto se ignora en silencio, y nunca se rescata
    // como silicio: "sí" normalizado es "si", símbolo del silicio.
    const utiles = unicos.filter((frase) => frase !== 'si' && frase !== 'no');
    if (!utiles.length) return;

    for (const frase of utiles) {
        if (LIMPIAR_VOZ.includes(frase)) {
            pendienteLimpiar = true;
            clearTimeout(temporizadorConfirmacion);
            temporizadorConfirmacion = setTimeout(() => {
                pendienteLimpiar = false;
            }, 15000);
            responder('¿Seguro? Di sí o no.');
            return;
        }

        if (procesarVoz(frase)) {
            return;
        }
    }

    // Ninguna hipótesis encajó exacta: se contempla lo que se escuchó.
    if (intentarRescate(utiles[0])) {
        return;
    }

    responder('No te escuché bien, repítelo.');
}

function pulsarBoton(selector) {
    if (typeof document === 'undefined') return;
    document.querySelector(selector)?.click();
}

function cambiarPanel(id, abrir) {
    if (typeof document === 'undefined') return;
    const casilla = document.getElementById(id);
    if (casilla) casilla.checked = abrir;
}

// La pestaña (Voz o Gestos) que se ve dentro del panel de ayuda.
function cambiarPestanaAyuda(pestana) {
    if (typeof document === 'undefined') return;
    const radio = document.getElementById(pestana === 'gestos' ? 'pestana-gestos' : 'pestana-voz');
    if (radio) radio.checked = true;
}

// Si la realidad aumentada está activa: el cuerpo lleva modo-ra.
// Sin documento (pruebas en Node) se dice que no, para no pulsar nada.
function raActiva() {
    if (typeof document === 'undefined') return false;
    return document.body.classList.contains('modo-ra');
}

function ejecutarComandoVoz({ intencion, parametros }) {
    switch (intencion) {
        case 'exportar':
            pulsarBoton('[data-accion="exportar"]');
            break;

        case 'importar':
            emit('ui:mensaje', {
                tipo: 'aviso',
                texto: 'Para importar, pulsa el botón Importar y selecciona tu archivo JSON.'
            });
            if (typeof document !== 'undefined') {
                document.querySelector('[data-accion="importar"]')?.focus();
            }
            break;

        case 'abrir-pizarra':
            pulsarBoton('[data-accion="pizarra"]');
            break;

        case 'silenciar-tonos':
            pulsarBoton('[data-accion="silenciar-sonidos"]');
            break;

        case 'modo-oscuro':
        case 'modo-claro': {
            if (typeof document === 'undefined') break;
            const oscuro = document.documentElement.dataset.tema === 'oscuro';
            if (
                (intencion === 'modo-oscuro' && !oscuro) ||
                (intencion === 'modo-claro' && oscuro)
            ) {
                pulsarBoton('#boton-tema');
            }
            break;
        }

        case 'vista-inicial':
            pulsarBoton('.ejes-casita');
            break;

        case 'panel-atomos':
            cambiarPanel('menu-atomos', parametros?.abrir !== false);
            break;

        case 'panel-info':
            cambiarPanel('menu-info', parametros?.abrir !== false);
            if (parametros?.abrir !== false) cambiarPanel('menu-ayuda', false);
            break;

        case 'microfono':
            establecerModoMicrofono(parametros?.encender === true);
            break;

        case 'realidad-aumentada': {
            // "activa" solo pulsa si está apagada y "apaga" solo si está
            // prendida; "realidad aumentada" a secas alterna.
            const accion = parametros?.accion || 'alternar';
            if (accion === 'alternar'
                || (accion === 'activar' && !raActiva())
                || (accion === 'desactivar' && raActiva())) {
                pulsarBoton('[data-accion="ra"]');
            }
            break;
        }

        case 'centrar-ra':
            pulsarBoton('#centrar-ra');
            break;

        case 'panel-ayuda':
            cambiarPanel('menu-ayuda', parametros?.abrir !== false);
            if (parametros?.abrir !== false) cambiarPanel('menu-info', false);
            if (parametros?.pestana) cambiarPestanaAyuda(parametros.pestana);
            break;

        default:
            break;
    }
}

export function iniciarComandos() {
    on('voz:texto', interpretarVoz);
    on('voz:comando', ejecutarComandoVoz);

    on('voz:respuesta', ({ texto, tipo }) => responder(texto, tipo));
    on('voz:hablar', ({ texto }) => hablar(texto));

    on('estado:microfono', ({ estado: estadoMic }) => {
        microfonoEscuchando = estadoMic === 'escuchando';
    });

    on('escena:molecula-identificada', ({ nombre, formula, completa }) => {
        moleculaIdentificada =
            completa && nombre && formula ? { nombre, formula } : null;
    });

    for (const evento of [
        'escena:atomo-agregado',
        'escena:atomo-eliminado',
        'escena:enlace-creado',
        'escena:enlace-eliminado',
        'escena:escena-limpia',
    ]) {
        on(evento, () => {
            moleculaIdentificada = null;
        });
    }
}
