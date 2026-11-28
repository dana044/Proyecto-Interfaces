/**
 * @file ui.js
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Dana Carmona Santamaria
 * @author Citlaly Morales Viveros
 */

import { emit, on } from './bus.js';
import { alternarMicrofono, detenerLocucion, hablar } from './voice.js';
import { agregarAtomo, agregarParticula, crearAtomoDesdeParticulas, deshacer, limpiarEscena, limpiarParticulas, quitarParticula, rehacer, verificarMolecula } from './atoms.js';
import { darPista, entrarModoReto, formatearTiempo, salirModoReto } from './reto.js';
import { identificarElemento } from './chemistry.js';
import { ELEMENTOS } from './elementos.js';
import { estado, setUltimaAccion } from './state.js';


const estadosMicrofono = {
  escuchando: { texto: 'Activo', clase: 'estado-ok' },
  espera: { texto: 'En espera', clase: 'estado-aviso' },
  pausado: { texto: 'Desactivado', clase: 'estado-aviso' },
  error: { texto: 'Desactivado', clase: 'estado-error' },
};


const estadosCamara = {
  activa: { texto: 'Activa', clase: 'estado-ok' },
  denegada: { texto: 'Denegada', clase: 'estado-error' },
  'sin-dispositivo': { texto: 'Sin cámara', clase: 'estado-error' },
};

// Tonos del enlace: 660 Hz al crear uno válido, 180 Hz al rechazarlo.
// El botón "Silenciar tonos" los apaga y también para cualquier
// respuesta hablada en curso.
let tonosSilenciados = false;
let contextoAudio = null;
function tono(frecuencia) {
  if (tonosSilenciados) return;
  try {
    contextoAudio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (contextoAudio.state === 'suspended') void contextoAudio.resume();
    const oscilador = contextoAudio.createOscillator();
    const ganancia = contextoAudio.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.value = frecuencia;
    ganancia.gain.value = 0.08;
    oscilador.connect(ganancia).connect(contextoAudio.destination);
    oscilador.start();
    oscilador.stop(contextoAudio.currentTime + 0.15);
  } catch {
    // Sin audio, la app sigue: el aviso escrito ya está en pantalla.
  }
}

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

/**
 * Dice si un color de fondo (número 0xRRGGBB) es claro.
 * El texto oscuro pasa 4.5:1 cuando la luminancia supera 0.18
 * (ahí el blanco ya no llega); por debajo, el blanco es el que
 * se lee. Es el caso del berilio: ámbar con texto blanco 3.19:1.
 * @param {number} color - Color como número 0xRRGGBB.
 * @returns {boolean} true si el fondo es claro.
 */
