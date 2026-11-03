/**
 * @fileoverview Configuración del pool de conexiones MySQL para Danillanos.
 * Establece la conexión hacia el motor de base de datos MySQL mediante mysql2/promise,
 * administrando el ciclo de vida de conexiones, resolución inteligente de cadenas de conexión
 * (DATABASE_URL, MYSQL_URL o variables individuales de Railway/Render/Local), detección
 * automática de SSL y verificación de disponibilidad del servicio.
 *
 * @module backend/config/db
 */

const path = require('path');
const mysql = require('mysql2/promise');

// Carga jerárquica de variables de entorno para compatibilidad con distintos entornos de despliegue
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();

/**
 * Resuelve y normaliza los parámetros de conexión a MySQL admitiendo múltiples formatos:
 * 1. URI unificada estándar: DATABASE_URL, MYSQL_URL o MYSQL_PRIVATE_URL (Railway, Render, Heroku)
 * 2. Variables nativas de Railway: MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE
 * 3. Variables tradicionales: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * 4. Fallback tolerante si el usuario pegó la URL completa en DB_HOST (ej. mysql://usuario:password@host:3306/db)
 *
 * @function resolveDbConfig
 * @param {object} [env=process.env] - Entorno de variables a evaluar.
 * @returns {import('mysql2/promise').PoolOptions} Opciones normalizadas para el pool de conexiones.
 */
function resolveDbConfig(env = process.env) {
  // 1. Detección de URI unificada de conexión
  let connectionUrl = env.DATABASE_URL || env.MYSQL_URL || env.MYSQL_PRIVATE_URL || '';

  // Tolerancia ante usuarios que pegan la URI completa dentro de DB_HOST
  if (!connectionUrl && env.DB_HOST && (env.DB_HOST.startsWith('mysql://') || env.DB_HOST.startsWith('mysqls://'))) {
    connectionUrl = env.DB_HOST;
  }

  let host = 'localhost';
  let port = 3306;
  let user = 'root';
  let password = '';
  let database = 'danillanos_db';

  if (connectionUrl) {
    try {
      const parsedUrl = new URL(connectionUrl);
      host = parsedUrl.hostname || host;
      port = parsedUrl.port ? Number(parsedUrl.port) : port;
      user = parsedUrl.username ? decodeURIComponent(parsedUrl.username) : user;
      password = parsedUrl.password ? decodeURIComponent(parsedUrl.password) : password;
      database = parsedUrl.pathname ? parsedUrl.pathname.replace(/^\//, '') : database;
    } catch (_) {
      // Si la URL no es parseable como URL estándar, se mantiene fallback tradicional
    }
  } else {
    host = env.MYSQLHOST || env.DB_HOST || host;
    port = Number(env.MYSQLPORT || env.DB_PORT) || port;
    user = env.MYSQLUSER || env.DB_USER || user;
    password = env.MYSQLPASSWORD !== undefined ? env.MYSQLPASSWORD : (env.DB_PASSWORD || password);
    database = env.MYSQLDATABASE || env.MYSQL_DATABASE || env.DB_NAME || database;
  }

  // 2. Detección inteligente de SSL:
  // - En redes internas de Railway (*.railway.internal) y localhost, SSL debe estar desactivado (red privada).
  // - En proveedores externos en la nube (Aiven, TiDB), SSL se activa automáticamente con rejectUnauthorized: false.
  // - Si se especifica explícitamente DB_SSL o MYSQL_SSL ('true'/'false'), se respeta la decisión del usuario.
  const explicitSsl = env.DB_SSL !== undefined ? env.DB_SSL : env.MYSQL_SSL;
  let useSsl = false;

  if (explicitSsl !== undefined) {
    useSsl = explicitSsl === 'true' || explicitSsl === '1';
  } else {
    const isInternalNetwork =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.includes('railway.internal') ||
      host.endsWith('.local');

    const isKnownCloudSslHost =
      host.includes('aivencloud.com') ||
      host.includes('tidbcloud.com');

    useSsl = isKnownCloudSslHost && !isInternalNetwork;
  }

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
}

/**
 * Parámetros resueltos de configuración del pool de conexiones MySQL.
 * @type {import('mysql2/promise').PoolOptions}
 */
const dbConfig = resolveDbConfig(process.env);

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
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[db] Aviso: No se pudo conectar a MySQL (${error.code || error.message}).`);
    }
    return false;
  }
}

module.exports = {
  pool,
  dbConfig,
  resolveDbConfig,
  checkDatabaseConnection
};
