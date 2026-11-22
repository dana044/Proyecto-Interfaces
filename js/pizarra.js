/**
 * @file pizarra.js
 * @description Pizarra de fórmulas: se escribe una fórmula (C2H6O) o una
 * estructura (CH3-CH2-OH) y la pizarra muestra la fórmula con subíndices, las
 * moléculas del catálogo que coinciden y deja agregarlas a la escena sin quitar
 * lo que ya hay. Se abre con el botón Pizarra de la barra de respaldo.
 * @author Citlaly Morales Viveros
 */

import { emit } from './bus.js';
import { agregarMolecula } from './atoms.js';
import { identificarMolecula } from './molecules.js';
import {
    conteoDe,
    construirEstructura,
    formulaLegible,
    mismoConteo,
    parsearEstructura,
    parsearFormula,
} from './formulas.js';

let dialogo = null;
let entrada = null;
let vista = null;
let opciones = null;
let mensaje = null;
let botonAgregar = null;
let catalogo = null;
/** Opción elegida: { nombre, molecula } o null. */
let seleccion = null;

/** Carga el catálogo una sola vez. Devuelve la lista de moléculas o null. */
async function cargarCatalogo() {
    if (catalogo) return catalogo;
    try {
        const respuesta = await fetch('data/moleculas.json');
        if (!respuesta.ok) throw new Error('catálogo no disponible');
        catalogo = (await respuesta.json()).moleculas ?? [];
        return catalogo;
    } catch {
        emit('ui:mensaje', { tipo: 'error', texto: 'No pude leer el catálogo de moléculas (data/moleculas.json).' });
        return null;
    }
}

/** Muestra un mensaje debajo de las opciones, y lo deja vacío si es null. */
function mostrarMensaje(texto, tipo = 'ayuda') {
    mensaje.textContent = texto ?? '';
    mensaje.dataset.tipo = tipo;
}

/** Elige una opción y actualiza el botón de agregar. */
function elegir(opcion) {
    seleccion = opcion;
    opciones.querySelectorAll('[role="option"]').forEach((boton) => {
        boton.setAttribute('aria-selected', String(boton.dataset.nombre === opcion?.nombre));
    });
    botonAgregar.disabled = !opcion;
}

/** Pone las opciones posibles en la lista y elige la única, si solo hay una. */
function mostrarOpciones(lista) {
    opciones.replaceChildren();
    for (const opcion of lista) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'pizarra-opcion';
        boton.setAttribute('role', 'option');
        boton.dataset.nombre = opcion.nombre;
        boton.textContent = opcion.etiqueta;
        boton.addEventListener('click', () => elegir(opcion));
        opciones.appendChild(boton);
    }
    elegir(lista.length === 1 ? lista[0] : null);
}

/** Analiza lo que se escribe: estructura si tiene guiones, si no, fórmula. */
function analizar(texto) {
    seleccion = null;
    botonAgregar.disabled = true;
    opciones.replaceChildren();

    if (!texto.trim()) {
        vista.textContent = '';
        mostrarMensaje('');
        return;
    }

    if (texto.includes('-')) {
        const leido = parsearEstructura(texto);
        if (!leido.ok) return fallar(leido.error);
        const construido = construirEstructura(leido.grupos);
        if (!construido.ok) return fallar(construido.error);

        const { molecula, completados } = construido;
        vista.textContent = formulaLegible(conteoDe(molecula.atomos));
        const resultado = identificarMolecula(
            {
                atomos: molecula.atomos,
                enlaces: molecula.enlaces.map((enlace) => ({ a: enlace.desde, b: enlace.hasta, orden: enlace.orden })),
            },
            catalogo ?? [],
        );
        const nombre = resultado.estado === 'completa' ? resultado.molecula.nombre : 'Estructura sin nombre en el catálogo';
        mostrarOpciones([{ nombre, etiqueta: nombre, molecula }]);
        const nota = completados > 0 ? ` Completé con ${completados} hidrógeno${completados > 1 ? 's' : ''} para cumplir la valencia.` : '';
        return mostrarMensaje(`Lista para agregar.${nota}`, 'correcto');
    }

    const leido = parsearFormula(texto);
    if (!leido.ok) return fallar(leido.error);

    vista.textContent = formulaLegible(leido.conteo);
    const coinciden = (catalogo ?? []).filter((molecula) => mismoConteo(conteoDe(molecula.atomos), leido.conteo));
    if (coinciden.length === 0) {
        return mostrarMensaje('No hay ninguna molécula con esa fórmula en el catálogo. Prueba escribiendo su estructura con guiones, como CH3-CH2-OH.', 'aviso');
    }

    mostrarOpciones(coinciden.map((molecula) => ({
        nombre: molecula.nombre,
        etiqueta: `${molecula.nombre} (${molecula.formula})`,
        molecula,
    })));
    mostrarMensaje(coinciden.length === 1 ? 'Lista para agregar.' : 'Elige una molécula de la lista.', 'ayuda');
}

