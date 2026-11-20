export const ELEMENTOS = {
    H:  { nombre: 'Hidrógeno', plural: 'hidrógenos', valencia: 1, color: 0xffffff, radio: 0.30, bordeOscuro: true },
    He: { nombre: 'Helio',    plural: 'helios',     valencia: 0, color: 0xd9ffff, radio: 0.32, bordeOscuro: true },
    Li: { nombre: 'Litio',    plural: 'litios',     valencia: 1, color: 0xcc80ff, radio: 0.49, bordeOscuro: true },
    Be: { nombre: 'Berilio',  plural: 'berilios',   valencia: 2, color: 0xc2ff00, radio: 0.46, bordeOscuro: true },
    B:  { nombre: 'Boro',     plural: 'boros',      valencia: 3, color: 0xffb5b5, radio: 0.44, bordeOscuro: true },
    C:  { nombre: 'Carbono',  plural: 'carbonos',   valencia: 4, color: 0x404040, radio: 0.45 },
    N:  { nombre: 'Nitrógeno', plural: 'nitrógenos', valencia: 3, color: 0x3050f8, radio: 0.42 },
    O:  { nombre: 'Oxígeno',  plural: 'oxígenos',   valencia: 2, color: 0xff0d0d, radio: 0.42 },
    F:  { nombre: 'Flúor',    plural: 'fluoruros',  valencia: 1, color: 0x90e050, radio: 0.39, bordeOscuro: true },
    Ne: { nombre: 'Neón',     plural: 'neones',     valencia: 0, color: 0xb3e3f5, radio: 0.37, bordeOscuro: true },
};

export const MAX_ATOMOS = 20;

export const AVISO_ELEMENTO_DESCONOCIDO =
    'Todavía no conozco ese elemento. Puedo agregar hidrógeno, helio, litio, berilio, boro, carbono, nitrógeno, oxígeno, flúor y neón.';