import { on } from './bus.js';
import { alternarMicrofono } from './voice.js';
import { agregarAtomo, agregarParticula, deshacer, limpiarEscena, limpiarParticulas, quitarParticula, verificarMolecula } from './atoms.js';
import { ELEMENTOS } from './elementos.js';
import { setUltimaAccion } from './state.js';

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

  // Botones de respaldo: Deshacer, Limpiar y Verificar no tenían ningún
  // listener y el clic no hacía nada. Ahora sí hacen lo que prometen.
  const botonDeshacer = document.querySelector('[data-accion="deshacer"]');
  const botonLimpiar = document.querySelector('[data-accion="limpiar"]');
  const botonVerificar = document.querySelector('[data-accion="verificar"]');
  botonDeshacer?.addEventListener('click', () => deshacer());
  botonLimpiar?.addEventListener('click', () => {
    if (!window.confirm('¿Borrar todos los átomos de la escena?')) return;
    limpiarEscena();
    limpiarParticulas();
  });
  botonVerificar?.addEventListener('click', () => verificarMolecula());

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
