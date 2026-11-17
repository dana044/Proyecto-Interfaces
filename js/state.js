/**
 * @fileoverview Estado compartido de la aplicación.
 * Es la única fuente de verdad para modo, átomos, enlaces y última acción.
 */

/**
 * @typedef {'libre' | 'reto'} Modo
 * @typedef {{ id: string, elemento: string, posicion: Object }} Atomo
 * @typedef {{ a: string, b: string, orden: number }} Enlace
 */

/** Estado global de la aplicación. */
export const estado = {
  /** @type {Modo} Modo actual de la aplicación */
  modo: 'libre',

  /** @type {Atomo[]} Lista de átomos en la escena */
  atomos: [],

  /** @type {Enlace[]} Lista de enlaces entre átomos */
  enlaces: [],

  /** @type {string} Descripción de la última acción realizada */
  ultimaAccion: '',
};

/**
 * Cambia el modo de la aplicación.
 * @param {Modo} nuevoModo
 */
export function setModo(nuevoModo) {
  estado.modo = nuevoModo;
}

/**
 * Registra la última acción realizada (para la barra de estado).
 * @param {string} descripcion
 */
export function setUltimaAccion(descripcion) {
  estado.ultimaAccion = descripcion;
}