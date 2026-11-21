/**
 * @fileoverview Identificación de la molécula construida y su geometría real.
 * Lógica pura, sin escena 3D: compara la fórmula y la conectividad de
 * lo armado con el catálogo, dice qué falta cuando está incompleta,
 * explica por qué una combinación no se puede armar según la valencia,
 * y calcula dónde va cada átomo en la geometría real de la molécula.
 * @author Citlaly Morales Viveros
 */

import { ELEMENTOS } from './elementos.js';
import { enlacesUsados, motivoValenciaLlena, valenciaDe } from './chemistry.js';

/**
 * Ángulo por defecto de cada geometría, en grados, por si el
 * catálogo no trae el ángulo de una molécula.
 */
const ANGULOS_POR_GEOMETRIA = {
    lineal: 180,
    angular: 104.5,
    'tetraédrica': 109.5,
    piramidal: 107,
};

/**
 * Cuenta cuántos átomos de cada elemento hay en una lista.
 * @param {Array<{ elemento: string }>} atomos Átomos a contar.
 * @returns {Object<string, number>} Cantidad por elemento.
 */
function contarElementos(atomos) {
    const conteo = {};
    for (const atomo of atomos) {
        conteo[atomo.elemento] = (conteo[atomo.elemento] || 0) + 1;
    }
    return conteo;
}

/**
 * Adyacencia de un conjunto de enlaces: para cada átomo, sus vecinos
 * con el orden del enlace que los une.
 * @param {Array<{ a: string, b: string, orden: number }>} enlaces Enlaces.
 * @returns {Map<string, Map<string, number>>} Vecinos por átomo.
 */
function construirAdyacencia(enlaces) {
    const adyacencia = new Map();
    for (const enlace of enlaces) {
        const orden = enlace.orden || 1;
        if (!adyacencia.has(enlace.a)) adyacencia.set(enlace.a, new Map());
        if (!adyacencia.has(enlace.b)) adyacencia.set(enlace.b, new Map());
        adyacencia.get(enlace.a).set(enlace.b, orden);
        adyacencia.get(enlace.b).set(enlace.a, orden);
    }
    return adyacencia;
}

/**
 * Busca un mapeo entre dos conjuntos de átomos (por ejemplo, del
 * catálogo a la escena) que respete los elementos y los enlaces:
 * cada enlace del origen tiene que existir en el destino, entre los
 * átomos correspondientes y con el mismo orden. Es una búsqueda
 * hacia atrás, pero las moléculas son pequeñas y va rápido.
 * @param {Array<{ id: string, elemento: string }>} origen Átomos a colocar.
 * @param {Array<{ a: string, b: string, orden: number }>} enlacesOrigen Enlaces del origen.
 * @param {Array<{ id: string, elemento: string }>} destino Átomos disponibles.
 * @param {Array<{ a: string, b: string, orden: number }>} enlacesDestino Enlaces del destino.
 * @param {boolean} [ignorarOrden=false] Si es true, basta con que el
 *   enlace exista, sin importar su orden: un enlace simple en la
 *   escena puede ser el doble que pide el catálogo, y eso se dirá
 *   como falta al comparar después.
 * @returns {Map<string, string> | null} Mapeo de id de origen a id de destino.
 */
function buscarMapeo(origen, enlacesOrigen, destino, enlacesDestino, ignorarOrden = false) {
    const adyacenciaOrigen = construirAdyacencia(enlacesOrigen);
    const adyacenciaDestino = construirAdyacencia(enlacesDestino);
    const porElemento = new Map();
    for (const atomo of destino) {
        if (!porElemento.has(atomo.elemento)) porElemento.set(atomo.elemento, []);
        porElemento.get(atomo.elemento).push(atomo.id);
    }

    // Primero los átomos con más enlaces: podan la búsqueda antes.
    const ordenados = [...origen].sort((a, b) => {
        const gradoA = adyacenciaOrigen.get(a.id)?.size ?? 0;
        const gradoB = adyacenciaOrigen.get(b.id)?.size ?? 0;
        return gradoB - gradoA;
    });

    const mapeo = new Map();
    const usados = new Set();

    function colocar(indice) {
        if (indice === ordenados.length) return true;
        const atomo = ordenados[indice];
        for (const candidato of porElemento.get(atomo.elemento) || []) {
            if (usados.has(candidato)) continue;
            // Cada enlace con un átomo ya colocado tiene que existir
            // en el destino, con el mismo orden (o solo existir, si
            // se ignora el orden).
            let compatible = true;
            for (const [vecino, orden] of adyacenciaOrigen.get(atomo.id) || []) {
                const vecinoMapeado = mapeo.get(vecino);
                if (vecinoMapeado === undefined) continue;
                const ordenDestino = adyacenciaDestino.get(candidato)?.get(vecinoMapeado);
                if (ordenDestino === undefined || (!ignorarOrden && ordenDestino !== orden)) {
                    compatible = false;
                    break;
                }
            }
            if (!compatible) continue;
            mapeo.set(atomo.id, candidato);
            usados.add(candidato);
            if (colocar(indice + 1)) return true;
            mapeo.delete(atomo.id);
            usados.delete(candidato);
        }
        return false;
    }

    return colocar(0) ? mapeo : null;
}

