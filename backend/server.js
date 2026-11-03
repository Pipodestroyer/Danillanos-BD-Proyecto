/**
 * @fileoverview Servidor principal de aplicaciones Danillanos.
 * Inicializa el servidor Express en un único puerto controlado, aplica cabeceras de seguridad
 * HTTP, validación estricta de origen CORS, limitación de tasa contra fuerza bruta/abuso,
 * enruta las peticiones de la API REST (/api) y sirve los recursos estáticos del frontend.
 *
 * @module backend/server
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

// Carga de variables de entorno buscando en ubicaciones jerárquicas del proyecto
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();

const { checkDatabaseConnection, dbConfig } = require('./config/db');
const apiRouter = require('./routes/api');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Ocultar huella tecnológica del servidor y confiar en el primer proxy inverso (ej. Render TLS)
app.disable('x-powered-by');
app.set('trust proxy', 1);

/**
 * Crea un limitador de tasa en memoria por IP con limpieza periódica para mitigar ataques
 * de fuerza bruta, enumeración y denegación de servicio sin dependencias externas.
 *
 * @function createRateLimiter
 * @param {object} options
 * @param {number} options.windowMs - Ventana de tiempo en milisegundos.
 * @param {number} options.max - Máximo de solicitudes permitidas por IP en la ventana.
 * @param {string} options.message - Mensaje devuelto cuando se excede el límite.
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now >= entry.resetAt) hits.delete(key);
    }
  }, Math.min(windowMs, 60000));
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

  return (req, res, next) => {
    const now = Date.now();
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = hits.get(clientIp);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(clientIp, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        ok: false,
        error: message,
        message
      });
    }
    return next();
  };
}

// Cabeceras defensivas HTTP contra clickjacking, MIME sniffing y almacenamiento en caché de datos privados
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");

  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/productos') && !req.path.startsWith('/api/categorias') && !req.path.startsWith('/api/carrusel')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

// Política CORS restringida: permite el mismo host del despliegue o dominios explícitos en ALLOWED_ORIGINS
const explicitAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (explicitAllowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)) {
        return callback(null, true);
      }
      if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(cleanOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Role'],
    maxAge: 600
  })
);

// Parseo controlado de cargas JSON y formularios (6 MB máximo para fotografías de entrega/soporte)
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

// Protección contra fuerza bruta en autenticación y abuso de endpoints públicos
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: 'Demasiados intentos de autenticación desde esta dirección. Intenta de nuevo en unos minutos.'
});
const publicWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 40,
  message: 'Se alcanzó el límite temporal de solicitudes. Espera un momento antes de continuar.'
});
const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Demasiadas solicitudes simultáneas. Por favor intenta nuevamente en unos segundos.'
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/cambiar-password', authLimiter);
app.post('/api/pedidos', publicWriteLimiter);
app.post('/api/soporte/crear', publicWriteLimiter);
app.use('/api', generalApiLimiter, apiRouter);

/**
 * Manejador de rutas no encontradas exclusivamente para el prefijo /api/*.
 * Asegura respuestas en formato JSON uniforme sin exponer detalles internos.
 */
app.use('/api/*', (req, res) => {
  res.status(404).json({
    ok: false,
    status: 404,
    message: 'Recurso no encontrado.'
  });
});

// Directorio raíz de recursos estáticos del cliente (bloquea cualquier acceso a archivos ocultos o dotfiles)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(
  express.static(frontendPath, {
    dotfiles: 'deny',
    index: 'index.html'
  })
);

// Rutas amigables de navegación del frontend
app.get('/perfil', (req, res) => res.sendFile(path.join(frontendPath, 'perfil.html')));
app.get('/pagos', (req, res) => res.sendFile(path.join(frontendPath, 'pagos.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(frontendPath, 'panel.html')));
app.get('/404', (req, res) => res.status(404).sendFile(path.join(frontendPath, '404.html')));

// Captura global de rutas no definidas para redirección a página de error 404
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(frontendPath, '404.html'));
});

// Manejador global de errores de Express (ej. JSON malformado o payload excesivo) sin filtrar trazas internas
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      ok: false,
      message: 'El archivo o imagen adjunta supera el tamaño máximo permitido (6 MB).'
    });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      ok: false,
      message: 'Formato de solicitud inválido.'
    });
  }
  return res.status(500).json({
    ok: false,
    message: 'Error interno al procesar la solicitud.'
  });
});

// Inicialización del servidor HTTP únicamente si se ejecuta como proceso principal
if (require.main === module) {
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
}

module.exports = app;
