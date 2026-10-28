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

module.exports = {
  categoriasFallback: categoriasDanillanos,
  productosFallback: productosDanillanos,
  carruselFallback: carruselDanillanos,
  usuariosFallback,
  direccionesFallback,
  pedidosFallback,
  ticketsFallback
};