/**
 * Enlaces del catálogo normalizados al mismo formato que los de la escena.
 * @param {object} molecula Molécula del catálogo.
 * @returns {Array<{ a: string, b: string, orden: number }>} Sus enlaces.
 */
function enlacesDeCatalogo(molecula) {
    return (molecula.enlaces || []).map((enlace) => ({
        a: enlace.desde,
        b: enlace.hasta,
        orden: enlace.orden || 1,
    }));
}

/**
 * Qué átomos y qué enlaces le faltan a la escena para ser una
 * molécula del catálogo, dado el mapeo parcial que ya se encontró.
 * @param {Map<string, string>} mapeo Mapeo de átomo de la escena a átomo del catálogo.
 * @param {object} molecula Molécula del catálogo.
 * @param {Array<{ a: string, b: string, orden: number }>} enlacesEscena Enlaces de la escena.
 * @returns {{ atomos: Array<{ elemento: string, cantidad: number }>, enlaces: Array<{ a: string, b: string, orden: number, cantidad: number }> }} Lo que falta.
 */
function calcularFalta(mapeo, molecula, enlacesEscena) {
    const mapeados = new Set(mapeo.values());
    const atomosFaltan = {};
    for (const atomo of molecula.atomos || []) {
        if (!mapeados.has(atomo.id)) {
            atomosFaltan[atomo.elemento] = (atomosFaltan[atomo.elemento] || 0) + 1;
        }
    }

    // Un enlace del catálogo ya está si sus dos átomos están en la
    // escena y unidos con el mismo orden.
    const inverso = new Map([...mapeo.entries()].map(([escena, catalogo]) => [catalogo, escena]));
    const adyacenciaEscena = construirAdyacencia(enlacesEscena);
    const enlacesFaltan = {};
    for (const enlace of enlacesDeCatalogo(molecula)) {
        const a = inverso.get(enlace.a);
        const b = inverso.get(enlace.b);
        const presente = a !== undefined && b !== undefined
            && adyacenciaEscena.get(a)?.get(b) === enlace.orden;
        if (presente) continue;
        const elementoA = molecula.atomos.find((atomo) => atomo.id === enlace.a)?.elemento ?? '';
        const elementoB = molecula.atomos.find((atomo) => atomo.id === enlace.b)?.elemento ?? '';
        const clave = [elementoA, elementoB].sort().join('-');
        if (!enlacesFaltan[clave]) {
            enlacesFaltan[clave] = { a: elementoA, b: elementoB, orden: enlace.orden, cantidad: 0 };
        }
        enlacesFaltan[clave].cantidad += 1;
    }

    return {
        atomos: Object.entries(atomosFaltan)
            .map(([elemento, cantidad]) => ({ elemento, cantidad })),
        enlaces: Object.values(enlacesFaltan),
    };
}

/**
 * Artículo de una molécula («el agua», «la acetona»): casi todas
 * son masculinas; las que terminan en «a» son femeninas, salvo
 * el agua, que lleva «el» por empezar con a tónica.
 * @param {string} nombre Nombre de la molécula.
 * @returns {'el' | 'la'} Su artículo.
 */
function articuloPara(nombre) {
    const minuscula = nombre.toLowerCase();
    if (minuscula === 'agua') return 'el';
    return minuscula.endsWith('a') ? 'la' : 'el';
}

/**
 * Describe un enlace que hace falta, sin el verbo («el oxígeno con
 * 2 hidrógenos», «los 2 oxígenos entre sí con un enlace doble»):
 * quien lo usa pone «unir» o «Une» delante, según la frase.
 * @param {string} a Elemento de un extremo del enlace.
 * @param {string} b Elemento del otro extremo.
 * @param {number} orden 1 para simple, 2 para doble.
 * @param {number} cantidad Cuántos enlaces iguales hacen falta.
 * @returns {string} La descripción del enlace.
 */
