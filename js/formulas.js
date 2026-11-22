/**
 * @file formulas.js
 * @description Lectura de lo que se escribe en la pizarra de fórmulas.
 * Acepta una fórmula de composición (C2H6O, c2h6o, C₂H₆O) o una estructura
 * con guiones (CH3-CH2-OH). Una fórmula se convierte en conteo de átomos; una
 * estructura se convierte en átomos y enlaces, completando con hidrógenos los
 * enlaces que falten. No toca la escena: solo devuelve datos.
 * @author Citlaly Morales Viveros
 */

import { ELEMENTOS, MAX_ATOMOS } from './elementos.js';

const SUBINDICES = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/** Pasa subíndices a números y quita espacios. */
function normalizarTexto(texto) {
    return String(texto ?? '')
        .replace(/[₀-₉]/g, (caracter) => String(caracter.charCodeAt(0) - 0x2080))
        .replace(/\s+/g, '');
}

/**
 * Lee el símbolo de un elemento en una posición del texto. Prefiere dos
 * letras (Be, Ne) solo si forman un elemento; si no, toma una letra.
 * @returns {{ simbolo: string, longitud: number } | null}
 */
function leerSimbolo(texto, posicion) {
    const dos = texto.slice(posicion, posicion + 2);
    if (/^[a-zA-Z]{2}$/.test(dos)) {
        const simbolo = dos[0].toUpperCase() + dos[1].toLowerCase();
        if (Object.hasOwn(ELEMENTOS, simbolo)) return { simbolo, longitud: 2 };
    }
    const uno = texto[posicion]?.toUpperCase();
    if (uno && /^[A-Z]$/.test(uno) && Object.hasOwn(ELEMENTOS, uno)) {
        return { simbolo: uno, longitud: 1 };
    }
    return null;
}

/** Convierte un número a subíndices Unicode, como en C₂H₆O. */
function subindice(numero) {
    return String(numero).split('').map((digito) => SUBINDICES[Number(digito)]).join('');
}

/**
 * Lee una fórmula de composición, como C2H6O o C₂H₆O.
 * @param {string} texto Lo que escribió la persona.
 * @returns {{ ok: true, conteo: Object<string, number> } | { ok: false, error: string }}
 */
export function parsearFormula(texto) {
    const limpio = normalizarTexto(texto);
    if (!limpio) return { ok: false, error: 'Escribe una fórmula, por ejemplo C2H6O' };

    const conteo = {};
    let posicion = 0;
    while (posicion < limpio.length) {
        const simbolo = leerSimbolo(limpio, posicion);
        if (!simbolo) {
            return { ok: false, error: `No reconozco "${limpio[posicion]}" como elemento de la pizarra` };
        }
        posicion += simbolo.longitud;

        const cifras = /^\d+/.exec(limpio.slice(posicion));
        const cantidad = cifras ? Number(cifras[0]) : 1;
        if (cifras) posicion += cifras[0].length;
        if (cantidad === 0) return { ok: false, error: 'Una cantidad no puede ser cero' };

        conteo[simbolo.simbolo] = (conteo[simbolo.simbolo] ?? 0) + cantidad;
    }
    return { ok: true, conteo };
}

/**
 * Lee una estructura con guiones, como CH3-CH2-OH. Cada grupo es un
 * elemento seguido de sus hidrógenos (H, H2, H3...). Los grupos se unen en
 * cadena con enlaces sencillos.
 * @param {string} texto Lo que escribió la persona.
 * @returns {{ ok: true, grupos: Array<{ elemento: string, hidrogenos: number }> } | { ok: false, error: string }}
 */
export function parsearEstructura(texto) {
    const limpio = normalizarTexto(texto);
    const partes = limpio.split('-');
    if (partes.some((parte) => parte === '')) {
        return { ok: false, error: 'Hay un guión sin átomo a un lado, por ejemplo CH3-OH' };
    }

    const grupos = [];
    for (const parte of partes) {
        const simbolo = leerSimbolo(parte, 0);
        if (!simbolo) return { ok: false, error: `No reconozco "${parte}" como elemento` };

        const resto = parte.slice(simbolo.longitud).toUpperCase();
        const hidrogenos = /^H(\d*)$/.exec(resto);
        if (resto !== '' && !hidrogenos) {
            return { ok: false, error: `No entiendo "${parte}": escribe primero el elemento y luego sus hidrógenos, como CH3 u OH` };
        }
        grupos.push({
            elemento: simbolo.simbolo,
            hidrogenos: resto === '' ? 0 : Number(hidrogenos[1] || 1),
        });
    }
    return { ok: true, grupos };
}

