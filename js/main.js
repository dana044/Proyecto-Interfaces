/**
 * @fileoverview Punto de entrada de MolecuLab 3D.
 * Inicia los módulos en orden: interfaz, escena, gestos y voz.
 * Si un módulo falla, los demás siguen funcionando.
 */

import { emit } from './bus.js';

// --- Importar funciones de inicio de cada módulo ---
// Cada módulo exporta su función aunque esté vacía por ahora (HU-06).
// Se irán implementando en sus HU correspondientes.

import { iniciarEscena }    from './scene.js';     // HU-07 (Citaly)
import { iniciarGestos }    from './gestures.js';  // HU-09 (Dana)
import { iniciarVoz }       from './voice.js';     // HU-10 (Stephanie)
import { iniciarInterfaz }  from './ui.js';        // HU-11 (Stephanie)

/**
 * Intenta iniciar un módulo. Si falla, emite un mensaje de error
 * sin detener la carga de los demás módulos.
 * @param {string} nombre - Nombre del módulo (para el mensaje de error)
 * @param {Function} fn - Función de inicio del módulo
 */
async function iniciarModulo(nombre, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`[main] Error al iniciar ${nombre}:`, error);
    emit('ui:mensaje', {
      tipo: 'error',
      texto: `No se pudo cargar el módulo ${nombre}. El resto sigue funcionando.`,
    });
  }
}

/** Inicia la aplicación en orden. */
async function iniciarApp() {
  await iniciarModulo('interfaz', iniciarInterfaz);
  await iniciarModulo('escena',   iniciarEscena);
  await iniciarModulo('gestos',   iniciarGestos);
  await iniciarModulo('voz',      iniciarVoz);
}

iniciarApp();