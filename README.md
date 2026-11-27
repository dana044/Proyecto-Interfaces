# MolecuLab

MolecuLab es una aplicación web para estudiantes de secundaria que construyen
moléculas en 3D con el mouse, con gestos de la mano, por voz o escribiendo
una fórmula, y luego las ven en realidad aumentada (RA).

No tiene backend ni instalación: es un sitio estático que se publica en
GitHub Pages desde la raíz de este repositorio.

- **App:** https://dana044.github.io/Proyecto-Interfaces/
- **Moléculas en AR (celular):** https://dana044.github.io/Proyecto-Interfaces/ar-moleculas/ar.html
- **Equipo:** Dana Carmona Santamaria, Citlaly Morales Viveros y
  Stephanie Elizdeth Hernández Prieto.

## Qué se puede hacer

| Función                         | Cómo se usa                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Construir moléculas             | Panel **Átomos** (H, He, Li, Be, B, C, N, O, F, Ne), arrastrar con el mouse o con gestos; los átomos se unen por cercanía solo si ambos tienen valencia libre.                                                                                                                |
| Verificar una molécula          | Botón **Verificar molécula**, pulgar arriba (1 s) o por voz («verificar»). El sistema la identifica contra el catálogo y dice qué falta si está incompleta.                                                                                                                   |
| Modelo de Bohr                  | Panel **Átomos**: agregar o quitar protones, neutrones y electrones; el sistema identifica el elemento formado (por ejemplo, helio-4 con 2 protones, 2 neutrones y 2 electrones).                                                                                             |
| Modo reto                       | 6 retos en orden — hidrógeno, oxígeno, agua, dióxido de carbono, metano y amoníaco — con 1 estrella por reto, sugerencia del siguiente paso y pista directa tras 2 intentos fallidos.                                                                                         |
| Pizarra de fórmulas             | Botón **Pizarra**: se escribe una fórmula (`C2H6O`) o una estructura (`CH3-CH2-OH`); ofrece las moléculas del catálogo que coinciden y las agrega sin borrar lo construido.                                                                                                   |
| Gestos                          | Cámara con MediaPipe (hasta 2 manos): seleccionar, mover, girar, acercar, paleta, colocar, micrófono, eliminar, deshacer, rehacer, reto, limpiar, listo y RA. El tutorial (`js/tutorial.js`) guía los 14 gestos en orden, en 3 minutos como máximo y una sola vez por sesión. |
| Voz                             | Comandos en español y preguntas al glosario (16 términos, por ejemplo «¿qué es un protón?»). Funciona en Chrome o Edge. Ver `docs/eventos.md`.                                                                                                                                |
| Realidad aumentada en el editor | Botón **Realidad aumentada**: la molécula construida se muestra sobre la tarjeta impresa, actualizada en vivo. Ver `docs/realidad-aumentada.md`.                                                                                                                              |
| Moléculas en AR en el celular   | Página `ar-moleculas/ar.html` con las 22 moléculas del catálogo: Scene Viewer en Android y Quick Look en iPhone.                                                                                                                                                              |
| Exportar / importar             | La escena se guarda en un archivo `.json` (`moleculab-escena`, versión 1, máximo 200 KB) y se puede volver a abrir; el archivo se valida antes de tocar la escena.                                                                                                            |
| Tema claro / oscuro             | Botón de tema en el encabezado; se guarda en el navegador.                                                                                                                                                                                                                    |

## Catálogo

- **22 moléculas** en `data/moleculas.json` (versión 1.0): las 15
  originales con H, C, N y O, más dimetiléter (isómero del etanol),
  fluoruro de hidrógeno, flúor, fluorometano, hidruro de litio,
  hidruro de berilio y borano. Ver el catálogo completo en
  `docs/quimica.md`.
- **10 elementos** en el panel y en `js/elementos.js`: H, He, Li, Be, B,
  C, N, O, F y Ne. He y Ne tienen valencia 0 y no forman moléculas del
  catálogo; se usan en el modelo de Bohr. Máximo 20 átomos en escena.
- Solo hay enlaces simples (orden 1) y dobles (orden 2). Por eso no
  están en el catálogo moléculas con enlace triple, como N₂, CO,
  C₂H₂ o HCN.

## Cómo correrlo en local

No hay que compilar nada. Desde la raíz del repositorio:

```bash
python -m http.server 8000
```

Y abrir http://localhost:8000

Se necesita un servidor local (no basta con abrir `index.html` con
`file://`) porque la app carga módulos de JavaScript y
`data/moleculas.json` con `fetch`.

Para la cámara, el micrófono y la RA se necesita Chrome (navegador de
pruebas del proyecto; Firefox no es compatible por ahora con
MediaPipe y MindAR en este proyecto). La cámara se procesa en el
navegador y no se guarda nada.

## Estructura del repositorio

