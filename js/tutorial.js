/**
 * @fileoverview Tutorial de gestos con demostraciones y un átomo de ejemplo.
 *
 * Primero calibra el pellizco (3 veces) y luego pide cada gesto en orden.
 * Cada paso muestra una animación del gesto junto al átomo de ejemplo y se
 * marca solo cuando el sistema reconoce el gesto. La pantalla no bloquea la
 * escena: se puede seguir eligiendo y colocando elementos mientras se aprende.
 * Dura 3 minutos como máximo, tiene un botón para saltarla y no vuelve a
 * aparecer en la misma sesión.
 * @author Dana Carmona Santamaria
 */

import { emit, on } from './bus.js';
import {
  configurarPellizco,
  obtenerDistanciaPellizco,
  obtenerEstadoCamara,
  obtenerUmbralesPellizco,
} from './gestures.js';

const CLAVE_VISTO = 'moleculab-tutorial-visto';
const CLAVE_UMBRAL = 'moleculab-umbral-pellizco';
const LIMITE_MS = 180000;
const PELLIZCOS_PARA_CALIBRAR = 3;

const PASOS = [
  {
    id: 'agarrar',
    titulo: 'Agarrar',
    texto: 'Levanta solo el índice sobre el átomo de ejemplo. Con la palma abierta solo mueves el cursor.',
    evento: 'gesto:pellizco-inicio',
  },
  {
    id: 'mover',
    titulo: 'Mover',
    texto: 'Junta pulgar e índice con una mano y arrástrala para mover la escena. Al separar los dedos, termina.',
    evento: 'gesto:mover',
  },
  {
    id: 'girar',
    titulo: 'Girar',
    texto: 'Junta pulgar e índice en las dos manos y gíralas alrededor del centro para rotar la molécula.',
    evento: 'gesto:rotar',
  },
  {
    id: 'acercar',
    titulo: 'Acercar',
    texto: 'Pulgar e índice estirados en las dos manos forman un marco. Acércalas o aléjalas para cambiar el tamaño.',
    evento: 'gesto:zoom',
  },
  {
    id: 'paleta',
    titulo: 'Paleta',
    texto: 'Muestra el pulgar hacia un lado un momento para abrir o cerrar la paleta de moléculas.',
    evento: 'gesto:paleta',
  },
  {
    id: 'colocar',
    titulo: 'Colocar',
    texto: 'Con el cursor sobre un elemento de la paleta, levanta el índice para tomarlo. Cierra el puño para entrar al tablero y levanta el índice donde quieras colocarlo.',
    evento: 'escena:atomo-agregado',
  },
  {
    id: 'microfono',
    titulo: 'Micrófono',
    texto: 'Levanta el meñique un momento para encender o apagar el micrófono.',
    evento: 'gesto:microfono',
  },
  {
    id: 'tablero',
    titulo: 'Tablero',
    texto: 'Cierra el puño un momento para entrar o salir del tablero.',
    evento: 'gesto:canvas',
  },
  {
    id: 'listo',
    titulo: 'Listo',
    texto: 'Pulgar arriba un segundo para confirmar.',
    evento: 'gesto:listo',
  },
];

/** Átomo de ejemplo que se dibuja dentro de cada demostración. */
const ATOMO_DEMO = '<g class="demo-atomo"><circle cx="80" cy="50" r="18"/><text x="80" y="56" text-anchor="middle">H</text></g>';

/**
 * Animación de cada gesto, en SVG. Las clases (demo-*) sirven para
 * animarlas con CSS.
 */
const DEMOS = {
  agarrar: `<circle class="demo-dedo" cx="30" cy="50" r="6"/>${ATOMO_DEMO}`,
  mover: `${ATOMO_DEMO}<path class="demo-flecha" d="M30 85 H130"/>`,
  girar: `${ATOMO_DEMO}<circle class="demo-orbita" cx="120" cy="50" r="5"/><circle class="demo-orbita" cx="40" cy="50" r="5"/><path class="demo-arco" d="M30 20 A50 50 0 0 1 130 20"/>`,
  acercar: `${ATOMO_DEMO}<path class="demo-marco" d="M12 25 L12 12 L30 12"/><path class="demo-marco" d="M148 75 L148 88 L130 88"/>`,
  paleta: `${ATOMO_DEMO}<rect class="demo-paleta" x="118" y="10" width="34" height="80" rx="4"/>`,
  colocar: `<rect class="demo-tablero" x="20" y="15" width="120" height="70" rx="4"/><g class="demo-caer">${ATOMO_DEMO}</g>`,
  microfono: `<circle class="demo-anillo" cx="80" cy="50" r="30"/><rect class="demo-mic" x="74" y="32" width="12" height="22" rx="6"/>`,
  tablero: `<rect class="demo-tablero" x="30" y="15" width="100" height="70" rx="4"/><path class="demo-flecha" d="M14 90 L58 60"/>${ATOMO_DEMO}`,
  listo: `<path class="demo-check" d="M55 50 L74 69 L106 33"/>`,
};

