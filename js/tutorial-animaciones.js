/**
 * @fileoverview Animaciones del tutorial: una mano o un emoji animado por paso.
 *
 * Las manos de Girar, Micrófono y Limpiar son un dibujo SVG
 * que muestra justo los dedos de cada gesto; el resto son emojis. Las
 * clases mg-* se animan en css/styles.css, bajo .tutorial-demo. Cada
 * animación muestra cómo se hace la seña: la mano sube, baja, barre o
 * gira según el gesto. Este archivo solo trae el dibujo de cada paso;
 * no detecta manos ni mueve átomos.
 */

// Dibuja una mano con los dedos que se le piden estirados. Cada número es
// un dedo (índice, medio, anular, meñique): 1 estirado, 0 doblado.
function manoEspecial(dedos) {
  const xs = [19, 32, 45, 58], ys = [19, 8, 13, 25];
  const extendidos = dedos.map((v, i) => v ? `<rect x="${xs[i]}" y="${ys[i]}" width="14" height="${64 - ys[i]}" rx="7"/>` : '').join('');
  const doblados = dedos.map((v, i) => !v ? `<rect x="${xs[i]}" y="39" width="14" height="23" rx="7"/>` : '').join('');
  return `<svg viewBox="0 0 84 90" aria-hidden="true"><g fill="#ffcc4d" stroke="#d99e30" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${extendidos}<path d="M19 47 Q15 42 14 55 Q12 69 25 83 L61 83 Q73 71 72 53 Q72 44 62 44 L29 44Z"/>${doblados}<path d="M18 67 Q9 56 17 51 Q23 47 31 57 L44 65 Q49 72 41 76 Q32 78 18 67Z" fill="#ffd365"/></g></svg>`;
}

const mano = (emoji, clase = '') => `<span class="mg-mano ${clase}">${emoji}</span>`;

export const DEMOS = {
  agarrar: mano('☝️', 'mg-seleccionar'),
  mover: mano('🤏', 'mg-mover'),
  girar: mano(manoEspecial([1, 1, 1, 0]), 'mg-girar'),
  acercar: mano('🤏', 'mg-izquierda') + mano('🤏', 'mg-derecha'),
  paleta: mano('👍', 'mg-paleta'),
  colocar: mano('🖐️', 'mg-fase1') + mano('☝️', 'mg-fase2') + mano('🖐️', 'mg-fase3'),
  microfono: mano(manoEspecial([0, 0, 0, 1]), 'mg-subir'),
  eliminar: mano('✌️', 'mg-subir'),
  deshacer: mano('🤙', 'mg-deshacer'),
  rehacer: mano('🤙', 'mg-rehacer'),
  reto: mano('🤟', 'mg-mecer'),
  limpiar: mano(manoEspecial([1, 1, 1, 1]), 'mg-barrer'),
  listo: mano('👍', 'mg-subir'),
  ra: mano('👎', 'mg-bajar'),
  detectar: mano('🖐️', 'mg-juntar-izq') + mano('🖐️', 'mg-juntar-der'),
  puno: mano('✊', 'mg-subir'),
  crear: mano('👍', 'mg-subir') + mano('👍', 'mg-subir'),
};