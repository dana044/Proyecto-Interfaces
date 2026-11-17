# Catálogo de moléculas y reglas químicas

**Responsable:** Citlaly Morales Viveros
**Fechas:** 14/11/2026 – 15/11/2026
**Archivos asociados:** `data/moleculas.json` (datos) y este documento (reglas y textos).

---

## Historia de usuario

> Como estudiante, quiero que el sistema conozca moléculas reales y sus reglas de enlace, para que lo que construyo sea químicamente correcto.
>
> **Alcance:** Citlaly define los datos en `data/moleculas.json` y `docs/quimica.md`; son la base de la validación (enlaces) y de la identificación de moléculas.

### Criterios de aceptación

1. Existen los elementos H, C, N y O con su valencia y color de representación.
2. El catálogo contiene al menos 6 moléculas. **Se incluyen 15** (ver la tabla de la sección 3).
3. Cada molécula define sus átomos, enlaces (orden 1 o 2), geometría y ángulo de referencia.
4. Cada molécula tiene nombre, descripción y un dato curioso de 1 o 2 frases en lenguaje de secundaria.
5. Una molécula se considera **completa** cuando cumple la definición de la sección 2.3.
6. Los datos se contrastan con el libro de texto o la fuente del curso (ver la sección 5).

---

## 1. Elementos

| Elemento  | Símbolo | Valencia | Color de representación | Código HEX |
| --------- | ------- | -------- | ----------------------- | ---------- |
| Hidrógeno | H       | 1        | Blanco                  | `#FFFFFF`  |
| Carbono   | C       | 4        | Gris oscuro             | `#404040`  |
| Nitrógeno | N       | 3        | Azul                    | `#3050F8`  |
| Oxígeno   | O       | 2        | Rojo                    | `#FF0D0D`  |

**Valencia** es el número de enlaces que un átomo puede formar. Es el dato que usa el sistema para aceptar o rechazar una unión.

---

## 2. Reglas de enlace

### 2.1 Tipos de enlace

- **Enlace simple (orden 1):** un par de electrones compartido. Se representa con un cilindro.
- **Enlace doble (orden 2):** dos pares de electrones compartidos. Se representa con dos cilindros paralelos.
- **Enlace triple:** no se incluye en esta versión del prototipo. Por eso moléculas como N₂, CO o HCN no están en el catálogo.

### 2.2 Validación al formar un enlace

Al acercar dos átomos, el sistema comprueba que **ambos** tengan valencia disponible:

- Si los dos la tienen, crea el enlace y confirma.
- Si alguno ya la completó, rechaza el enlace y explica el motivo con lenguaje sencillo.
- Repetir la unión entre la misma pareja puede convertirla en doble, siempre que ambos átomos tengan valencia libre.
- Un átomo nunca puede exceder su valencia, aunque dos acciones ocurran casi al mismo tiempo.

### 2.3 Definición de «molécula completa»

Una molécula es **completa** cuando se cumplen dos condiciones:

1. **Todos sus átomos tienen la valencia llena.** La suma de los órdenes de enlace de cada átomo es igual a su valencia.
2. **Forma un solo grupo conectado.** Desde cualquier átomo se puede llegar a todos los demás siguiendo enlaces.

Si la molécula está incompleta, el sistema indica qué átomo o enlace falta.

**Ejemplo:** en el agua (H₂O), el oxígeno tiene dos enlaces sencillos (1 + 1 = 2, su valencia) y cada hidrógeno tiene uno (1, su valencia). Todos los átomos están conectados. Es una molécula completa.

---

## 3. Catálogo de moléculas

