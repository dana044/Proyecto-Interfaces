/**
 * @fileoverview Punto de entrada de MolecuLab 3D.
 * Inicia los módulos en orden: escena, arrastre de átomos, gestos, voz e interfaz.
 * Si un módulo falla, los demás siguen funcionando.
 * @author Citlaly Morales Viveros
 */

import { emit } from './bus.js';
import { iniciarEscena } from './scene.js';
import { iniciarGestos } from './gestures.js';
import { iniciarVoz } from './voice.js';
import { iniciarInterfaz } from './ui.js';
import { iniciarComandos } from './commands.js';
import { iniciarComandosDeAtomos, iniciarArrastreDeAtomos } from './atoms.js';

// PRUEBA TEMPORAL: borrar después de agregar la cámara y la voz
import * as Atomos from './atoms.js';
import * as Bus from './bus.js';

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
  await iniciarModulo('escena', iniciarEscena);
  await iniciarModulo('arrastre de átomos', () => {
    if (!iniciarArrastreDeAtomos()) throw new Error('la escena no tiene lienzo');
  });
  await iniciarModulo('gestos', iniciarGestos);
  await iniciarModulo('interfaz', iniciarInterfaz);
  await iniciarModulo('comandos de átomos', iniciarComandosDeAtomos);
  await iniciarModulo('comandos de voz', iniciarComandos);
  await iniciarModulo('voz', iniciarVoz);


  // Prueba temporal de la escena.
  window.Atomos = Atomos;
  window.Bus = Bus;
}

iniciarApp();