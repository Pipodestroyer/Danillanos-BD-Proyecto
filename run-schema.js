/**
 * ============================================================================
 * DANILLANOS - SCRIPT EJECUTOR DE SCHEMA MYSQL
 * ============================================================================
 * Lee las credenciales de conexión del archivo .env y ejecuta de forma
 * automática el script database/schema.sql en el servidor MySQL (local o cloud como Aiven).
 *
 * Uso:
 *   node run-schema.js
 *   npm run db:init
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runSchema() {
  console.log('============================================================');
  console.log('🥩 DANILLANOS - INICIALIZADOR DE BASE DE DATOS MYSQL');
  console.log('============================================================\n');

  // 1. Obtener y validar variables de entorno desde .env
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'danillanos_db';

  console.log('📋 Configuración detectada desde .env:');
  console.log(`   - Host:     ${host}`);
  console.log(`   - Puerto:   ${port}`);
  console.log(`   - Usuario:  ${user}`);
  console.log(`   - Base DB:  ${database}`);
  console.log(`   - Password: ${password ? '******** (definida)' : '(vacía)'}`);

  // Detectar soporte SSL (necesario para servicios en la nube como Aiven Cloud)
  const isCloudOrSsl =
    process.env.DB_SSL === 'true' ||
    host.includes('aivencloud.com') ||
    (port !== 3306 && host !== 'localhost' && host !== '127.0.0.1');

  const sslOption = isCloudOrSsl ? { rejectUnauthorized: false } : undefined;
  if (isCloudOrSsl) {
    console.log('   - SSL/TLS:  Activado (requerido para servicios Cloud/Aiven)');
  }

  // 2. Leer archivo schema.sql
  const schemaPath = path.join(__dirname, 'database', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`\n❌ Error: No se encontró el archivo SQL en: ${schemaPath}`);
    process.exit(1);
  }

  let sqlContent = fs.readFileSync(schemaPath, 'utf8');
  console.log(`\n📄 Archivo SQL cargado con éxito: database/schema.sql (${(sqlContent.length / 1024).toFixed(1)} KB)`);

  // Adaptar el nombre de la BD en el script al configurado en .env
  if (database && database !== 'danillanos_db') {
    console.log(`🔄 Adaptando script SQL para usar la base de datos: "${database}"`);
    sqlContent = sqlContent
      .replace(/CREATE DATABASE IF NOT EXISTS\s+danillanos_db/gi, `CREATE DATABASE IF NOT EXISTS \`${database}\``)
      .replace(/USE\s+danillanos_db;/gi, `USE \`${database}\`;`);
  }

  let connection;
  try {
    console.log('\n🔌 Conectando al servidor MySQL...');
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      ssl: sslOption
    });
    console.log('✅ Conexión establecida correctamente con MySQL.');

    console.log(`🚀 Ejecutando schema.sql y cargando datos semilla en "${database}"...`);
    const startTime = Date.now();

    await connection.query(sqlContent);

    const elapsedMs = Date.now() - startTime;
    console.log(`\n🎉 ¡Base de datos inicializada con éxito en ${elapsedMs} ms!`);

    // 3. Verificación de tablas creadas
    await connection.query(`USE \`${database}\``);
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n📊 Tablas creadas/verificadas en la base de datos:');
    tables.forEach((row) => {
      const tableName = Object.values(row)[0];
      console.log(`   ✔️ ${tableName}`);
    });

    // Conteo de productos
    const [products] = await connection.query('SELECT COUNT(*) AS total FROM productos');
    console.log(`\n📦 Total de productos registrados: ${products[0].total}`);

    // Conteo de carrusel
    const [carousel] = await connection.query('SELECT COUNT(*) AS total FROM carrusel_promociones');
    console.log(`🎠 Total de promociones en carrusel: ${carousel[0].total}`);

    console.log('\n============================================================');
    console.log('✨ Todo listo. Ahora puedes iniciar el servidor con:');
    console.log('   npm start');
    console.log('============================================================\n');

  } catch (error) {
    console.error('\n❌ Ocurrió un error al ejecutar el schema en MySQL:');
    console.error(`   Código: ${error.code || 'DESCONOCIDO'}`);
    console.error(`   Mensaje: ${error.message}`);
    if (error.sqlMessage) {
      console.error(`   Detalle SQL: ${error.sqlMessage}`);
    }
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔒 Conexión con MySQL cerrada ordenadamente.');
    }
  }
}

runSchema();
