"""Genera tomas simuladas de la tarjeta (y negativos) para probar el reconocimiento.

Uso:
    python generar-tomas.py marcador.png carpeta_salida [cantidad]

Crea 'cantidad' tomas de la tarjeta con rotación, inclinación, distintos tamaños,
luz variable, desenfoque y ruido, y tres negativos que NO deben reconocerse
(ruido, gris liso y la tarjeta en espejo).
Requiere: pip install pillow numpy
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

W, H = 640, 480


def coeficientes(origen, destino):
    """Homografía que lleva 'destino' a 'origen' (para Image.transform en modo PERSPECTIVE)."""
    filas, vector = [], []
    for (x, y), (u, v) in zip(destino, origen):
        filas.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); vector.append(u)
        filas.append([0, 0, 0, x, y, 1, -v * x, -v * y]); vector.append(v)
    return np.linalg.solve(np.array(filas, float), np.array(vector, float)).tolist()


def toma(marca, rng):
    fondo = Image.fromarray(np.clip(np.random.normal(120, 35, (H, W, 3)), 0, 255).astype(np.uint8))
    fondo = fondo.filter(ImageFilter.GaussianBlur(3))
    tam = rng.uniform(0.25, 0.70) * W
    angulo = math.radians(rng.uniform(-35, 35))
    cx, cy = rng.uniform(0.35, 0.65) * W, rng.uniform(0.35, 0.65) * H
    s = tam / 2.0
    esquinas = [(-s, -s), (s, -s), (s, s), (-s, s)]
    esquinas = [(x + rng.uniform(-0.06, 0.06) * s * 2, y + rng.uniform(-0.06, 0.06) * s * 2) for x, y in esquinas]
    destino = [(cx + x * math.cos(angulo) - y * math.sin(angulo),
                cy + x * math.sin(angulo) + y * math.cos(angulo)) for x, y in esquinas]
    origen = [(0, 0), (marca.width, 0), (marca.width, marca.height), (0, marca.height)]
    c = coeficientes(origen, destino)
    tarjeta = marca.transform((W, H), Image.PERSPECTIVE, c, Image.BICUBIC)
    mascara = marca.transform((W, H), Image.PERSPECTIVE, c, Image.NEAREST, fillcolor=0)
    mascara = mascara.convert('L').point(lambda v: 255 if v > 0 else 0)
    base = fondo.copy()
    base.paste(tarjeta, (0, 0), mascara)
    arr = np.asarray(base).astype(float) * rng.uniform(0.55, 1.25)
    arr = arr + np.random.normal(0, rng.uniform(0, 6), arr.shape)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(rng.uniform(0, 1.1)))


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    marcador, salida = sys.argv[1], sys.argv[2]
    cantidad = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    os.makedirs(salida, exist_ok=True)
    rng = random.Random(3)
    np.random.seed(3)
    marca = Image.open(marcador).convert('RGB')

    for i in range(cantidad):
        toma(marca, rng).save(os.path.join(salida, f'toma_{i:02d}.png'))

    # Negativos: no deben reconocerse.
    np.random.seed(11)
    Image.fromarray(np.random.randint(0, 255, (H, W, 3), dtype=np.uint8)).save(os.path.join(salida, 'negativo_ruido.png'))
    Image.new('RGB', (W, H), (128, 128, 128)).save(os.path.join(salida, 'negativo_gris.png'))
    espejo = ImageOps.mirror(marca.resize((360, 360)))
    lienzo = Image.new('RGB', (W, H), (60, 60, 60))
    lienzo.paste(espejo, ((W - 360) // 2, (H - 360) // 2))
    lienzo.save(os.path.join(salida, 'negativo_espejo.png'))
    print(f'Listo: {cantidad} tomas y 3 negativos en {salida}')


if __name__ == '__main__':
    main()