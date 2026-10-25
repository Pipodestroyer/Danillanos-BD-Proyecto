/**
 * Servidor Principal - Danillanos Tienda de Cárnicos, Congelados e Insumos
 * Sirve la API REST conectada a MySQL (con encriptación AES-256-GCM) y las páginas del Frontend.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { checkDatabaseConnection, dbConfig } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Carga dinámica de rutas de la API REST (/api/*) para aplicar cambios sin requerir reinicio manual
const apiRoutePath = path.join(__dirname, 'routes', 'api.js');
let cachedApiRouter = require('./routes/api');
let lastApiMtimeMs = (() => {
  try {
    return fs.statSync(apiRoutePath).mtimeMs;
  } catch (_) {
    return 0;
  }
})();

app.use('/api', (req, res, next) => {
  try {
    const stat = fs.statSync(apiRoutePath);
    if (stat.mtimeMs !== lastApiMtimeMs) {
      delete require.cache[require.resolve('./routes/api')];
      cachedApiRouter = require('./routes/api');
      lastApiMtimeMs = stat.mtimeMs;
    }
  } catch (_) {
    // Continuar con el router en memoria
  }
  return cachedApiRouter(req, res, next);
});

// Si una ruta bajo /api/* no existe, devolver siempre JSON estructurado en lugar de HTML
app.use('/api/*', (req, res) => {
  res.status(404).json({
    ok: false,
    status: 404,
    message: `Ruta de API no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Servir archivos estáticos del Frontend (index.html, perfil.html, pagos.html, panel.html, 404.html)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Rutas amigables sin extensión .html
app.get('/perfil', (req, res) => res.sendFile(path.join(frontendPath, 'perfil.html')));
app.get('/pagos', (req, res) => res.sendFile(path.join(frontendPath, 'pagos.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(frontendPath, 'panel.html')));
app.get('/404', (req, res) => res.status(404).sendFile(path.join(frontendPath, '404.html')));

// Cualquier otra ruta no existente muestra la página 404
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(frontendPath, '404.html'));
});

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
