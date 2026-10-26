/**
 * Generador automático de frontend/js/config.js a partir de backend/data/catalogData.js
 * para mantener los 235 productos sincronizados tanto en MySQL como en el Frontend.
 */

const fs = require('fs');
const path = require('path');
const {
  categoriasDanillanos,
  productosDanillanos,
  carruselDanillanos
} = require('../backend/data/catalogData');

const municipiosMeta = [
  { nombre: 'Villavicencio', lat: 4.1420, lng: -73.6266, es_villavicencio: true },
  { nombre: 'Acacías', lat: 3.9869, lng: -73.7579, es_villavicencio: false },
  { nombre: 'Restrepo', lat: 4.2618, lng: -73.5644, es_villavicencio: false },
  { nombre: 'Cumaral', lat: 4.2708, lng: -73.4867, es_villavicencio: false },
  { nombre: 'Granada', lat: 3.5463, lng: -73.7069, es_villavicencio: false },
  { nombre: 'Puerto López', lat: 4.0845, lng: -72.9560, es_villavicencio: false },
  { nombre: 'San Martín', lat: 3.6964, lng: -73.6938, es_villavicencio: false },
  { nombre: 'Guamal', lat: 3.8804, lng: -73.7656, es_villavicencio: false },
  { nombre: 'Castilla la Nueva', lat: 3.8272, lng: -73.6881, es_villavicencio: false },
  { nombre: 'Vista Hermosa', lat: 3.1242, lng: -73.7514, es_villavicencio: false }
];

const configObject = {
  brand: {
    name: 'DANILLANOS',
    tagline: 'DISTRIBUIMOS CALIDAD',
    address: 'CLLE 15 # 12 -91 AVENIDA LOS MARACOS, Villavicencio - Meta',
    logoUrl: null
  },
  api: {
    baseUrl: '/api',
    carouselIntervalMs: 6000
  },
  auth: {
    googleClientId: '394071429874-5ev2n04b6j7akvqg0rtaene6461smr10.apps.googleusercontent.com'
  },
  map: {
    // Coordenadas de Villavicencio y radio de cobertura de entrega inmediata el mismo día
    villavicencioCenter: { lat: 4.1420, lng: -73.6266 },
    villavicencioRadiusMeters: 9500,
    sedeDanillanos: {
      nombre: 'Danillanos Sede Principal - Clle 15 # 12-91 Av. Los Maracos',
      lat: 4.1365,
      lng: -73.6215
    },
    municipiosMeta
  },
  // Por defecto la página inicia SIN USUARIO (modo visualización visitante)
  defaultUser: null,
  categories: categoriasDanillanos,
  carouselSlides: carruselDanillanos,
  products: productosDanillanos
};

const outputContent = `/**
 * ============================================================================
 * CONFIGURACIÓN GLOBAL Y CATÁLOGO COMPLETO (235 PRODUCTOS) - DANILLANOS
 * ============================================================================
 * Incluye las 9 líneas del listado oficial de precios, configuración del radio
 * de cobertura de Villavicencio y municipios del Meta.
 * Por defecto inicia sin sesión activa (defaultUser: null).
 */

window.DANILLANOS_CONFIG = ${JSON.stringify(configObject, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'frontend', 'js', 'config.js'), outputContent, 'utf8');
console.log('✅ frontend/js/config.js actualizado con los 235 productos y configuración de mapa.');