| #   | Nombre                | Fórmula | Geometría                                     | Ángulo de referencia | Enlaces                                 |
| --- | --------------------- | ------- | --------------------------------------------- | -------------------- | --------------------------------------- |
| 1   | Hidrógeno             | H₂      | Lineal                                        | 180°                 | 1 simple                                |
| 2   | Oxígeno               | O₂      | Lineal                                        | 180°                 | 1 doble                                 |
| 3   | Agua                  | H₂O     | Angular                                       | 104.5°               | 2 simples                               |
| 4   | Dióxido de carbono    | CO₂     | Lineal                                        | 180°                 | 2 dobles                                |
| 5   | Metano                | CH₄     | Tetraédrica                                   | 109.5°               | 4 simples                               |
| 6   | Amoníaco              | NH₃     | Piramidal                                     | 107°                 | 3 simples                               |
| 7   | Metanol               | CH₃OH   | Tetraédrica (en C)                            | C–O–H ≈ 108.5°       | 4 simples + 1 simple O–H                |
| 8   | Etanol                | C₂H₆O   | Tetraédrica (en C)                            | C–O–H ≈ 108.5°       | 7 simples (incluye C–C)                 |
| 9   | Etileno               | C₂H₄    | Trigonal plana                                | H–C–H ≈ 120°         | 1 doble C=C + 4 simples C–H             |
| 10  | Peróxido de hidrógeno | H₂O₂    | No lineal                                     | H–O–O ≈ 94.8°        | 3 simples                               |
| 11  | Formaldehído          | CH₂O    | Trigonal plana                                | H–C–H ≈ 116°         | 1 doble C=O + 2 simples C–H             |
| 12  | Ácido acético         | C₂H₄O₂  | Tetraédrica (en C) y trigonal plana (en COOH) | O=C–O ≈ 120°         | 1 C–C, 3 C–H, 1 doble C=O, 1 C–O, 1 O–H |
| 13  | Acetona               | C₃H₆O   | Trigonal plana (en C central)                 | C–C–C ≈ 117°         | 2 C–C, 6 C–H, 1 doble C=O               |
| 14  | Urea                  | CH₄N₂O  | Trigonal plana (en C central)                 | N–C–N ≈ 116°         | 1 doble C=O, 2 C–N, 4 N–H               |
| 15  | Ácido metanoico       | HCOOH   | Trigonal plana (en C)                         | C–O–H ≈ 106°         | 1 doble C=O, 1 C–O, 1 C–H, 1 O–H        |

### Textos de cada molécula

**1. Hidrógeno (H₂)**
Es el gas más ligero que existe. Está formado por dos átomos de hidrógeno unidos por un enlace sencillo.
_Dato curioso:_ El hidrógeno es el elemento más abundante del universo, aunque en la Tierra casi siempre se encuentra unido a otros átomos, como en el agua.

**2. Oxígeno (O₂)**
Es el gas que respiramos. Sus dos átomos están unidos por un enlace doble, que es muy estable.
_Dato curioso:_ El oxígeno forma cerca de una quinta parte (21 %) del aire que respiramos.

**3. Agua (H₂O)**
Es la molécula que más abunda en la superficie de la Tierra y es indispensable para la vida. Tiene forma de «V».
_Dato curioso:_ El agua es una molécula polar: el oxígeno atrae con más fuerza los electrones, por eso puede disolver muchas sustancias.

**4. Dióxido de carbono (CO₂)**
Es un gas que producimos al respirar y que las plantas usan para fabricar su alimento. Tiene dos enlaces dobles, uno a cada lado del carbono.
_Dato curioso:_ El hielo seco, que se usa para crear efecto de humo en espectáculos, es dióxido de carbono sólido.

**5. Metano (CH₄)**
Es el principal componente del gas natural que se usa en las estufas. Tiene cuatro enlaces sencillos que apuntan a las esquinas de un tetraedro.
_Dato curioso:_ El metano también se forma de manera natural en pantanos y en el sistema digestivo de algunos animales, como las vacas.

**6. Amoníaco (NH₃)**
Es un gas de olor muy penetrante. Tiene tres enlaces sencillos y un par de electrones libre que empuja a los hidrógenos formando una pirámide.
_Dato curioso:_ Gran parte de los fertilizantes que se usan en la agricultura se fabrican a partir de amoníaco.

**7. Metanol (CH₃OH)**
Es el alcohol más sencillo. Se parece al metano, pero uno de sus hidrógenos está sustituido por un grupo OH (oxígeno unido a hidrógeno).
_Dato curioso:_ Se llama también «alcohol de madera» porque antiguamente se obtenía al calentar madera. Es tóxico y nunca debe ingerirse.

