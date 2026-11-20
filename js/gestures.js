/**
 * @fileoverview Cámara y detección de manos con MediaPipe.
 *
 * Pide la cámara, muestra el video en espejo, 
 * detecta hasta 2 manos con 21 puntos cada una, dibuja el
 * esqueleto sobre #superposicion-mano y publica cuántas manos se ven.
 *
 *
 * @see docs/eventos.md
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { emit } from './bus.js';

const VERSION_TASKS_VISION = '0.10.20';
const URL_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_TASKS_VISION}/wasm`;
/** Modelo oficial de manos (float16), servido por Google. */
const URL_MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const FPS_MINIMO = 20;
const SEGUNDOS_LENTOS_ANTES_DE_BAJAR = 2;
const ANCHO_BAJA_RESOLUCION = 640;
const ALTO_BAJA_RESOLUCION = 480;
const UMBRAL_PELLIZCO_INICIO = 0.05;
const UMBRAL_PELLIZCO_FIN = 0.08;
const ALFA_SUAVIZADO = 0.4;
const MS_MANO_PERDIDA = 500;
const PUNTO_PULGAR = 4;
const PUNTO_INDICE = 8;

const MENSAJE_PERMISO_DENEGADO = 'Necesito tu cámara para ver tus manos; actívala en el candado de la barra de direcciones. Mientras tanto puedes usar el mouse.';
const MENSAJE_SIN_CAMARA = 'No encontré una cámara disponible. Si otra aplicación la está usando, ciérrala e inténtalo de nuevo. Mientras tanto puedes usar el mouse.';

let iniciado = false;
let detenido = false;
let video = null;
let lienzo = null;
let contexto = null;
let landmarker = null;
let stream = null;
let idAnimacion = 0;
let ultimoTiempoVideo = -1;
let resolucionReducida = false;
let ultimasManos = [];
let ultimoNumeroManos = -1;
let cuadrosEnVentana = 0;
let inicioVentana = 0;
let segundosLentosSeguidos = 0;
let umbrales = { inicio: UMBRAL_PELLIZCO_INICIO, fin: UMBRAL_PELLIZCO_FIN };
let pellizcando = false;
let suavizado = null;
let ultimoMomentoConMano = 0;
let cursor = null;

/**
 * Publica el estado de la cámara en el bus.
 * @param {'activa' | 'denegada' | 'sin-dispositivo'} estado
 */
function publicarEstadoCamara(estado) {
  emit('estado:camara', { estado });
}

/** Publica el número de manos solo cuando cambia. */
function publicarNumeroManos(cantidad) {
  if (cantidad === ultimoNumeroManos) return;

  ultimoNumeroManos = cantidad;
  emit('estado:manos', { cantidad });
}

/**
 * Muestra un error de cámara sin romper la página: publica el estado y
 * avisa con ui:mensaje
 * @param {Error} error
 */
function manejarErrorCamara(error) {
  const nombre = error?.name || '';

  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    publicarEstadoCamara('denegada');
    emit('ui:mensaje', { tipo: 'error', texto: MENSAJE_PERMISO_DENEGADO });
    return;
  }

  publicarEstadoCamara('sin-dispositivo');
  emit('ui:mensaje', { tipo: 'error', texto: MENSAJE_SIN_CAMARA });
}

/**
 * Pide la cámara con la resolución indicada.
 * @param {number} ancho
 * @param {number} alto
 */
async function pedirCamara(ancho, alto) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error('Este navegador no permite usar la cámara aquí.');
    error.name = 'NotSupportedError';
    throw error;
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: ancho },
      height: { ideal: alto },
      facingMode: 'user',
    },
    audio: false,
  });
}

/**
 * Crea el detector de manos. Prueba primero con GPU y si el equipo no
 * tiene WebGL, reintenta con CPU antes de rendirse.
 */
