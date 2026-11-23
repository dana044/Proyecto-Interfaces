/**
 * @file ar.js
 * @description Carga el catálogo de moléculas, llena el selector y cambia el
 * modelo del visor de realidad aumentada (model-viewer) al elegir una molécula.
 * @author Citlaly Morales Viveros
 */

const selector = document.getElementById('selector');
const visor = document.getElementById('visor');
const info = document.getElementById('info');

/**
 * Muestra en el visor la molécula con ese id y actualiza su descripción.
 * @param {Array<{id: string, nombre: string, formula: string, archivo: string}>} moleculas Catálogo cargado.
 * @param {string} id Id de la molécula a mostrar.
 */
function mostrar(moleculas, id) {
    const m = moleculas.find((x) => x.id === id);
    visor.src = m.archivo;
    visor.alt = `${m.nombre}, fórmula ${m.formula}`;
    info.textContent = `${m.nombre} · ${m.formula}`;
}

/**
 * Carga catalogo.json y prepara el selector. Si la carga falla, muestra un
 * aviso en lugar de dejar el selector en «Cargando catálogo…».
 * @returns {Promise<void>}
 */
async function iniciar() {
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