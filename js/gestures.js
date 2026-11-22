/**
 * @fileoverview Cámara y detección de manos con MediaPipe.
 *
 * Pide la cámara, muestra el video en espejo,
 * detecta hasta 2 manos con 21 puntos cada una, dibuja el
 * esqueleto sobre #superposicion-mano y publica cuántas manos se ven.
 *
 * Gestos (la palma abierta solo mueve el cursor):
 * - índice arriba: agarra un átomo; al bajar el índice, suelta.
 * - una mano en pinza: mueve la vista al arrastrar.
 * - dos manos en pinza que giran: rota la vista con el ángulo.
 * - dos manos en marco (pulgar e índice estirados): acerca o aleja.
 * - pulgar hacia un lado: abre o cierra la paleta de moléculas.
 * - meñique arriba: enciende o apaga el micrófono.
 * - puño cerrado: entra o sale del tablero (modo lienzo o interfaz).
 * - pulgar arriba un segundo: confirma (listo).
 *
 * @see docs/eventos.md
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { emit, on } from './bus.js';

const VERSION_TASKS_VISION = '0.10.20';
const URL_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_TASKS_VISION}/wasm`;
/** Modelo oficial de manos (float16), servido por Google. */
const URL_MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const FPS_MINIMO = 20;
const SEGUNDOS_LENTOS_ANTES_DE_BAJAR = 2;
const ANCHO_BAJA_RESOLUCION = 640;
const ALTO_BAJA_RESOLUCION = 480;
const ALFA_SUAVIZADO = 0.4;
const MS_MANO_PERDIDA = 500;
const PUNTO_INDICE = 8;
const FACTOR_DEDO_EXTENDIDO = 1.1;
const FACTOR_DEDO_PLEGADO = 1.0;
const CUADROS_PARA_SOLTAR = 3;
const PUNTO_PULGAR = 4;
const UMBRAL_PELLIZCO_AGARRAR = 0.05;
const UMBRAL_PELLIZCO_SOLTAR = 0.08;
const ZOOM_MINIMO = 0.5;
const ZOOM_MAXIMO = 3;
const CAMBIO_MINIMO_ZOOM = 0.02;
const MOVIMIENTO_MINIMO_MOVER = 0.005;
const ANGULO_MINIMO_ROTAR = 0.01;
const ANGULO_MINIMO_MARCO = Math.PI / 3;
const MS_MANTENER_LISTO = 1000;
const MS_MANTENER_PALETA = 500;
const MS_MANTENER_MICROFONO = 800;
const MS_MANTENER_CUADRO = 500;
const UMBRAL_PULGAR_LADO_X = 0.08;
const UMBRAL_PULGAR_LADO_Y = 0.05;
const UMBRAL_PULGAR_ARRIBA_Y = 0.08;

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
let agarrando = false;
let cuadrosSinIndice = 0;
let suavizado = null;
let ultimoMomentoConMano = 0;
let cursor = null;
let estadoCamara = null;
let umbralesPellizco = { agarrar: UMBRAL_PELLIZCO_AGARRAR, soltar: UMBRAL_PELLIZCO_SOLTAR };
let moverActivo = false;
let suavizadoMover = null;
let referenciaMover = null;
let rotarActivo = false;
let ultimoAnguloRotar = null;
let zoomActivo = false;
let referenciaZoom = null;
let ultimoFactorZoom = 1;
let anilloProgreso = null;
let enCanvas = true;

/**
 * Publica el estado de la cámara en el bus.
 * @param {'activa' | 'denegada' | 'sin-dispositivo'} estado
 */