async function crearLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(URL_WASM);

  const opciones = {
    baseOptions: { modelAssetPath: URL_MODELO },
    runningMode: 'VIDEO',
    numHands: 2,
  };

  try {
    return await HandLandmarker.createFromOptions(vision, {
      ...opciones,
      baseOptions: { ...opciones.baseOptions, delegate: 'GPU' },
    });
  } catch (error) {
    console.warn('[gestos] Sin GPU, reintentando la detección con CPU:', error);
    return HandLandmarker.createFromOptions(vision, {
      ...opciones,
      baseOptions: { ...opciones.baseOptions, delegate: 'CPU' },
    });
  }
}

/** Detiene las pistas del stream actual, si lo hay. */
function detenerStream() {
  stream?.getTracks().forEach((pista) => pista.stop());
  stream = null;
}

/**
 * Baja la cámara a 640x480 cuando la detección va por debajo de 20 FPS.
 */
async function reducirResolucion() {
  if (resolucionReducida || !video) return;

  resolucionReducida = true;

  try {
    detenerStream();
    stream = await pedirCamara(ANCHO_BAJA_RESOLUCION, ALTO_BAJA_RESOLUCION);
    video.srcObject = stream;
    await video.play();
    emit('ui:mensaje', {
      tipo: 'aviso',
      texto: 'La cámara iba lenta y bajé su resolución a 640x480 para que la detección no se trabe.',
    });
  } catch (error) {
    console.error('[gestos] No se pudo bajar la resolución de la cámara:', error);
  }

  cuadrosEnVentana = 0;
  inicioVentana = performance.now();
  segundosLentosSeguidos = 0;
}

/**
 * Cuenta los cuadros por segundo y baja la resolución si la detección se
 * mantiene por debajo de 20 FPS durante varios segundos seguidos.
 */
function medirFPS(ahora) {
  if (!inicioVentana) inicioVentana = ahora;

  cuadrosEnVentana += 1;

  const transcurrido = ahora - inicioVentana;
  if (transcurrido < 1000) return;

  const fps = (cuadrosEnVentana * 1000) / transcurrido;
  cuadrosEnVentana = 0;
  inicioVentana = ahora;

  if (fps < FPS_MINIMO) {
    segundosLentosSeguidos += 1;
    if (segundosLentosSeguidos >= SEGUNDOS_LENTOS_ANTES_DE_BAJAR) {
      reducirResolucion();
    }
  } else {
    segundosLentosSeguidos = 0;
  }
}

/**
 * Guarda las manos del último resultado y publica cuántas se ven.
 * @param {import('@mediapipe/tasks-vision').HandLandmarkerResult} resultado
 */
function actualizarManos(resultado) {
  const puntosPorMano = resultado.landmarks || [];
  const lateralidades = resultado.handedness || [];

  ultimasManos = puntosPorMano.map((puntos, i) => ({
    puntos,
    lateralidad: lateralidades[i]?.[0]?.categoryName || undefined,
  }));

  publicarNumeroManos(ultimasManos.length);
}

/**
 * Dibuja el esqueleto de cada mano sobre el canvas
 * @param {import('@mediapipe/tasks-vision').HandLandmarkerResult} resultado
 */
function dibujarManos(resultado) {
  if (!video || !lienzo || !contexto) return;
  if (!video.videoWidth || !video.videoHeight) return;

  // Se dibuja al tamaño visible (200x150), no al del video: con 1280 px
  // de ancho una línea de 3 px salía de menos de medio píxel en pantalla.
  const anchoVisible = lienzo.clientWidth || video.videoWidth;
  const altoVisible = lienzo.clientHeight || video.videoHeight;

  if (lienzo.width !== anchoVisible || lienzo.height !== altoVisible) {
    lienzo.width = anchoVisible;
    lienzo.height = altoVisible;
  }

  contexto.clearRect(0, 0, lienzo.width, lienzo.height);

  // El video recorta los lados (object-fit: cover en caja 4/3); se aplica
  // el mismo recorte para que el esqueleto caiga sobre la mano.
  const escala = Math.max(
    lienzo.width / video.videoWidth,
    lienzo.height / video.videoHeight,
  );
  const desplazamientoX = (lienzo.width - video.videoWidth * escala) / 2;
  const desplazamientoY = (lienzo.height - video.videoHeight * escala) / 2;

  const aPixeles = (punto) => ({
    x: desplazamientoX + punto.x * video.videoWidth * escala,
    y: desplazamientoY + punto.y * video.videoHeight * escala,
  });

  const grosorLinea = Math.max(3, Math.round(lienzo.width * 0.025));
  const radioPunto = Math.max(3, Math.round(lienzo.width * 0.02));

  for (const puntos of resultado.landmarks || []) {
    contexto.strokeStyle = '#00FF00';
    contexto.lineWidth = grosorLinea;
    for (const conexion of HandLandmarker.HAND_CONNECTIONS) {
      const a = aPixeles(puntos[conexion.start]);
      const b = aPixeles(puntos[conexion.end]);
      contexto.beginPath();
      contexto.moveTo(a.x, a.y);
      contexto.lineTo(b.x, b.y);
      contexto.stroke();
    }

    contexto.fillStyle = '#FF0000';
    for (const punto of puntos) {
      const { x, y } = aPixeles(punto);
      contexto.beginPath();
      contexto.arc(x, y, radioPunto, 0, 2 * Math.PI);
      contexto.fill();
    }
  }
}