/**
 * Convierte los grupos de una estructura en átomos y enlaces (con el mismo
 * formato de desde/hasta que usa el catálogo). Si un átomo tiene menos
 * enlaces que su valencia, se completa con hidrógenos; si tiene más, es un
 * error. Revisa también el máximo de átomos de la escena.
 * @param {Array<{ elemento: string, hidrogenos: number }>} grupos
 * @returns {{ ok: true, molecula: { atomos: Array, enlaces: Array }, completados: number } | { ok: false, error: string }}
 */
export function construirEstructura(grupos) {
    const atomos = [];
    const enlaces = [];
    const contador = {};
    const nuevoId = (elemento) => {
        contador[elemento] = (contador[elemento] ?? 0) + 1;
        return `${elemento}${contador[elemento]}`;
    };
    const agregarHidrogeno = (desde) => {
        const id = nuevoId('H');
        atomos.push({ id, elemento: 'H' });
        enlaces.push({ desde, hasta: id, orden: 1 });
    };

    const centrales = [];
    for (const grupo of grupos) {
        const id = nuevoId(grupo.elemento);
        atomos.push({ id, elemento: grupo.elemento });
        centrales.push(id);
        for (let i = 0; i < grupo.hidrogenos; i++) agregarHidrogeno(id);
    }
    for (let i = 0; i < centrales.length - 1; i++) {
        enlaces.push({ desde: centrales[i], hasta: centrales[i + 1], orden: 1 });
    }

    const usados = new Map(atomos.map((atomo) => [atomo.id, 0]));
    for (const enlace of enlaces) {
        usados.set(enlace.desde, usados.get(enlace.desde) + enlace.orden);
        usados.set(enlace.hasta, usados.get(enlace.hasta) + enlace.orden);
    }

    let completados = 0;
    for (const atomo of [...atomos]) {
        const valencia = ELEMENTOS[atomo.elemento].valencia;
        const usado = usados.get(atomo.id);
        if (usado > valencia) {
            return {
                ok: false,
                error: `${atomo.id} tendría ${usado} enlaces, pero el ${ELEMENTOS[atomo.elemento].nombre.toLowerCase()} admite ${valencia}`,
            };
        }
        for (let i = usado; i < valencia; i++) {
            agregarHidrogeno(atomo.id);
            completados++;
        }
    }

    if (atomos.length > MAX_ATOMOS) {
        return { ok: false, error: `La estructura tendría ${atomos.length} átomos y el máximo es ${MAX_ATOMOS}` };
    }
    return { ok: true, molecula: { atomos, enlaces }, completados };
}

/**
 * Cuenta los átomos de una lista por elemento.
 * @param {Array<{ elemento: string }>} atomos
 * @returns {Object<string, number>}
 */
export function conteoDe(atomos) {
    const conteo = {};
    for (const atomo of atomos) conteo[atomo.elemento] = (conteo[atomo.elemento] ?? 0) + 1;
    return conteo;
}

/** Dos conteos son iguales si tienen los mismos elementos y cantidades. */
export function mismoConteo(a, b) {
    const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...claves].every((clave) => (a[clave] ?? 0) === (b[clave] ?? 0));
}

/**
 * Escribe una fórmula con subíndices: el carbono primero, luego el hidrógeno y
 * el resto en orden alfabético, como se escribe en química.
 * @param {Object<string, number>} conteo
 * @returns {string} Por ejemplo C₂H₆O.
 */
export function formulaLegible(conteo) {
    const claves = Object.keys(conteo).filter((clave) => conteo[clave] > 0);
    // Como en química: el carbono primero, luego el hidrógeno, y el resto alfabético.
    const orden = [
        ...claves.filter((clave) => clave === 'C'),
        ...claves.filter((clave) => clave === 'H'),
        ...claves.filter((clave) => clave !== 'C' && clave !== 'H').sort(),
    ];
    return orden
        .map((elemento) => `${elemento}${conteo[elemento] > 1 ? subindice(conteo[elemento]) : ''}`)
        .join('');
}