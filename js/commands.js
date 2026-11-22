/**
 * @file commands.js
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Citlaly Morales Viveros
 */

import { emit, on } from './bus.js';
import { hablar, detenerLocucion, alternarMicrofono, FRASES_PARAR } from './voice.js';
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

/**
 * Palabras de cantidad para las frases ("dos", "un", "5"): así el
 * artículo no se toma por cantidad ("el oxígeno" antes se leía
 * como cantidad "el" y la frase no se entendía).
 */
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

/** Nombres del catálogo (data/moleculas.json) por voz, ya normalizados. */
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

/**
 * Lee "[cantidad] [artículo] elemento" de una parte de frase:
 * "dos hidrógenos", "un oxígeno", "el hidrógeno", "2 H".
 */
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

/**
 * Interpreta "unir 2 hidrógenos", "enlazar dos hidrógenos",
 * "crear un doble enlace de dos hidrógenos", "unir oxígeno con
 * hidrógeno" y "crear un enlace entre oxígeno e hidrógeno".
 * Si faltan átomos en la escena, atoms.js los agrega antes de unir.
 * Devuelve true si era una frase de unión (aunque no se pueda unir).
 */
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
        // "unir 2 hidrógenos": dos átomos del mismo elemento.
        // Con un solo átomo no hay con quién unirlo; si el verbo
        // es "crea", puede ser una molécula ("crea oxígeno" = O2)
        // y se deja pasar a interpretarMolecula.
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

/**
 * Interpreta "añade agua" y "crea agua": una molécula completa del
 * catálogo, con sus átomos y sus enlaces. Si el nombre también es
 * un elemento ("oxígeno", "hidrógeno"), con "agrega/pon/añade" gana
 * el átomo (así sigue funcionando "agrega oxígeno"); con "crea"
 * gana la molécula ("crea oxígeno" = O2).
 */
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

/**
 * Interpreta "quita un oxígeno", "elimina el hidrógeno" y
 * "borra un carbono": quita átomos de la escena por voz.
 */
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

