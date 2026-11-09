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

const { pool, checkDatabaseConnection, dbConfig } = require('./config/db');
const { hashLookup, hashPassword, encryptData } = require('./utils/security');
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
      if (/^https:\/\/[a-z0-9.-]+\.up\.railway\.app$/i.test(cleanOrigin)) {
        return callback(null, true);
      }
      if (/^https?:\/\/(.*\.)?icedlemontea\.dev$/i.test(cleanOrigin)) {
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
app.use('/api/auth/recuperar-password', authLimiter);
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

/**
 * Middleware canónico para URLs limpias:
 * 1. Redirige /index.html y /index directamente a la raíz / (preservando query params)
 * 2. Redirige cualquier archivo *.html a su ruta limpia sin extensión (ej. /perfil.html -> /perfil)
 * 3. Normaliza rutas eliminando barras diagonales finales innecesarias (ej. /perfil/ -> /perfil)
 */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

  // Redireccionar /index.html o /index canónicamente a la raíz /
  if (req.path === '/index.html' || req.path === '/index') {
    return res.redirect(301, '/' + query);
  }

  // Redireccionar archivos con extensión .html a su versión sin extensión
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    return res.redirect(301, cleanPath + query);
  }

  // Normalizar rutas con barra diagonal final redundante (excepto la raíz "/")
  if (req.path.length > 1 && req.path.endsWith('/')) {
    const cleanPath = req.path.replace(/\/+$/, '');
    return res.redirect(301, cleanPath + query);
  }

  next();
});

// Servicio de recursos estáticos del frontend (imágenes, CSS, JS) sin servir index automático
app.use(
  express.static(frontendPath, {
    dotfiles: 'deny',
    index: false
  })
);

// Rutas amigables de navegación del frontend
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
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

/**
 * Asegura que la cuenta de administrador principal exista en MySQL con el correo
 * y la contraseña configurados en las variables de entorno o valores predeterminados.
 *
 * @async
 * @function syncAdminAccountInDatabase
 * @param {import('mysql2/promise').Pool} dbPool - Pool de conexiones MySQL.
 * @returns {Promise<void>}
 */
async function syncAdminAccountInDatabase(dbPool) {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@danillanos.com').trim().toLowerCase();
    const adminPassword = (process.env.ADMIN_DEFAULT_PASSWORD || process.env.ADMIN_PASSWORD || process.env.ADMIN_SEED_PASSWORD || 'Danillanos2026*').trim();

    const emailHash = hashLookup(adminEmail);
    const emailEnc = encryptData(adminEmail);
    const passHash = hashPassword(adminPassword);

    const [adminRows] = await dbPool.query(
      "SELECT id, rol, activo FROM usuarios WHERE id = 1 OR rol = 'admin' OR email_hash = ? LIMIT 1",
      [emailHash]
    );

    if (adminRows && adminRows.length > 0) {
      await dbPool.query(
        `UPDATE usuarios 
         SET email_hash = ?, email_enc = ?, password_hash = ?, rol = 'admin', activo = 1
         WHERE id = ?`,
        [emailHash, emailEnc, passHash, adminRows[0].id]
      );
      console.log(`🔐 Cuenta administradora sincronizada en MySQL (${adminEmail}) con contraseña de entorno.`);
    } else {
      await dbPool.query(
        `INSERT INTO usuarios (
          id, username, nombre_completo_enc, nombres_enc, apellidos_enc, empresa_enc,
          tipo_documento, numero_documento_enc, email_hash, email_enc, password_hash, telefono_enc, rol, activo
        ) VALUES (
          1, 'Administrador Danillanos', ?, ?, ?, ?, 'NIT', ?, ?, ?, ?, ?, 'admin', 1
        )`,
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
      console.log(`🎉 Cuenta administradora creada en MySQL (${adminEmail}) con contraseña de entorno.`);
    }
  } catch (err) {
    console.error('⚠️ Advertencia al sincronizar cuenta de administrador en MySQL:', err.message);
  }
}

/**
 * Verifica la disponibilidad de la base de datos MySQL e inicializa automáticamente
 * el esquema DDL y los datos semilla si detecta que la base de datos se encuentra vacía.
 *
 * @async
 * @function autoInitializeDatabaseIfEmpty
 * @returns {Promise<boolean>}
 */
async function autoInitializeDatabaseIfEmpty() {
  try {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      console.error('\n🚨 ============================================================');
      console.error('❌ ERROR CRÍTICO: No se pudo conectar a la base de datos MySQL.');
      console.error('   Verifica la variable DATABASE_URL o MYSQL_URL en Railway.');
      console.error('============================================================\n');
      return false;
    }

    console.log(`✅ Servidor MySQL conectado (${dbConfig.host}:${dbConfig.port}/${dbConfig.database})`);

    // Comprobar si las tablas principales ya existen
    const [tables] = await pool.query("SHOW TABLES LIKE 'usuarios'");
    if (!tables || tables.length === 0) {
      console.log('⚠️  No se encontraron tablas en la base de datos MySQL.');
      console.log('🚀 Ejecutando inicialización automática DDL/DML (runSchema)...');
      const { runSchema } = require('../run-schema');
      await runSchema();
      console.log('🎉 ¡Base de datos inicializada exitosamente en MySQL!');
    } else {
      console.log('✅ Tablas verificadas en MySQL (usuarios, productos, etc. activos).');
    }
    try {
      await pool.query(
        "UPDATE productos SET imagen_url = ? WHERE imagen_url LIKE '%1584308666744%'",
        ['https://plus.unsplash.com/premium_photo-1675855723466-fd4729e23d5d?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D']
      );
      await pool.query(
        "UPDATE productos SET imagen_url = ? WHERE imagen_url LIKE '%1576107232684%'",
        ['https://images.unsplash.com/photo-1601599967100-f16100982063?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D']
      );
      await pool.query(
        "UPDATE hero_slides SET imagen_url = ? WHERE imagen_url LIKE '%1576107232684%'",
        ['https://images.unsplash.com/photo-1601599967100-f16100982063?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D']
      );
    } catch (_) {
      // Ignorar si alguna tabla aún no está disponible
    }
    await syncAdminAccountInDatabase(pool);
    return true;
  } catch (initErr) {
    console.error('\n🚨 ============================================================');
    console.error('❌ ERROR CRÍTICO AL INICIALIZAR LA BASE DE DATOS MYSQL:');
    console.error(`   Mensaje: ${initErr.message}`);
    console.error(`   Código:  ${initErr.code || 'N/A'}`);
    if (initErr.sqlMessage) console.error(`   SQL:     ${initErr.sqlMessage}`);
    console.error('============================================================\n');
    return false;
  }
}

// Inicialización del servidor HTTP únicamente si se ejecuta como proceso principal
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log('============================================================');
    console.log('🥩 DANILLANOS - CÁRNICOS, CONGELADOS E INSUMOS PARA RESTAURANTE');
    console.log(`🚀 Tienda principal:   http://localhost:${PORT}/`);
    console.log(`👤 Perfil y Mapa:      http://localhost:${PORT}/perfil`);
    console.log(`💳 Pasarela de Pagos:  http://localhost:${PORT}/pagos`);
    console.log(`🛠️  Panel Operativo:    http://localhost:${PORT}/panel`);
    console.log('============================================================');
    await autoInitializeDatabaseIfEmpty();
  });
}

module.exports = app;
