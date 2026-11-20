import { on } from './bus.js';
import { alternarMicrofono } from './voice.js';
import { agregarAtomo, deshacer, limpiarEscena, verificarMolecula } from './atoms.js';
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
 * Actualiza un indicador de la barra de estado (#estado-camara,
 * #estado-mano o #estado-microfono) con su texto y su color.
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
  const indicador = document.querySelector('#estado-microfono');
  const mensajes = document.querySelector('#zona-mensajes');
  const indicadorCamara = document.querySelector('#estado-camara');
  const indicadorMano = document.querySelector('#estado-mano');

  iniciarPanelAtomos();

  // Si falta un elemento de la página, no se rompe toda la interfaz:
  // antes un solo elemento ausente dejaba mudos la barra y los mensajes.
  if (!microfono || !indicador || !mensajes || !indicadorCamara || !indicadorMano) return;
  const valor = indicador.querySelector('.valor');
  if (!valor) return;

  // Botones de respaldo: Deshacer, Limpiar y Verificar no tenían ningún
  // listener y el clic no hacía nada. Ahora sí hacen lo que prometen.
  const botonDeshacer = document.querySelector('[data-accion="deshacer"]');
  const botonLimpiar = document.querySelector('[data-accion="limpiar"]');
  const botonVerificar = document.querySelector('[data-accion="verificar"]');
  botonDeshacer?.addEventListener('click', () => deshacer());
  botonLimpiar?.addEventListener('click', () => {
    if (!window.confirm('¿Borrar todos los átomos de la escena?')) return;
    limpiarEscena();
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

  on('estado:microfono', ({ estado }) => {
    const datos = estadosMicrofono[estado];
    if (!datos) return;
    indicador.classList.remove('estado-ok', 'estado-aviso', 'estado-error');
    indicador.classList.add(datos.clase);
    valor.textContent = datos.texto;
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

  on('ui:mensaje', ({ tipo, texto }) => {
    const aviso = document.createElement('p');
    aviso.classList.add('mensaje');
    if (['correcto', 'aviso', 'error'].includes(tipo)) {
      aviso.classList.add(`mensaje-${tipo}`);
    }
    aviso.textContent = texto;
    mensajes.replaceChildren(aviso);
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
  });
}
