# Pruebas de integración de MolecuLab

Pruebas entre módulos y con la realidad aumentada. No hay un
ejecutor de pruebas en el repositorio (no hay carpeta de tests ni
script de test en la raíz): estas pruebas son manuales, salvo las
comprobaciones automáticas de RA que se citan en la sección 4, que
usan dobles de MindAR, Three.js, la cámara y el editor en un DOM
simulado (jsdom).

**Cómo usar este documento:** antes de una demo o de una sesión de
evaluación, recorrer las secciones 1–3 en orden. Anotar el resultado
de cada prueba como **Pasa / Falla / No aplicada**, con la fecha, la
versión (commit) y el navegador. Un fallo en la sección 1 bloquea
la demo; un fallo en la 2 o la 3 se registra y se usa el plan B de
`docs/guion-demo.md`.

## 1. Arranque y módulos (`js/main.js`)

La app arranca los módulos en este orden: interfaz, bus, estado,
escena, ejes, modelo de Bohr, arrastre de átomos, química, gestos,
realidad aumentada, comandos de átomos, tutorial, exportar/importar,
pizarra, reto, comandos de voz y voz. Si un módulo falla, los demás
siguen funcionando y se muestra un mensaje de error.

| #   | Prueba                                                                      | Resultado esperado                                                                                                        |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Abrir la app en Chrome (local con `python -m http.server 8000` o publicada) | Carga la escena 3D, el panel de átomos con los 10 elementos y la barra de respaldo; sin errores que bloqueen la pantalla. |
| 1.2 | Abrir sin cámara (denegar el permiso)                                       | La app sigue funcionando con mouse y teclado; el tutorial se salta con el aviso «Sin cámara, el tutorial se saltó».       |
| 1.3 | Abrir sin micrófono                                                         | La app sigue funcionando; los comandos de voz muestran el aviso de compatibilidad (Chrome o Edge).                        |

## 2. Flujos entre módulos (bus de eventos)

El contrato completo está en `docs/eventos.md`. Estas pruebas
recorren los flujos que cruzan más de un módulo.

| #    | Prueba                                                                                                                  | Resultado esperado                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | Agregar un oxígeno desde el panel y dos hidrógenos, unirlos por cercanía                                                | Se emite `escena:enlace-creado` por cada unión; el anillo de valencia del oxígeno se completa y **Verificar molécula** identifica agua (H₂O). |
| 2.2  | Intentar un enlace sin valencia libre                                                                                   | Se emite `escena:enlace-rechazado` con el motivo en lenguaje sencillo y no se crea el enlace.                                                 |
| 2.3  | Repetir la unión entre la misma pareja (O₂, CO₂)                                                                        | El enlace simple se convierte en doble, si ambos átomos tienen valencia libre.                                                                |
| 2.4  | Deshacer (Ctrl+Z) y rehacer (Ctrl+Y) tras agregar y enlazar                                                             | La escena vuelve al estado anterior y luego al posterior; la RA y el modo reto se actualizan con `escena:reconstruir`.                        |
| 2.5  | Limpiar la escena                                                                                                       | Se emite `escena:escena-limpia`; se borran átomos, enlaces y partículas, y la RA muestra el mensaje de escena vacía.                          |
| 2.6  | Exportar la escena e importarla en una pestaña vacía                                                                    | El archivo `.json` (`moleculab-escena`, v1) se guarda con átomos, posiciones y enlaces; al importar, la escena queda igual.                   |
| 2.7  | Importar un archivo que no es de MolecuLab, con ids repetidos o con un átomo sin valencia posible                       | La importación se rechaza con un mensaje y la escena no cambia.                                                                               |
| 2.8  | Pizarra: escribir `C2H6O`                                                                                               | Ofrece etanol y dimetiléter (misma fórmula, distinta estructura); al elegir una, se agrega sin borrar lo construido.                          |
| 2.9  | Pizarra: escribir `CH3-CH2-OH`                                                                                          | Construye la estructura y completa los hidrógenos que faltan para cumplir la valencia.                                                        |
| 2.10 | Modo reto: entrar, construir H₂ y verificar                                                                             | Se gana 1 estrella, se pasa al reto 2 (oxígeno) y la escena se limpia para el reto nuevo.                                                     |
| 2.11 | Modo reto: 2 intentos fallidos                                                                                          | La pista pasa a ser directa (la receta completa del reto).                                                                                    |
| 2.12 | Modelo de Bohr: 2 protones, 2 neutrones y 2 electrones                                                                  | El sistema identifica helio (He, Z = 2) y los contadores muestran 2/2/2.                                                                      |
| 2.13 | Voz: «agrega oxígeno», «unir dos hidrógenos», «crea agua», «verificar»                                                  | Cada comando ejecuta su acción; «¿qué es un protón?» muestra y lee la definición del glosario.                                                |
| 2.14 | Voz: «limpiar» y luego «no»                                                                                             | No se borra nada (la limpieza por voz pide confirmación).                                                                                     |
| 2.15 | Gestos (con cámara): seleccionar, mover, girar, acercar, paleta, eliminar, deshacer, rehacer, reto, limpiar, listo y RA | Cada gesto emite su evento `gesto:*` y ejecuta la acción; el tutorial marca cada paso solo cuando se reconoce el gesto que toca.              |

