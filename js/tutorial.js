/**
 * @fileoverview Tutorial de gestos con demostraciones y un átomo de ejemplo.
 *
 * Empieza directo en el primer gesto. Cada paso muestra una animación del
 * gesto y se marca solo cuando el sistema reconoce el gesto. El panel no
 * bloquea la escena: se puede seguir eligiendo y colocando elementos.
 * Dura 3 minutos como máximo y no vuelve a aparecer en la misma sesión.
 */

import { emit, on } from './bus.js';
import { configurarPellizco, obtenerEstadoCamara } from './gestures.js';

const CLAVE_VISTO = 'moleculab-tutorial-visto';
const CLAVE_UMBRAL = 'moleculab-umbral-pellizco';
const LIMITE_MS = 180000;

const PASOS = [
  {
    id: 'agarrar',
    titulo: 'Seleccionar',
    texto: 'Levanta solo el índice sobre un átomo del tablero para seleccionarlo. Con la palma abierta solo mueves el cursor.',
    evento: 'gesto:seleccionar-inicio',
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
    texto: 'Levanta el índice, el medio y el anular, con el meñique doblado, y muévelos a la derecha, a la izquierda, arriba o abajo para girar.',
    evento: 'gesto:rotar',
  },
  {
    id: 'acercar',
    titulo: 'Acercar',
    texto: 'Junta pulgar e índice en cada mano (dos pinzas) y sepáralas para acercar, o juntalas para alejar.',
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
    texto: 'Entra al tablero con la mano abierta, selecciona un botón de la paleta con el índice arriba, arrástralo al tablero y abre la mano para soltarlo.',
    evento: 'escena:atomo-agregado',
  },
  {
    id: 'microfono',
    titulo: 'Micrófono',
    texto: 'Levanta el meñique un momento para encender o apagar el micrófono.',
    evento: 'gesto:microfono',
  },
  {
    id: 'eliminar',
    titulo: 'Eliminar',
    texto: 'Levanta el índice y el medio, pon el cursor sobre un átomo y mantenlos medio segundo para eliminarlo.',
    evento: 'gesto:eliminar',
  },
  {
    id: 'deshacer',
    titulo: 'Deshacer',
    texto: 'Toca el pulgar con el dedo medio y mantenlo medio segundo para deshacer.',
    evento: 'gesto:deshacer',
  },
  {
    id: 'rehacer',
    titulo: 'Rehacer',
    texto: 'Toca el pulgar con el anular y mantenlo medio segundo para rehacer.',
    evento: 'gesto:rehacer',
  },
  {
    id: 'listo',
    titulo: 'Listo',
    texto: 'Pulgar arriba un segundo para confirmar la molécula.',
    evento: 'gesto:listo',
  },
];

/** Átomo de ejemplo que se dibuja dentro de cada demostración. */
const ATOMO_DEMO = '<g class="demo-atomo"><circle cx="80" cy="50" r="18"/><text x="80" y="56" text-anchor="middle">H</text></g>';

/** Animación de cada gesto, en SVG. Las clases demo-* sirven para animarlas con CSS. */
const DEMOS = {
  agarrar: `<circle class="demo-dedo" cx="30" cy="50" r="6"/>${ATOMO_DEMO}`,
  mover: `${ATOMO_DEMO}<path class="demo-flecha" d="M30 85 H130"/>`,
  girar: `${ATOMO_DEMO}<circle class="demo-orbita" cx="120" cy="50" r="5"/><circle class="demo-orbita" cx="40" cy="50" r="5"/><path class="demo-arco" d="M30 20 A50 50 0 0 1 130 20"/>`,
  acercar: `${ATOMO_DEMO}<path class="demo-marco" d="M12 25 L12 12 L30 12"/><path class="demo-marco" d="M148 75 L148 88 L130 88"/>`,
  paleta: `${ATOMO_DEMO}<rect class="demo-paleta" x="118" y="10" width="34" height="80" rx="4"/>`,
  colocar: `<rect class="demo-tablero" x="20" y="15" width="120" height="70" rx="4"/><g class="demo-caer">${ATOMO_DEMO}</g>`,
  microfono: `<circle class="demo-anillo" cx="80" cy="50" r="30"/><rect class="demo-mic" x="74" y="32" width="12" height="22" rx="6"/>`,
  eliminar: `${ATOMO_DEMO}<path class="demo-flecha" d="M140 20 V75"/><path class="demo-flecha" d="M133 68 L140 78 L147 68"/>`,
  deshacer: `${ATOMO_DEMO}<path class="demo-flecha" d="M130 85 H30"/><path class="demo-flecha" d="M42 78 L30 85 L42 92"/>`,
  rehacer: `${ATOMO_DEMO}<path class="demo-flecha" d="M30 85 H130"/><path class="demo-flecha" d="M118 78 L130 85 L118 92"/>`,
  listo: `<path class="demo-check" d="M55 50 L74 69 L106 33"/>`,
};