function procesarVoz(frase) {

    if (CONSULTA_MOLECULA.test(frase)) {
        if (!moleculaIdentificada) {
            responder('Todavía no hay una molécula identificada. Construye una y pulsa Verificar molécula.');
            return true;
        }

        const { nombre, formula } = moleculaIdentificada;
        responder(`La molécula es ${nombre}. Su fórmula es ${formula}.`, 'correcto');
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

    if (['verificar', 'verifica', 'verifica la molecula', 'verificar molecula', 'verificar la molecula', 'comprueba', 'comprueba la molecula', 'comprobar'].includes(frase)) {
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

    // Interrumpir una respuesta hablada: funciona también a mitad
    // de la locución, porque el micrófono sigue abierto y deja
    // pasar solo estas frases mientras suena la respuesta.
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

    if (['acercar', 'acerca', 'acercar la camara', 'acerca la camara', 'acercar la vista', 'acerca la vista'].includes(frase)) {
        emit('voz:comando', { intencion: 'acercar', parametros: {} });
        return true;
    }

    if (['alejar', 'aleja', 'alejar la camara', 'aleja la camara', 'alejar la vista', 'aleja la vista'].includes(frase)) {
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

    if (['silencia los tonos', 'silenciar tonos', 'apaga los tonos', 'activa los tonos', 'enciende los tonos'].includes(frase)) {
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

    if (frase === 'vista inicial' || frase === 'vuelve a la vista inicial' || frase === 'vista de inicio') {
        emit('voz:comando', { intencion: 'vista-inicial', parametros: {} });
        return true;
    }

    if (frase === 'abre el panel de atomos' || frase === 'abre la paleta' || frase === 'abre los atomos') {
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

    if (frase === 'apaga el microfono' || frase === 'apagar microfono') {
        emit('voz:comando', { intencion: 'microfono', parametros: { encender: false } });
        return true;
    }

    if (frase === 'enciende el microfono' || frase === 'encender microfono') {
        emit('voz:comando', { intencion: 'microfono', parametros: { encender: true } });
        return true;
    }

    if (frase === 'ayuda' || frase === 'que puedo decir') {
        // En modo reto la pista la da el reto (sugerencia o pista
        // directa); en modo libre, la ayuda general de voz.
        if (estado.modo === 'reto') {
            emit('voz:comando', { intencion: 'ayuda', parametros: {} });
            return true;
        }
        responder('Puedes decir: agrega oxígeno, unir dos hidrógenos, crea agua, deshacer, rehacer, limpiar, verificar, exportar, abre la pizarra, silencia los tonos, modo oscuro o modo reto.');
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

/** Frases que piden limpiar; antes de borrar, se confirma en voz. */
const LIMPIAR_VOZ = ['limpiar', 'limpia', 'limpia la escena', 'limpiar todo', 'limpia todo', 'borra todo', 'borrar todo'];
let pendienteLimpiar = false;
let temporizadorConfirmacion = null;
let fallosSeguidos = 0;

function interpretarVoz({ texto }) {
    if (typeof texto !== 'string') return;
    const frase = normalizar(texto);
    if (!frase) return;

    if (pendienteLimpiar) {
        pendienteLimpiar = false;
        clearTimeout(temporizadorConfirmacion);
        if (frase === 'si') {
            emit('voz:comando', { intencion: 'limpiar', parametros: { confirmada: true } });
            return;
        }
        if (frase === 'no') {
            responder('Ok, no borro nada.');
            return;
        }
        // Cualquier otra frase cancela la confirmación y se interpreta normal.
    }

    // Un "sí" o "no" suelto, sin confirmación pendiente, no es un
    // comando: se ignora en silencio en vez de contestar "no te entendí".
    if (frase === 'si' || frase === 'no') return;

    if (LIMPIAR_VOZ.includes(frase)) {
        pendienteLimpiar = true;
        clearTimeout(temporizadorConfirmacion);
        temporizadorConfirmacion = setTimeout(() => { pendienteLimpiar = false; }, 15000);
        responder('¿Seguro? Di sí o no.');
        return;
    }

    if (procesarVoz(frase)) {
        fallosSeguidos = 0;
        return;
    }

    fallosSeguidos += 1;
    if (fallosSeguidos >= 2) {
        fallosSeguidos = 0;
        responder('Puedes decir: agrega oxígeno, unir dos hidrógenos, crea agua, deshacer, rehacer, limpiar, verificar, acercar, alejar, gira a la izquierda, modo reto, modo libre o ayuda.');
        return;
    }
    responder('No te entendí, prueba con “agrega oxígeno”.');
}

/**
 * Pulsa un botón o interruptor de la página por su selector. Es el
 * mismo clic que haría el mouse, así la voz y el mouse usan el mismo
 * camino. En Node (pruebas) no hay document y no hace nada.
 */
function pulsarBoton(selector) {
    if (typeof document === 'undefined') return;
    document.querySelector(selector)?.click();
}

function cambiarPanel(id, abrir) {
    if (typeof document === 'undefined') return;
    const casilla = document.getElementById(id);
    if (casilla) casilla.checked = abrir;
}

/**
 * Ejecuta los comandos de voz que tocan la interfaz (los de la
 * escena los ejecuta atoms.js). Cada uno pulsa el mismo botón que
 * pulsaría el mouse, así no hay dos caminos distintos.
 */
function ejecutarComandoVoz({ intencion, parametros }) {
    switch (intencion) {
        case 'exportar': pulsarBoton('[data-accion="exportar"]'); break;
        case 'importar': pulsarBoton('[data-accion="importar"]'); break;
        case 'abrir-pizarra': pulsarBoton('[data-accion="pizarra"]'); break;
        case 'silenciar-tonos': pulsarBoton('[data-accion="silenciar-sonidos"]'); break;
        case 'modo-oscuro':
        case 'modo-claro': {
            if (typeof document === 'undefined') break;
            const oscuro = document.documentElement.dataset.tema === 'oscuro';
            if ((intencion === 'modo-oscuro' && !oscuro) || (intencion === 'modo-claro' && oscuro)) {
                pulsarBoton('#boton-tema');
            }
            break;
        }
        case 'vista-inicial': pulsarBoton('.ejes-casita'); break;
        case 'panel-atomos': cambiarPanel('menu-atomos', parametros?.abrir !== false); break;
        case 'panel-info': cambiarPanel('menu-info', parametros?.abrir !== false); break;
        case 'microfono':
            // Sin el estado, "apaga el micrófono" lo encendería si
            // ya estaba apagado: alternarMicrofono solo cambia.
            if (parametros?.encender === microfonoEscuchando) break;
            alternarMicrofono();
            break;
        default: break;
    }
}

export function iniciarComandos() {
    on('voz:texto', interpretarVoz);
    on('voz:comando', ejecutarComandoVoz);
    // Respuestas de atoms.js: se muestran y se hablan (respuesta) o
    // solo se hablan (hablar, cuando el mensaje ya está en pantalla).
    on('voz:respuesta', ({ texto, tipo }) => responder(texto, tipo));
    on('voz:hablar', ({ texto }) => hablar(texto));
    on('estado:microfono', ({ estado: estadoMic }) => {
        microfonoEscuchando = estadoMic === 'escuchando';
    });

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