/**
 * @file ar.js
 * @description Carga el catálogo de moléculas y los datos de los elementos,
 * llena el selector, cambia el modelo del visor de realidad aumentada
 * (model-viewer), con su GLB para Android y su USDZ para iPhone, y muestra una
 * tarjeta con la descripción de cada átomo de la molécula elegida.
 * @author Citlaly Morales Viveros
 */

const selector = document.getElementById('selector');
const visor = document.getElementById('visor');
const info = document.getElementById('info');
const seccionAtomos = document.getElementById('atomos');
const subtitulo = document.getElementById('subtitulo');

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
 * Escribe bajo el nombre de la molécula cuántos átomos de cada elemento tiene.
 * Por ejemplo: «2 H (hidrógeno) y 1 O (oxígeno)».
 * @param {Array<{elemento: string}>} atomos Átomos de la molécula, del catálogo.
 */
function mostrarSubtitulo(atomos = []) {
    const conteo = new Map();
    for (const a of atomos) conteo.set(a.elemento, (conteo.get(a.elemento) || 0) + 1);
    const partes = [...conteo].map(([simbolo, n]) => {
        const nombre = elementos[simbolo]?.nombre;
        return nombre ? `${n} ${simbolo} (${nombre.toLowerCase()})` : `${n} ${simbolo}`;
    });
    subtitulo.textContent = partes.join(' y ');
}

/**
 * Coloca una etiqueta con el símbolo sobre cada átomo del visor. Las etiquetas
 * solo se ven en la vista 3D de la página, no en AR.
 * @param {Array<{id: string, elemento: string, posicion?: number[]}>} atomos
 */
function mostrarEtiquetas(atomos = []) {
    visor.querySelectorAll('.etiqueta-atomo').forEach((e) => e.remove());
    for (const a of atomos) {
        if (!a.posicion) continue;
        const etiqueta = document.createElement('button');
        etiqueta.className = 'etiqueta-atomo';
        etiqueta.slot = `hotspot-${a.id}`;
        etiqueta.dataset.position = a.posicion.join(' ');
        etiqueta.dataset.normal = '0 1 0';
        etiqueta.textContent = a.elemento;
        etiqueta.setAttribute('aria-label', `Átomo ${elementos[a.elemento]?.nombre ?? a.elemento}`);
        visor.appendChild(etiqueta);
    }
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
    if (m.usdz) visor.setAttribute('ios-src', m.usdz);
    else visor.removeAttribute('ios-src');
    visor.alt = `${m.nombre}, fórmula ${m.formula}`;
    info.textContent = `${m.nombre} · ${m.formula}`;
    mostrarAtomos(m.formula);
    mostrarSubtitulo(m.atomos);
    mostrarEtiquetas(m.atomos);
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