export function descripcionEnlace(a, b, orden, cantidad) {
    const doble = orden === 2 ? ' con un enlace doble' : '';
    if (a === b) {
        return `los ${cantidad + 1} ${ELEMENTOS[a]?.plural ?? a} entre sí${doble}`;
    }
    const nombreA = ELEMENTOS[a]?.nombre.toLowerCase() ?? a;
    if (cantidad === 1) {
        return `el ${nombreA} con un ${ELEMENTOS[b]?.nombre.toLowerCase() ?? b}${doble}`;
    }
    return `el ${nombreA} con ${cantidad} ${ELEMENTOS[b]?.plural ?? b}${doble}`;
}

/**
 * Frase en palabras sencillas con lo que le falta a la escena para
 * ser la molécula indicada.
 * @param {object} molecula Molécula del catálogo.
 * @param {{ atomos: Array, enlaces: Array }} falta Lo que falta, de calcularFalta().
 * @returns {string} El mensaje para el estudiante.
 */
function mensajeFalta(molecula, falta) {
    const nombre = molecula.nombre.toLowerCase();
    const articulo = articuloPara(molecula.nombre);
    if (falta.atomos.length > 0) {
        const partes = falta.atomos.map(({ elemento, cantidad }) => {
            const plural = ELEMENTOS[elemento]?.plural ?? elemento;
            return cantidad === 1
                ? `1 ${ELEMENTOS[elemento]?.nombre.toLowerCase() ?? elemento}`
                : `${cantidad} ${plural}`;
        });
        const verbo = falta.atomos.reduce((total, { cantidad }) => total + cantidad, 0) === 1
            ? 'Te falta'
            : 'Te faltan';
        return `${verbo} ${partes.join(' y ')} para ${articulo} ${nombre}.`;
    }
    const partes = falta.enlaces.map(({ a, b, orden, cantidad }) => (
        `unir ${descripcionEnlace(a, b, orden || 1, cantidad)}`
    ));
    const deFrase = articulo === 'el' ? `del ${nombre}` : `de la ${nombre}`;
    return `Ya tienes todos los átomos ${deFrase}. Te falta ${partes.join(' y ')}.`;
}

/**
 * Motivo en palabras sencillas cuando un átomo tiene más enlaces
 * de los que su valencia permite, o null si todo está en orden.
 * @param {Array<{ id: string, elemento: string }>} atomos Átomos de la escena.
 * @param {Array<{ a: string, b: string, orden: number }>} enlaces Enlaces de la escena.
 * @returns {string | null} El motivo, o null si es posible.
 */
function motivoImposible(atomos, enlaces) {
    for (const atomo of atomos) {
        const usados = enlacesUsados(atomo.id, enlaces);
        if (usados > valenciaDe(atomo.elemento)) {
            return `${motivoValenciaLlena(atomo.elemento)} Por eso esta combinación no se puede armar.`;
        }
    }
    return null;
}

/**
 * Identifica la molécula construida comparando su fórmula y su
 * conectividad con el catálogo.
 * @param {{ atomos: Array<{ id: string, elemento: string }>, enlaces: Array<{ a: string, b: string, orden: number }> }} escena Átomos y enlaces de la escena.
 * @param {Array<object>} moleculas Moléculas del catálogo.
 * @returns {{ estado: 'completa', molecula: object, mapeo: Map<string, string> } | { estado: 'incompleta', molecula: object, falta: object, mensaje: string } | { estado: 'desconocida', mensaje: string } | { estado: 'imposible', motivo: string }} El resultado.
 */
