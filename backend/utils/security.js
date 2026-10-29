/**
 * ============================================================================
 * MÓDULO DE SEGURIDAD Y ENCRIPTACIÓN DE DATOS DE USUARIO - DANILLANOS
 * ============================================================================
 * Implementa estándares criptográficos modernos sin dependencias externas vulnerables:
 * 1. Contraseñas: Hash con algoritmo Scrypt + Salt aleatorio de 16 bytes + comparación en tiempo constante.
 * 2. Datos sensibles (PII): Cifrado autenticado AES-256-GCM (IV de 12 bytes + AuthTag de 16 bytes).
 * 3. Sesiones: Tokens firmados con HMAC-SHA256 (formato JWT estándar).
 */

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();

// Clave maestra derivada de variable de entorno o semilla de seguridad por defecto
const SECRET_SEED = process.env.SECURITY_SECRET || 'Danillanos_AES256_Master_Key_Meta_Villavicencio_2026!';
const AES_KEY = crypto.createHash('sha256').update(SECRET_SEED).digest(); // 32 bytes exactos (256 bits)

/**
 * Genera un hash seguro de contraseña usando Scrypt
 * @param {string} plainPassword
 * @returns {string} Formato: saltHex:hashHex
 */
function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(plainPassword), salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifica una contraseña en texto plano contra su hash almacenado
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {boolean}
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
 * Cifra cualquier cadena de texto sensible con AES-256-GCM
 * @param {string|null} plainText
 * @returns {string|null} Formato: enc:ivHex:authTagHex:cipherHex
 */
function encryptData(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return null;
  const text = String(plainText);
  if (text.startsWith('enc:')) return text; // Ya está cifrado

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra una cadena cifrada con AES-256-GCM
 * @param {string|null} encryptedText
 * @returns {string|null}
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
 * Genera un hash determinístico SHA-256 para búsquedas indexadas de correos
 * permitiendo privacidad sin perder unicidad.
 */
function hashLookup(value) {
  if (!value) return '';
  return crypto
    .createHmac('sha256', AES_KEY)
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

/**
 * Firma un token de sesión estilo JWT con HMAC-SHA256
 * @param {object} payload
 * @param {number} expiresInSeconds
 * @returns {string}
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
 * Verifica y decodifica un token de sesión
 * @param {string} token
 * @returns {object|null}
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
