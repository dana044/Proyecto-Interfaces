/**
 * @file ui.js
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Dana Carmona Santamaria
 * @author Citlaly Morales Viveros
 */

import { on } from './bus.js';
import { alternarMicrofono } from './voice.js';
import { agregarAtomo, agregarParticula, deshacer, limpiarEscena, limpiarParticulas, quitarParticula, rehacer, verificarMolecula } from './atoms.js';
import { darPista, entrarModoReto, formatearTiempo, salirModoReto } from './reto.js';
import { ELEMENTOS } from './elementos.js';
import { estado, setUltimaAccion } from './state.js';

const estadosMicrofono = {
  escuchando: { texto: 'Escuchando', clase: 'estado-ok' },
  pausado: { texto: 'Pausado', clase: 'estado-aviso' },
  error: { texto: 'Error', clase: 'estado-error' },
};

const estadosCamara = {
  activa: { texto: 'Activa', clase: 'estado-ok' },
  denegada: { texto: 'Denegada', clase: 'estado-error' },
  'sin-dispositivo': { texto: 'Sin cámara', clase: 'estado-error' },
};

/**
 * Actualiza una pastilla de estado del encabezado (#estado-camara
 * o #estado-mano) con su texto y su color.
 * @param {Element | null} indicador
 * @param {{ texto: string, clase: string }} datos
 */
function actualizarIndicador(indicador, datos) {
  if (!indicador) return;

  indicador.classList.remove('estado-ok', 'estado-aviso', 'estado-error');
  indicador.classList.add(datos.clase);

  const valor = indicador.querySelector('.valor');
  if (valor) valor.textContent = datos.texto;
}

function iniciarPanelAtomos() {
  const lista = document.querySelector('#lista-elementos');
  if (!lista) return;

  const botones = Object.entries(ELEMENTOS).map(([simbolo, datos]) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton boton-atomo';
    boton.dataset.accion = 'agregar';
    boton.dataset.elemento = simbolo;

    const insignia = document.createElement('span');
    insignia.className = 'simbolo';
    insignia.textContent = simbolo;
    insignia.setAttribute('aria-hidden', 'true');
    insignia.style.backgroundColor =
      '#' + datos.color.toString(16).padStart(6, '0');

    // Por el momento el panel solo muestra el nombre. La información
    // completa queda en el título, en la etiqueta para lectores de
    // pantalla y en la tarjeta que aparece al pasar el cursor sobre
    // un átomo en la escena.
    const info = `${datos.nombre} · ${datos.grupo} · Valencia ${datos.valencia}`;
    boton.setAttribute('aria-label', info);
    boton.title = info;

    const etiqueta = document.createElement('span');
    etiqueta.textContent = datos.nombre;

    boton.append(insignia, etiqueta);
    boton.addEventListener('click', () => agregarAtomo(simbolo));
    return boton;
  });

  lista.replaceChildren(...botones);
}