function publicarEstadoCamara(estado) {
  estadoCamara = estado;
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
    contexto.strokeStyle = '#6a45c2';
    contexto.lineWidth = grosorLinea;
    for (const conexion of HandLandmarker.HAND_CONNECTIONS) {
      const a = aPixeles(puntos[conexion.start]);
      const b = aPixeles(puntos[conexion.end]);
      contexto.beginPath();
      contexto.moveTo(a.x, a.y);
      contexto.lineTo(b.x, b.y);
      contexto.stroke();
    }

    contexto.fillStyle = '#6a45c2';
    for (const punto of puntos) {
      const { x, y } = aPixeles(punto);
      contexto.beginPath();
      contexto.arc(x, y, radioPunto, 0, 2 * Math.PI);
      contexto.fill();
    }
  }
}

/**
 * El cursor es un ratón virtual que vive en toda la ventana, no solo
 * en el tablero: así puede pulsar botones y elegir moléculas.
 */
function crearCursor() {
  if (cursor) return;

  cursor = document.createElement('div');
  Object.assign(cursor.style, {
    position: 'fixed',
    width: '28px',
    height: '28px',
    marginLeft: '-14px',
    marginTop: '-14px',
    borderRadius: '50%',
    border: '3px solid #FFFFFF',
    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.4)',
    pointerEvents: 'none',
    display: 'none',
    zIndex: '9999',
    transition: 'transform 0.1s, background-color 0.1s',
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: '13px',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  });
  document.body.appendChild(cursor);
}

/**
 * Muestra el cursor en (x, y) de la ventana. En la interfaz es ámbar,
 * en el tablero es blanco y al agarrar se vuelve verde y se encoge.
 * @param {number} x
 * @param {number} y
 */
function mostrarCursor(x, y) {
  if (!cursor) return;

  cursor.style.display = 'flex';
  cursor.style.left = `${x * window.innerWidth}px`;
  cursor.style.top = `${y * window.innerHeight}px`;
  cursor.style.borderColor = !enCanvas ? '#F59E0B' : agarrando ? '#22C55E' : '#FFFFFF';
  cursor.style.backgroundColor = agarrando ? 'rgba(34, 197, 94, 0.5)' : 'transparent';
  cursor.style.transform = agarrando ? 'scale(0.6)' : 'scale(1)';
}

function ocultarCursor() {
  if (cursor) cursor.style.display = 'none';
}

/** Muestra el símbolo del elemento en la mano sobre el cursor. */
function mostrarElementoEnCursor(simbolo, color) {
  if (!cursor) return;
  cursor.textContent = simbolo || '';
  if (color) cursor.style.backgroundColor = color;
}

/** Quita el símbolo del elemento en la mano del cursor. */
function limpiarElementoEnCursor() {
  if (!cursor) return;
  cursor.textContent = '';
  cursor.style.backgroundColor = 'transparent';
}

// El átomo avisa qué elemento lleva en la mano para colocarlo.
on('cursor:elemento', ({ simbolo, color }) => {
  if (simbolo) mostrarElementoEnCursor(simbolo, color);
  else limpiarElementoEnCursor();
});

/** Crea el círculo de progreso de los gestos con espera en la ventana. */
function crearAnilloProgreso() {
  if (anilloProgreso) return;

  anilloProgreso = document.createElement('div');
  Object.assign(anilloProgreso.style, {
    position: 'fixed',
    width: '44px',
    height: '44px',
    marginLeft: '-22px',
    marginTop: '-22px',
    borderRadius: '50%',
    pointerEvents: 'none',
    display: 'none',
    zIndex: '9999',
  });
  document.body.appendChild(anilloProgreso);
}

/**
 * Muestra el círculo de progreso en (x, y) de la ventana,
 * con el avance de 0 a 1.
 * @param {number} x
 * @param {number} y
 * @param {number} avance
 */
function mostrarProgreso(x, y, avance) {
  if (!anilloProgreso) return;

  const grados = Math.round(Math.min(1, Math.max(0, avance)) * 360);
  anilloProgreso.style.display = 'block';
  anilloProgreso.style.left = `${x * window.innerWidth}px`;
  anilloProgreso.style.top = `${y * window.innerHeight}px`;
  anilloProgreso.style.background = `conic-gradient(#22C55E ${grados}deg, rgba(255, 255, 255, 0.25) ${grados}deg)`;
}

