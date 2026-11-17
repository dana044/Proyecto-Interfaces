/**
 * @fileoverview Punto de entrada de MolecuLab 3D.
 * Inicia los módulos en orden: escena, gestos, voz e interfaz.
 * Si un módulo falla, los demás siguen funcionando.
 */

import { emit } from './bus.js';
import { iniciarEscena } from './scene.js';
import { iniciarGestos } from './gestures.js';
import { iniciarVoz } from './voice.js';
import { iniciarInterfaz } from './ui.js';

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
  await iniciarModulo('gestos', iniciarGestos);
  await iniciarModulo('voz', iniciarVoz);
  await iniciarModulo('interfaz', iniciarInterfaz);

  // PRUEBA TEMPORAL: borrar después de agregar la cámara y la voz.
  // No agrega átomos al arrancar: solo crea el botón, y al hacer clic
  // agrega H, C, N y O sin usar cámara ni voz.
  window.Atomos = Atomos;
  window.Bus = Bus;
  crearBotonPruebaTemporal();
}

/**
 * PRUEBA TEMPORAL: botón «agregar H, C, N, O» para probar HU-08
 * sin cámara ni voz. Borrar esta función y su llamada cuando
 * Stephanie conecte los botones reales de js/ui.js (HU-11).
 */
function crearBotonPruebaTemporal() {
  const boton = document.createElement('button');
  boton.textContent = 'PRUEBA: agregar H, C, N, O';
  boton.type = 'button';
  boton.style.position = 'fixed';
  boton.style.right = '12px';
  boton.style.bottom = '12px';
  boton.style.zIndex = '9999';
  boton.style.padding = '10px 14px';
  boton.style.background = '#6D28D9';
  boton.style.color = '#fff';
  boton.style.border = 'none';
  boton.style.borderRadius = '8px';
  boton.style.cursor = 'pointer';
  boton.addEventListener('click', () => {
    Atomos.limpiarEscena();
    Atomos.agregarAtomo('H', { x: -1.5, y: 0, z: 0 });
    Atomos.agregarAtomo('C', { x: -0.5, y: 0, z: 0 });
    Atomos.agregarAtomo('N', { x: 0.5, y: 0, z: 0 });
    Atomos.agregarAtomo('O', { x: 1.5, y: 0, z: 0 });
  });
  document.body.appendChild(boton);
}

iniciarApp();