/**
 * @fileoverview Ejecutor e inicializador del esquema de base de datos MySQL para Danillanos.
 * Lee las credenciales de conexión del archivo .env (soporta DATABASE_URL, MYSQL_URL o variables individuales),
 * carga el script `database/schema.sql`, adapta el identificador de la base de datos de ser necesario,
 * extrae rutinas con delimitadores complejos y aplica todas las definiciones DDL (tablas, vistas,
 * procedimientos y disparadores) y DML (datos semilla de 235 productos y promociones).
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
    const notFoundErr = new Error(`No se encontró el archivo SQL en: ${schemaPath}`);
    console.error(`\n❌ Error: ${notFoundErr.message}`);
    if (require.main === module) process.exit(1);
    throw notFoundErr;
  }

  let sqlContent = fs.readFileSync(schemaPath, 'utf8');
  console.log(`\n📄 Archivo SQL cargado con éxito: database/schema.sql (${(sqlContent.length / 1024).toFixed(1)} KB)`);

  // Extraer bloques con DELIMITER // para ejecutarlos como sentencias individuales compatibles con mysql2
  let mainSql = sqlContent;
  let routines = [];
  const delimiterRegex = /DELIMITER\s+\/\/\s*([\s\S]*?)\s*DELIMITER\s*;/i;
  const delimiterMatch = sqlContent.match(delimiterRegex);
  if (delimiterMatch) {
    routines = delimiterMatch[1]
      .split(/\/\/\s*/)
      .map((r) => r.trim())
      .filter(Boolean);
    mainSql = sqlContent.replace(delimiterRegex, '-- [Procedimientos y triggers ejecutados de forma individual]');
  }

  // Ajuste dinámico del nombre de la base de datos si difiere del valor por defecto
  if (database && database !== 'danillanos_db') {
    console.log(`🔄 Adaptando script SQL para usar la base de datos: "${database}"`);
    mainSql = mainSql
      .replace(/CREATE DATABASE IF NOT EXISTS\s+[^\n;]+;/gi, `-- Base de datos gestionada por el entorno: ${database}`)
      .replace(/USE\s+[^\n;]+;/gi, `USE \`${database}\`;`);
  }

  let connection;
  try {
    console.log('\n🔌 Conectando al servidor MySQL...');
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database: database || undefined,
      multipleStatements: true,
      ssl
    });
    console.log('✅ Conexión establecida correctamente con MySQL.');

    console.log(`🚀 Ejecutando DDL, DML y datos semilla en "${database}"...`);
    const startTime = Date.now();

    await connection.query(mainSql);

    // Ejecutar procedimientos almacenados y disparadores de forma individual
    for (const routine of routines) {
      try {
        await connection.query(routine);
      } catch (routErr) {
        console.warn(`   ⚠️ Advertencia en rutina/trigger: ${routErr.message}`);
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`\n🎉 ¡Base de datos inicializada con éxito en ${elapsedMs} ms!`);

    // Inspección y validación de las tablas creadas
    if (database) {
      await connection.query(`USE \`${database}\``);
    }
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

    // Sincronización de la cuenta de administrador con la clave y contraseña de entorno actuales
    try {
      const { hashLookup, hashPassword, encryptData } = require('./backend/utils/security');
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@danillanos.com').trim().toLowerCase();
      const adminPassword = (process.env.ADMIN_DEFAULT_PASSWORD || process.env.ADMIN_PASSWORD || process.env.ADMIN_SEED_PASSWORD || 'Danillanos2026*').trim();
      const emailHash = hashLookup(adminEmail);
      const emailEnc = encryptData(adminEmail);
      const passHash = hashPassword(adminPassword);

      await connection.query(
        `INSERT INTO usuarios (
          id, username, nombre_completo_enc, nombres_enc, apellidos_enc, empresa_enc,
          tipo_documento, numero_documento_enc, email_hash, email_enc, password_hash, telefono_enc, rol, activo
        ) VALUES (
          1, 'Administrador Danillanos', ?, ?, ?, ?, 'NIT', ?, ?, ?, ?, ?, 'admin', 1
        ) ON DUPLICATE KEY UPDATE email_hash = VALUES(email_hash), email_enc = VALUES(email_enc), password_hash = VALUES(password_hash), rol = 'admin', activo = 1`,
        [
          encryptData('Administrador Danillanos'),
          encryptData('Administrador'),
          encryptData('Danillanos'),
          encryptData('Danillanos Cárnicos y Congelados S.A.S.'),
          encryptData('900000000-1'),
          emailHash,
          emailEnc,
          passHash,
          encryptData('3109998877')
        ]
      );
      console.log(`👤 Usuario Administrador (#1): ${adminEmail} configurado con contraseña de entorno.`);
    } catch (adminSyncErr) {
      console.warn(`   ⚠️ Advertencia al sincronizar admin en schema: ${adminSyncErr.message}`);
    }

    console.log('\n============================================================');
    console.log('✨ Base de datos lista.');
    console.log('============================================================\n');
  } catch (error) {
    console.error('\n❌ Error al ejecutar el esquema SQL:');
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Código:  ${error.code || 'N/A'}`);
    if (error.sqlMessage) console.error(`   SQL:     ${error.sqlMessage}`);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
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
