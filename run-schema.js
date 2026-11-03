/**
 * @fileoverview Ejecutor e inicializador del esquema de base de datos MySQL para Danillanos.
 * Lee las credenciales de conexión del archivo .env (soporta DATABASE_URL, MYSQL_URL o variables individuales),
 * carga el script `database/schema.sql`, adapta el identificador de la base de datos de ser necesario
 * y aplica todas las definiciones DDL (tablas, vistas, procedimientos almacenados y disparadores) y DML.
 *
 * @module run-schema
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('./backend/config/db');

/**
 * Ejecuta el script de esquema SQL en el motor de base de datos MySQL configurado.
 *
 * @async
 * @function runSchema
 * @returns {Promise<void>}
 */
async function runSchema() {
  console.log('============================================================');
  console.log('🥩 DANILLANOS - INICIALIZADOR DE BASE DE DATOS MYSQL');
  console.log('============================================================\n');

  // Resolución unificada de configuración (Railway, Render, Aiven o Local)
  const config = resolveDbConfig(process.env);
  const { host, port, user, password, database, ssl } = config;

  console.log('📋 Configuración detectada:');
  console.log(`   - Host:     ${host}`);
  console.log(`   - Puerto:   ${port}`);
  console.log(`   - Usuario:  ${user}`);
  console.log(`   - Base DB:  ${database}`);
  console.log(`   - Password: ${password ? '******** (definida)' : '(vacía)'}`);
  console.log(`   - SSL/TLS:  ${ssl ? 'Activado' : 'Desactivado (Red privada Railway / Local)'}`);

  // Carga del archivo SQL con las sentencias DDL y DML
  const schemaPath = path.join(__dirname, 'database', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`\n❌ Error: No se encontró el archivo SQL en: ${schemaPath}`);
    process.exit(1);
  }

  let sqlContent = fs.readFileSync(schemaPath, 'utf8');
  console.log(`\n📄 Archivo SQL cargado con éxito: database/schema.sql (${(sqlContent.length / 1024).toFixed(1)} KB)`);

  // Ajuste dinámico del nombre de la base de datos si difiere del valor por defecto
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
      ssl
    });
    console.log('✅ Conexión establecida correctamente con MySQL.');

    console.log(`🚀 Ejecutando schema.sql y cargando datos semilla en "${database}"...`);
    const startTime = Date.now();

    await connection.query(sqlContent);

    const elapsedMs = Date.now() - startTime;
    console.log(`\n🎉 ¡Base de datos inicializada con éxito en ${elapsedMs} ms!`);

    // Inspección y validación de las tablas creadas
    await connection.query(`USE \`${database}\``);
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n📊 Tablas creadas/verificadas en la base de datos:');
    tables.forEach((row) => {
      const tableName = Object.values(row)[0];
      console.log(`   ✔️ ${tableName}`);
    });

    // Diagnóstico de conteo de productos inicializados
    const [products] = await connection.query('SELECT COUNT(*) AS total FROM productos');
    console.log(`\n📦 Total de productos registrados: ${products[0].total}`);

    // Diagnóstico de conteo de diapositivas del carrusel
    const [carousel] = await connection.query('SELECT COUNT(*) AS total FROM carrusel_promociones');
    console.log(`🎠 Total de promociones en carrusel: ${carousel[0].total}`);

    console.log('\n============================================================');
    console.log('✨ Todo listo. Ahora puedes iniciar el servidor con:');
    console.log('   npm start');
    console.log('============================================================\n');
  } catch (error) {
    console.error('\n❌ Error al ejecutar el esquema SQL:');
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Código:  ${error.code || 'N/A'}`);
    if (error.sqlMessage) console.error(`   SQL:     ${error.sqlMessage}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  runSchema();
}

module.exports = { runSchema };
