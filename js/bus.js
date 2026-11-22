/**
 * @fileoverview Bus de eventos global para MolecuLab 3D.
 * Permite comunicación entre módulos sin dependencias directas.
 * @author Dana Carmona Santamaria
 */

/** Activa o desactiva los logs de depuración en consola. */
const DEBUG = false;

/** @type {Object.<string, Function[]>} Mapa de nombre de evento → oyentes */
const oyentes = {};

/**
 * Emite un evento con datos opcionales.
 * @param {string} nombre - Nombre del evento (ej. "gesto:pellizco-inicio")
 * @param {Object} [datos={}] - Datos que acompañan el evento
 */
export function emit(nombre, datos = {}) {
  if (DEBUG) console.log(`[bus] emit → ${nombre}`, datos);
  if (!oyentes[nombre]) return;
  oyentes[nombre].forEach(fn => fn(datos));
}

/**
 * Registra un oyente para un evento.
 * @param {string} nombre - Nombre del evento a escuchar
 * @param {Function} funcion - Función que se ejecuta al recibir el evento
 */
/**
 * Inicio del bus (HU-06: cada módulo exporta una iniciar...()).
 * El bus no necesita inicialización: solo deja constancia de que existe.
 */
export function iniciarBus() {}

export function on(nombre, funcion) {
  if (!oyentes[nombre]) oyentes[nombre] = [];
  oyentes[nombre].push(funcion);
}