export function identificarMolecula(escena, moleculas) {
    const atomosEscena = escena.atomos || [];
    const enlacesEscena = escena.enlaces || [];
    const conteoEscena = contarElementos(atomosEscena);

    // Molécula completa: misma fórmula y misma conectividad.
    for (const molecula of moleculas || []) {
        const atomosCatalogo = molecula.atomos || [];
        const enlacesCatalogo = enlacesDeCatalogo(molecula);
        if (atomosEscena.length !== atomosCatalogo.length) continue;
        if (enlacesEscena.length !== enlacesCatalogo.length) continue;
        const conteoCatalogo = contarElementos(atomosCatalogo);
        const mismaFormula = Object.keys(conteoEscena).length === Object.keys(conteoCatalogo).length
            && Object.entries(conteoEscena).every(([elemento, cantidad]) => conteoCatalogo[elemento] === cantidad);
        if (!mismaFormula) continue;
        const mapeo = buscarMapeo(atomosCatalogo, enlacesCatalogo, atomosEscena, enlacesEscena);
        if (mapeo) return { estado: 'completa', molecula, mapeo };
    }

    // Molécula incompleta: lo armado cabe dentro de una del catálogo.
    // El orden del enlace no se exige aquí: un enlace simple donde
    // el catálogo pide uno doble también es un avance, y al comparar
    // después se dirá que falta el doble (antes, un O–O simple se
    // tomaba por peróxido de hidrógeno y el oxígeno quedaba fuera).
    // Se elige la que menos átomos le faltan, y luego la que menos enlaces.
    let mejor = null;
    for (const molecula of moleculas || []) {
        const atomosCatalogo = molecula.atomos || [];
        if (atomosEscena.length > atomosCatalogo.length) continue;
        const mapeo = buscarMapeo(atomosEscena, enlacesEscena, atomosCatalogo, enlacesDeCatalogo(molecula), true);
        if (!mapeo) continue;
        const falta = calcularFalta(mapeo, molecula, enlacesEscena);
        const faltanAtomos = falta.atomos.reduce((total, { cantidad }) => total + cantidad, 0);
        const faltanEnlaces = falta.enlaces.reduce((total, { cantidad }) => total + cantidad, 0);
        if (!mejor || faltanAtomos < mejor.faltanAtomos
            || (faltanAtomos === mejor.faltanAtomos && faltanEnlaces < mejor.faltanEnlaces)) {
            mejor = { molecula, falta, faltanAtomos, faltanEnlaces };
        }
    }
    if (mejor) {
        return {
            estado: 'incompleta',
            molecula: mejor.molecula,
            falta: mejor.falta,
            mensaje: mensajeFalta(mejor.molecula, mejor.falta),
        };
    }

    // Fuera del catálogo: imposible según la valencia, o todavía
    // no reconocida pero químicamente posible.
    const motivo = motivoImposible(atomosEscena, enlacesEscena);
    if (motivo) return { estado: 'imposible', motivo };
    return {
        estado: 'desconocida',
        mensaje: 'No la reconozco todavía. Parece posible, pero no está en mi catálogo.',
    };
}

/**
 * Direcciones repartidas sobre una esfera, para acomodar átomos
 * sin una geometría conocida en el catálogo.
 * @param {number} indice Índice de la dirección.
 * @returns {{ x: number, y: number, z: number }} Dirección unitaria.
 */
function direccionEsfera(indice) {
    // Puntos de Fibonacci: reparten las direcciones sin amontonarlas.
    const dorado = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - ((indice + 0.5) / 12) * 2;
    const radio = Math.sqrt(Math.max(0, 1 - y * y));
    const angulo = dorado * indice;
    return { x: Math.cos(angulo) * radio, y, z: Math.sin(angulo) * radio };
}

/**
 * Calcula dónde va cada átomo en la geometría real de la molécula:
 * el átomo central en el centro y los demás a distancia de enlace
 * (suma de radios), con el ángulo del catálogo.
 * @param {object} molecula Molécula del catálogo, con geometria y angulo_grados.
 * @param {Map<string, string>} mapeo Mapeo de id del catálogo a id de la escena.
 * @returns {Object<string, { x: number, y: number, z: number }>} Posición por id de la escena.
 */
