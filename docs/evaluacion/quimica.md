# Química para la evaluación (HU-13)

> **Nota (27 de noviembre de 2026):** este archivo contenía una copia
> del contrato de eventos. Se reemplazó por el resumen de química que
> necesita la evaluación. El catálogo completo, con los textos de cada
> molécula y las reglas de enlace, está en `docs/quimica.md`; los datos
> de este archivo son los de `data/moleculas.json` (versión 1.0).

## Lo que usa la evaluación

La evaluación (ver `docs/evaluacion/plan.md`) solo necesita una parte
del catálogo:

| Tarea | Qué se construye                                | Qué debe identificar el sistema       |
| ----- | ----------------------------------------------- | ------------------------------------- |
| T1    | Un átomo de oxígeno                             | Esfera con el símbolo O               |
| T3    | Dos hidrógenos unidos                           | Enlace simple entre ambos (H₂)        |
| T5–T6 | Agua: 2 H + 1 O                                 | Agua, H₂O, geometría angular (104.5°) |
| T7    | Helio-4: 2 protones, 2 neutrones y 2 electrones | Helio, He, Z = 2                      |

El modo reto, que puede mostrarse al final de la sesión, usa las 6
primeras moléculas del catálogo, en orden: hidrógeno (H₂), oxígeno
(O₂), agua (H₂O), dióxido de carbono (CO₂), metano (CH₄) y amoníaco
(NH₃).

## Elementos y valencias

| Elemento  | Símbolo | Valencia |
| --------- | ------- | -------- |
| Hidrógeno | H       | 1        |
| Carbono   | C       | 4        |
| Nitrógeno | N       | 3        |
| Oxígeno   | O       | 2        |

El editor usa 10 elementos en total (H, He, Li, Be, B, C, N, O, F y
Ne); He y Ne tienen valencia 0 y se usan en el modelo de Bohr, no en
moléculas. La valencia es el número de enlaces que un átomo puede
formar y es el dato que usa el sistema para aceptar o rechazar una
unión.

## Reglas que afectan a las tareas

- Al acercar dos átomos, el sistema comprueba que **ambos** tengan
  valencia disponible. Si alguno ya la completó, rechaza el enlace y
  explica el motivo con lenguaje sencillo.
- Repetir la unión entre la misma pareja puede convertirla en doble,
  siempre que ambos átomos tengan valencia libre.
- Una molécula es **completa** cuando todos sus átomos tienen la
  valencia llena **y** forma un solo grupo conectado. Si está
  incompleta, el sistema indica qué átomo o enlace falta.
- Solo hay enlaces simples (orden 1) y dobles (orden 2). No hay
  enlaces triples en esta versión.

## Catálogo completo (resumen)

El catálogo tiene **22 moléculas** (ver `docs/quimica.md` para la
tabla completa y los textos):

Hidrógeno (H₂), oxígeno (O₂), agua (H₂O), dióxido de carbono (CO₂),
metano (CH₄), amoníaco (NH₃), metanol (CH₃OH), etanol (C₂H₆O),
etileno (C₂H₄), peróxido de hidrógeno (H₂O₂), formaldehído (CH₂O),
ácido acético (C₂H₄O₂), acetona (C₃H₆O), urea (CH₄N₂O), ácido
metanoico (HCOOH), dimetiléter (C₂H₆O), fluoruro de hidrógeno (HF),
flúor (F₂), fluorometano (CH₃F), hidruro de litio (LiH), hidruro de
berilio (BeH₂) y borano (BH₃).

El dimetiléter es un isómero del etanol: misma fórmula (C₂H₆O),
distinta estructura. La pizarra ofrece las dos al escribir `C2H6O`.

## Verificación pendiente

Antes de cerrar la historia de química hay que contrastar geometría,
ángulos, valencias, nombres, fórmulas y datos curiosos con el libro
de texto o la fuente del curso, incluidas las 7 moléculas añadidas
después de las 15 originales. El checklist está en
`docs/quimica.md`, sección 5. Los ángulos de metanol, etanol,
peróxido de hidrógeno, formaldehído, ácido acético, acetona, urea,
ácido metanoico, dimetiléter y fluorometano son valores de referencia
aproximados.

**Pendiente de confirmar con la docente:** el documento de alcance
dice 15 moléculas con H, C, N y O, y el catálogo actual tiene 22,
con F, Li, Be y B además.
