/**
 * @file state.js
 * @fileoverview Estado compartido de la aplicación.
 * Es la única fuente de verdad para modo, átomos, enlaces y última acción.
 * @author Dana Carmona Santamaria
 * @author Citlaly Morales Viveros
 */

/**
 * @typedef {'libre' | 'reto'} Modo
 * @typedef {{ id: string, elemento: string, posicion: Object }} Atomo
 * @typedef {{ a: string, b: string, orden: number }} Enlace
 * @typedef {{ id: string, nombre: string, intentos: number, tiempoMs: number | null, completado: boolean }} ResultadoReto
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

  /**
   * Progreso del modo reto: reto actual, estrellas ganadas y, por
   * reto, sus intentos y su tiempo (se usan en la evaluación).
   */
  reto: {
    /** @type {number} Índice del reto actual (0 a 5) */
    indice: 0,

    /** @type {number} Estrellas ganadas (una por reto completado) */
    estrellas: 0,

    /** @type {ResultadoReto[]} Un resultado por reto */
    resultados: [],

    /** @type {number | null} Cuándo empezó el reto actual (null en pausa) */
    inicioMs: null,

    /** @type {number} Tiempo acumulado del reto actual antes de pausarlo */
    tiempoAcumuladoMs: 0,
  },
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

  // Antes esta función solo guardaba el texto en memoria y nadie la
  // llamaba: el indicador #estado-accion se quedaba en "Ninguna todavía".
  // Ahora actualiza también la barra de estado, si ya existe en la página.
  const indicador = document.querySelector('#estado-accion');
  if (!indicador) return;
  const valor = indicador.querySelector('.valor');
  if (valor) valor.textContent = descripcion;
  indicador.classList.remove('estado-ok', 'estado-aviso', 'estado-error');
  indicador.classList.add('estado-ok');
}

/**
 * Inicio del estado compartido (HU-06: cada módulo exporta una iniciar...()).
 * No hay nada que arrancar: el estado inicial ya está en `estado`.
 */
export function iniciarEstado() { }