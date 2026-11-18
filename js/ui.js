import { on } from './bus.js';
import { alternarMicrofono } from './voice.js';
import { agregarAtomo } from './atoms.js';

const estadosMicrofono = {
  escuchando: { texto: 'Escuchando', clase: 'estado-ok' },
  pausado: { texto: 'Pausado', clase: 'estado-aviso' },
  error: { texto: 'Error', clase: 'estado-error' },
};

export function iniciarInterfaz() {
  const microfono = document.querySelector('[data-accion="microfono"]');
  const indicador = document.querySelector('#estado-microfono');
  const valor = indicador.querySelector('.valor');
  const mensajes = document.querySelector('#zona-mensajes');

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