let activo = false;
let contenedor = null;
let elementosPasos = [];
let zonaDemo = null;
let cajaDemo = null;
let tituloPaso = null;
let textoPaso = null;
let pasoActual = 0;
let idTemporizador = 0;

/** Lee la calibración guardada del pellizco y la aplica, si la hay. */
function aplicarCalibracionGuardada() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_UMBRAL) || 'null');
    if (guardado && typeof guardado.agarrar === 'number' && typeof guardado.soltar === 'number') {
      configurarPellizco(guardado);
    }
  } catch (error) {
    console.warn('[tutorial] No se pudo leer la calibración guardada:', error);
  }
}

/** Cierra el tutorial, quita el átomo de ejemplo y marca que ya se vio. */
function cerrar() {
  if (!activo) return;
  activo = false;
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

/**
 * Crea un elemento con su clase y su texto.
 * @param {string} etiqueta
 * @param {string} clase
 * @param {string} [texto]
 */
function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  if (texto) elemento.textContent = texto;
  return elemento;
}

/** Muestra la animación, el título y el texto del paso actual. */
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
 * Arma la pantalla: la demostración, la lista de pasos y el botón para
 * saltarla. El contenedor no bloquea los clics de la escena.
 */
function construirPantalla() {
  contenedor = crearElemento('div', 'tutorial');
  const tarjeta = crearElemento('div', 'tutorial-tarjeta');

  const titulo = crearElemento('h2', 'tutorial-titulo', 'Aprende los gestos');
  const descripcion = crearElemento(
    'p',
    'tutorial-descripcion',
    'La palma abierta solo mueve el cursor. Haz cada gesto como lo muestra la animación. Tienes 3 minutos.',
  );

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
  tarjeta.appendChild(zonaDemo);
  tarjeta.appendChild(lista);
  tarjeta.appendChild(boton);
  contenedor.appendChild(tarjeta);
}

/** Marca el paso actual como hecho y muestra el siguiente. Al terminar, cierra. */
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

// Cada gesto completa su paso solo si es el que toca.
PASOS.forEach((paso, i) => {
  on(paso.evento, () => {
    if (!activo || pasoActual !== i) return;
    completarPaso();
  });
});

// Si la cámara se niega o se pierde con el tutorial abierto, se salta.
on('estado:camara', ({ estado }) => {
  if (!activo) return;
  if (estado === 'denegada' || estado === 'sin-dispositivo') saltarSinCamara();
});

/**
 * Muestra el tutorial. Devuelve false si ya se vio en esta sesión o si
 * no hay cámara.
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

  aplicarCalibracionGuardada();
  construirPantalla();
  document.body.appendChild(contenedor);
  activo = true;
  pasoActual = 0;
  mostrarPasoActual();
  emit('tutorial:atomo-ejemplo', { mostrar: true });

  idTemporizador = setTimeout(() => {
    emit('ui:mensaje', { tipo: 'aviso', texto: 'El tutorial se cerró por tiempo. Los gestos siguen funcionando.' });
    cerrar();
  }, opciones.limiteMs || LIMITE_MS);

  return true;
}