function ocultarProgreso() {
  if (anilloProgreso) anilloProgreso.style.display = 'none';
}

/**
 * Distancia en píxeles del video entre dos puntos de la mano.
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 */
function distanciaPx(a, b) {
  return Math.hypot((a.x - b.x) * video.videoWidth, (a.y - b.y) * video.videoHeight);
}

/**
 * Indica si un dedo está estirado comparando la punta con la articulación media,
 * ambas medidas desde la muñeca.
 * @param {Array<{x: number, y: number}>} puntos
 * @param {number} punta - Índice del punto de la punta
 * @param {number} articulacion - Índice de la articulación media
 */
function relacionDedo(puntos, punta, articulacion) {
  return distanciaPx(puntos[punta], puntos[0]) / distanciaPx(puntos[articulacion], puntos[0]);
}

/**
 * Ángulo en radianes entre dos dedos, medidos desde la muñeca.
 * @param {Array<{x: number, y: number}>} puntos
 * @param {number} a
 * @param {number} b
 */
function anguloEntreDedos(puntos, a, b) {
  const ax = (puntos[a].x - puntos[0].x) * video.videoWidth;
  const ay = (puntos[a].y - puntos[0].y) * video.videoHeight;
  const bx = (puntos[b].x - puntos[0].x) * video.videoWidth;
  const by = (puntos[b].y - puntos[0].y) * video.videoHeight;
  const normas = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (!normas) return 0;
  const coseno = Math.min(1, Math.max(-1, (ax * bx + ay * by) / normas));
  return Math.acos(coseno);
}

/**
 * Índice arriba: el índice estirado y los otros tres dedos plegados.
 * @param {Array<{x: number, y: number}>} puntos
 */
function esIndiceArriba(puntos) {
  return relacionDedo(puntos, 8, 6) > FACTOR_DEDO_EXTENDIDO
    && relacionDedo(puntos, 12, 10) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 16, 14) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 20, 18) < FACTOR_DEDO_PLEGADO;
}

/**
 * Pulgar arriba: el pulgar estirado y claramente por encima de la
 * muñeca, con los otros cuatro dedos plegados.
 * @param {Array<{x: number, y: number}>} puntos
 */
function esPulgarArriba(puntos) {
  return relacionDedo(puntos, 4, 3) > FACTOR_DEDO_EXTENDIDO
    && puntos[0].y - puntos[4].y > UMBRAL_PULGAR_ARRIBA_Y
    && relacionDedo(puntos, 8, 6) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 12, 10) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 16, 14) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 20, 18) < FACTOR_DEDO_PLEGADO;
}

/**
 * Pulgar hacia un lado: el pulgar estirado y casi a la altura de la
 * muñeca, con los otros cuatro dedos plegados. Sirve para abrir o
 * cerrar la paleta de moléculas.
 * @param {Array<{x: number, y: number}>} puntos
 */
function esPulgarLado(puntos) {
  const dx = puntos[PUNTO_PULGAR].x - puntos[0].x;
  const dy = puntos[PUNTO_PULGAR].y - puntos[0].y;
  return relacionDedo(puntos, 4, 3) > FACTOR_DEDO_EXTENDIDO
    && Math.abs(dx) > UMBRAL_PULGAR_LADO_X
    && Math.abs(dy) < UMBRAL_PULGAR_LADO_Y
    && relacionDedo(puntos, 8, 6) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 12, 10) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 16, 14) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 20, 18) < FACTOR_DEDO_PLEGADO;
}

/**
 * Meñique arriba: solo el meñique estirado, los demás plegados.
 * Sirve para encender o apagar el micrófono.
 * @param {Array<{x: number, y: number}>} puntos
 */