export function calcularGeometria(molecula, mapeo) {
    const atomosCatalogo = molecula.atomos || [];
    const enlacesCatalogo = enlacesDeCatalogo(molecula);
    const elementoDe = new Map(atomosCatalogo.map((atomo) => [atomo.id, atomo.elemento]));
    const distancia = (idA, idB) => (ELEMENTOS[elementoDe.get(idA)]?.radio ?? 0.4)
        + (ELEMENTOS[elementoDe.get(idB)]?.radio ?? 0.4);

    const posiciones = {};
    if (atomosCatalogo.length === 0) return posiciones;
    if (atomosCatalogo.length === 2) {
        const [primero, segundo] = atomosCatalogo;
        const d = distancia(primero.id, segundo.id);
        posiciones[mapeo.get(primero.id)] = { x: -d / 2, y: 0, z: 0 };
        posiciones[mapeo.get(segundo.id)] = { x: d / 2, y: 0, z: 0 };
        return posiciones;
    }

    // Átomo central: el que tiene más enlaces; si empatan, el que no es hidrógeno.
    const grado = new Map();
    for (const enlace of enlacesCatalogo) {
        grado.set(enlace.a, (grado.get(enlace.a) || 0) + 1);
        grado.set(enlace.b, (grado.get(enlace.b) || 0) + 1);
    }
    const central = [...atomosCatalogo].sort((a, b) => {
        const diferencia = (grado.get(b.id) || 0) - (grado.get(a.id) || 0);
        if (diferencia !== 0) return diferencia;
        return (a.elemento === 'H' ? 1 : 0) - (b.elemento === 'H' ? 1 : 0);
    })[0];
    posiciones[mapeo.get(central.id)] = { x: 0, y: 0, z: 0 };

    const vecinos = atomosCatalogo
        .filter((atomo) => atomo.id !== central.id)
        .map((atomo) => ({
            id: atomo.id,
            d: distancia(central.id, atomo.id),
        }));
    const angulo = (molecula.angulo_grados ?? ANGULOS_POR_GEOMETRIA[molecula.geometria] ?? 109.5)
        * Math.PI / 180;
    const geometria = molecula.geometria || '';

    if (geometria === 'lineal') {
        vecinos.forEach((vecino, indice) => {
            const signo = indice % 2 === 0 ? 1 : -1;
            posiciones[mapeo.get(vecino.id)] = { x: signo * vecino.d, y: 0, z: 0 };
        });
    } else if (geometria === 'angular' && vecinos.length === 2) {
        vecinos.forEach((vecino, indice) => {
            const lado = indice === 0 ? 1 : -1;
            posiciones[mapeo.get(vecino.id)] = {
                x: vecino.d * Math.cos(angulo / 2),
                y: lado * vecino.d * Math.sin(angulo / 2),
                z: 0,
            };
        });
    } else if (geometria === 'tetraédrica' && vecinos.length === 4) {
        const vertices = [
            [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
        ];
        vecinos.forEach((vecino, indice) => {
            const [x, y, z] = vertices[indice];
            const norma = Math.sqrt(3);
            posiciones[mapeo.get(vecino.id)] = {
                x: (x / norma) * vecino.d,
                y: (y / norma) * vecino.d,
                z: (z / norma) * vecino.d,
            };
        });
    } else if (geometria === 'piramidal' && vecinos.length === 3) {
        // Los vecinos forman un cono: el ángulo entre dos de ellos es
        // el del catálogo, y de ahí sale cuánto se abre el cono.
        const seno = Math.sqrt(Math.max(0, (1 - Math.cos(angulo)) / 1.5));
        const coseno = Math.sqrt(Math.max(0, 1 - seno * seno));
        vecinos.forEach((vecino, indice) => {
            const azimut = (2 * Math.PI * indice) / 3;
            posiciones[mapeo.get(vecino.id)] = {
                x: vecino.d * seno * Math.cos(azimut),
                y: vecino.d * seno * Math.sin(azimut),
                z: vecino.d * coseno,
            };
        });
    } else {
        // Geometría sin regla propia (otras moléculas del catálogo):
        // los vecinos se reparten alrededor del centro, cada uno a su
        // distancia de enlace.
        vecinos.forEach((vecino, indice) => {
            const direccion = direccionEsfera(indice);
            posiciones[mapeo.get(vecino.id)] = {
                x: direccion.x * vecino.d,
                y: direccion.y * vecino.d,
                z: direccion.z * vecino.d,
            };
        });
    }

    // Los átomos que no son vecinos del centro (cadenas como el
    // etanol) se colocan desde su átomo ya colocado, a su distancia
    // de enlace y en una dirección repartida.
    const adyacencia = construirAdyacencia(enlacesCatalogo);
    let indiceDireccion = vecinos.length;
    const cola = [central.id, ...vecinos.map((vecino) => vecino.id)];
    const visitados = new Set(cola);
    while (cola.length > 0) {
        const actual = cola.shift();
        for (const vecinoId of adyacencia.get(actual)?.keys() || []) {
            if (visitados.has(vecinoId)) continue;
            visitados.add(vecinoId);
            cola.push(vecinoId);
            const posicionPadre = posiciones[mapeo.get(actual)];
            const direccion = direccionEsfera(indiceDireccion);
            indiceDireccion += 1;
            const d = distancia(actual, vecinoId);
            posiciones[mapeo.get(vecinoId)] = {
                x: posicionPadre.x + direccion.x * d,
                y: posicionPadre.y + direccion.y * d,
                z: posicionPadre.z + direccion.z * d,
            };
        }
    }
    return posiciones;
}
