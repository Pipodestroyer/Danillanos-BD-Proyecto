/**
 * @fileoverview Módulo de criptografía, hashing y seguridad de datos para Danillanos.
 * Proporciona métodos para el almacenamiento seguro de credenciales (Scrypt con sal aleatoria),
 * cifrado simétrico autenticado de información personal identificable (AES-256-GCM),
 * generación de índices ciegos para búsquedas de correo (HMAC-SHA256) y emisión/verificación
 * de tokens de sesión autenticados (JWT/HMAC-SHA256).
 *
 * @module backend/utils/security
 */

const crypto = require('crypto');
const path = require('path');

// Carga de variables de entorno para resolver la clave maestra de seguridad
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();

/**
 * Semilla maestra para derivación de claves criptográficas.
 * Se obtiene prioritariamente desde SECURITY_SECRET en las variables de entorno.
 * @type {string}
 */
const SECRET_SEED = process.env.SECURITY_SECRET || 'Danillanos_AES256_Master_Key_Meta_Villavicencio_2026!';

/**
 * Clave simétrica de 256 bits (32 bytes) derivada con SHA-256 a partir de la semilla maestra.
 * @type {Buffer}
 */
const AES_KEY = crypto.createHash('sha256').update(SECRET_SEED).digest();

/**
 * Genera una derivación segura para contraseñas utilizando el algoritmo Scrypt con una sal aleatoria.
 *
 * @function hashPassword
 * @param {string} plainPassword - Contraseña en texto plano a transformar.
 * @returns {string} Cadena en formato `saltHex:derivedKeyHex`.
 */
function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(plainPassword), salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Valida si una contraseña en texto plano coincide con un hash almacenado previamente.
 * Emplea comparación en tiempo constante (crypto.timingSafeEqual) para mitigar ataques de temporización.
 *
 * @function verifyPassword
 * @param {string} plainPassword - Contraseña suministrada por el usuario.
 * @param {string} storedHash - Hash con formato `saltHex:derivedKeyHex` recuperado de la base de datos.
 * @returns {boolean} `true` si la contraseña coincide; de lo contrario `false`.
 */
function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(String(plainPassword), salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

/**
 * Cifra datos confidenciales utilizando AES-256-GCM con vector de inicialización único de 12 bytes.
 * Incluye etiqueta de autenticación (auth tag) para garantizar la integridad y autenticidad del contenido.
 *
 * @function encryptData
 * @param {string|null|undefined} plainText - Texto plano que se desea cifrar.
 * @returns {string|null} Cadena en formato `enc:ivHex:authTagHex:cipherHex`, o null si la entrada es nula/vacía.
 */
function encryptData(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return null;
  const text = String(plainText);
  if (text.startsWith('enc:')) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra una cadena previamente cifrada con el método `encryptData`.
 *
 * @function decryptData
 * @param {string|null|undefined} encryptedText - Cadena cifrada con formato `enc:ivHex:authTagHex:cipherHex`.
 * @returns {string|null} Texto plano descifrado, o marcador de contingencia ante fallos de verificación de integridad.
 */
function decryptData(encryptedText) {
  if (!encryptedText) return null;
  const text = String(encryptedText);
  if (!text.startsWith('enc:')) return text;

  try {
    const parts = text.split(':');
    if (parts.length !== 4) return text;
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    return '[Dato Protegido]';
  }
}

/**
 * Genera un resumen criptográfico determinista con HMAC-SHA256 para búsquedas indexadas de campos sensibles (e.g. email).
 * Permite realizar búsquedas exactas en la base de datos sin exponer el dato en texto plano ni romper la unicidad.
 *
 * @function hashLookup
 * @param {string|null|undefined} value - Valor textual a indexar.
 * @returns {string} Digest hexadecimal generado con la clave de seguridad.
 */
function hashLookup(value) {
  if (!value) return '';
  return crypto
    .createHmac('sha256', AES_KEY)
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

/**
 * Emite un token web de sesión firmado digitalmente con HMAC-SHA256 según el estándar JWT.
 *
 * @function signToken
 * @param {object} payload - Objeto con los atributos de sesión del usuario.
 * @param {number} [expiresInSeconds=604800] - Tiempo de validez del token en segundos (por defecto 7 días).
 * @returns {string} Token firmado con formato `header.payload.signature` en base64url.
 */
function signToken(payload, expiresInSeconds = 86400 * 7) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AES_KEY)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Valida la firma criptográfica y expiración de un token de sesión, retornando su contenido decodificado.
 *
 * @function verifyToken
 * @param {string} token - Token en formato JWT a comprobar.
 * @returns {object|null} Objeto decodificado del payload si es válido; de lo contrario `null`.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', AES_KEY)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  hashLookup,
  signToken,
  verifyToken
};