function esMeniqueArriba(puntos) {
  return relacionDedo(puntos, 20, 18) > FACTOR_DEDO_EXTENDIDO
    && relacionDedo(puntos, 4, 3) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 8, 6) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 12, 10) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 16, 14) < FACTOR_DEDO_PLEGADO;
}

/**
 * Puño cerrado: los cinco dedos plegados. Sirve para entrar
 * o salir del tablero.
 * @param {Array<{x: number, y: number}>} puntos
 */
function esPuno(puntos) {
  return relacionDedo(puntos, 4, 3) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 8, 6) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 12, 10) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 16, 14) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 20, 18) < FACTOR_DEDO_PLEGADO;
}

/**
 * Marco: pulgar e índice estirados y abiertos entre sí, con los
 * otros tres dedos plegados. El ángulo entre pulgar e índice
 * distingue el marco de un índice arriba con el pulgar suelto.
 * @param {Array<{x: number, y: number}>} puntos
 */
function esMarco(puntos) {
  return relacionDedo(puntos, 4, 3) > FACTOR_DEDO_EXTENDIDO
    && relacionDedo(puntos, 8, 6) > FACTOR_DEDO_EXTENDIDO
    && relacionDedo(puntos, 12, 10) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 16, 14) < FACTOR_DEDO_PLEGADO
    && relacionDedo(puntos, 20, 18) < FACTOR_DEDO_PLEGADO
    && anguloEntreDedos(puntos, 4, 8) > ANGULO_MINIMO_MARCO;
}

/**
 * Distancia pulgar-índice como fracción del ancho del video, o null
 * sin video o sin mano. Es el pellizco que usan mover y girar.
 * @param {Array<{x: number, y: number}>} puntos
 */
function distanciaPellizco(puntos) {
  if (!video || !video.videoWidth || !puntos) return null;
  return distanciaPx(puntos[PUNTO_PULGAR], puntos[PUNTO_INDICE]) / video.videoWidth;
}

/**
 * Centro de la mano en espejo, como promedio de sus 21 puntos.
 * @param {Array<{x: number, y: number}>} puntos
 */
function centroMano(puntos) {
  let x = 0;
  let y = 0;
  for (const punto of puntos) {
    x += punto.x;
    y += punto.y;
  }
  return { x: 1 - x / puntos.length, y: y / puntos.length };
}

/**
 * Pellizco: pulgar e índice juntos. El índice puede estar doblado,
 * pero no del todo: en un puño cerrado el índice queda bien plegado,
 * y ahí no hay pinza.
 * @param {Array<{x: number, y: number}>} puntos
 * @param {number} umbral
 */
function esPellizco(puntos, umbral) {
  const distancia = distanciaPellizco(puntos);
  return distancia !== null && distancia < umbral
    && relacionDedo(puntos, PUNTO_INDICE, 6) > FACTOR_DEDO_PLEGADO;
}

/** Distancia entre los centros de dos manos. */
function distanciaEntreCentros(a, b) {
  const centroA = centroMano(a);
  const centroB = centroMano(b);
  return Math.hypot(centroA.x - centroB.x, centroA.y - centroB.y);
}

/**
 * Mantiene un gesto el tiempo pedido y avisa una sola vez, hasta que
 * la pose se rompe. Mientras se mantiene, el círculo muestra el avance.
 * @param {number} ms
 */
function crearMantenedor(ms) {
  let inicio = 0;
  let emitido = false;
  return {
    actualizar(activo, ahora, x, y) {
      if (!activo) {
        if (inicio !== 0 || emitido) {
          inicio = 0;
          emitido = false;
          ocultarProgreso();
        }
        return false;
      }
      if (emitido) return false;
      if (inicio === 0) {
        inicio = ahora;
        return false;
      }
      if (ahora - inicio >= ms) {
        emitido = true;
        inicio = 0;
        ocultarProgreso();
        return true;
      }
      mostrarProgreso(x, y, (ahora - inicio) / ms);
      return false;
    },
    reiniciar() {
      inicio = 0;
      emitido = false;
    },
  };
}