function colorDeFondoClaro(color) {
  const rojo = ((color >> 16) & 255) / 255;
  const verde = ((color >> 8) & 255) / 255;
  const azul = (color & 255) / 255;
  const linealizar = (v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const luminancia = 0.2126 * linealizar(rojo) + 0.7152 * linealizar(verde) + 0.0722 * linealizar(azul);
  return luminancia > 0.18;
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
    // Fondo claro: el símbolo va en oscuro para que se lea; el
    // resto queda en blanco, que sí pasa el contraste. Hoy ningún
    // elemento tiene fondo claro, pero la regla queda por si aparece.
    if (colorDeFondoClaro(datos.color)) insignia.classList.add('simbolo-claro');

    // Por el momento el panel solo muestra el nombre. La información
    // completa queda en el título, en la etiqueta para lectores de
    // pantalla y en la tarjeta que aparece al pasar el cursor sobre
    // un átomo en la escena o al tocarlo.
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
  // Al iniciar la sesión, los paneles de átomos y de información
  // empiezan cerrados: el navegador a veces restaura los
  // interruptores como estaban antes de recargar y los paneles
  // salían abiertos.
  const menuAtomos = document.querySelector('#menu-atomos');
  const menuInfo = document.querySelector('#menu-info');
  const menuAyuda = document.querySelector('#menu-ayuda');
  if (menuAtomos) menuAtomos.checked = false;
  if (menuInfo) menuInfo.checked = false;
  if (menuAyuda) menuAyuda.checked = false;

  // Información y Ayuda comparten la columna derecha: solo se ve uno
  // a la vez. Al abrir uno con clic o teclado, el otro se cierra.
  // (Por voz y al verificar se cierran en commands.js y en
  // mostrarPanelInfo, porque marcar .checked no dispara change.)
  menuInfo?.addEventListener('change', () => {
    if (menuInfo.checked && menuAyuda) menuAyuda.checked = false;
  });
  menuAyuda?.addEventListener('change', () => {
    if (menuAyuda.checked && menuInfo) menuInfo.checked = false;
  });

  // Pulgar hacia un lado: abre o cierra la paleta de moléculas.
  on('gesto:paleta', () => {
    if (!menuAtomos) return;
    menuAtomos.checked = !menuAtomos.checked;
    emit('ui:paleta', { abierta: menuAtomos.checked });
  });

  const microfono = document.querySelector('[data-accion="microfono"]');
  const mensajes = document.querySelector('#zona-mensajes');
  const indicadorCamara = document.querySelector('#estado-camara');
  const indicadorMano = document.querySelector('#estado-mano');

  iniciarPanelAtomos();

  // Si falta un elemento de la página, no se rompe toda la interfaz:
  // antes un solo elemento ausente dejaba mudos la barra y los mensajes.
  if (!microfono || !mensajes || !indicadorCamara || !indicadorMano) return;

  // Botones del modelo de Bohr: el + toma la partícula en la mano
  // (se suelta tocando la escena) y el − quita la última de ese tipo.
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
  const botonCrearAtomo = document.querySelector('[data-accion="crear-atomo"]');
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
  // Crear átomo es una acción propia, independiente de verificar:
  // convierte las partículas (del modelo o sueltas) en átomos.
  botonCrearAtomo?.addEventListener('click', () => crearAtomoDesdeParticulas());
  // El botón de reto alterna entre entrar y salir del modo reto;
  // su texto cambia con el evento reto:actualizado.
  botonReto?.addEventListener('click', () => {
    if (estado.modo === 'reto') salirModoReto();
    else entrarModoReto();
  });
  botonAyudaReto?.addEventListener('click', () => darPista());
  botonSalirReto?.addEventListener('click', () => salirModoReto());
  // Al terminar el tutorial, si quedó en modo reto, se regresa al modo libre.
  on('tutorial:terminado', () => {
    if (estado.modo === 'reto') salirModoReto();
  });
  // I love you: entra al modo reto, o sale si ya está en él, igual que los botones.
  on('gesto:reto', () => {
    if (estado.modo === 'reto') salirModoReto();
    else entrarModoReto();
  });

  const botonSilenciar = document.querySelector('[data-accion="silenciar-sonidos"]');
  botonSilenciar?.addEventListener('click', () => {
    tonosSilenciados = !tonosSilenciados;
    botonSilenciar.setAttribute('aria-pressed', String(tonosSilenciados));
    botonSilenciar.textContent = tonosSilenciados ? 'Activar tonos' : 'Silenciar tonos';
    detenerLocucion();
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

  // Medidor de nivel del micrófono: la barra crece con lo que entra.
  // Si el micrófono está apagado o no entra nada, se queda en cero.
  const nivelMicrofono = microfono.querySelector('.nivel-microfono-relleno');
  on('voz:nivel', ({ nivel }) => {
    if (!nivelMicrofono) return;
    const porcentaje = Math.round(Math.min(1, Math.max(0, Number(nivel) || 0)) * 100);
    nivelMicrofono.style.width = `${porcentaje}%`;
  });

  on('estado:camara', ({ estado }) => {
    const datos = estadosCamara[estado];
    if (!datos) return;
    actualizarIndicador(indicadorCamara, datos);
  });

  on('estado:manos', ({ cantidad }) => {
    const numero = Number(cantidad) || 0;
    actualizarIndicador(indicadorMano, {
      texto: `Manos: ${numero}`,
      clase: numero === 0 ? 'estado-aviso' : 'estado-ok',
    });
  });

  // Tonos al crear o al rechazar un enlace.
  on('escena:enlace-creado', () => tono(660));
  on('escena:enlace-eliminado', () => tono(180));

  // Notificación emergente: aparece 4 segundos y se puede cerrar
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
    temporizadorMensaje = setTimeout(ocultarMensaje, 4000);
    setUltimaAccion(texto);
  });

  // Subtítulo en vivo: lo que el micrófono entendió, 2 segundos.
  // Es la confirmación visual de que la voz se escuchó bien.
  const subtitulo = document.querySelector('#subtitulo-voz');
  let temporizadorSubtitulo = null;
  on('voz:texto', ({ texto }) => {
    if (!subtitulo || !texto) return;
    subtitulo.textContent = `Escuché: «${texto}»`;
    subtitulo.hidden = false;
    if (temporizadorSubtitulo !== null) clearTimeout(temporizadorSubtitulo);
    temporizadorSubtitulo = setTimeout(() => { subtitulo.hidden = true; }, 2000);
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
  // filas de partículas del panel de átomos. Al cambiar los protones
  // se identifica el elemento formado (Z = protones) y se muestra su
  // masa aproximada (protones + neutrones); los neutrones solos no
  // cambian el elemento, solo la masa. El panel solo se abre solo
  // cuando hay partículas en el modelo: al soltar partículas
  // sueltas no se abre, para no tapar la escena ni empujarlas
  // fuera de la vista.
  on('escena:particulas-cambiadas', ({ protones, neutrones, electrones, enModelo }) => {
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
    const identificado = identificarElemento(protones, neutrones);
    const lineaElemento = panelInfo.querySelector('[data-campo="elemento"]');
    if (lineaElemento) {
      lineaElemento.textContent = identificado.simbolo ? identificado.mensaje : identificado.motivo;
    }
    const lineaMasa = panelInfo.querySelector('[data-campo="masa-linea"]');
    const valorMasa = panelInfo.querySelector('[data-campo="masa"]');
    if (lineaMasa && valorMasa) {
      lineaMasa.hidden = !identificado.simbolo;
      valorMasa.textContent = String(identificado.simbolo ? identificado.masa : 0);
    }
    if (enModelo > 0) mostrarPanelInfo();
  });

  // Explicación del enlace: al formarse, el panel dice qué
  // electrones comparten los dos átomos y la app lo lee en voz.
  // Ejemplo: "El oxígeno y el hidrógeno comparten 1 par de
  // electrones" (enlace doble: 2 pares).
  on('escena:electrones-compartidos', ({ elementoA, elementoB, pares }) => {
    const panelInfo = document.querySelector('#panel-info');
    if (!panelInfo) return;
    const nombreA = ELEMENTOS[elementoA]?.nombre.toLowerCase();
    const nombreB = ELEMENTOS[elementoB]?.nombre.toLowerCase();
    if (!nombreA || !nombreB || !pares) return;
    const texto = `El ${nombreA} y el ${nombreB} comparten `
      + (pares === 1 ? '1 par de electrones.' : `${pares} pares de electrones.`);
    const explicacion = panelInfo.querySelector('[data-campo="enlace-explicacion"]');
    if (explicacion) {
      explicacion.textContent = texto;
      explicacion.hidden = false;
    }
    mostrarPanelInfo();
    hablar(texto);
  });

  // Panel de información de la molécula: antes sus campos (fórmula,
  // nombre, geometría, descripción) no los escribía ningún JS.
  function limpiarPanelInfo() {
    const panelInfo = document.querySelector('#panel-info');
    if (!panelInfo) return;
    for (const campo of ['formula', 'nombre', 'geometria', 'descripcion', 'dato-curioso']) {
      const elemento = panelInfo.querySelector(`[data-campo="${campo}"]`);
      if (elemento) elemento.textContent = campo === 'descripcion'
        ? 'Construye una molécula y verifícala para ver su información aquí.'
        : '—';
    }
    const faltante = panelInfo.querySelector('[data-campo="faltante"]');
    if (faltante) faltante.hidden = true;
    const explicacion = panelInfo.querySelector('[data-campo="enlace-explicacion"]');
    if (explicacion) {
      explicacion.textContent = '';
      explicacion.hidden = true;
    }
  }

  // Cuando cambia la escena, lo identificado ya no vale: se limpia
  // el panel para no mostrar la molécula anterior como si fuera esta.
  for (const evento of [
    'escena:atomo-agregado', 'escena:atomo-eliminado',
    'escena:enlace-creado', 'escena:enlace-eliminado', 'escena:escena-limpia',
  ]) {
    on(evento, limpiarPanelInfo);
  }

  on('escena:molecula-identificada', ({ nombre, formula, geometria, descripcion, completa, datoCurioso, mensaje }) => {
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
    escribir('dato-curioso', datoCurioso);
    // Incompleta: lo que falta se ve en ámbar en el panel, no solo
    // en el aviso que desaparece a los 4 segundos.
    const faltante = panelInfo.querySelector('[data-campo="faltante"]');
    if (faltante) {
      if (completa === false && mensaje) {
        faltante.textContent = mensaje;
        faltante.hidden = false;
      } else {
        faltante.hidden = true;
      }
    }
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
  // La Ayuda comparte la columna: si estaba abierta, se cierra.
  const ayuda = document.querySelector('#menu-ayuda');
  if (ayuda) ayuda.checked = false;
}