export function iniciarInterfaz() {
  const microfono = document.querySelector('[data-accion="microfono"]');
  const mensajes = document.querySelector('#zona-mensajes');
  const indicadorCamara = document.querySelector('#estado-camara');
  const indicadorMano = document.querySelector('#estado-mano');

  iniciarPanelAtomos();

  // Si falta un elemento de la página, no se rompe toda la interfaz:
  // antes un solo elemento ausente dejaba mudos la barra y los mensajes.
  if (!microfono || !mensajes || !indicadorCamara || !indicadorMano) return;

  // Botones del modelo de Bohr: agregar y quitar partículas.
  document.querySelectorAll('[data-particula]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const tipo = boton.dataset.particula;
      if (boton.dataset.accionParticula === 'quitar') quitarParticula(tipo);
      else agregarParticula(tipo);
    });
  });

  // Botones de respaldo: Deshacer, Rehacer, Limpiar y Verificar no
  // tenían ningún listener y el clic no hacía nada. Ahora sí hacen
  // lo que prometen.
  const botonDeshacer = document.querySelector('[data-accion="deshacer"]');
  const botonRehacer = document.querySelector('[data-accion="rehacer"]');
  const botonLimpiar = document.querySelector('[data-accion="limpiar"]');
  const botonVerificar = document.querySelector('[data-accion="verificar"]');
  const botonReto = document.querySelector('[data-accion="reto"]');
  const botonAyudaReto = document.querySelector('[data-accion="ayuda-reto"]');
  const botonSalirReto = document.querySelector('[data-accion="salir-reto"]');
  botonDeshacer?.addEventListener('click', () => deshacer());
  botonRehacer?.addEventListener('click', () => rehacer());
  botonLimpiar?.addEventListener('click', () => {
    // La confirmación vive en limpiarEscena(): solo pregunta con
    // más de 2 átomos, y si se cancela no se borran las partículas.
    if (limpiarEscena()) limpiarParticulas();
  });
  botonVerificar?.addEventListener('click', () => verificarMolecula());
  // El botón de reto alterna entre entrar y salir del modo reto;
  // su texto cambia con el evento reto:actualizado.
  botonReto?.addEventListener('click', () => {
    if (estado.modo === 'reto') salirModoReto();
    else entrarModoReto();
  });
  botonAyudaReto?.addEventListener('click', () => darPista());
  botonSalirReto?.addEventListener('click', () => salirModoReto());

  microfono.addEventListener('click', alternarMicrofono);
  document.addEventListener('keydown', (evento) => {
    if (evento.code !== 'Space' || evento.defaultPrevented || evento.repeat
      || evento.isComposing || evento.altKey || evento.ctrlKey || evento.metaKey
      || evento.shiftKey) return;

    // Los controles enfocados conservan el comportamiento nativo de Espacio.
    const objetivo = evento.target;
    if (objetivo instanceof HTMLElement && (objetivo.isContentEditable
      || objetivo.closest('button, input, textarea, select, summary, [role="button"]'))) return;
    if (document.querySelector('dialog[open]')) return;

    evento.preventDefault();
    alternarMicrofono();
  });

  // Ctrl+Z deshace y Ctrl+Y (o Ctrl+Shift+Z) rehace, en toda la
  // página. Se ignoran en campos de texto, como el Espacio de arriba.
  document.addEventListener('keydown', (evento) => {
    if (evento.defaultPrevented || evento.repeat || evento.isComposing
      || evento.altKey || !(evento.ctrlKey || evento.metaKey)) return;

    if (evento.code !== 'KeyZ' && evento.code !== 'KeyY') return;
    const objetivo = evento.target;
    if (objetivo instanceof HTMLElement && (objetivo.isContentEditable
      || objetivo.closest('input, textarea, select, [contenteditable]'))) return;
    if (document.querySelector('dialog[open]')) return;

    evento.preventDefault();
    if (evento.code === 'KeyY' || evento.shiftKey) rehacer();
    else deshacer();
  });

  // El estado del micrófono vive en su propio botón: un punto de
  // color y el estado en texto (Escuchando, Pausado o Error).
  on('estado:microfono', ({ estado }) => {
    const datos = estadosMicrofono[estado];
    if (!datos) return;
    microfono.classList.remove('estado-ok', 'estado-aviso', 'estado-error');
    microfono.classList.add(datos.clase);
    const textoEstado = microfono.querySelector('.estado-boton');
    if (textoEstado) textoEstado.textContent = datos.texto;
  });

  on('estado:camara', ({ estado }) => {
    const datos = estadosCamara[estado];
    if (!datos) return;
    actualizarIndicador(indicadorCamara, datos);
  });

  on('estado:manos', ({ cantidad }) => {
    const numero = Number(cantidad) || 0;
    actualizarIndicador(indicadorMano, numero === 0
      ? { texto: 'No detectada', clase: 'estado-aviso' }
      : { texto: `${numero} detectada${numero > 1 ? 's' : ''}`, clase: 'estado-ok' });
  });

  // Notificación emergente: aparece 6 segundos y se puede cerrar
  // con la ×. Un aviso nuevo reinicia el tiempo.
  const parrafoMensaje = mensajes.querySelector('p');
  const botonCerrarMensaje = mensajes.querySelector('.cerrar-mensaje');
  let temporizadorMensaje = null;
  const ocultarMensaje = () => {
    if (temporizadorMensaje !== null) {
      clearTimeout(temporizadorMensaje);
      temporizadorMensaje = null;
    }
    mensajes.hidden = true;
  };
  botonCerrarMensaje?.addEventListener('click', ocultarMensaje);
  parrafoMensaje?.classList.add('mensaje');

  on('ui:mensaje', ({ tipo, texto }) => {
    if (!parrafoMensaje) return;
    parrafoMensaje.classList.remove('mensaje-correcto', 'mensaje-aviso', 'mensaje-error');
    if (['correcto', 'aviso', 'error'].includes(tipo)) {
      parrafoMensaje.classList.add(`mensaje-${tipo}`);
    }
    parrafoMensaje.textContent = texto;
    mensajes.hidden = false;
    if (temporizadorMensaje !== null) clearTimeout(temporizadorMensaje);
    temporizadorMensaje = setTimeout(ocultarMensaje, 6000);
    setUltimaAccion(texto);
  });

  // La última acción también se actualiza al seleccionar o mover un átomo.
  // Antes estos dos eventos se emitían sin ningún receptor.
  on('escena:atomo-seleccionado', ({ id }) => {
    if (id) setUltimaAccion(`Seleccionaste ${id}`);
  });
  on('escena:atomo-movido', ({ id }) => {
    if (id) setUltimaAccion(`Moviste ${id}`);
  });

  // Contador del modelo de Bohr en el panel de información y en las
  // filas de partículas del panel de átomos.
  on('escena:particulas-cambiadas', ({ protones, neutrones, electrones }) => {
    const panelInfo = document.querySelector('#panel-info');
    if (!panelInfo) return;
    const escribir = (campo, numero) => {
      const elemento = panelInfo.querySelector(`[data-campo="${campo}"]`);
      if (elemento) elemento.textContent = String(numero);
      const fila = document.querySelector(`[data-conteo-particula="${campo}"]`);
      if (fila) fila.textContent = String(numero);
    };
    escribir('protones', protones);
    escribir('neutrones', neutrones);
    escribir('electrones', electrones);
    if (protones + neutrones + electrones > 0) mostrarPanelInfo();
  });

  // Panel de información de la molécula: antes sus campos (fórmula,
  // nombre, geometría, descripción) no los escribía ningún JS.
  on('escena:molecula-identificada', ({ nombre, formula, geometria, descripcion }) => {
    const panelInfo = document.querySelector('#panel-info');
    if (!panelInfo) return;
    const escribir = (campo, texto) => {
      const elemento = panelInfo.querySelector(`[data-campo="${campo}"]`);
      if (elemento && texto) elemento.textContent = texto;
    };
    escribir('formula', formula);
    escribir('nombre', nombre);
    escribir('geometria', geometria);
    escribir('descripcion', descripcion);
    // Solo se abre el panel cuando hay una molécula que mostrar: en
    // una verificación fallida sin molécula no hay nada nuevo.
    if (nombre || formula) mostrarPanelInfo();
  });

  // Panel del modo reto: muestra el reto actual, su fórmula, la
  // sugerencia, las estrellas, los intentos y el tiempo. Solo se
  // ve en modo reto; la pantalla completa del reto es de Stephanie.
  on('reto:actualizado', ({ activo, titulo, formula, sugerencia, estrellas, intentos, tiempoMs, total, terminado }) => {
    const panelReto = document.querySelector('#panel-reto');
    const botonReto = document.querySelector('[data-accion="reto"]');
    if (botonReto) botonReto.textContent = activo ? 'Modo libre' : 'Modo reto';
    if (!panelReto) return;
    panelReto.hidden = !activo;
    if (!activo) return;
    const escribir = (campo, texto) => {
      const elemento = panelReto.querySelector(`[data-campo-reto="${campo}"]`);
      if (elemento) elemento.textContent = texto;
    };
    escribir('titulo', titulo);
    escribir('formula', formula || '—');
    escribir('sugerencia', terminado
      ? '¡Terminaste los 6 retos! Entra de nuevo al modo reto para volver a empezar.'
      : sugerencia);
    escribir('estrellas', '★'.repeat(estrellas) + '☆'.repeat(Math.max(0, total - estrellas)));
    escribir('intentos', `Intentos: ${intentos}`);
    escribir('tiempo', `Tiempo: ${formatearTiempo(tiempoMs || 0)}`);
    mostrarPanelInfo();
  });
}

/**
 * Muestra el panel de información: marca su interruptor, que es lo
 * mismo que pulsar la etiqueta «Información». Si la usuaria lo
 * oculta después, se queda oculto hasta que llegue información nueva.
 */
function mostrarPanelInfo() {
  const interruptor = document.querySelector('#menu-info');
  if (interruptor) interruptor.checked = true;
}