const mantenedorListo = crearMantenedor(MS_MANTENER_LISTO);
const mantenedorPaleta = crearMantenedor(MS_MANTENER_PALETA);
const mantenedorMicrofono = crearMantenedor(MS_MANTENER_MICROFONO);
const mantenedorCuadro = crearMantenedor(MS_MANTENER_CUADRO);

/**
 * Pulgar arriba un segundo: emite gesto:listo.
 * @param {Array<{x: number, y: number}>} puntos
 * @param {number} ahora
 */
function procesarListo(puntos, ahora) {
  if (mantenedorListo.actualizar(
    esPulgarArriba(puntos),
    ahora,
    1 - puntos[PUNTO_PULGAR].x,
    puntos[PUNTO_PULGAR].y,
  )) emit('gesto:listo');
}

/**
 * Pulgar hacia un lado medio segundo: emite gesto:paleta.
 * @param {Array<{x: number, y: number}>} puntos
 * @param {number} ahora
 */
function procesarPaleta(puntos, ahora) {
  if (mantenedorPaleta.actualizar(
    esPulgarLado(puntos),
    ahora,
    1 - puntos[PUNTO_PULGAR].x,
    puntos[PUNTO_PULGAR].y,
  )) emit('gesto:paleta');
}

/**
 * Meñique arriba un instante: emite gesto:microfono.
 * @param {Array<{x: number, y: number}>} puntos
 * @param {number} ahora
 */
function procesarMicrofono(puntos, ahora) {
  if (mantenedorMicrofono.actualizar(
    esMeniqueArriba(puntos),
    ahora,
    1 - puntos[20].x,
    puntos[20].y,
  )) emit('gesto:microfono');
}

/**
 * Puño cerrado medio segundo: entra o sale del tablero.
 * @param {Array<{x: number, y: number}>} puntos
 * @param {number} ahora
 */
function procesarCanvas(puntos, ahora) {
  const centro = centroMano(puntos);
  if (mantenedorCuadro.actualizar(esPuno(puntos), ahora, centro.x, centro.y)) {
    cambiarModoCanvas(!enCanvas);
  }
}

/**
 * Una mano en pinza arrastrando: emite gesto:mover con el
 * desplazamiento del índice. Mientras se agarra un átomo no mueve
 * la vista. Con dos pinzas es girar, no mover.
 * @param {import('@mediapipe/tasks-vision').HandLandmarkerResult} resultado
 */
function procesarMover(resultado) {
  const manos = resultado.landmarks || [];
  const umbral = moverActivo ? umbralesPellizco.soltar : umbralesPellizco.agarrar;
  const pinchan = manos.filter((puntos) => esPellizco(puntos, umbral));

  if (agarrando || pinchan.length !== 1) {
    moverActivo = false;
    suavizadoMover = null;
    referenciaMover = null;
    return;
  }

  const puntos = pinchan[0];
  const x = 1 - puntos[PUNTO_INDICE].x;
  const y = puntos[PUNTO_INDICE].y;
  suavizadoMover = suavizadoMover
    ? {
      x: ALFA_SUAVIZADO * x + (1 - ALFA_SUAVIZADO) * suavizadoMover.x,
      y: ALFA_SUAVIZADO * y + (1 - ALFA_SUAVIZADO) * suavizadoMover.y,
    }
    : { x, y };

  if (!moverActivo || !referenciaMover) {
    moverActivo = true;
    referenciaMover = { ...suavizadoMover };
    return;
  }

  const dx = suavizadoMover.x - referenciaMover.x;
  const dy = suavizadoMover.y - referenciaMover.y;
  referenciaMover = { ...suavizadoMover };
  if (Math.hypot(dx, dy) < MOVIMIENTO_MINIMO_MOVER) return;
  emit('gesto:mover', { dx, dy });
}

