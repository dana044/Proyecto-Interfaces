/**
 * @file elementos.js
 * @description Elementos del 1 al 10 con su valencia, radio y color.
 * El color de la esfera es el color de su grupo en la tabla periódica,
 * no el color estándar de cada elemento: todos los elementos de un
 * mismo grupo comparten color. Los grupos presentes son metales
 * alcalinos, metales alcalinotérreos, metaloides, no metales
 * reactivos y gases nobles.
 * @author Citlaly Morales Viveros
 */

/**
 * Color por grupo en la tabla periódica, tomado de los colores de
 * la tabla de referencia del equipo.
 */
export const GRUPOS = {
    'Metales alcalinos': { color: 0xc2414f },
    'Metales alcalinotérreos': { color: 0xd97706 },
    Metaloides: { color: 0x92600f },
    'No metales reactivos': { color: 0x2563eb },
    'Gases nobles': { color: 0xb4537a },
};

export const ELEMENTOS = {
    H: { nombre: 'Hidrógeno', plural: 'hidrógenos', valencia: 1, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, radio: 0.30 },
    He: { nombre: 'Helio', plural: 'helios', valencia: 0, grupo: 'Gases nobles', color: GRUPOS['Gases nobles'].color, radio: 0.32 },
    Li: { nombre: 'Litio', plural: 'litios', valencia: 1, grupo: 'Metales alcalinos', color: GRUPOS['Metales alcalinos'].color, radio: 0.49 },
    Be: { nombre: 'Berilio', plural: 'berilios', valencia: 2, grupo: 'Metales alcalinotérreos', color: GRUPOS['Metales alcalinotérreos'].color, radio: 0.46 },
    B: { nombre: 'Boro', plural: 'boros', valencia: 3, grupo: 'Metaloides', color: GRUPOS.Metaloides.color, radio: 0.44 },
    C: { nombre: 'Carbono', plural: 'carbonos', valencia: 4, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, radio: 0.45 },
    N: { nombre: 'Nitrógeno', plural: 'nitrógenos', valencia: 3, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, radio: 0.42 },
    O: { nombre: 'Oxígeno', plural: 'oxígenos', valencia: 2, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, radio: 0.42 },
    F: { nombre: 'Flúor', plural: 'fluoruros', valencia: 1, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, radio: 0.39 },
    Ne: { nombre: 'Neón', plural: 'neones', valencia: 0, grupo: 'Gases nobles', color: GRUPOS['Gases nobles'].color, radio: 0.37 },
};

export const MAX_ATOMOS = 20;

export const AVISO_ELEMENTO_DESCONOCIDO =
    'Todavía no conozco ese elemento. Puedo agregar hidrógeno, helio, litio, berilio, boro, carbono, nitrógeno, oxígeno, flúor y neón.';
