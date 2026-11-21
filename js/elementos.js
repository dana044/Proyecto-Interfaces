/**
 * @file elementos.js
 * @description Elementos del 1 al 10 con su número atómico (Z),
 * valencia, radio, masa aproximada y color.
 * El color de la esfera es el color de su grupo en la tabla periódica,
 * no el color estándar de cada elemento: todos los elementos de un
 * mismo grupo comparten color. El color estándar de cada elemento
 * se guarda en `colorEstandar`, como dato de referencia. Los grupos
 * presentes son metales alcalinos, metales alcalinotérreos,
 * metaloides, no metales reactivos y gases nobles.
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
    H: { nombre: 'Hidrógeno', plural: 'hidrógenos', z: 1, valencia: 1, masa: 1, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, colorEstandar: 0xffffff, radio: 0.30 },
    He: { nombre: 'Helio', plural: 'helios', z: 2, valencia: 0, masa: 4, grupo: 'Gases nobles', color: GRUPOS['Gases nobles'].color, colorEstandar: 0xd9ffff, radio: 0.32 },
    Li: { nombre: 'Litio', plural: 'litios', z: 3, valencia: 1, masa: 7, grupo: 'Metales alcalinos', color: GRUPOS['Metales alcalinos'].color, colorEstandar: 0xcc80ff, radio: 0.49 },
    Be: { nombre: 'Berilio', plural: 'berilios', z: 4, valencia: 2, masa: 9, grupo: 'Metales alcalinotérreos', color: GRUPOS['Metales alcalinotérreos'].color, colorEstandar: 0xc2ff00, radio: 0.46 },
    B: { nombre: 'Boro', plural: 'boros', z: 5, valencia: 3, masa: 11, grupo: 'Metaloides', color: GRUPOS.Metaloides.color, colorEstandar: 0xffb5b5, radio: 0.44 },
    C: { nombre: 'Carbono', plural: 'carbonos', z: 6, valencia: 4, masa: 12, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, colorEstandar: 0x404040, radio: 0.45 },
    N: { nombre: 'Nitrógeno', plural: 'nitrógenos', z: 7, valencia: 3, masa: 14, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, colorEstandar: 0x3050f8, radio: 0.42 },
    O: { nombre: 'Oxígeno', plural: 'oxígenos', z: 8, valencia: 2, masa: 16, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, colorEstandar: 0xff0d0d, radio: 0.42 },
    F: { nombre: 'Flúor', plural: 'fluoruros', z: 9, valencia: 1, masa: 19, grupo: 'No metales reactivos', color: GRUPOS['No metales reactivos'].color, colorEstandar: 0x90e050, radio: 0.39 },
    Ne: { nombre: 'Neón', plural: 'neones', z: 10, valencia: 0, masa: 20, grupo: 'Gases nobles', color: GRUPOS['Gases nobles'].color, colorEstandar: 0xb3e3f5, radio: 0.37 },
};

export const MAX_ATOMOS = 20;

export const AVISO_ELEMENTO_DESCONOCIDO =
    'Todavía no conozco ese elemento. Puedo agregar hidrógeno, helio, litio, berilio, boro, carbono, nitrógeno, oxígeno, flúor y neón.';
