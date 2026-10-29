/**
 * Datos de respaldo (Fallback): catálogo de productos de Danillanos y una única cuenta de administrador.
 * Sin pedidos, direcciones ni tickets de ejemplo.
 */

const {
  categoriasDanillanos,
  productosDanillanos,
  carruselDanillanos
} = require('./catalogData');
const { hashPassword, encryptData, hashLookup } = require('../utils/security');

const defaultPassHash = hashPassword('Danillanos2026*');

// Única cuenta inicial: Administrador general. El resto de cuentas se crean desde el panel.
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

const direccionesFallback = [];

const pedidosFallback = [];

const ticketsFallback = [];

const fs = require('fs');
const path = require('path');
const storeFilePath = path.join(__dirname, 'fallback_store.json');

function saveFallbackStore() {
  try {
    const data = {
      usuarios: usuariosFallback,
      direcciones: direccionesFallback,
      pedidos: pedidosFallback,
      tickets: ticketsFallback
    };
    fs.writeFileSync(storeFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

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
    }
  } catch (_) {}
}

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