## 3. Realidad aumentada

### 3.1 RA en el editor

| #   | Prueba                                                    | Resultado esperado                                                                                        |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 3.1 | Activar la RA con una molécula construida                 | Se pausa la detección de manos, se pide la cámara trasera y la molécula aparece plana sobre la tarjeta.   |
| 3.2 | Mover un átomo en el editor con la RA activa              | Solo se actualiza ese átomo, sus enlaces y sus anillos de valencia, sin redibujar toda la estructura.     |
| 3.3 | Unir dos estructuras o separar una                        | La selección sigue al átomo ancla; si el ancla se elimina, se elige la estructura más grande.             |
| 3.4 | Cambiar de estructura en el selector y pulsar **Centrar** | La estructura elegida se centra en el origen de la tarjeta.                                               |
| 3.5 | Escena vacía con la RA activa                             | Aparece el mensaje «Agrega átomos en el editor para verlos aquí».                                         |
| 3.6 | Denegar la cámara al activar la RA                        | La RA se apaga sola, el editor queda como estaba y aparece un aviso con la alternativa (mouse o teclado). |
| 3.7 | Salir de la RA                                            | Se liberan las pistas de la cámara y se reanuda la detección de manos.                                    |

⚠️ **Antes de probar 3.1, leer la discrepancia del marcador:** el
código carga `ar/card.mind` (`js/ra.js`) y la documentación dice que
el definitivo es `ar/marcador-moleculab.mind`, pendiente de prueba
con el teléfono. Probar con ambas tarjetas impresas a 8 × 8 cm y
anotar cuál reconoce la versión probada. Ver
`docs/evaluacion/realidad-aumentada.md`, secciones 2 y 5.

### 3.2 Página móvil (`ar-moleculas/`)

| #    | Prueba                                             | Resultado esperado                                                                                                                                          |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.8  | Abrir `ar-moleculas/ar.html` en Android con Chrome | El selector muestra las 22 moléculas; al elegir una, cambian el modelo GLB, el nombre, la fórmula, el subtítulo de composición y las tarjetas de elementos. |
| 3.9  | Tocar el botón de AR en Android                    | Se abre Scene Viewer con la molécula sobre la mesa.                                                                                                         |
| 3.10 | Abrir la página en iPhone con Safari               | Se abre Quick Look con el archivo USDZ. **Sin probar todavía: registrar el resultado la primera vez que se haga.**                                          |
| 3.11 | Escanear el QR del panel de información            | Abre `https://dana044.github.io/Proyecto-Interfaces/ar-moleculas/ar.html`. Si la dirección cambió, hay que generar el QR de nuevo.                          |

## 4. Comprobaciones automáticas de RA (reportadas)

Según `docs/evaluacion/realidad-aumentada.md`, sección 5, las
comprobaciones automáticas de RA usan dobles de MindAR, Three.js, la
cámara y el editor en un DOM simulado (jsdom). No reemplazan la
prueba con cámara real.

| Etapa                                    | Comprobaciones | Resultado reportado                                          |
| ---------------------------------------- | -------------- | ------------------------------------------------------------ |
| 2 — Modo RA dentro de MolecuLab          | 38             | Pasan (encender, vistas, apagar, cámara denegada).           |
| 3 — Estructura viva                      | 19             | Pasan (alta, movimiento, enlaces, reconstrucción, limpieza). |
| 4 — Selección de estructuras (corregida) | 24             | Pasan (grupos, selección, unión, separación, centrado).      |

Además, la geometría real de `js/molecules.js` se verificó sobre
las 22 moléculas del catálogo: todos los átomos reciben una posición
válida.

**Estado al revisar el 27 de noviembre de 2026:** en el repositorio
no hay una carpeta de tests ni un script que ejecute estas
comprobaciones, así que no se pudieron volver a correr en esta
revisión. Si se quieren repetir, hay que localizar el archivo o el
procedimiento con el que se ejecutaron y documentarlo aquí.

## 5. Qué registrar

Por cada pasada de pruebas, anotar:

- Fecha, commit (`git log -1 --oneline`) y URL o puerto local.
- Navegador y versión, dispositivo (laptop/celular, modelo y Android).
- Tarjeta usada en RA (`card` o `marcador-moleculab`) y tamaño real
  de impresión.
- Resultado por prueba: Pasa / Falla / No aplicada, y el error exacto
  que mostró la app o la consola si falló.
