/**
 * @file ar.js
 * @description Carga el catálogo de moléculas y los datos de los elementos,
 * llena el selector, cambia el modelo del visor de realidad aumentada
 * (model-viewer) y muestra una tarjeta con la descripción de cada átomo de la
 * molécula elegida.
 * @author Citlaly Morales Viveros
 */

const selector = document.getElementById('selector');
const visor = document.getElementById('visor');
const info = document.getElementById('info');
const seccionAtomos = document.getElementById('atomos');

/** @type {Record<string, {nombre: string, z: number, valencia: number, masa: number, descripcion: string}>} */
let elementos = {};

/**
 * Obtiene los símbolos químicos de una fórmula, sin repetir. Cada símbolo es
 * una letra mayúscula con una minúscula opcional; los subíndices se ignoran.
 * @param {string} formula Fórmula, por ejemplo «C₂H₆O».
 * @returns {string[]} Símbolos distintos, por ejemplo ['C', 'H', 'O'].
 */
function simbolosDe(formula) {
    return [...new Set(formula.match(/[A-Z][a-z]?/g) ?? [])];
}

/**
 * Muestra una tarjeta por cada átomo de la molécula que tenga descripción.
 * @param {string} formula Fórmula de la molécula elegida.
 */
function mostrarAtomos(formula) {
    const tarjetas = simbolosDe(formula)
        .filter((simbolo) => elementos[simbolo])
        .map((simbolo) => {
            const e = elementos[simbolo];
            const tarjeta = document.createElement('article');
            tarjeta.className = 'atomo';
            tarjeta.innerHTML = `<h2>${e.nombre} <span>(${simbolo})</span></h2>` +
                `<p class="datos">Z = ${e.z} · valencia ${e.valencia} · masa ${e.masa}</p>` +
                `<p>${e.descripcion}</p>`;
            return tarjeta;
        });
    seccionAtomos.replaceChildren(...tarjetas);
}

/**
 * Muestra en el visor la molécula con ese id y actualiza su descripción y sus átomos.
 * @param {Array<{id: string, nombre: string, formula: string, archivo: string}>} moleculas Catálogo cargado.
 * @param {string} id Id de la molécula a mostrar.
 */
function mostrar(moleculas, id) {
    const m = moleculas.find((x) => x.id === id);
    visor.src = m.archivo;
    visor.alt = `${m.nombre}, fórmula ${m.formula}`;
    info.textContent = `${m.nombre} · ${m.formula}`;
    mostrarAtomos(m.formula);
}

/**
 * Carga los datos de los elementos. Si falla, la página sigue funcionando sin
 * las tarjetas de átomos.
 * @returns {Promise<void>}
 */
async function cargarElementos() {
    try {
        elementos = await (await fetch('elementos.json')).json();
    } catch (error) {
        console.error('[ar] No se pudieron cargar los elementos:', error);
    }
}

/**
 * Carga catalogo.json y prepara el selector. Si la carga falla, muestra un
 * aviso en lugar de dejar el selector en «Cargando catálogo…».
 * @returns {Promise<void>}
 */
async function iniciar() {
    await cargarElementos();
    try {
        const moleculas = await (await fetch('catalogo.json')).json();
        selector.replaceChildren(...moleculas.map((m) => new Option(`${m.nombre} (${m.formula})`, m.id)));
        selector.addEventListener('change', () => mostrar(moleculas, selector.value));
        mostrar(moleculas, moleculas[0].id);
    } catch (error) {
        selector.replaceChildren(new Option('No se pudo cargar el catálogo', ''));
        info.textContent = 'Revisa que catalogo.json y la carpeta glb/ estén publicados.';
        console.error('[ar] No se pudo cargar el catálogo:', error);
    }
}

iniciar();