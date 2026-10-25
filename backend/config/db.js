/**
 * Configuración de Conexión a Base de Datos MySQL - Danillanos
 * Utiliza un Pool de conexiones con mysql2/promise para alto rendimiento.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT) || 3306;

// Detectar si requiere SSL (indispensable para servicios cloud como Aiven Cloud)
const isCloudOrSsl =
  process.env.DB_SSL === 'true' ||
  host.includes('aivencloud.com') ||
  (port !== 3306 && host !== 'localhost' && host !== '127.0.0.1');

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

const pool = mysql.createPool(dbConfig);

/**
 * Verifica si la base de datos MySQL está accesible actualmente.
 * @returns {Promise<boolean>}
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