let activo = false;
let contenedor = null;
let elementosPasos = [];
let zonaDemo = null;
let cajaDemo = null;
let tituloPaso = null;
let textoPaso = null;
let textoCalibracion = null;
let pasoActual = 0;
let calibrando = false;
let pellizcosContados = 0;
let enPellizco = false;
let minimoPellizco = null;
let minimos = [];
let idAnimacion = 0;
let idTemporizador = 0;

/** Lee el umbral guardado y lo aplica, si lo hay. */
function aplicarCalibracionGuardada() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_UMBRAL) || 'null');
    if (guardado && typeof guardado.agarrar === 'number' && typeof guardado.soltar === 'number') {
      configurarPellizco(guardado);
      return true;
    }
  } catch (error) {
    console.warn('[tutorial] No se pudo leer la calibración guardada:', error);
  }
  return false;
}

/** Guarda el umbral personal para las próximas veces. */
function guardarCalibracion(umbrales) {
  try {
    localStorage.setItem(CLAVE_UMBRAL, JSON.stringify(umbrales));
  } catch (error) {
    console.warn('[tutorial] No se pudo guardar la calibración:', error);
  }
}

/** Cierra la pantalla, quita el átomo de ejemplo y marca que ya se vio. */
function cerrar() {
  if (!activo) return;
  activo = false;
  calibrando = false;
  cancelAnimationFrame(idAnimacion);
  clearTimeout(idTemporizador);
  contenedor?.remove();
  contenedor = null;
  emit('tutorial:atomo-ejemplo', { mostrar: false });
  try {
    sessionStorage.setItem(CLAVE_VISTO, '1');
  } catch (error) {
    console.warn('[tutorial] No se pudo marcar el tutorial como visto:', error);
  }
}

/** Avisa y cierra cuando no hay cámara para hacer los gestos. */
function saltarSinCamara() {
  emit('ui:mensaje', {
    tipo: 'aviso',
    texto: 'Sin cámara, el tutorial se saltó. Puedes usar el mouse para mover los átomos.',
  });
  cerrar();
}

/** Crea un elemento con su clase y su texto. */
function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  if (texto) elemento.textContent = texto;
  return elemento;
}

/**
 * Muestra la animación y el texto del paso actual.
 */
function mostrarPasoActual() {
  if (!cajaDemo) return;
  const paso = PASOS[pasoActual];
  if (!paso) return;

  cajaDemo.innerHTML = `<svg viewBox="0 0 160 100" class="tutorial-demo demo-${paso.id}" aria-hidden="true">${DEMOS[paso.id]}</svg>`;
  tituloPaso.textContent = paso.titulo;
  textoPaso.textContent = paso.texto;

  elementosPasos.forEach((elemento, i) => {
    elemento.item.classList.toggle('tutorial-paso-actual', i === pasoActual);
  });
}

/**
 * Arma la pantalla: una tarjeta con la demostración, la lista de pasos
 * y el botón para saltarla. El contenedor no bloquea los clics de la escena.
 */
function construirPantalla() {
  // Posición, tamaño y clics se controlan en css/styles.css.
  contenedor = crearElemento('div', 'tutorial');
  const tarjeta = crearElemento('div', 'tutorial-tarjeta');

  const titulo = crearElemento('h2', 'tutorial-titulo', 'Aprende los gestos');
  const descripcion = crearElemento(
    'p',
    'tutorial-descripcion',
    'La palma abierta solo mueve el cursor. Haz cada gesto como lo muestra la animación. Tienes 3 minutos.',
  );
  textoCalibracion = crearElemento('p', 'tutorial-calibracion', '');

  zonaDemo = crearElemento('div', 'tutorial-paso-zona');
  cajaDemo = crearElemento('div', 'tutorial-demo-caja');
  tituloPaso = crearElemento('p', 'tutorial-paso-titulo', '');
  textoPaso = crearElemento('p', 'tutorial-paso-texto-actual', '');
  zonaDemo.appendChild(cajaDemo);
  zonaDemo.appendChild(tituloPaso);
  zonaDemo.appendChild(textoPaso);

  const lista = crearElemento('ol', 'tutorial-pasos');
  elementosPasos = PASOS.map((paso) => {
    const item = crearElemento('li', 'tutorial-paso');
    const palomita = crearElemento('span', 'tutorial-palomita', '○');
    const texto = crearElemento('span', 'tutorial-paso-texto', paso.titulo);
    item.appendChild(palomita);
    item.appendChild(texto);
    lista.appendChild(item);
    return { item, palomita };
  });

  const boton = crearElemento('button', 'tutorial-boton-saltar', 'Saltar tutorial');
  boton.addEventListener('click', () => cerrar());

  tarjeta.appendChild(titulo);
  tarjeta.appendChild(descripcion);
  tarjeta.appendChild(textoCalibracion);
  tarjeta.appendChild(zonaDemo);
  tarjeta.appendChild(lista);
  tarjeta.appendChild(boton);
  contenedor.appendChild(tarjeta);
}

