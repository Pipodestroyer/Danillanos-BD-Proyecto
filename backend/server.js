/**
 * @fileoverview Servidor principal de aplicaciones Danillanos.
 * Inicializa el servidor Express, configura middleware global, gestiona la recarga
 * dinámica del enrutador de la API REST (/api), sirve los archivos estáticos del frontend
 * y administra las rutas de navegación web.
 *
 * @module backend/server
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Carga de variables de entorno buscando en ubicaciones jerárquicas del proyecto
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();

const { checkDatabaseConnection, dbConfig } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de middlewares globales para CORS y parseo de payloads JSON/URL-encoded
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Ruta física del módulo de rutas de la API para control de recarga en caliente
const apiRoutePath = path.join(__dirname, 'routes', 'api.js');
let cachedApiRouter = require('./routes/api');
let lastApiMtimeMs = (() => {
  try {
    return fs.statSync(apiRoutePath).mtimeMs;
  } catch (_) {
    return 0;
  }
})();

/**
 * Middleware para la recarga dinámica del enrutador API.
 * Detecta cambios en el archivo de rutas y purga la caché de Node.js en tiempo de ejecución.
 */
app.use('/api', (req, res, next) => {
  try {
    const stat = fs.statSync(apiRoutePath);
    if (stat.mtimeMs !== lastApiMtimeMs) {
      delete require.cache[require.resolve('./routes/api')];
      delete require.cache[require.resolve('./data/fallbackData')];
      cachedApiRouter = require('./routes/api');
      lastApiMtimeMs = stat.mtimeMs;
    }
  } catch (_) {
    // Si ocurre un error de lectura de archivo, se mantiene la versión previa en memoria
  }
  return cachedApiRouter(req, res, next);
});

/**
 * Manejador de rutas no encontradas exclusivamente para el prefijo /api/*.
 * Asegura respuestas en formato JSON uniforme en lugar de respuestas HTML genéricas.
 */
app.use('/api/*', (req, res) => {
  res.status(404).json({
    ok: false,
    status: 404,
    message: `Ruta de API no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Directorio raíz de recursos estáticos del cliente
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Rutas amigables de navegación del frontend
app.get('/perfil', (req, res) => res.sendFile(path.join(frontendPath, 'perfil.html')));
app.get('/pagos', (req, res) => res.sendFile(path.join(frontendPath, 'pagos.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(frontendPath, 'panel.html')));
app.get('/404', (req, res) => res.status(404).sendFile(path.join(frontendPath, '404.html')));

// Captura global de rutas no definidas para redirección a página de error 404
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(frontendPath, '404.html'));
});

// Inicialización del servidor HTTP y diagnóstico de conectividad a la base de datos
app.listen(PORT, async () => {
  const isConnected = await checkDatabaseConnection();
  console.log('============================================================');
  console.log('🥩 DANILLANOS - CÁRNICOS, CONGELADOS E INSUMOS PARA RESTAURANTE');
  console.log(`🚀 Tienda principal:   http://localhost:${PORT}/index.html`);
  console.log(`👤 Perfil y Mapa:      http://localhost:${PORT}/perfil.html`);
  console.log(`💳 Pasarela de Pagos:  http://localhost:${PORT}/pagos.html`);
  console.log(`🛠️  Panel Operativo:    http://localhost:${PORT}/panel.html`);
  if (isConnected) {
    console.log(`✅ Base de datos MySQL conectada (${dbConfig.host}:${dbConfig.port}/${dbConfig.database})`);
  } else {
    console.log('ℹ️  Modo Respaldo Activo (235 productos listos).');
  }
  console.log('============================================================');
});
