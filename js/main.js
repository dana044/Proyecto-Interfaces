/**
 * @fileoverview Punto de entrada de MolecuLab 3D.
 * Inicia los módulos en orden: interfaz, bus, estado, escena,
 * modelo de Bohr, arrastre, química, gestos, comandos de átomos,
 * reto, comandos de voz y voz.
 * Si un módulo falla, los demás siguen funcionando.
 * @author Dana Carmona Santamaria
 * @author Citlaly Morales Viveros
 * @author Stephanie Elizdeth Hernández Prieto
 */

import { emit, iniciarBus } from './bus.js';
import { iniciarEstado } from './state.js';
import { iniciarEscena } from './scene.js';
import { iniciarGestos, detenerGestos } from './gestures.js';
import { iniciarVoz } from './voice.js';
import { iniciarInterfaz } from './ui.js';
import { iniciarComandos } from './commands.js';
import { iniciarComandosDeAtomos, iniciarArrastreDeAtomos, iniciarModeloBohr } from './atoms.js';
import { iniciarQuimica } from './chemistry.js';
import { iniciarReto } from './reto.js';

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

/**
 * Inicia la aplicación en orden. La interfaz va primero: antes, si la
 * escena o los gestos fallaban al arrancar, su mensaje de error
 * (ui:mensaje) no tenía receptor todavía y el usuario no veía nada.
 */
async function iniciarApp() {
  await iniciarModulo('interfaz', iniciarInterfaz);
  await iniciarModulo('bus', iniciarBus);
  await iniciarModulo('estado', iniciarEstado);
  await iniciarModulo('escena', iniciarEscena);
  await iniciarModulo('modelo de Bohr', () => {
    if (!iniciarModeloBohr()) throw new Error('la escena no tiene contenedor');
  });
  await iniciarModulo('arrastre de átomos', () => {
    if (!iniciarArrastreDeAtomos()) throw new Error('la escena no tiene lienzo');
  });
  await iniciarModulo('química', iniciarQuimica);
  await iniciarModulo('gestos', iniciarGestos);
  await iniciarModulo('comandos de átomos', iniciarComandosDeAtomos);
  await iniciarModulo('reto', iniciarReto);
  await iniciarModulo('comandos de voz', iniciarComandos);
  await iniciarModulo('voz', iniciarVoz);
}

// Al cerrar o recargar la página se apaga la cámara: detenerGestos()
// existía pero nadie la llamaba.
window.addEventListener('beforeunload', detenerGestos);

iniciarApp();