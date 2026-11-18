import { emit, on } from './bus.js';
import { hablar } from './voice.js';


const elementos = new Map([
  ['hidrogeno', 'H'],
  ['hidrogenos', 'H'],
  ['carbono', 'C'],
  ['carbonos', 'C'],
  ['nitrogeno', 'N'],
  ['nitrogenos', 'N'],
  ['oxigeno', 'O'],
  ['oxigenos', 'O'],
]);

const cantidades = new Map([
  ['un', 1], ['uno', 1], ['una', 1], ['dos', 2], ['tres', 3],
  ['cuatro', 4], ['cinco', 5], ['seis', 6], ['siete', 7], ['ocho', 8],
  ['nueve', 9], ['diez', 10], ['once', 11], ['doce', 12], ['trece', 13],
  ['catorce', 14], ['quince', 15], ['dieciseis', 16], ['diecisiete', 17],
  ['dieciocho', 18], ['diecinueve', 19], ['veinte', 20],
]);

function interpretarAgregar({ texto }) {
  const frase = texto.trim().replace(/[.!?]+$/, '').trim();
  const verbo = /^(?:agrega(?:r)?|pon(?:er)?|anade|anadir)\s+/;
  const tieneVerbo = verbo.test(frase);
  const pedido = frase.replace(verbo, '');

  const coincidencia = pedido.match(
    /^(?:(\S+)\s+)?(?:atomos?\s+de\s+)?([a-z]+)$/
  );
  if (!coincidencia) return;

  const [, palabraCantidad, nombre] = coincidencia;
  const elemento = elementos.get(nombre);
  const cantidad = palabraCantidad === undefined
    ? 1
    : cantidades.get(palabraCantidad)
      ?? (/^\d+$/.test(palabraCantidad) ? Number(palabraCantidad) : NaN);

  // Una frase sin verbo solo cuenta si pide una cantidad de un elemento conocido.
  if (!tieneVerbo && (!palabraCantidad || !elemento)) return;
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) return;

  if (!elemento) {
    const aviso = 'Todavía no conozco ese elemento; puedo agregar hidrógeno, carbono, nitrógeno u oxígeno';
    emit('ui:mensaje', { tipo: 'aviso', texto: aviso });
    hablar(aviso);
    return;
  }

  emit('voz:comando', {
    intencion: 'agregar-atomo',
    parametros: { elemento, cantidad },
  });
}

export function iniciarComandos() {
  on('voz:texto', interpretarAgregar);
}