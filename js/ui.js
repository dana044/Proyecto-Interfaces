import { on } from './bus.js';
import { alternarMicrofono } from './voice.js';
import { agregarAtomo } from './atoms.js';

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

export function iniciarInterfaz() {
  const microfono = document.querySelector('[data-accion="microfono"]');
  const indicador = document.querySelector('#estado-microfono');
  const valor = indicador.querySelector('.valor');
  const mensajes = document.querySelector('#zona-mensajes');
  const indicadorCamara = document.querySelector('#estado-camara');
  const indicadorMano = document.querySelector('#estado-mano');

document.querySelectorAll('#panel-atomos [data-accion="agregar"]')
  .forEach((boton) => {
    boton.addEventListener('click', () => {
      agregarAtomo(boton.dataset.elemento);
    });
  });

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
  });
}