/**
 * Cambia los umbrales del pellizco, como fracción del ancho del video.
 * @param {{inicio?: number, fin?: number}} nuevos
 */
export function configurarPellizco(nuevos = {}) {
  umbrales = { ...umbrales, ...nuevos };
}

/** Crea el círculo del cursor virtual dentro de #lienzo-3d. */
function crearCursor() {
  const contenedor = document.getElementById('lienzo-3d');
  if (!contenedor || cursor) return;

  cursor = document.createElement('div');
  Object.assign(cursor.style, {
    position: 'absolute',
    width: '28px',
    height: '28px',
    marginLeft: '-14px',
    marginTop: '-14px',
    borderRadius: '50%',
    border: '3px solid #FFFFFF',
    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.4)',
    pointerEvents: 'none',
    display: 'none',
    zIndex: '5',
    transition: 'transform 0.1s, background-color 0.1s',
  });
  contenedor.appendChild(cursor);
}

/**
 * Muestra el cursor en (x, y); se vuelve verde y se encoge al pellizcar.
 * @param {number} x
 * @param {number} y
 */
function mostrarCursor(x, y) {
  if (!cursor) return;

  const contenedor = cursor.parentElement;
  cursor.style.display = 'block';
  cursor.style.left = `${x * contenedor.clientWidth}px`;
  cursor.style.top = `${y * contenedor.clientHeight}px`;
  cursor.style.borderColor = pellizcando ? '#22C55E' : '#FFFFFF';
  cursor.style.backgroundColor = pellizcando ? 'rgba(34, 197, 94, 0.5)' : 'transparent';
  cursor.style.transform = pellizcando ? 'scale(0.6)' : 'scale(1)';
}

function ocultarCursor() {
  if (cursor) cursor.style.display = 'none';
}

/**
 * Distancia en píxeles del video entre el pulgar y el índice.
 * @param {Array<{x: number, y: number}>} puntos - 21 puntos de la mano
 */
function distanciaPellizco(puntos) {
  const pulgar = puntos[PUNTO_PULGAR];
  const indice = puntos[PUNTO_INDICE];
  const dx = (pulgar.x - indice.x) * video.videoWidth;
  const dy = (pulgar.y - indice.y) * video.videoHeight;
  return Math.hypot(dx, dy);
}

/**
 * Suelta el átomo si la mano se perdió más de 0.5 s, o limpia el cursor.
 * @param {number} ahora
 */
function procesarManoPerdida(ahora) {
  if (!pellizcando) {
    ocultarCursor();
    suavizado = null;
    return;
  }
  if (ahora - ultimoMomentoConMano < MS_MANO_PERDIDA) return;

  pellizcando = false;
  emit('gesto:pellizco-fin', { ...suavizado });
  emit('ui:mensaje', {
    tipo: 'aviso',
    texto: 'Perdí tu mano y solté el átomo donde estaba.',
  });
  ocultarCursor();
  suavizado = null;
}