/**
 * Dos manos en pinza que giran alrededor del centro entre ellas:
 * emite gesto:rotar con el cambio de ángulo. Al soltar una pinza,
 * termina la rotación. El dx es la fracción de vuelta (0.5 = media).
 * @param {import('@mediapipe/tasks-vision').HandLandmarkerResult} resultado
 */
function procesarRotar(resultado) {
  const manos = resultado.landmarks || [];
  const umbral = rotarActivo ? umbralesPellizco.soltar : umbralesPellizco.agarrar;
  const pinchan = manos.length >= 2
    && esPellizco(manos[0], umbral)
    && esPellizco(manos[1], umbral);

  if (!pinchan) {
    rotarActivo = false;
    ultimoAnguloRotar = null;
    return;
  }

  const centroA = centroMano(manos[0]);
  const centroB = centroMano(manos[1]);
  const angulo = Math.atan2(centroB.y - centroA.y, centroB.x - centroA.x);

  if (!rotarActivo || ultimoAnguloRotar === null) {
    rotarActivo = true;
    ultimoAnguloRotar = angulo;
    return;
  }

  let delta = angulo - ultimoAnguloRotar;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  ultimoAnguloRotar = angulo;
  if (Math.abs(delta) < ANGULO_MINIMO_ROTAR) return;
  emit('gesto:rotar', { dx: delta / (2 * Math.PI), dy: 0 });
}

/**
 * Dos manos en marco: emite gesto:zoom con el factor de cambio
 * desde que se formó el marco, entre 0.5 y 3. Solo emite cuando
 * el factor cambia lo suficiente.
 * @param {import('@mediapipe/tasks-vision').HandLandmarkerResult} resultado
 */
function procesarZoom(resultado) {
  const manos = resultado.landmarks || [];
  const enmarcan = manos.length >= 2
    && esMarco(manos[0])
    && esMarco(manos[1]);

  if (!enmarcan) {
    zoomActivo = false;
    referenciaZoom = null;
    ultimoFactorZoom = 1;
    return;
  }

  const distancia = distanciaEntreCentros(manos[0], manos[1]);
  if (!zoomActivo) {
    zoomActivo = true;
    referenciaZoom = distancia;
    ultimoFactorZoom = 1;
    return;
  }
  if (!referenciaZoom) return;

  const factor = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, distancia / referenciaZoom));
  if (Math.abs(factor - ultimoFactorZoom) < CAMBIO_MINIMO_ZOOM) return;
  ultimoFactorZoom = factor;
  emit('gesto:zoom', { factor });
}

/**
 * Suelta el átomo si la mano se perdió más de 0.5 s, o limpia el cursor.
 * @param {number} ahora
 */
function procesarManoPerdida(ahora) {
  cuadrosSinIndice = 0;
  moverActivo = false;
  suavizadoMover = null;
  referenciaMover = null;
  rotarActivo = false;
  ultimoAnguloRotar = null;
  zoomActivo = false;
  referenciaZoom = null;
  ultimoFactorZoom = 1;
  mantenedorListo.reiniciar();
  mantenedorPaleta.reiniciar();
  mantenedorMicrofono.reiniciar();
  mantenedorCuadro.reiniciar();
  ocultarProgreso();
  if (!agarrando) {
    ocultarCursor();
    suavizado = null;
    return;
  }
  if (ahora - ultimoMomentoConMano < MS_MANO_PERDIDA) return;

  agarrando = false;
  emit('gesto:pellizco-fin', { ...suavizado });
  emit('ui:mensaje', {
    tipo: 'aviso',
    texto: 'Perdí tu mano y solté el átomo donde estaba.',
  });
  ocultarCursor();
  suavizado = null;
}

/**
 * Agarra con índice arriba, mueve con la punta del índice y suelta
 * al bajar el índice 3 cuadros. La palma abierta solo mueve el
 * cursor. Emite los eventos gesto:pellizco-* que escucha atoms.js.
 * @param {import('@mediapipe/tasks-vision').HandLandmarkerResult} resultado
 * @param {number} ahora
 */