/** Actualiza el texto con los pellizcos que faltan para calibrar. */
function actualizarTextoCalibracion() {
  if (!textoCalibracion) return;
  const faltan = PELLIZCOS_PARA_CALIBRAR - pellizcosContados;
  textoCalibracion.textContent = faltan > 0
    ? `Primero calibra tu pellizco: junta el pulgar y el índice y suelta. Te faltan ${faltan}.`
    : 'Calibración lista. Ahora practica los gestos.';
}

/** Marca el paso actual, muestra el siguiente y, si era el último, cierra. */
function completarPaso() {
  const actual = elementosPasos[pasoActual];
  if (!actual) return;
  actual.item.classList.remove('tutorial-paso-actual');
  actual.item.classList.add('tutorial-paso-completo');
  actual.palomita.textContent = '✓';
  pasoActual += 1;
  if (pasoActual >= PASOS.length) {
    emit('ui:mensaje', { tipo: 'correcto', texto: 'Tutorial completo. Ya puedes usar los gestos.' });
    cerrar();
    return;
  }
  mostrarPasoActual();
}

/** Termina la calibración: guarda el umbral personal y empieza los pasos. */
function terminarCalibracion() {
  calibrando = false;
  cancelAnimationFrame(idAnimacion);
  const promedio = minimos.reduce((a, b) => a + b, 0) / minimos.length;
  const agarrar = Math.min(0.07, Math.max(0.02, promedio + 0.01));
  const soltar = Math.min(0.10, Math.max(0.05, agarrar + 0.03));
  configurarPellizco({ agarrar, soltar });
  guardarCalibracion({ agarrar, soltar });
  actualizarTextoCalibracion();
  mostrarPasoActual();
}

/**
 * Lee la distancia del pellizco en cada cuadro y cuenta 3 veces
 * que se cierra y se abre. Guarda la distancia más corta de cada vez.
 */
function bucleCalibracion() {
  if (!activo || !calibrando) return;
  idAnimacion = requestAnimationFrame(bucleCalibracion);

  const distancia = obtenerDistanciaPellizco();
  if (distancia === null) {
    enPellizco = false;
    return;
  }

  const umbrales = obtenerUmbralesPellizco();
  if (!enPellizco && distancia < umbrales.agarrar) {
    enPellizco = true;
    minimoPellizco = distancia;
  } else if (enPellizco) {
    minimoPellizco = Math.min(minimoPellizco, distancia);
    if (distancia > umbrales.soltar) {
      enPellizco = false;
      minimos.push(minimoPellizco);
      pellizcosContados = minimos.length;
      actualizarTextoCalibracion();
      if (pellizcosContados >= PELLIZCOS_PARA_CALIBRAR) terminarCalibracion();
    }
  }
}

// Cada gesto completa su paso solo si es el que toca.
PASOS.forEach((paso, i) => {
  on(paso.evento, () => {
    if (!activo || calibrando || pasoActual !== i) return;
    completarPaso();
  });
});

// Si la cámara se niega o se pierde con el tutorial abierto, se salta.
on('estado:camara', ({ estado }) => {
  if (!activo) return;
  if (estado === 'denegada' || estado === 'sin-dispositivo') saltarSinCamara();
});

/**
 * Muestra el tutorial. Devuelve false si ya se vio en esta sesión
 * o si no hay cámara. El límite en ms solo se usa para probar.
 * @param {{limiteMs?: number}} [opciones]
 */
export function iniciarTutorial(opciones = {}) {
  if (activo) return false;

  try {
    if (sessionStorage.getItem(CLAVE_VISTO)) return false;
  } catch (error) {
    console.warn('[tutorial] No se pudo leer si el tutorial ya se vio:', error);
  }

  const estado = obtenerEstadoCamara();
  if (estado === 'denegada' || estado === 'sin-dispositivo') {
    saltarSinCamara();
    return false;
  }

  construirPantalla();
  document.body.appendChild(contenedor);
  activo = true;
  pasoActual = 0;
  emit('tutorial:atomo-ejemplo', { mostrar: true });

  idTemporizador = setTimeout(() => {
    emit('ui:mensaje', { tipo: 'aviso', texto: 'El tutorial se cerró por tiempo. Los gestos siguen funcionando.' });
    cerrar();
  }, opciones.limiteMs || LIMITE_MS);

  if (aplicarCalibracionGuardada()) {
    calibrando = false;
    actualizarTextoCalibracion();
    mostrarPasoActual();
  } else {
    calibrando = true;
    pellizcosContados = 0;
    minimos = [];
    enPellizco = false;
    actualizarTextoCalibracion();
    mostrarPasoActual();
    bucleCalibracion();
  }

  return true;
}