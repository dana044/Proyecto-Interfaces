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
import { DEMOS } from './tutorial-animaciones.js';

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
    texto: 'Con la mano derecha, haz la llamada con el meñique hacia la izquierda y mantenla medio segundo para deshacer.',
    evento: 'gesto:deshacer',
  },
  {
    id: 'rehacer',
    titulo: 'Rehacer',
    texto: 'Con la mano izquierda, haz la llamada con el meñique hacia la derecha y mantenla medio segundo para rehacer.',
    evento: 'gesto:rehacer',
  },
  {
    id: 'reto',
    titulo: 'Reto',
    texto: 'Forma un «I love you» (pulgar, índice y meñique estirados) y mantenlo medio segundo para entrar o salir del modo reto.',
    evento: 'gesto:reto',
  },
  {
    id: 'limpiar',
    titulo: 'Limpiar',
    texto: 'Estira los cuatro dedos largos con el pulgar dentro de la palma y mantenlo un segundo para borrar todo.',
    evento: 'gesto:limpiar',
  },
  {
    id: 'listo',
    titulo: 'Listo',
    texto: 'Cierra la mano con el pulgar hacia arriba y mantenlo un segundo para confirmar la molécula.',
    evento: 'gesto:listo',
  },
  {
    id: 'ra',
    titulo: 'Realidad aumentada',
    texto: 'Baja el pulgar (pulgar hacia abajo) y mantenlo medio segundo para entrar o salir de la realidad aumentada.',
    evento: 'gesto:ra',
  },
];

let activo = false;
let contenedor = null;
let elementosPasos = [];
let zonaDemo = null;
let cajaDemo = null;
let tituloPaso = null;
let textoPaso = null;
let pasoActual = 0;
let idTemporizador = 0;
let listaPasos = null;
let completando = false;

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

/**
 * Cierra el tutorial, quita el átomo de ejemplo y marca que ya se vio.
 * @param {boolean} [completo] true solo si se terminaron todos los pasos.
 */
function cerrar(completo = false) {
  if (!activo) return;
  activo = false;
  clearTimeout(idTemporizador);
  contenedor?.remove();
  contenedor = null;
  emit('tutorial:atomo-ejemplo', { mostrar: false });
  emit('tutorial:terminado', { completo });
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

  cajaDemo.innerHTML = `<div class="tutorial-demo demo-${paso.id}" aria-hidden="true">${DEMOS[paso.id]}</div>`;
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

  listaPasos = crearElemento('ol', 'tutorial-pasos');
  elementosPasos = PASOS.map((paso) => {
    const item = crearElemento('li', 'tutorial-paso');
    const palomita = crearElemento('span', 'tutorial-palomita', '○');
    const texto = crearElemento('span', 'tutorial-paso-texto', paso.titulo);
    item.appendChild(palomita);
    item.appendChild(texto);
    return { item, palomita };
  });

  const boton = crearElemento('button', 'tutorial-boton-saltar', 'Saltar tutorial');
  boton.addEventListener('click', () => cerrar());

  tarjeta.appendChild(titulo);
  tarjeta.appendChild(descripcion);
  tarjeta.appendChild(zonaDemo);
  renderizarLista();
  tarjeta.appendChild(listaPasos);
  tarjeta.appendChild(boton);
  contenedor.appendChild(tarjeta);
}

/** Muestra solo el paso actual y los que faltan. */
function renderizarLista() {
  listaPasos.replaceChildren(...elementosPasos.slice(pasoActual, pasoActual + 1).map((elemento) => elemento.item));
}

/** Aviso al entrar al modo reto: oculta la tarjeta un momento para que se vea el panel del reto. */
function avisarEntradaReto() {
  emit('ui:mensaje', { tipo: 'correcto', texto: 'Entraste al modo reto. Para salir, vuelve a hacer «I love you».' });
  if (!contenedor) return;
  contenedor.style.display = 'none';
  setTimeout(() => {
    if (contenedor) contenedor.style.display = '';
  }, 2000);
}

/** Aviso al entrar a la realidad aumentada: oculta la tarjeta un momento para que se vea la vista de RA. */
function avisarEntradaRA() {
  emit('ui:mensaje', { tipo: 'correcto', texto: 'Entraste a la realidad aumentada. Para salir, pulsa el botón de RA.' });
  if (!contenedor) return;
  contenedor.style.display = 'none';
  setTimeout(() => {
    if (contenedor) contenedor.style.display = '';
  }, 2000);
}

/**
 * Marca el paso actual en verde y, un momento después, pasa al siguiente.
 * Al terminar el último, cierra el tutorial.
 */
function completarPaso() {
  const actual = elementosPasos[pasoActual];
  if (!actual || completando) return;
  completando = true;
  actual.item.classList.remove('tutorial-paso-actual');
  actual.item.classList.add('tutorial-paso-completo');
  actual.palomita.textContent = '✓';
  if (PASOS[pasoActual].id === 'reto') avisarEntradaReto();
  if (PASOS[pasoActual].id === 'ra') avisarEntradaRA();

  setTimeout(() => {
    completando = false;
    if (!activo) return;
    pasoActual += 1;
    if (pasoActual >= PASOS.length) {
      emit('ui:mensaje', { tipo: 'correcto', texto: 'Tutorial completo. Ya puedes usar los gestos.' });
      cerrar(true);
      return;
    }
    mostrarPasoActual();
    renderizarLista();
  }, 900);
}

// Cada gesto completa su paso solo si es el que toca.
PASOS.forEach((paso, i) => {
  on(paso.evento, () => {
    if (!activo || completando || pasoActual !== i) return;
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