**8. Etanol (C₂H₆O)**
Es el alcohol de las bebidas alcohólicas y también se usa como desinfectante. Tiene dos carbonos unidos por un enlace sencillo y un grupo OH al final.
_Dato curioso:_ Su fórmula también se escribe C₂H₅OH, porque el grupo OH está al final de la cadena de carbonos.

**9. Etileno (C₂H₄)**
Es el hidrocarburo más sencillo con un enlace doble entre carbonos. Todos sus átomos están en un mismo plano.
_Dato curioso:_ Es una hormona vegetal: las frutas como el plátano y el jitomate producen etileno y lo usan para madurar.

**10. Peróxido de hidrógeno (H₂O₂)**
Es un líquido que se descompone con facilidad. Sus dos oxígenos están unidos por un enlace sencillo y cada uno tiene un hidrógeno.
_Dato curioso:_ Diluido en agua se usa como antiséptico para limpiar heridas leves, porque libera oxígeno al descomponerse.

**11. Formaldehído (CH₂O)**
Es un gas de olor muy fuerte y picante. Tiene un enlace doble entre el carbono y el oxígeno, y dos hidrógenos unidos al carbono.
_Dato curioso:_ Disuelto en agua se conoce como formol, y se usa para conservar muestras biológicas en laboratorios.

**12. Ácido acético (C₂H₄O₂)**
Es el ácido que da el sabor agrio al vinagre. Tiene un grupo COOH al final de una cadena de dos carbonos.
_Dato curioso:_ El vinagre comercial tiene alrededor de 5 % de ácido acético en agua.

**13. Acetona (C₃H₆O)**
Es un líquido incoloro y muy volátil. Su carbono central tiene un enlace doble con el oxígeno y dos grupos CH₃ a los lados.
_Dato curioso:_ Es el principal componente de muchos quitaesmaltes y se evapora muy rápido al contacto con el aire.

**14. Urea (CH₄N₂O)**
Es una molécula con un carbono unido a dos grupos NH₂ y un oxígeno con enlace doble. Contiene nitrógeno en dos posiciones.
_Dato curioso:_ Es el principal producto de desecho del nitrógeno en la orina de los mamíferos, y también se usa como fertilizante.

**15. Ácido metanoico (HCOOH)**
Es el ácido más sencillo de todos. Tiene un carbono con un enlace doble a un oxígeno, y un grupo OH unido al otro lado.
_Dato curioso:_ Las hormigas lo usan como defensa, y por eso su picadura arde. Su nombre viene de la palabra latina para hormiga.

---

## 4. Moléculas excluidas

Estas moléculas no entran en el catálogo porque necesitan enlaces triples, que aún no están soportados:

| Molécula                   | Motivo                                 |
| -------------------------- | -------------------------------------- |
| N₂ (nitrógeno)             | Enlace triple N≡N                      |
| CO (monóxido de carbono)   | Enlace triple C≡O en su forma estándar |
| C₂H₂ (acetileno)           | Enlace triple C≡C                      |
| HCN (cianuro de hidrógeno) | Enlace triple C≡N                      |

---

## 5. Verificación de datos (pendiente)

El contexto del proyecto exige contrastar los datos con el libro de texto o la fuente del curso. Este checklist debe completarse antes de cerrar la historia:

- [ ] Geometría y ángulo de cada molécula contra el libro del curso.
- [ ] Valencias H = 1, C = 4, N = 3, O = 2 contra el libro del curso.
- [ ] Nombres y fórmulas en español de secundaria.
- [ ] Datos curiosos revisados (sin afirmaciones no verificadas).
- [ ] Fuente citada: ********\_\_******** (página o capítulo).

**Nota:** los ángulos de metanol, etanol, peróxido de hidrógeno, formaldehído, ácido acético, acetona, urea y ácido metanoico son valores de referencia aproximados. Conviene confirmarlos con la fuente del curso antes de presentarlos como datos definitivos.

---

## 6. Inconsistencias detectadas en el contexto

- La sección 15.1 y la 16 del documento de contexto dicen **seis moléculas**; la historia de Citlaly pide **mínimo 6**. Se incluyen 15, lo que cumple ambas.
- La sección 15.1 dice que el alcance incluye «enlaces simples/dobles», lo que confirma la exclusión de los triples de la sección 4.