/** Muestra un error de lectura y limpia la vista previa. */
function fallar(texto) {
    mostrarMensaje(texto, 'error');
    return null;
}

/** Agrega la opción elegida a la escena, sin quitar lo que ya hay. */
function agregarSeleccion() {
    if (!seleccion) return;
    const agregada = agregarMolecula(seleccion.molecula, seleccion.nombre);
    if (agregada) {
        mostrarMensaje(`Agregada: ${seleccion.nombre}. Puedes seguir escribiendo.`, 'correcto');
        entrada.value = '';
        analizar('');
        entrada.focus();
    }
}

/** Abre la pizarra y carga el catálogo si todavía no está. */
async function abrirPizarra() {
    if (!dialogo.open) dialogo.showModal();
    await cargarCatalogo();
    entrada.focus();
    if (entrada.value) analizar(entrada.value);
}

/**
 * Crea la ventana de la pizarra y conecta el botón de la barra de respaldo.
 * Devuelve true si el botón existe.
 */
export function iniciarPizarra() {
    const boton = document.querySelector('[data-accion="pizarra"]');
    if (!boton || document.getElementById('pizarra-formulas')) return false;

    const estilo = document.createElement('style');
    estilo.id = 'estilos-pizarra';
    estilo.textContent = `
        #pizarra-formulas { width: min(92vw, 460px); padding: 0; border: 1px solid var(--borde, #d1d5db); border-radius: 14px; background: var(--superficie, #ffffff); color: var(--texto, #111827); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25); font-family: Inter, system-ui, sans-serif; }
        #pizarra-formulas::backdrop { background: rgba(0, 0, 0, 0.35); }
        #pizarra-formulas .pizarra-cuerpo { display: flex; flex-direction: column; gap: 12px; padding: 18px; }
        #pizarra-formulas .pizarra-cabecera { display: flex; align-items: center; justify-content: space-between; }
        #pizarra-formulas h2 { margin: 0; font-size: 18px; }
        #pizarra-formulas .pizarra-cerrar { border: none; background: transparent; color: inherit; font-size: 22px; line-height: 1; cursor: pointer; }
        #pizarra-formulas .pizarra-ayuda { margin: 0; font-size: 13px; color: var(--texto-secundario, #4b5563); }
        #pizarra-formulas .pizarra-entrada { width: 100%; box-sizing: border-box; padding: 10px 12px; font: 16px/1.2 Inter, system-ui, sans-serif; border: 1px solid var(--borde, #d1d5db); border-radius: 10px; background: var(--fondo, #ffffff); color: inherit; }
        #pizarra-formulas .pizarra-vista { min-height: 28px; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.02em; }
        #pizarra-formulas .pizarra-opciones { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
        #pizarra-formulas .pizarra-opcion { text-align: left; padding: 8px 12px; border: 1px solid var(--borde, #d1d5db); border-radius: 10px; background: var(--fondo, #ffffff); color: inherit; font: 14px/1.2 Inter, system-ui, sans-serif; cursor: pointer; }
        #pizarra-formulas .pizarra-opcion[aria-selected="true"] { border-color: var(--accion, #111827); box-shadow: 0 0 0 2px var(--accion, #111827); }
        #pizarra-formulas .pizarra-mensaje { min-height: 18px; margin: 0; font-size: 13px; color: var(--texto-secundario, #4b5563); }
        #pizarra-formulas .pizarra-mensaje[data-tipo="error"] { color: #b91c1c; }
        #pizarra-formulas .pizarra-mensaje[data-tipo="correcto"] { color: #15803d; }
        #pizarra-formulas .pizarra-acciones { display: flex; justify-content: flex-end; }
        #pizarra-formulas .pizarra-agregar { align-self: flex-end; padding: 8px 16px; border: none; border-radius: 10px; background: var(--accion, #111827); color: #ffffff; font: 600 14px/1.2 Inter, system-ui, sans-serif; cursor: pointer; }
        #pizarra-formulas .pizarra-agregar:disabled { opacity: 0.4; cursor: not-allowed; }
        #pizarra-formulas button:focus-visible, #pizarra-formulas input:focus-visible { outline: 2px solid var(--accion, #111827); outline-offset: 2px; }
        .respaldo [data-accion="pizarra"]::before { mask-image: url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='14' rx='2'/%3E%3Cpath d='M8 21h8M12 18v3M7 9h3M13 9h4M7 13h10'/%3E%3C/svg%3E"); -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='14' rx='2'/%3E%3Cpath d='M8 21h8M12 18v3M7 9h3M13 9h4M7 13h10'/%3E%3C/svg%3E"); }
    `;
    document.head.appendChild(estilo);

    dialogo = document.createElement('dialog');
    dialogo.id = 'pizarra-formulas';
    dialogo.setAttribute('aria-labelledby', 'pizarra-titulo');
    dialogo.innerHTML = `
        <div class="pizarra-cuerpo">
            <div class="pizarra-cabecera">
                <h2 id="pizarra-titulo">Pizarra de fórmulas</h2>
                <button type="button" class="pizarra-cerrar" aria-label="Cerrar la pizarra">×</button>
            </div>
            <p class="pizarra-ayuda">Escribe una fórmula como <b>C2H6O</b> o una estructura como <b>CH3-CH2-OH</b>. Las moléculas se agregan junto a lo que ya hay en la escena.</p>
            <input class="pizarra-entrada" type="text" autocomplete="off" spellcheck="false" placeholder="C2H6O o CH3-CH2-OH" aria-label="Fórmula o estructura">
            <p class="pizarra-vista" aria-live="polite"></p>
            <div class="pizarra-opciones" role="listbox" aria-label="Moléculas posibles"></div>
            <p class="pizarra-mensaje" aria-live="polite"></p>
            <div class="pizarra-acciones">
                <button type="button" class="pizarra-agregar" disabled>Agregar a la escena</button>
            </div>
        </div>`;
    document.body.appendChild(dialogo);

    entrada = dialogo.querySelector('.pizarra-entrada');
    vista = dialogo.querySelector('.pizarra-vista');
    opciones = dialogo.querySelector('.pizarra-opciones');
    mensaje = dialogo.querySelector('.pizarra-mensaje');
    botonAgregar = dialogo.querySelector('.pizarra-agregar');
    opciones.setAttribute('role', 'listbox');

    entrada.addEventListener('input', () => analizar(entrada.value));
    entrada.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' && seleccion) {
            evento.preventDefault();
            agregarSeleccion();
        }
    });
    botonAgregar.addEventListener('click', agregarSeleccion);
    dialogo.querySelector('.pizarra-cerrar').addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('click', (evento) => {
        // Clic en el fondo oscuro (fuera del cuerpo) cierra la pizarra.
        if (evento.target === dialogo) dialogo.close();
    });

    boton.addEventListener('click', () => abrirPizarra());
    return true;
}