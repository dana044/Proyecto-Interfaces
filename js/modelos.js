/**
 * @file modelos.js
 * @description Geometría visual de MolecuLab: átomos (esfera, aro de valencia y
 * etiqueta), enlaces (cilindros) y su cálculo de posición. La usan la escena
 * principal y, más adelante, la vista de realidad aumentada, para que ambas
 * dibujen las mismas moléculas.
 * @author Citlaly Morales Viveros
 * @author Stephanie Elizdeth Hernández Prieto
 * @author Dana Carmona Santamaria
 */

import * as THREE from 'three';
import { ELEMENTOS } from './elementos.js';
import { crearAnilloValencia } from './chemistry.js';

/** Color del resaltado de selección y de arrastre. */
export const COLOR_RESALTADO = 0xfacc15;
/** Separación de los dos cilindros de un enlace doble. */
export const ALTURA_ENLACE_DOBLE = 0.16;
/** Dirección "arriba" de los cilindros al crearlos. */
export const EJE_UP = new THREE.Vector3(0, 1, 0);

/**
 * Crea la etiqueta con el símbolo del elemento. La letra es oscura
 * solo si el color de la esfera es claro; con los colores de grupo
 * actuales, todos son oscuros y la letra es blanca.
 * @param {string} simbolo Símbolo del elemento.
 * @param {number} color Color de la esfera, en hexadecimal.
 * @param {number} [escala=0.5] Tamaño de la etiqueta en la escena.
 */
export function crearEtiqueta(simbolo, color, escala = 0.5) {
    const lienzo = document.createElement('canvas');
    lienzo.width = 128;
    lienzo.height = 128;

    const rojo = (color >> 16) & 0xff;
    const verde = (color >> 8) & 0xff;
    const azul = color & 0xff;
    const luminancia = 0.2126 * rojo + 0.7152 * verde + 0.0722 * azul;
    const claro = luminancia > 180;

    const ctx = lienzo.getContext('2d');
    ctx.font = 'bold 84px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = claro ? '#202331' : '#ffffff';
    ctx.strokeStyle = claro ? '#202331' : '#000000';
    ctx.lineWidth = 6;
    ctx.strokeText(simbolo, 64, 64);
    ctx.fillText(simbolo, 64, 64);

    const material = new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(lienzo),
        depthTest: false,
    });
    const etiqueta = new THREE.Sprite(material);
    etiqueta.scale.set(escala, escala, 1);
    etiqueta.renderOrder = 2;
    return etiqueta;
}

/** Lado del plano de cada etiqueta cruzada (igual que el sprite del editor). */
const LADO_ETIQUETA_CRUZADA = 0.5;
/** Lado del lienzo que dibuja el símbolo sobre la esfera, en píxeles. */
const LADO_LIENZO_ESFERA = 512;
/** Tamaño de la letra sobre la esfera, en píxeles del lienzo. */
const FUENTE_ESFERA = 320;

/**
 * Dibuja el símbolo en un lienzo transparente. El color de la letra sigue la
 * misma regla que crearEtiqueta: blanca sobre colores oscuros y oscura sobre claros.
 * @param {string} simbolo Símbolo del elemento.
 * @param {number} color Color de la esfera, en hexadecimal.
 * @param {number} lado Lado del lienzo, en píxeles.
 * @param {number} fuente Tamaño de la letra, en píxeles.
 * @returns {THREE.CanvasTexture}
 */
