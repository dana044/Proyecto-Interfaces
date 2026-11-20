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

  if (lienzo.width !== video.videoWidth || lienzo.height !== video.videoHeight) {
    lienzo.width = video.videoWidth || lienzo.width;
    lienzo.height = video.videoHeight || lienzo.height;
  }

  contexto.clearRect(0, 0, lienzo.width, lienzo.height);

  for (const puntos of resultado.landmarks || []) {
    const aPixeles = (punto) => ({
      x: punto.x * lienzo.width,
      y: punto.y * lienzo.height,
    });

    contexto.strokeStyle = '#00FF00';
    contexto.lineWidth = 3;
    for (const [inicio, fin] of HandLandmarker.HAND_CONNECTIONS) {
      const a = aPixeles(puntos[inicio]);
      const b = aPixeles(puntos[fin]);
      contexto.beginPath();
      contexto.moveTo(a.x, a.y);
      contexto.lineTo(b.x, b.y);
      contexto.stroke();
    }

    contexto.fillStyle = '#FF0000';
    for (const punto of puntos) {
      const { x, y } = aPixeles(punto);
      contexto.beginPath();
      contexto.arc(x, y, 4, 0, 2 * Math.PI);
      contexto.fill();
    }
  }
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

  iniciarCamara();
}

/**
 * Detiene la detección y apaga la cámara al salir.
 */
export function detenerGestos() {
  detenido = true;
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
