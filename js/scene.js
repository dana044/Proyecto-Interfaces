/**
 * @author Citlaly Morales Viveros
 */

import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/controls/OrbitControls.js';

const COLOR_FONDO = 0xf3f4f6;
const COLOR_CUADRICULA = 0xd1d5db;
const DISTANCIA_MIN = 2;
const DISTANCIA_MAX = 15;

let contenedor = null;
let renderer = null;
let escena = null;
let camara = null;
let controles = null;
let grupoAtomos = null;
let esferaPrueba = null;
let observadorTamano = null;
let iniciado = false;

/**
 * Crea la escena 3D dentro de #lienzo-3d.
 * Devuelve true si la escena quedó lista y false si no encontró el contenedor.
 */
export async function iniciarEscena() {
    if (iniciado) return true;

    contenedor = document.getElementById('lienzo-3d');
    if (!contenedor) {
        console.error('scene.js: no se encontró el elemento #lienzo-3d');
        return false;
    }

    const ancho = contenedor.clientWidth || 800;
    const alto = contenedor.clientHeight || 600;

    escena = new THREE.Scene();
    escena.background = new THREE.Color(COLOR_FONDO);

    camara = new THREE.PerspectiveCamera(45, ancho / alto, 0.1, 100);
    camara.position.set(0, 2, 6);
    camara.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(ancho, alto);
    contenedor.appendChild(renderer.domElement);

    escena.add(new THREE.AmbientLight(0xffffff, 0.6));
    const luzDireccional = new THREE.DirectionalLight(0xffffff, 1.0);
    luzDireccional.position.set(5, 10, 7);
    escena.add(luzDireccional);

    const cuadricula = new THREE.GridHelper(20, 20, COLOR_CUADRICULA, COLOR_CUADRICULA);
    escena.add(cuadricula);

    esferaPrueba = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 16),
        new THREE.MeshStandardMaterial({ color: 0x9ca3af })
    );
    esferaPrueba.name = 'esfera-prueba';
    escena.add(esferaPrueba);

    grupoAtomos = new THREE.Group();
    grupoAtomos.name = 'atomos';
    escena.add(grupoAtomos);

    controles = new OrbitControls(camara, renderer.domElement);
    controles.enableDamping = true;
    controles.minDistance = DISTANCIA_MIN;
    controles.maxDistance = DISTANCIA_MAX;
    controles.target.set(0, 0, 0);
    controles.update();

    observadorTamano = new ResizeObserver(ajustarTamano);
    observadorTamano.observe(contenedor);

    iniciado = true;
    animar();
    return true;
}

function ajustarTamano() {
    if (!renderer || !contenedor) return;
    const ancho = contenedor.clientWidth;
    const alto = contenedor.clientHeight;
    if (ancho === 0 || alto === 0) return;

    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    renderer.setSize(ancho, alto);
}

function animar() {
    requestAnimationFrame(animar);
    controles.update();
    renderer.render(escena, camara);
}

/**
 * Gira la vista alrededor de la molécula.
 * dx y dy son desplazamientos relativos de la pantalla (valores entre 0 y 1 aprox.).
 * Un desplazamiento de 0.5 en dx equivale a media vuelta horizontal.
 */
export function rotarVista(dx, dy) {
    if (!iniciado) return;

    const desplazamiento = new THREE.Vector3().subVectors(camara.position, controles.target);
    const esferica = new THREE.Spherical().setFromVector3(desplazamiento);

    esferica.theta -= dx * Math.PI * 2;
    esferica.phi = THREE.MathUtils.clamp(esferica.phi - dy * Math.PI, 0.05, Math.PI - 0.05);

    desplazamiento.setFromSpherical(esferica);
    camara.position.copy(controles.target).add(desplazamiento);
    camara.lookAt(controles.target);
}

/**
 * Acerca la cámara si factor es mayor que 1 y la aleja si es menor que 1.
 * Por ejemplo, factor 2 deja la cámara a la mitad de su distancia actual.
 * La distancia queda limitada entre DISTANCIA_MIN y DISTANCIA_MAX.
 */
export function acercar(factor) {
    if (!iniciado || !factor || factor <= 0) return;

    const desplazamiento = new THREE.Vector3().subVectors(camara.position, controles.target);
    const distancia = THREE.MathUtils.clamp(
        desplazamiento.length() / factor,
        DISTANCIA_MIN,
        DISTANCIA_MAX
    );
    desplazamiento.setLength(distancia);
    camara.position.copy(controles.target).add(desplazamiento);
}

/** Devuelve una copia de la lista de objetos que hay dentro del grupo de átomos. */
export function obtenerAtomos() {
    return grupoAtomos ? [...grupoAtomos.children] : [];
}

/** Devuelve el grupo donde se colocan las esferas y los cilindros de los enlaces. */
export function obtenerContenedorAtomos() {
    return grupoAtomos;
}

/** Quita la esfera de referencia de la escena y libera su memoria. */
export function quitarEsferaDePrueba() {
    if (esferaPrueba && escena) {
        escena.remove(esferaPrueba);
        esferaPrueba.geometry.dispose();
        esferaPrueba.material.dispose();
        esferaPrueba = null;
    }
}