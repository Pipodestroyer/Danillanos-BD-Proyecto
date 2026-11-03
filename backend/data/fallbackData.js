/**
 * @fileoverview Repositorio de datos de respaldo en memoria y persistencia local (Fallback).
 * Provee colecciones en memoria con persistencia en JSON (`fallback_store.json`) que garantizan
 * la operatividad ininterrumpida de la tienda ante contingencias o desconexión del servidor MySQL.
 *
 * @module backend/data/fallbackData
 */

const fs = require('fs');
const path = require('path');
const {
  categoriasDanillanos,
  productosDanillanos,
  carruselDanillanos
} = require('./catalogData');
const { hashPassword, encryptData, hashLookup } = require('../utils/security');

/**
 * Hash inicial de contraseña para la cuenta administrativa predeterminada.
 * @type {string}
 */
const defaultPassHash = hashPassword('Danillanos2026*');

/**
 * Registro en memoria de usuarios para el modo de contingencia.
 * @type {Array<object>}
 */
const usuariosFallback = [
  {
    id: 1,
    username: 'Administrador Danillanos',
    nombre_completo_enc: encryptData('Administrador Danillanos'),
    nombres_enc: encryptData('Administrador'),
    apellidos_enc: encryptData('Danillanos'),
    empresa_enc: encryptData('Danillanos S.A.S.'),
    tipo_documento: 'CC',
    numero_documento_enc: encryptData(''),
    email_hash: hashLookup('admin@danillanos.com'),
    email_enc: encryptData('admin@danillanos.com'),
    password_hash: defaultPassHash,
    telefono_enc: encryptData(''),
    avatar_url: null,
    rol: 'admin',
    activo: 1
  }
];

/**
 * Registro en memoria de direcciones asociadas a usuarios en contingencia.
 * @type {Array<object>}
 */
const direccionesFallback = [];

/**
 * Registro en memoria de órdenes de compra en contingencia.
 * @type {Array<object>}
 */
const pedidosFallback = [];

/**
 * Registro en memoria de tickets de atención al cliente en contingencia.
 * @type {Array<object>}
 */
const ticketsFallback = [];

/**
 * Ruta absoluta del archivo JSON de persistencia de contingencia.
 * @type {string}
 */
const storeFilePath = path.join(__dirname, 'fallback_store.json');

/**
 *Persiste el estado actual de las colecciones en memoria hacia el archivo JSON.
 *
 * @function saveFallbackStore
 * @returns {void}
 */
function saveFallbackStore() {
  try {
    const productosDescuentos = {};
    productosDanillanos.forEach((p) => {
      if (
        Number(p.descuento_porcentaje || 0) > 0 ||
        p.precio_base !== undefined
      ) {
        productosDescuentos[p.id] = {
          precio_base: Number(p.precio_base ?? p.precio ?? 0),
          descuento_porcentaje: Number(p.descuento_porcentaje || 0),
          descuento_tipo: p.descuento_tipo || 'manual',
          descuento_expira_en: p.descuento_expira_en || null,
          descuento_expira_ms: p.descuento_expira_ms ?? null,
          descuento_unidades_limite: p.descuento_unidades_limite ?? null,
          descuento_unidades_vendidas: Number(p.descuento_unidades_vendidas || 0)
        };
      }
    });
    const data = {
      usuarios: usuariosFallback,
      direcciones: direccionesFallback,
      pedidos: pedidosFallback,
      tickets: ticketsFallback,
      productosDescuentos
    };
    fs.writeFileSync(storeFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {
    // Omisión controlada de errores de escritura de disco en contingencia
  }
}

/**
 * Lee y carga el estado persistido previamente desde el archivo JSON hacia la memoria.
 *
 * @function loadFallbackStore
 * @returns {void}
 */
function loadFallbackStore() {
  try {
    if (fs.existsSync(storeFilePath)) {
      const raw = fs.readFileSync(storeFilePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.usuarios) && data.usuarios.length > 0) {
        usuariosFallback.length = 0;
        usuariosFallback.push(...data.usuarios);
      }
      if (Array.isArray(data.direcciones) && data.direcciones.length > 0) {
        direccionesFallback.length = 0;
        direccionesFallback.push(...data.direcciones);
      }
      if (Array.isArray(data.pedidos) && data.pedidos.length > 0) {
        pedidosFallback.length = 0;
        pedidosFallback.push(...data.pedidos);
      }
      if (Array.isArray(data.tickets) && data.tickets.length > 0) {
        ticketsFallback.length = 0;
        ticketsFallback.push(...data.tickets);
      }
      if (data.productosDescuentos && typeof data.productosDescuentos === 'object') {
        productosDanillanos.forEach((p) => {
          const saved = data.productosDescuentos[p.id];
          if (saved) {
            if (saved.precio_base !== undefined) p.precio = Number(saved.precio_base);
            p.descuento_porcentaje = Number(saved.descuento_porcentaje || 0);
            p.descuento_tipo = saved.descuento_tipo || 'manual';
            p.descuento_expira_en = saved.descuento_expira_en || null;
            p.descuento_expira_ms = saved.descuento_expira_ms ?? null;
            p.descuento_unidades_limite = saved.descuento_unidades_limite ?? null;
            p.descuento_unidades_vendidas = Number(saved.descuento_unidades_vendidas || 0);
          }
        });
      }
    }
  } catch (_) {
    // Omisión controlada de errores de parseo en contingencia
  }
}

// Carga inicial de datos al importar el módulo
loadFallbackStore();

module.exports = {
  categoriasFallback: categoriasDanillanos,
  productosFallback: productosDanillanos,
  carruselFallback: carruselDanillanos,
  usuariosFallback,
  direccionesFallback,
  pedidosFallback,
  ticketsFallback,
  saveFallbackStore,
  loadFallbackStore
};
