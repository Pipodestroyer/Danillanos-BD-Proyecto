/**
 * @fileoverview Configuración del pool de conexiones MySQL para Danillanos.
 * Establece la conexión hacia el motor de base de datos MySQL mediante mysql2/promise,
 * administrando el ciclo de vida de conexiones, detección automática de SSL para
 * proveedores cloud (como Aiven) y verificación de disponibilidad del servicio.
 *
 * @module backend/config/db
 */

const path = require('path');
const mysql = require('mysql2/promise');

// Carga jerárquica de variables de entorno para compatibilidad con distintos entornos de despliegue
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT) || 3306;

/**
 * Indicador booleano que determina si la conexión requiere transporte seguro TLS/SSL.
 * Se habilita explícitamente vía DB_SSL o implícitamente ante hosts en la nube / puertos no convencionales.
 * @type {boolean}
 */
const isCloudOrSsl =
  process.env.DB_SSL === 'true' ||
  host.includes('aivencloud.com') ||
  (port !== 3306 && host !== 'localhost' && host !== '127.0.0.1');

/**
 * Parámetros de configuración del pool de conexiones.
 * @type {import('mysql2/promise').PoolOptions}
 */
const dbConfig = {
  host,
  port,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'danillanos_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: isCloudOrSsl ? { rejectUnauthorized: false } : undefined
};

/**
 * Instancia compartida del pool de conexiones MySQL.
 * Utilizado por los controladores de la aplicación para ejecutar consultas asíncronas.
 */
const pool = mysql.createPool(dbConfig);

/**
 * Comprueba la disponibilidad del servidor de base de datos mediante un comando ping.
 *
 * @async
 * @function checkDatabaseConnection
 * @returns {Promise<boolean>} Retorna true si la conexión fue exitosa y false ante cualquier fallo de red o credenciales.
 */
async function checkDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  pool,
  dbConfig,
  checkDatabaseConnection
};