function procesarAgarre(resultado, ahora) {
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

  cuadrosSinIndice = agarrando && !esIndiceArriba(puntos) ? cuadrosSinIndice + 1 : 0;

  // Con el pulgar junto al índice es un pellizco, no un agarre;
  // con pulgar e índice abiertos es un marco, tampoco.
  const pellizcando = esPellizco(puntos, umbralesPellizco.soltar);
  const enmarcando = esMarco(puntos);

  if (agarrando && cuadrosSinIndice >= CUADROS_PARA_SOLTAR) {
    agarrando = false;
    cuadrosSinIndice = 0;
    emit('gesto:pellizco-fin', { ...suavizado });
  } else if (!agarrando && esIndiceArriba(puntos) && !pellizcando && !enmarcando) {
    agarrando = true;
    emit('gesto:pellizco-inicio', { ...suavizado });
  } else if (agarrando && esIndiceArriba(puntos)) {
    emit('gesto:pellizco-mover', { ...suavizado });
  }

  procesarListo(puntos, ahora);
  procesarPaleta(puntos, ahora);
  procesarMicrofono(puntos, ahora);
  procesarCanvas(puntos, ahora);
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
    procesarAgarre(resultado, ahora);
    procesarMover(resultado);
    procesarRotar(resultado);
    procesarZoom(resultado);
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
  crearAnilloProgreso();

  iniciarCamara();
}

/**
 * Detiene la detección y apaga la cámara al salir.
 */
export function detenerGestos() {
  detenido = true;
  if (agarrando) emit('gesto:pellizco-fin', { ...suavizado });
  agarrando = false;
  cuadrosSinIndice = 0;
  suavizado = null;
  moverActivo = false;
  suavizadoMover = null;
  referenciaMover = null;
  rotarActivo = false;
  ultimoAnguloRotar = null;
  zoomActivo = false;
  referenciaZoom = null;
  ultimoFactorZoom = 1;
  mantenedorListo.reiniciar();
  mantenedorPaleta.reiniciar();
  mantenedorMicrofono.reiniciar();
  mantenedorCuadro.reiniciar();
  ocultarCursor();
  limpiarElementoEnCursor();
  ocultarProgreso();
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

/** Devuelve el estado actual de la cámara, o null si aún no se sabe. */
export function obtenerEstadoCamara() {
  return estadoCamara;
}

/** Devuelve true si el cursor está dentro del tablero. */
export function estaEnCanvas() {
  return enCanvas;
}

/**
 * Cambia el modo del cursor: dentro del tablero los gestos mueven
 * la molécula; fuera, el cursor pulsa la interfaz. No hace nada
 * si ya se está en ese modo.
 * @param {boolean} dentro
 */
export function cambiarModoCanvas(dentro) {
  if (enCanvas === dentro) return;
  enCanvas = dentro;
  emit('gesto:canvas', { dentro });
  emit('ui:mensaje', {
    tipo: 'aviso',
    texto: dentro
      ? 'Estás en el tablero. Los gestos mueven la molécula.'
      : 'Estás en la interfaz. El cursor puede pulsar botones.',
  });
}

/**
 * Cambia los umbrales del pellizco, como fracción del ancho del video.
 * @param {{agarrar?: number, soltar?: number}} nuevos
 */
export function configurarPellizco(nuevos = {}) {
  umbralesPellizco = { ...umbralesPellizco, ...nuevos };
}

/** Devuelve los umbrales actuales del pellizco. */
export function obtenerUmbralesPellizco() {
  return { ...umbralesPellizco };
}

/**
 * Distancia pulgar-índice de la primera mano, como fracción del ancho
 * del video, o null si no hay mano. La usa el tutorial para calibrar.
 */
export function obtenerDistanciaPellizco() {
  const puntos = ultimasManos[0]?.puntos;
  if (!puntos) return null;
  return distanciaPellizco(puntos);
}