```
index.html                  App principal (editor 3D)
css/                        styles.css, responsive.css
js/                         Módulos de la app (ver abajo)
data/moleculas.json         Catálogo: 10 elementos y 22 moléculas
ar/                         Tarjetas/marcadores para imprimir y QR
ar-moleculas/               Página móvil: ar.html, ar.js, catalogo.json,
                            elementos.json, glb/ (22) y usdz/ (22)
docs/                       Documentación del proyecto
docs/evaluacion/            Plan de evaluación (HU-13), guion, pruebas y datos
docs/wireframes/            Wireframes de referencia (principal, tutorial,
                            reto, info, avisos)
herramientas/               Compilar el marcador .mind, probar su
                            reconocimiento y generar los modelos GLB/USDZ
pruebas/                    Prototipos y páginas de diagnóstico de RA
```

Módulos principales en `js/` (el orden de arranque está en
`js/main.js`; si un módulo falla, los demás siguen funcionando):

| Módulo                                   | Responsabilidad                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `bus.js`                                 | Bus de eventos: los módulos se avisan sin importarse entre sí.                                |
| `state.js`                               | Estado compartido: modo (libre/reto), átomos, enlaces y progreso del reto.                    |
| `scene.js`, `ejes.js`, `modelos.js`      | Escena 3D (Three.js 0.183.2), ejes y geometría de átomos y enlaces.                           |
| `atoms.js`                               | Crear, mover, enlazar y eliminar átomos; deshacer/rehacer; modelo de Bohr; exportar/importar. |
| `chemistry.js`, `molecules.js`           | Valencias, enlaces por cercanía e identificación de la molécula y su geometría real.          |
| `elementos.js`                           | Los 10 elementos: Z, valencia, masa, radio y color por grupo.                                 |
| `formulas.js`, `pizarra.js`              | Leer fórmulas y estructuras escritas y buscarlas en el catálogo.                              |
| `gestures.js`                            | Cámara y detección de manos con MediaPipe tasks-vision 0.10.20.                               |
| `voice.js`, `commands.js`, `glosario.js` | Reconocimiento y síntesis de voz, comandos y glosario.                                        |
| `tutorial.js`, `tutorial-animaciones.js` | Tutorial de gestos en 14 pasos.                                                               |
| `reto.js`                                | Modo reto: 6 retos, estrellas, intentos y tiempo.                                             |
| `ra.js`                                  | RA en el editor con MindAR 1.2.5 y la tarjeta impresa.                                        |
| `ui.js`, `io.js`                         | Interfaz, botones de respaldo, tonos, exportar/importar.                                      |

## Documentación

| Documento                               | Contenido                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `docs/quimica.md`                       | Catálogo de 22 moléculas, elementos, reglas de enlace y verificación pendiente contra el libro del curso. |
| `docs/eventos.md`                       | Contrato de eventos del bus: gestos, voz, escena, reto, interfaz y estado.                                |
| `docs/realidad-aumentada.md`            | Cómo funciona la RA (editor y página móvil), generación de modelos y marcador, y solución de problemas.   |
| `docs/evaluacion/realidad-aumentada.md` | Propuesta, decisiones, avances por etapa (0–6 cerradas, 7 pendiente) y limitaciones conocidas.            |
| `docs/guion-demo.md`                    | Guion de demostración del proyecto, con plan B si falla la cámara o la RA.                                |
| `docs/pruebas-integracion.md`           | Pruebas de integración entre módulos y con la RA.                                                         |
| `docs/evaluacion/plan.md`               | Plan de evaluación HU-13 (Stephanie Hernández Prieto): 7 tareas, piloto, métricas y SUS.                  |
| `herramientas/README.md`                | Compilar el marcador, probar su reconocimiento y generar los modelos GLB/USDZ.                            |

## Realidad aumentada: lo que hay que saber antes de la demo

- La RA del editor reconoce **una tarjeta impresa de 8 × 8 cm** y dibuja
  encima la estructura seleccionada, plana sobre la tarjeta (escala 0.3;
  1 unidad = ancho de la tarjeta). Mientras la RA está activa, la
  detección de manos se pausa, porque MindAR y MediaPipe no pueden usar
  la cámara a la vez.
- **Discrepancia pendiente de resolver (revisada el 27 de noviembre
  de 2026):** la documentación dice que el marcador definitivo es
  `ar/marcador-moleculab.mind` (tercera versión, con la paleta de
  `card.png`), pero el código todavía carga `ar/card.mind`
  (`RUTA_MARCADOR` en `js/ra.js`, con el comentario «Es el prototipo;
  se reemplazará por el definitivo de 8 × 8 cm»). Además, en las
  pruebas con el teléfono solo el marcador `card` se reconocía; la
  tercera versión de MolecuLab está pendiente de prueba. **Antes de
  una demo, imprimir ambas tarjetas, probar cuál reconoce la versión
  publicada y no cambiar el código a última hora sin probarlo.**
- La página móvil usa `model-viewer` 4.4.0. Los 22 modelos GLB abren
  en AR en Android (probado en X7 Pro y Samsung Galaxy S20 FE); el
  Quick Look de iPhone todavía no se ha probado.

## Evaluación

El plan de evaluación (HU-13) está en `docs/evaluacion/plan.md`: al
menos 3 participantes que no hayan usado MolecuLab (meta: 6), 7 tareas
cronometradas (T1–T7), una sesión piloto previa con una compañera
(pendiente de realizar) y cuestionario SUS en español. Los resultados
se registran en `docs/evaluacion/resultados.xlsx`.