function texturaSimbolo(simbolo, color, lado, fuente) {
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;

    const rojo = (color >> 16) & 0xff;
    const verde = (color >> 8) & 0xff;
    const azul = color & 0xff;
    const luminancia = 0.2126 * rojo + 0.7152 * verde + 0.0722 * azul;
    const claro = luminancia > 180;

    const ctx = lienzo.getContext('2d');
    ctx.font = `bold ${fuente}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = claro ? '#202331' : '#ffffff';
    ctx.strokeStyle = claro ? '#202331' : '#000000';
    ctx.lineWidth = lado * (6 / 128);
    ctx.strokeText(simbolo, lado / 2, lado / 2);
    ctx.fillText(simbolo, lado / 2, lado / 2);

    return new THREE.CanvasTexture(lienzo);
}

/**
 * Etiqueta cruzada: dos planos con el símbolo, centrados en el átomo y
 * con normales a 45° del eje vertical de la estructura, para que la letra
 * se vea desde arriba. Los planos son fijos: no giran con la cámara.
 * La orientación supone la estructura de la RA, con la tarjeta en el plano
 * XY y «arriba» en −Z.
 * @param {string} simbolo Símbolo del elemento.
 * @param {number} color Color de la esfera, en hexadecimal.
 * @returns {THREE.Group} Grupo con los dos planos, en el centro del átomo.
 */
export function crearEtiquetaCruzada(simbolo, color) {
    const grupo = new THREE.Group();
    grupo.name = 'etiqueta-cruzada';
    const textura = texturaSimbolo(simbolo, color, 128, 84);
    const s = Math.SQRT1_2;
    const orientaciones = [
        { derecha: new THREE.Vector3(s, -s, 0), normal: new THREE.Vector3(s, s, 0) },
        { derecha: new THREE.Vector3(s, s, 0), normal: new THREE.Vector3(-s, s, 0) },
    ];
    const arriba = new THREE.Vector3(0, 0, -1);

    for (const { derecha, normal } of orientaciones) {
        const base = new THREE.Matrix4().makeBasis(derecha, arriba, normal);
        const plano = new THREE.Mesh(
            new THREE.PlaneGeometry(LADO_ETIQUETA_CRUZADA, LADO_ETIQUETA_CRUZADA),
            new THREE.MeshBasicMaterial({
                map: textura,
                transparent: true,
                depthTest: false,
                depthWrite: false,
                side: THREE.DoubleSide,
            })
        );
        plano.quaternion.setFromRotationMatrix(base);
        plano.renderOrder = 2;
        grupo.add(plano);
    }
    return grupo;
}

/**
 * Etiqueta sobre la esfera: el símbolo impreso en una capa transparente
 * que cubre la cara de la esfera orientada hacia la cámara. La capa tiene
 * profundidad, así que los enlaces de detrás quedan tapados.
 * La textura se desplaza para que el centro del símbolo caiga en la cara
 * frontal de la esfera (uv 0.25, 0.5) y la malla se gira para que esa cara
 * mire hacia +Y de la estructura.
 * @param {string} simbolo Símbolo del elemento.
 * @param {number} color Color de la esfera, en hexadecimal.
 * @param {number} radio Radio de la esfera del átomo.
 * @returns {THREE.Mesh} Capa con el símbolo, centrada en el átomo.
 */
export function crearEtiquetaEsfera(simbolo, color, radio) {
    const textura = texturaSimbolo(simbolo, color, LADO_LIENZO_ESFERA, FUENTE_ESFERA);
    textura.offset.set(0.25, 0);
    const capa = new THREE.Mesh(
        new THREE.SphereGeometry(radio * 1.03, 64, 48),
        new THREE.MeshBasicMaterial({
            map: textura,
            transparent: true,
            depthWrite: false,
        })
    );
    capa.rotation.x = -Math.PI / 2;
    capa.renderOrder = 2;
    capa.name = 'etiqueta-esfera';
    return capa;
}

export function crearAtomoVisual(elemento) {
    const config = ELEMENTOS[elemento];
    const grupo = new THREE.Group();

    const esfera = new THREE.Mesh(
        new THREE.SphereGeometry(config.radio, 32, 24),
        new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: 0.4,
        })
    );
    grupo.add(esfera);

    // El contorno de selección empieza oculto.
    const borde = new THREE.Mesh(
        new THREE.SphereGeometry(config.radio * 1.12, 32, 24),
        new THREE.MeshBasicMaterial({
            color: COLOR_RESALTADO,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.9,
        })
    );
    borde.visible = false;
    grupo.add(borde);

    if (config.bordeOscuro) {
        const contorno = new THREE.Mesh(
            new THREE.SphereGeometry(config.radio * 1.02, 32, 24),
            new THREE.MeshBasicMaterial({
                color: 0x202331,
                wireframe: true,
                transparent: true,
                opacity: 0.25,
            })
        );
        grupo.add(contorno);
    }

    const etiqueta = crearEtiqueta(elemento, config.color);
    etiqueta.position.set(0, config.radio + 0.25, 0);
    grupo.add(etiqueta);

    // Aro de valencia (js/chemistry.js): verde si la valencia está
    // completa, gris con un punto por cada enlace que aún le queda.
    const anillo = crearAnilloValencia(config.radio, config.valencia);
    grupo.add(anillo);

    return { grupo, esfera, borde, anillo, radio: config.radio };
}

export function liberarGrupo(grupo) {
    grupo.traverse((objeto) => {
        if (objeto.geometry) objeto.geometry.dispose();
        if (objeto.material) {
            if (objeto.material.map) objeto.material.map.dispose();
            objeto.material.dispose();
        }
    });
}

/**
 * Crea la malla de un enlace: uno o dos cilindros sin posición fija. La
 * posición y la orientación se calculan después con actualizarMallaEnlace.
 * @param {number} cantidad 1 para enlace simple, 2 para doble.
 * @param {string} idA Id del primer átomo.
 * @param {string} idB Id del segundo átomo.
 * @returns {{ grupo: THREE.Group, cilindros: THREE.Mesh[] }}
 */
export function crearMallaEnlace(cantidad, idA, idB) {
    const grupo = new THREE.Group();
    grupo.userData.tipo = 'enlace';
    grupo.userData.a = idA;
    grupo.userData.b = idB;

    const material = new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        roughness: 0.6,
    });
    const cilindros = [];

    for (let i = 0; i < cantidad; i++) {
        const cilindro = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 1, 16),
            material
        );
        grupo.add(cilindro);
        cilindros.push(cilindro);
    }
    return { grupo, cilindros };
}

/**
 * Calcula la geometría de un enlace entre dos puntos, sin usar Three.js: la
 * longitud, el punto medio, la dirección y el desplazamiento de un enlace doble.
 * Es la misma fórmula que usaba actualizarEnlace, separada para poder probarla.
 * El cilindro va de centro a centro: las esferas opacas tapan sus puntas.
 * @param {{x: number, y: number, z: number}} pA Centro del primer átomo.
 * @param {{x: number, y: number, z: number}} pB Centro del segundo átomo.
 * @returns {{ longitud: number, medio: {x: number, y: number, z: number}, normal: {x: number, y: number, z: number}, desplazamiento: {x: number, y: number, z: number} }}
 */
export function calcularParametrosEnlace(pA, pB) {
    const d = { x: pB.x - pA.x, y: pB.y - pA.y, z: pB.z - pA.z };
    const longitud = Math.hypot(d.x, d.y, d.z);
    const normal = longitud === 0
        ? { x: 0, y: 0, z: 0 }
        : { x: d.x / longitud, y: d.y / longitud, z: d.z / longitud };
    const medio = {
        x: (pA.x + pB.x) / 2,
        y: (pA.y + pB.y) / 2,
        z: (pA.z + pB.z) / 2,
    };

    // Si el enlace va casi vertical, el eje de referencia cambia a X, para
    // que el desplazamiento del enlace doble no quede en cero.
    const up = { x: 0, y: 1, z: 0 };
    const alineado = Math.abs(normal.x * up.x + normal.y * up.y + normal.z * up.z) > 0.99;
    const eje = alineado ? { x: 1, y: 0, z: 0 } : up;
    const cruz = {
        x: normal.y * eje.z - normal.z * eje.y,
        y: normal.z * eje.x - normal.x * eje.z,
        z: normal.x * eje.y - normal.y * eje.x,
    };
    const largoCruz = Math.hypot(cruz.x, cruz.y, cruz.z);
    const escala = largoCruz === 0 ? 0 : ALTURA_ENLACE_DOBLE / largoCruz;
    const desplazamiento = {
        x: cruz.x * escala,
        y: cruz.y * escala,
        z: cruz.z * escala,
    };

    return { longitud, medio, normal, desplazamiento };
}

/**
 * Coloca los cilindros de un enlace entre dos átomos. Un enlace doble separa
 * sus dos cilindros a ambos lados del eje.
 * @param {{ cilindros: THREE.Mesh[] }} enlace Malla creada con crearMallaEnlace.
 * @param {THREE.Vector3} pA Centro del primer átomo.
 * @param {THREE.Vector3} pB Centro del segundo átomo.
 */
export function actualizarMallaEnlace(enlace, pA, pB) {
    const p = calcularParametrosEnlace(pA, pB);
    const medio = new THREE.Vector3(p.medio.x, p.medio.y, p.medio.z);
    const desplazamiento = new THREE.Vector3(p.desplazamiento.x, p.desplazamiento.y, p.desplazamiento.z);
    const normal = new THREE.Vector3(p.normal.x, p.normal.y, p.normal.z);
    const orientacion = new THREE.Quaternion().setFromUnitVectors(EJE_UP, normal);

    enlace.cilindros.forEach((cilindro, i) => {
        const separacion = enlace.cilindros.length === 2 ? (i === 0 ? 1 : -1) : 0;
        cilindro.position.copy(medio).addScaledVector(desplazamiento, separacion);
        cilindro.quaternion.copy(orientacion);
        cilindro.scale.set(1, p.longitud, 1);
    });
}