/**
 * Detecta el pellizco con la primera mano, suaviza el índice, emite los
 * eventos gesto:pellizco-* y mueve el cursor. Usa histéresis para no parpadear.
 * @param {import('@mediapipe/tasks-vision').HandLandmarkerResult} resultado
 * @param {number} ahora
 */
function procesarPellizco(resultado, ahora) {
  const puntos = resultado.landmarks?.[0];
  if (!puntos) {
    procesarManoPerdida(ahora);
    return;
  }

  ultimoMomentoConMano = ahora;

  // La x se refleja aquí para que coincida con la vista en espejo.
  const x = 1 - puntos[PUNTO_INDICE].x;
  const y = puntos[PUNTO_INDICE].y;
  suavizado = suavizado
    ? {
        x: ALFA_SUAVIZADO * x + (1 - ALFA_SUAVIZADO) * suavizado.x,
        y: ALFA_SUAVIZADO * y + (1 - ALFA_SUAVIZADO) * suavizado.y,
      }
    : { x, y };

  const distancia = distanciaPellizco(puntos);
  const ancho = video.videoWidth;

  if (!pellizcando && distancia < umbrales.inicio * ancho) {
    pellizcando = true;
    emit('gesto:pellizco-inicio', { ...suavizado });
  } else if (pellizcando && distancia > umbrales.fin * ancho) {
    pellizcando = false;
    emit('gesto:pellizco-fin', { ...suavizado });
  } else if (pellizcando) {
    emit('gesto:pellizco-mover', { ...suavizado });
  }

  mostrarCursor(suavizado.x, suavizado.y);
}

/** Bucle de detección: un cuadro nuevo del video, una detección. */
function bucleDeteccion() {
  if (detenido) return;

  idAnimacion = requestAnimationFrame(bucleDeteccion);

  if (!video || !landmarker || video.readyState < 2) return;

  // Evita detectar dos veces el mismo cuadro (detectForVideo exige
  // marcas de tiempo crecientes y un cuadro repetido no aporta nada).
  if (video.currentTime === ultimoTiempoVideo) return;
  ultimoTiempoVideo = video.currentTime;

  const ahora = performance.now();

  try {
    const resultado = landmarker.detectForVideo(video, ahora);
    actualizarManos(resultado);
    dibujarManos(resultado);
    procesarPellizco(resultado, ahora);
    medirFPS(ahora);
  } catch (error) {
    console.warn('[gestos] No se pudo detectar en este cuadro:', error);
  }
}

/** Arranca la cámara y el detector en segundo plano. */
async function iniciarCamara() {
  try {
    stream = await pedirCamara(1280, 720);
    video.srcObject = stream;
    await video.play();
    publicarEstadoCamara('activa');

    landmarker = await crearLandmarker();
    bucleDeteccion();
  } catch (error) {
    console.error('[gestos] No se pudo iniciar la cámara:', error);
    manejarErrorCamara(error);
  }
}

/**
 * Inicia la detección de manos
 */
export async function iniciarGestos() {
  if (iniciado) return;
  iniciado = true;
  detenido = false;

  video = document.getElementById('camara-espejo');
  lienzo = document.getElementById('superposicion-mano');

  if (!video || !lienzo) {
    publicarEstadoCamara('sin-dispositivo');
    emit('ui:mensaje', {
      tipo: 'error',
      texto: 'No encontré el video ni el lienzo de la cámara en la página.',
    });
    return;
  }

  contexto = lienzo.getContext('2d');
  crearCursor();

  iniciarCamara();
}

/**
 * Detiene la detección y apaga la cámara al salir.
 */
export function detenerGestos() {
  detenido = true;
  if (pellizcando) emit('gesto:pellizco-fin', { ...suavizado });
  pellizcando = false;
  suavizado = null;
  ocultarCursor();
  cancelAnimationFrame(idAnimacion);
  detenerStream();
  if (video) video.srcObject = null;
  if (contexto && lienzo) contexto.clearRect(0, 0, lienzo.width, lienzo.height);
  ultimasManos = [];
  ultimoNumeroManos = -1;
  iniciado = false;
}

/**
 * Devuelve las manos detectadas en el último cuadro
 */
export function obtenerManos() {
  return ultimasManos;
}