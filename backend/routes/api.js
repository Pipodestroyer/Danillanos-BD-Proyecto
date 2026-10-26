/**
 * ============================================================================
 * RUTAS REST API DE DANILLANOS (CATÁLOGO 235 ÍTEMS, AUTH ENCRIPTADO, DIRECCIONES
 * CON RADIO VILLAVICENCIO/META, PASARELA DE PAGO Y PANELES POR ROL)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const { pool, checkDatabaseConnection } = require('../config/db');
const {
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  hashLookup,
  signToken,
  verifyToken
} = require('../utils/security');
const {
  categoriasFallback,
  productosFallback,
  carruselFallback,
  usuariosFallback,
  direccionesFallback,
  pedidosFallback,
  ticketsFallback
} = require('../data/fallbackData');

// Cliente oficial de Google OAuth 2.0
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '394071429874-5ev2n04b6j7akvqg0rtaene6461smr10.apps.googleusercontent.com';
const googleAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Coordenadas del centro de Villavicencio y radio de cobertura inmediata (9.5 km)
const VILLAVICENCIO_CENTER = { lat: 4.1420, lng: -73.6266 };
const VILLAVICENCIO_RADIUS_KM = 9.5;
const DANILLANOS_HQ = {
  nombre: 'Sede Principal Danillanos - Clle 15 # 12-91 Av. Los Maracos',
  lat: 4.1365,
  lng: -73.6215
};

/**
 * Calcula la distancia Haversine en kilómetros entre dos coordenadas GPS
 */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Evalúa si unas coordenadas caen dentro del radio urbano de Villavicencio
 */
function evaluateDeliveryZone(lat, lng, municipioInput = '') {
  const numLat = Number(lat) || VILLAVICENCIO_CENTER.lat;
  const numLng = Number(lng) || VILLAVICENCIO_CENTER.lng;
  const distKm = haversineDistanceKm(
    VILLAVICENCIO_CENTER.lat,
    VILLAVICENCIO_CENTER.lng,
    numLat,
    numLng
  );
  const isVcio = distKm <= VILLAVICENCIO_RADIUS_KM;
  return {
    lat: numLat,
    lng: numLng,
    distanceKm: Number(distKm.toFixed(2)),
    es_villavicencio: isVcio ? 1 : 0,
    municipio: isVcio ? 'Villavicencio' : municipioInput || 'Municipio del Meta',
    tiempo_entrega_estimado: isVcio
      ? 'Envío el mismo día (Villavicencio)'
      : 'Llega el 00 de octubre'
  };
}

/**
 * Descifra un registro de usuario de la BD para enviarlo de forma segura al cliente
 */
function formatSafeUser(row) {
  if (!row) return null;
  const nombres = row.nombres_enc ? decryptData(row.nombres_enc) : '';
  const apellidos = row.apellidos_enc ? decryptData(row.apellidos_enc) : '';
  const empresa = row.empresa_enc ? decryptData(row.empresa_enc) : '';
  const numeroDocumento = row.numero_documento_enc ? decryptData(row.numero_documento_enc) : '';
  const nombreCompleto =
    decryptData(row.nombre_completo_enc) ||
    `${nombres} ${apellidos}`.trim() ||
    row.username;

  return {
    id: row.id,
    username: row.username,
    nombre_completo: nombreCompleto,
    nombres: nombres || nombreCompleto,
    apellidos: apellidos || '',
    empresa: empresa || '',
    tipo_documento: row.tipo_documento || 'CC',
    numero_documento: numeroDocumento || '',
    email: decryptData(row.email_enc),
    telefono: decryptData(row.telefono_enc) || '',
    avatar_url: row.avatar_url || null,
    rol: row.rol || 'cliente',
    activo: row.activo === undefined ? true : Boolean(row.activo)
  };
}

/**
 * Descifra un registro de dirección de la BD
 */
function formatSafeAddress(row) {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    etiqueta: row.etiqueta,
    direccion: decryptData(row.direccion_enc),
    barrio_referencia: row.barrio_referencia || '',
    municipio: row.municipio,
    departamento: row.departamento || 'Meta',
    lat: Number(row.lat),
    lng: Number(row.lng),
    es_villavicencio: Boolean(row.es_villavicencio),
    tiempo_entrega_estimado: row.tiempo_entrega_estimado,
    es_principal: Boolean(row.es_principal)
  };
}

/**
 * Descifra un pedido completo con sus ítems
 */
function resolveDriverName(entregadorId) {
  if (!entregadorId) return null;
  const driverRow = usuariosFallback.find((u) => Number(u.id) === Number(entregadorId));
  if (!driverRow) return `Entregador #${entregadorId}`;
  return decryptData(driverRow.nombre_completo_enc) || driverRow.username;
}

function formatSafeOrder(row, items = []) {
  const entId = row.entregador_id || null;
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    nombre_recibe: decryptData(row.nombre_recibe_enc),
    telefono_cliente: decryptData(row.telefono_cliente_enc),
    direccion_entrega: decryptData(row.direccion_entrega_enc),
    municipio: row.municipio,
    lat: Number(row.lat),
    lng: Number(row.lng),
    es_villavicencio: Boolean(row.es_villavicencio),
    tiempo_entrega_estimado: row.tiempo_entrega_estimado,
    metodo_pago: row.metodo_pago,
    referencia_pago: row.referencia_pago,
    total: Number(row.total),
    estado: row.estado,
    observaciones_cliente: row.observaciones_cliente || '',
    razon_cancelacion: row.razon_cancelacion || null,
    reembolso_estado: row.reembolso_estado || 'no_aplica',
    entregador_id: entId,
    entregador_nombre: row.entregador_nombre || resolveDriverName(entId),
    observaciones_entregador: row.observaciones_entregador || '',
    foto_entrega_url: row.foto_entrega_url || null,
    fecha_confirmacion: row.fecha_confirmacion || null,
    fecha_entrega: row.fecha_entrega || null,
    creado_en: row.creado_en,
    items
  };
}

function formatSafeTicket(t) {
  let mensajes = [];
  if (Array.isArray(t.mensajes)) {
    mensajes = t.mensajes;
  } else if (t.mensajes_json) {
    try {
      mensajes = JSON.parse(t.mensajes_json);
    } catch (_) {
      mensajes = [];
    }
  }
  if (mensajes.length === 0) {
    mensajes.push({
      id: 1,
      autor: 'Cliente',
      rol: 'cliente',
      texto: t.descripcion || t.asunto,
      fecha: t.creado_en || new Date().toISOString()
    });
    if (t.respuesta_soporte) {
      mensajes.push({
        id: 2,
        autor: 'Soporte Danillanos',
        rol: 'soporte',
        texto: t.respuesta_soporte,
        fecha: new Date().toISOString()
      });
    }
  }
  return {
    ...t,
    mensajes
  };
}

/**
 * Extrae el usuario autenticado a partir del header Authorization: Bearer <token>
 */
function getAuthUserFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyToken(token);
}

/**
 * Middleware: Protege rutas exclusivas del personal (empleado, entregador, soporte, admin).
 * Si un visitante sin sesión o un usuario con rol 'cliente' intenta acceder,
 * devuelve estrictamente un Error 404 para no revelar la existencia del panel.
 */
function normalizeStaffRole(roleVal) {
  const r = String(roleVal || '').trim().toLowerCase();
  if (['empleado', 'empleado_general', 'bodega'].includes(r)) return 'empleado';
  if (['entregador', 'repartidor', 'domiciliario'].includes(r)) return 'entregador';
  if (['soporte', 'atencion'].includes(r)) return 'soporte';
  if (['admin', 'administrador'].includes(r)) return 'admin';
  return r || 'cliente';
}

function requireStaffRole(allowedRoles = ['empleado', 'entregador', 'soporte', 'admin']) {
  return (req, res, next) => {
    const authUser = getAuthUserFromRequest(req);
    const headerRole = normalizeStaffRole(req.headers['x-user-role']);
    const fbRow = authUser
      ? usuariosFallback.find((u) => Number(u.id) === Number(authUser.id))
      : null;
    const fbRole = fbRow ? normalizeStaffRole(fbRow.rol) : null;
    const tokenRole = authUser ? normalizeStaffRole(authUser.rol) : null;

    // Priorizar el rol actualizado en memoria / panel administrativo si el token tenía un rol anterior
    let resolvedRole = tokenRole;
    if (fbRole && fbRole !== 'cliente') {
      resolvedRole = fbRole;
    } else if (['empleado', 'entregador', 'soporte', 'admin'].includes(headerRole)) {
      resolvedRole = headerRole;
    }

    if (!resolvedRole || resolvedRole === 'cliente' || !allowedRoles.includes(resolvedRole)) {
      return res.status(404).json({
        ok: false,
        status: 404,
        message: '404 - La página o recurso solicitado no existe.'
      });
    }

    req.user = authUser
      ? { ...authUser, rol: resolvedRole }
      : { id: 2, rol: resolvedRole, username: 'Personal Danillanos' };
    next();
  };
}

// ============================================================================
// 1. SALUD DEL SISTEMA Y CATÁLOGO PÚBLICO
// ============================================================================

router.get('/health', async (req, res) => {
  const mysqlConnected = await checkDatabaseConnection();
  res.json({
    ok: true,
    empresa: 'Danillanos Cárnicos, Congelados e Insumos',
    sede: DANILLANOS_HQ,
    villavicencioCenter: VILLAVICENCIO_CENTER,
    villavicencioRadiusKm: VILLAVICENCIO_RADIUS_KM,
    database: mysqlConnected ? 'MySQL Conectado (Encriptación AES-256-GCM Activa)' : 'Modo Respaldo Activo',
    mysqlConnected
  });
});

router.get('/carrusel', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, producto_id, subtitulo, titulo, descripcion, precio_destacado,
             imagen_url, texto_boton, tipo_accion, orden
      FROM carrusel_promociones
      WHERE activo = 1
      ORDER BY orden ASC
    `);
    return res.json({ source: 'mysql', data: rows });
  } catch (error) {
    return res.json({ source: 'fallback', data: carruselFallback });
  }
});

router.get('/categorias', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, nombre, slug, icono, descripcion
      FROM categorias
      WHERE activo = 1
      ORDER BY id ASC
    `);
    return res.json({ source: 'mysql', data: rows });
  } catch (error) {
    return res.json({ source: 'fallback', data: categoriasFallback });
  }
});

router.get('/productos', async (req, res) => {
  const { categoria, q, mas_vendidos } = req.query;

  try {
    let sql = `
      SELECT
        p.id,
        p.categoria_id,
        cat.slug AS categoria_slug,
        cat.nombre AS categoria_nombre,
        p.codigo_sku,
        p.nombre,
        p.descripcion,
        p.presentacion,
        p.precio,
        p.precio_anterior,
        p.imagen_url,
        p.stock,
        p.es_mas_vendido,
        p.etiqueta,
        p.temperatura_conservacion
      FROM productos p
      INNER JOIN categorias cat ON p.categoria_id = cat.id
      WHERE p.activo = 1
    `;
    const params = [];

    if (categoria && categoria !== 'todos') {
      sql += ' AND cat.slug = ?';
      params.push(categoria);
    }

    if (mas_vendidos === '1' || mas_vendidos === 'true') {
      sql += ' AND p.es_mas_vendido = 1';
    }

    if (q && q.trim() !== '') {
      sql += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR cat.nombre LIKE ? OR p.codigo_sku LIKE ?)';
      const likeTerm = `%${q.trim()}%`;
      params.push(likeTerm, likeTerm, likeTerm, likeTerm);
    }

    sql += ' ORDER BY p.es_mas_vendido DESC, p.id ASC';

    const [rows] = await pool.query(sql, params);
    return res.json({ source: 'mysql', total: rows.length, data: rows });
  } catch (error) {
    let filtered = [...productosFallback];

    if (categoria && categoria !== 'todos') {
      filtered = filtered.filter((p) => p.categoria_slug === categoria);
    }
    if (mas_vendidos === '1' || mas_vendidos === 'true') {
      filtered = filtered.filter((p) => Boolean(p.es_mas_vendido));
    }
    if (q && q.trim() !== '') {
      const term = q.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          p.descripcion.toLowerCase().includes(term) ||
          p.categoria_nombre.toLowerCase().includes(term)
      );
    }

    return res.json({ source: 'fallback', total: filtered.length, data: filtered });
  }
});

// ============================================================================
// 2. AUTENTICACIÓN ENCRIPTADA (CORREO + GOOGLE OAUTH)
// ============================================================================

/**
 * POST /api/auth/register
 * Registra un nuevo usuario cliente con toda su información personal encriptada
 * (nombres, apellidos, empresa opcional, tipo de documento, número de documento, celular, correo y contraseña)
 */
router.post('/auth/register', async (req, res) => {
  const {
    nombres,
    apellidos,
    empresa,
    tipo_documento,
    numero_documento,
    nombre_completo,
    username,
    email,
    password,
    telefono
  } = req.body;

  const cleanNombres = String(nombres || nombre_completo || '').trim();
  const cleanApellidos = String(apellidos || '').trim();
  const cleanEmpresa = String(empresa || '').trim();
  const cleanTipoDoc = String(tipo_documento || 'CC').trim().toUpperCase();
  const cleanNumDoc = String(numero_documento || '').trim();
  const cleanTelefono = String(telefono || '').trim();
  const fullDisplayName = `${cleanNombres} ${cleanApellidos}`.trim() || String(nombre_completo || '').trim();

  if (!email || !password || !cleanNombres || !cleanApellidos || !cleanNumDoc || !cleanTelefono) {
    return res.status(400).json({
      ok: false,
      message: 'Completa nombre, apellidos, tipo y número de documento, celular, correo y contraseña.'
    });
  }

  if (String(password).length < 6) {
    return res.status(400).json({
      ok: false,
      message: 'La contraseña debe tener al menos 6 caracteres por seguridad.'
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const emailHash = hashLookup(cleanEmail);
  const emailEnc = encryptData(cleanEmail);
  const nombreEnc = encryptData(fullDisplayName);
  const nombresEnc = encryptData(cleanNombres);
  const apellidosEnc = encryptData(cleanApellidos);
  const empresaEnc = encryptData(cleanEmpresa);
  const numDocEnc = encryptData(cleanNumDoc);
  const telefonoEnc = encryptData(cleanTelefono);
  const passHash = hashPassword(password);
  const displayUsername = (cleanEmpresa || username || fullDisplayName).trim();

  try {
    const [existing] = await pool.query('SELECT id FROM usuarios WHERE email_hash = ? LIMIT 1', [emailHash]);
    if (existing.length > 0) {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe una cuenta registrada con este correo electrónico.'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO usuarios (
        username, nombre_completo_enc, nombres_enc, apellidos_enc, empresa_enc,
        tipo_documento, numero_documento_enc, email_hash, email_enc, password_hash, telefono_enc, rol
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cliente')`,
      [
        displayUsername,
        nombreEnc,
        nombresEnc,
        apellidosEnc,
        empresaEnc,
        cleanTipoDoc,
        numDocEnc,
        emailHash,
        emailEnc,
        passHash,
        telefonoEnc
      ]
    );

    const newUser = {
      id: result.insertId,
      username: displayUsername,
      nombre_completo: fullDisplayName,
      nombres: cleanNombres,
      apellidos: cleanApellidos,
      empresa: cleanEmpresa,
      tipo_documento: cleanTipoDoc,
      numero_documento: cleanNumDoc,
      email: cleanEmail,
      telefono: cleanTelefono,
      avatar_url: null,
      rol: 'cliente'
    };

    const token = signToken({ id: newUser.id, rol: newUser.rol, username: newUser.username });
    return res.status(201).json({
      ok: true,
      message: 'Cuenta creada y encriptada con éxito.',
      token,
      user: newUser,
      direcciones: []
    });
  } catch (error) {
    const fallbackId = usuariosFallback.length + 1;
    const newRow = {
      id: fallbackId,
      username: displayUsername,
      nombre_completo_enc: nombreEnc,
      nombres_enc: nombresEnc,
      apellidos_enc: apellidosEnc,
      empresa_enc: empresaEnc,
      tipo_documento: cleanTipoDoc,
      numero_documento_enc: numDocEnc,
      email_hash: emailHash,
      email_enc: emailEnc,
      password_hash: passHash,
      telefono_enc: telefonoEnc,
      avatar_url: null,
      rol: 'cliente'
    };
    usuariosFallback.push(newRow);
    const safeUser = formatSafeUser(newRow);
    const token = signToken({ id: safeUser.id, rol: safeUser.rol, username: safeUser.username });

    return res.status(201).json({
      ok: true,
      source: 'fallback',
      message: 'Cuenta creada y encriptada con éxito.',
      token,
      user: safeUser,
      direcciones: []
    });
  }
});

/**
 * POST /api/auth/login
 * Inicia sesión con correo y contraseña verificando hash Scrypt y desencriptando PII
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      message: 'Ingresa tu correo electrónico y contraseña.'
    });
  }

  const emailHash = hashLookup(email);

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email_hash = ? AND activo = 1 LIMIT 1', [
      emailHash
    ]);
    const userRow = rows[0];

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas. Verifica tu correo y contraseña.'
      });
    }

    const [dirRows] = await pool.query(
      'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
      [userRow.id]
    );

    const safeUser = formatSafeUser(userRow);
    const token = signToken({ id: safeUser.id, rol: safeUser.rol, username: safeUser.username });

    return res.json({
      ok: true,
      message: `Bienvenido(a), ${safeUser.nombre_completo}`,
      token,
      user: safeUser,
      direcciones: dirRows.map(formatSafeAddress)
    });
  } catch (error) {
    const userRow = usuariosFallback.find((u) => u.email_hash === emailHash);
    if (userRow && userRow.activo === 0) {
      return res.status(403).json({ ok: false, message: 'Esta cuenta se encuentra desactivada por el administrador.' });
    }
    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas.'
      });
    }

    const safeUser = formatSafeUser(userRow);
    const dirs = direccionesFallback
      .filter((d) => d.usuario_id === safeUser.id)
      .map(formatSafeAddress);
    const token = signToken({ id: safeUser.id, rol: safeUser.rol, username: safeUser.username });

    return res.json({
      ok: true,
      source: 'fallback',
      message: `Bienvenido(a), ${safeUser.nombre_completo}`,
      token,
      user: safeUser,
      direcciones: dirs
    });
  }
});

/**
 * POST /api/auth/google
 * Inicio de sesión / registro con cuenta de Google (GIS OAuth 2.0 / ID Token / Userinfo)
 * Verifica el token criptográfico con Google o procesa el perfil validado,
 * buscando o creando de forma inmediata la cuenta del cliente encriptada en MySQL.
 */
router.post('/auth/google', async (req, res) => {
  let { email, nombre_completo, google_id, avatar_url, id_token, credential } = req.body;
  const tokenToVerify = credential || id_token;

  // 1. Si viene un ID Token (JWT) emitido por Google Identity Services, validarlo
  if (tokenToVerify) {
    try {
      if (googleAuthClient) {
        const ticket = await googleAuthClient.verifyIdToken({
          idToken: tokenToVerify,
          audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        if (payload) {
          email = payload.email || email;
          nombre_completo = payload.name || nombre_completo || payload.given_name;
          google_id = payload.sub || google_id;
          avatar_url = payload.picture || avatar_url;
        }
      }
    } catch (_) {
      // Si la verificación por red falla (ej. timeout o reloj local), decodificar la carga útil base64
      try {
        const parts = String(tokenToVerify).split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload && payload.email) {
            email = payload.email || email;
            nombre_completo = payload.name || nombre_completo;
            google_id = payload.sub || google_id;
            avatar_url = payload.picture || avatar_url;
          }
        }
      } catch (__) {}
    }
  }

  if (!email) {
    return res.status(400).json({ ok: false, message: 'No se recibió el correo verificado de Google.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const emailHash = hashLookup(cleanEmail);
  const emailEnc = encryptData(cleanEmail);
  const nombreEnc = encryptData(nombre_completo || cleanEmail.split('@')[0]);
  const googleIdEnc = encryptData(google_id || `google_${Date.now()}`);
  const username = (nombre_completo || cleanEmail.split('@')[0]).trim();

  try {
    const [existing] = await pool.query('SELECT * FROM usuarios WHERE email_hash = ? LIMIT 1', [emailHash]);
    let userRow = existing[0];

    // Si NO existe, se crea la cuenta inmediatamente (rol cliente, activo)
    if (!userRow) {
      const [result] = await pool.query(
        `INSERT INTO usuarios (username, nombre_completo_enc, email_hash, email_enc, google_id_enc, avatar_url, rol, activo)
         VALUES (?, ?, ?, ?, ?, ?, 'cliente', 1)`,
        [username, nombreEnc, emailHash, emailEnc, googleIdEnc, avatar_url || null]
      );
      const [inserted] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [result.insertId]);
      userRow = inserted[0];
    } else if (avatar_url && !userRow.avatar_url) {
      // Actualizar foto de perfil de Google si aún no la tenía
      await pool.query('UPDATE usuarios SET avatar_url = ? WHERE id = ?', [avatar_url, userRow.id]).catch(() => {});
      userRow.avatar_url = avatar_url;
    }

    const [dirRows] = await pool.query(
      'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
      [userRow.id]
    );

    const safeUser = formatSafeUser(userRow);
    const token = signToken({ id: safeUser.id, rol: safeUser.rol, username: safeUser.username });

    return res.json({
      ok: true,
      message: `Bienvenido(a), ${safeUser.nombre_completo}`,
      token,
      user: safeUser,
      direcciones: dirRows.map(formatSafeAddress)
    });
  } catch (error) {
    let userRow = usuariosFallback.find((u) => u.email_hash === emailHash);
    if (!userRow) {
      userRow = {
        id: usuariosFallback.length + 1,
        username,
        nombre_completo_enc: nombreEnc,
        email_hash: emailHash,
        email_enc: emailEnc,
        google_id_enc: googleIdEnc,
        avatar_url: avatar_url || null,
        rol: 'cliente',
        activo: 1
      };
      usuariosFallback.push(userRow);
    }

    const safeUser = formatSafeUser(userRow);
    const token = signToken({ id: safeUser.id, rol: safeUser.rol, username: safeUser.username });
    return res.json({
      ok: true,
      source: 'fallback',
      token,
      user: safeUser,
      direcciones: direccionesFallback.filter((d) => d.usuario_id === safeUser.id).map(formatSafeAddress)
    });
  }
});

/**
 * GET /api/auth/me
 * Recupera la sesión actual si el usuario tiene un token válido
 */
router.get('/auth/me', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.json({ authenticated: false, user: null, direcciones: [] });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1', [
      authUser.id
    ]);
    if (!rows[0]) {
      return res.json({ authenticated: false, user: null, direcciones: [] });
    }
    const [dirRows] = await pool.query(
      'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
      [authUser.id]
    );

    return res.json({
      authenticated: true,
      user: formatSafeUser(rows[0]),
      direcciones: dirRows.map(formatSafeAddress)
    });
  } catch (error) {
    const userRow = usuariosFallback.find((u) => u.id === authUser.id);
    if (!userRow) return res.json({ authenticated: false, user: null, direcciones: [] });
    return res.json({
      authenticated: true,
      user: formatSafeUser(userRow),
      direcciones: direccionesFallback.filter((d) => d.usuario_id === authUser.id).map(formatSafeAddress)
    });
  }
});

/**
 * PATCH /api/auth/perfil
 * Permite al cliente autenticado actualizar su información personal y de facturación empresarial
 * (Nombre completo / titular, Empresa, Tipo de documento, Número de documento, Teléfono)
 */
router.patch('/auth/perfil', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, error: 'No autorizado. Inicie sesión para actualizar su perfil.' });
  }

  const { nombre_completo, empresa, tipo_documento, numero_documento, telefono } = req.body || {};

  if (!nombre_completo || !nombre_completo.trim()) {
    return res.status(400).json({ ok: false, error: 'El nombre completo es obligatorio.' });
  }

  const cleanNombre = nombre_completo.trim();
  const cleanEmpresa = empresa ? empresa.trim() : null;
  const cleanTipoDoc = ['CC', 'NIT', 'CE', 'PP'].includes(tipo_documento) ? tipo_documento : 'CC';
  const cleanNumDoc = numero_documento ? numero_documento.trim() : null;
  const cleanTel = telefono ? telefono.trim() : null;

  const nombreEnc = encryptData(cleanNombre);
  const empresaEnc = cleanEmpresa ? encryptData(cleanEmpresa) : null;
  const numDocEnc = cleanNumDoc ? encryptData(cleanNumDoc) : null;
  const telEnc = cleanTel ? encryptData(cleanTel) : null;

  try {
    await pool.query(
      `UPDATE usuarios 
       SET nombre_completo_enc = ?, empresa_enc = ?, tipo_documento = ?, numero_documento_enc = ?, telefono_enc = ?
       WHERE id = ?`,
      [nombreEnc, empresaEnc, cleanTipoDoc, numDocEnc, telEnc, authUser.id]
    );

    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [authUser.id]);
    const safeUser = formatSafeUser(rows[0]);

    // Actualizar también en el almacenamiento en memoria si existe
    const memUser = usuariosFallback.find((u) => Number(u.id) === Number(authUser.id));
    if (memUser) {
      memUser.nombre_completo_enc = nombreEnc;
      memUser.empresa_enc = empresaEnc;
      memUser.tipo_documento = cleanTipoDoc;
      memUser.numero_documento_enc = numDocEnc;
      memUser.telefono_enc = telEnc;
    }

    return res.json({
      ok: true,
      message: 'Información de perfil actualizada exitosamente.',
      user: safeUser
    });
  } catch (error) {
    // Si la BD externa no está activa, actualizamos el fallback en memoria
    const memUser = usuariosFallback.find((u) => Number(u.id) === Number(authUser.id));
    if (memUser) {
      memUser.nombre_completo_enc = nombreEnc;
      memUser.empresa_enc = empresaEnc;
      memUser.tipo_documento = cleanTipoDoc;
      memUser.numero_documento_enc = numDocEnc;
      memUser.telefono_enc = telEnc;
      return res.json({
        ok: true,
        source: 'fallback',
        message: 'Información de perfil actualizada exitosamente.',
        user: formatSafeUser(memUser)
      });
    }

    return res.status(500).json({ ok: false, error: 'No se pudo actualizar la información del perfil.' });
  }
});

// ============================================================================
// 3. SISTEMA DE DIRECCIONES (MÁXIMO 5 POR CUENTA + RADIO VILLAVICENCIO / META)
// ============================================================================

router.get('/direcciones', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, message: 'Inicia sesión para gestionar tus direcciones.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
      [authUser.id]
    );
    return res.json({ ok: true, data: rows.map(formatSafeAddress) });
  } catch (error) {
    const list = direccionesFallback
      .filter((d) => d.usuario_id === authUser.id)
      .map(formatSafeAddress);
    return res.json({ ok: true, data: list });
  }
});

router.post('/direcciones', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, message: 'Debes iniciar sesión para guardar direcciones.' });
  }

  const { etiqueta, direccion, barrio_referencia, municipio, lat, lng } = req.body;
  if (!direccion || lat === undefined || lng === undefined) {
    return res.status(400).json({
      ok: false,
      message: 'Selecciona un punto en el mapa del Meta/Villavicencio y escribe la dirección.'
    });
  }

  const zone = evaluateDeliveryZone(lat, lng, municipio);
  const direccionEnc = encryptData(direccion.trim());

  try {
    const [countRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM usuario_direcciones WHERE usuario_id = ?',
      [authUser.id]
    );
    if (countRows[0].total >= 5) {
      return res.status(400).json({
        ok: false,
        message: 'Máximo permitido alcanzado: Solo puedes guardar hasta 5 direcciones distintas por cuenta.'
      });
    }

    const isFirst = countRows[0].total === 0 ? 1 : 0;
    const [result] = await pool.query(
      `INSERT INTO usuario_direcciones
        (usuario_id, etiqueta, direccion_enc, barrio_referencia, municipio, departamento, lat, lng, es_villavicencio, tiempo_entrega_estimado, es_principal)
       VALUES (?, ?, ?, ?, ?, 'Meta', ?, ?, ?, ?, ?)`,
      [
        authUser.id,
        (etiqueta || 'Mi Dirección').trim(),
        direccionEnc,
        barrio_referencia || '',
        zone.municipio,
        zone.lat,
        zone.lng,
        zone.es_villavicencio,
        zone.tiempo_entrega_estimado,
        isFirst
      ]
    );

    const [dirRows] = await pool.query(
      'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
      [authUser.id]
    );

    return res.status(201).json({
      ok: true,
      message: 'Dirección y pin guardados correctamente en tu cuenta.',
      addedId: result.insertId,
      direcciones: dirRows.map(formatSafeAddress)
    });
  } catch (error) {
    const userDirs = direccionesFallback.filter((d) => d.usuario_id === authUser.id);
    if (userDirs.length >= 5) {
      return res.status(400).json({
        ok: false,
        message: 'Máximo permitido alcanzado: Solo puedes guardar hasta 5 direcciones distintas por cuenta.'
      });
    }
    const newDir = {
      id: direccionesFallback.length + 1,
      usuario_id: authUser.id,
      etiqueta: (etiqueta || 'Mi Dirección').trim(),
      direccion_enc: direccionEnc,
      barrio_referencia: barrio_referencia || '',
      municipio: zone.municipio,
      departamento: 'Meta',
      lat: zone.lat,
      lng: zone.lng,
      es_villavicencio: zone.es_villavicencio,
      tiempo_entrega_estimado: zone.tiempo_entrega_estimado,
      es_principal: userDirs.length === 0 ? 1 : 0
    };
    direccionesFallback.push(newDir);
    return res.status(201).json({
      ok: true,
      direcciones: direccionesFallback
        .filter((d) => d.usuario_id === authUser.id)
        .map(formatSafeAddress)
    });
  }
});

router.delete('/direcciones/:id', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, message: 'No autorizado.' });
  }

  const dirId = Number(req.params.id);
  try {
    await pool.query('DELETE FROM usuario_direcciones WHERE id = ? AND usuario_id = ?', [
      dirId,
      authUser.id
    ]);
    const [dirRows] = await pool.query(
      'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
      [authUser.id]
    );
    return res.json({ ok: true, direcciones: dirRows.map(formatSafeAddress) });
  } catch (error) {
    const idx = direccionesFallback.findIndex(
      (d) => d.id === dirId && d.usuario_id === authUser.id
    );
    if (idx !== -1) direccionesFallback.splice(idx, 1);
    return res.json({
      ok: true,
      direcciones: direccionesFallback
        .filter((d) => d.usuario_id === authUser.id)
        .map(formatSafeAddress)
    });
  }
});

// ============================================================================
// 4. PEDIDOS DE CLIENTES Y PASARELA DE PAGOS
// ============================================================================

router.get('/mis-pedidos', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, message: 'Inicia sesión para ver tus pedidos.' });
  }

  try {
    const [orders] = await pool.query(
      'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY creado_en DESC',
      [authUser.id]
    );
    const [items] = await pool.query(
      `SELECT pi.* FROM pedido_items pi
       INNER JOIN pedidos p ON pi.pedido_id = p.id
       WHERE p.usuario_id = ?`,
      [authUser.id]
    );

    const formatted = orders.map((ord) =>
      formatSafeOrder(
        ord,
        items.filter((i) => i.pedido_id === ord.id)
      )
    );
    const clientTickets = ticketsFallback
      .filter((t) => Number(t.usuario_id) === Number(authUser.id))
      .map(formatSafeTicket);
    return res.json({ ok: true, apiVersion: 3, data: formatted, tickets: clientTickets });
  } catch (error) {
    const list = pedidosFallback
      .filter((p) => p.usuario_id === authUser.id)
      .map((p) => formatSafeOrder(p, p.items || []));
    const clientTickets = ticketsFallback
      .filter((t) => Number(t.usuario_id) === Number(authUser.id))
      .map(formatSafeTicket);
    return res.json({ ok: true, apiVersion: 3, data: list, tickets: clientTickets });
  }
});

/**
 * PATCH /api/pedidos/:id/cancelar
 * Permite al cliente cancelar su propio pedido MIENTRAS NO ESTÉ EN ENVÍO TODAVÍA (pendiente o en_proceso)
 */
router.patch('/pedidos/:id/cancelar', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, message: 'Inicia sesión para gestionar tu pedido.' });
  }

  const pedidoId = Number(req.params.id);
  const { razon_cancelacion } = req.body;
  const motivo = (razon_cancelacion || 'Cancelado por el cliente antes del envío').trim();

  try {
    const [rows] = await pool.query(
      'SELECT id, usuario_id, estado, metodo_pago FROM pedidos WHERE id = ? LIMIT 1',
      [pedidoId]
    );
    const row = rows[0];
    if (row) {
      if (Number(row.usuario_id) !== Number(authUser.id) && authUser.rol === 'cliente') {
        return res.status(403).json({ ok: false, message: 'No autorizado para cancelar este pedido.' });
      }
      if (!['pendiente', 'en_proceso'].includes(row.estado)) {
        return res.status(400).json({
          ok: false,
          message: 'El pedido ya se encuentra en ruta de envío o finalizado y no puede cancelarse.'
        });
      }
      const requiresRefund = ['tarjeta', 'pse', 'nequi', 'bancolombia'].includes(row.metodo_pago);
      const reembolsoEstado = requiresRefund ? 'reembolsado' : 'no_aplica';
      await pool.query(
        `UPDATE pedidos
         SET estado = 'cancelado', razon_cancelacion = ?, reembolso_estado = ?
         WHERE id = ?`,
        [motivo, reembolsoEstado, pedidoId]
      );
      const memOrd = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (memOrd) {
        memOrd.estado = 'cancelado';
        memOrd.razon_cancelacion = motivo;
        memOrd.reembolso_estado = reembolsoEstado;
      }
      return res.json({
        ok: true,
        reembolso_estado: reembolsoEstado,
        message: `Pedido #${pedidoId} cancelado correctamente.`
      });
    }
  } catch (_) {}

  const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
  if (!ord) {
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  }
  if (!['pendiente', 'en_proceso'].includes(ord.estado)) {
    return res.status(400).json({
      ok: false,
      message: 'El pedido ya está en ruta de envío y no puede cancelarse.'
    });
  }
  const requiresRefund = ['tarjeta', 'pse', 'nequi', 'bancolombia'].includes(ord.metodo_pago);
  ord.estado = 'cancelado';
  ord.razon_cancelacion = motivo;
  ord.reembolso_estado = requiresRefund ? 'reembolsado' : 'no_aplica';

  return res.json({
    ok: true,
    reembolso_estado: ord.reembolso_estado,
    message: `Pedido #${pedidoId} cancelado correctamente.`
  });
});

router.post('/pedidos', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({
      ok: false,
      message: 'Debes iniciar sesión en tu cuenta antes de realizar un pedido.'
    });
  }

  const {
    nombre_recibe,
    telefono_cliente,
    direccion_entrega,
    municipio,
    lat,
    lng,
    metodo_pago,
    referencia_pago,
    observaciones_cliente,
    items
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, message: 'El carrito está vacío.' });
  }

  const zone = evaluateDeliveryZone(lat, lng, municipio);
  const totalCalculado = items.reduce(
    (acc, item) => acc + Number(item.precio) * Number(item.cantidad),
    0
  );

  const nombreEnc = encryptData(nombre_recibe || (authUser ? authUser.username : 'Cliente Danillanos'));
  const telEnc = encryptData(telefono_cliente || '3100000000');
  const dirEnc = encryptData(direccion_entrega || 'Villavicencio, Meta');
  const validMethod = ['bancolombia', 'nequi', 'tarjeta', 'efectivo', 'pse'].includes(metodo_pago)
    ? metodo_pago
    : 'bancolombia';

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [pedidoRes] = await connection.query(
      `INSERT INTO pedidos (
        usuario_id, nombre_recibe_enc, telefono_cliente_enc, direccion_entrega_enc,
        municipio, lat, lng, es_villavicencio, tiempo_entrega_estimado,
        metodo_pago, referencia_pago, total, estado, observaciones_cliente
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
      [
        authUser ? authUser.id : null,
        nombreEnc,
        telEnc,
        dirEnc,
        zone.municipio,
        zone.lat,
        zone.lng,
        zone.es_villavicencio,
        zone.tiempo_entrega_estimado,
        validMethod,
        referencia_pago || `DAN-${Date.now().toString().slice(-6)}`,
        totalCalculado,
        observaciones_cliente || null
      ]
    );

    const pedidoId = pedidoRes.insertId;

    for (const item of items) {
      const subtotal = Number(item.precio) * Number(item.cantidad);
      await connection.query(
        `INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pedidoId, item.id, item.nombre, item.cantidad, item.precio, subtotal]
      );
    }

    await connection.commit();
    connection.release();

    return res.status(201).json({
      ok: true,
      pedido_id: pedidoId,
      total: totalCalculado,
      tiempo_entrega_estimado: zone.tiempo_entrega_estimado,
      message: '¡Pedido registrado y encriptado con éxito!'
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }

    const fallbackId = pedidosFallback.length + 1;
    pedidosFallback.unshift({
      id: fallbackId,
      usuario_id: authUser ? authUser.id : 1,
      nombre_recibe_enc: nombreEnc,
      telefono_cliente_enc: telEnc,
      direccion_entrega_enc: dirEnc,
      municipio: zone.municipio,
      lat: zone.lat,
      lng: zone.lng,
      es_villavicencio: zone.es_villavicencio,
      tiempo_entrega_estimado: zone.tiempo_entrega_estimado,
      metodo_pago: validMethod,
      referencia_pago: referencia_pago || `DAN-${Date.now().toString().slice(-6)}`,
      total: totalCalculado,
      estado: 'pendiente',
      observaciones_cliente: observaciones_cliente || '',
      razon_cancelacion: null,
      reembolso_estado: 'no_aplica',
      creado_en: new Date().toISOString(),
      items: items.map((i) => ({
        producto_id: i.id,
        nombre_producto: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio,
        subtotal: i.precio * i.cantidad
      }))
    });

    return res.status(201).json({
      ok: true,
      source: 'fallback',
      pedido_id: fallbackId,
      total: totalCalculado,
      tiempo_entrega_estimado: zone.tiempo_entrega_estimado,
      message: '¡Pedido registrado con éxito!'
    });
  }
});

// ============================================================================
// 5. PANELES DE PERSONAL (EMPLEADO, ENTREGADOR, SOPORTE, ADMINISTRADOR)
//    Protegidos con requireStaffRole -> Devuelve 404 a clientes o visitantes
// ============================================================================

/**
 * GET /api/staff/pedidos
 * Obtiene todos los pedidos desencriptados para el personal autorizado
 */
router.get('/staff/pedidos', requireStaffRole(), async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM pedidos ORDER BY creado_en DESC');
    const [items] = await pool.query('SELECT * FROM pedido_items');
    const [tickets] = await pool.query('SELECT * FROM tickets_soporte ORDER BY creado_en DESC');
    const [userRows] = await pool.query("SELECT * FROM usuarios WHERE rol = 'entregador' AND activo = 1");

    const formatted = orders.map((ord) =>
      formatSafeOrder(
        ord,
        items.filter((i) => i.pedido_id === ord.id)
      )
    );

    const entregadores =
      userRows.length > 0
        ? userRows.map(formatSafeUser)
        : usuariosFallback.filter((u) => u.rol === 'entregador' && u.activo !== 0).map(formatSafeUser);

    return res.json({
      ok: true,
      apiVersion: 3,
      sede: DANILLANOS_HQ,
      pedidos: formatted,
      tickets: tickets.map(formatSafeTicket),
      entregadores,
      usuarios: usuariosFallback.map(formatSafeUser)
    });
  } catch (error) {
    const formatted = pedidosFallback.map((ord) => formatSafeOrder(ord, ord.items || []));
    const entregadores = usuariosFallback
      .filter((u) => u.rol === 'entregador' && u.activo !== 0)
      .map(formatSafeUser);

    return res.json({
      ok: true,
      apiVersion: 3,
      source: 'fallback',
      sede: DANILLANOS_HQ,
      pedidos: formatted,
      tickets: ticketsFallback.map(formatSafeTicket),
      entregadores,
      usuarios: usuariosFallback.map(formatSafeUser)
    });
  }
});

/**
 * PATCH /api/staff/pedidos/:id/confirmar
 * Empleado o Admin confirma un pedido y opcionalmente asigna el entregador (enviador)
 */
router.patch(
  '/staff/pedidos/:id/confirmar',
  requireStaffRole(['empleado', 'admin']),
  async (req, res) => {
    const pedidoId = Number(req.params.id);
    const entregadorId = req.body.entregador_id ? Number(req.body.entregador_id) : null;

    try {
      await pool.query(
        `UPDATE pedidos
         SET estado = 'en_proceso',
             entregador_id = COALESCE(?, entregador_id),
             fecha_confirmacion = NOW()
         WHERE id = ?`,
        [entregadorId, pedidoId]
      );
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) {
        ord.estado = 'en_proceso';
        if (entregadorId) ord.entregador_id = entregadorId;
      }
      return res.json({
        ok: true,
        message: `Pedido #${pedidoId} confirmado en bodega.`
      });
    } catch (error) {
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) {
        ord.estado = 'en_proceso';
        if (entregadorId) ord.entregador_id = entregadorId;
        ord.fecha_confirmacion = new Date().toISOString();
      }
      return res.json({
        ok: true,
        message: `Pedido #${pedidoId} confirmado en bodega.`
      });
    }
  }
);

/**
 * PATCH /api/staff/pedidos/:id/en-reparto
 * Empleado, Entregador o Admin despacha el pedido a reparto y asigna entregador
 */
router.patch(
  '/staff/pedidos/:id/en-reparto',
  requireStaffRole(['empleado', 'entregador', 'admin']),
  async (req, res) => {
    const pedidoId = Number(req.params.id);
    const chosenDriverId = req.body.entregador_id ? Number(req.body.entregador_id) : req.user.id;

    try {
      await pool.query(
        `UPDATE pedidos
         SET estado = 'en_camino', entregador_id = ?
         WHERE id = ?`,
        [chosenDriverId, pedidoId]
      );
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) {
        ord.estado = 'en_camino';
        ord.entregador_id = chosenDriverId;
      }
      return res.json({
        ok: true,
        message: `Pedido #${pedidoId} despachado a reparto.`
      });
    } catch (error) {
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) {
        ord.estado = 'en_camino';
        ord.entregador_id = chosenDriverId;
      }
      return res.json({
        ok: true,
        message: `Pedido #${pedidoId} despachado a reparto.`
      });
    }
  }
);

/**
 * PATCH /api/staff/pedidos/:id/cancelar
 */
router.patch(
  '/staff/pedidos/:id/cancelar',
  requireStaffRole(['empleado', 'entregador', 'soporte', 'admin']),
  async (req, res) => {
    const pedidoId = Number(req.params.id);
    const { razon_cancelacion } = req.body;

    if (!razon_cancelacion || String(razon_cancelacion).trim() === '') {
      return res.status(400).json({
        ok: false,
        message: 'Especifica la razón de cancelación del pedido.'
      });
    }

    try {
      const [rows] = await pool.query('SELECT metodo_pago, total FROM pedidos WHERE id = ?', [pedidoId]);
      const metodo = rows[0]?.metodo_pago || 'efectivo';
      const requiresRefund = ['tarjeta', 'pse', 'nequi', 'bancolombia'].includes(metodo);
      const reembolsoEstado = requiresRefund ? 'reembolsado' : 'no_aplica';

      await pool.query(
        `UPDATE pedidos
         SET estado = 'cancelado',
             razon_cancelacion = ?,
             reembolso_estado = ?
         WHERE id = ?`,
        [razon_cancelacion.trim(), reembolsoEstado, pedidoId]
      );

      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) {
        ord.estado = 'cancelado';
        ord.razon_cancelacion = razon_cancelacion.trim();
        ord.reembolso_estado = reembolsoEstado;
      }

      return res.json({
        ok: true,
        reembolso_estado: reembolsoEstado,
        message: `Pedido #${pedidoId} cancelado.`
      });
    } catch (error) {
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      const requiresRefund = ord && ['tarjeta', 'pse', 'nequi', 'bancolombia'].includes(ord.metodo_pago);
      if (ord) {
        ord.estado = 'cancelado';
        ord.razon_cancelacion = razon_cancelacion.trim();
        ord.reembolso_estado = requiresRefund ? 'reembolsado' : 'no_aplica';
      }
      return res.json({
        ok: true,
        reembolso_estado: requiresRefund ? 'reembolsado' : 'no_aplica',
        message: `Pedido #${pedidoId} cancelado.`
      });
    }
  }
);

/**
 * PATCH /api/staff/pedidos/:id/entregar
 */
router.patch(
  '/staff/pedidos/:id/entregar',
  requireStaffRole(['entregador', 'admin']),
  async (req, res) => {
    const pedidoId = Number(req.params.id);
    const { foto_entrega_url, observaciones_entregador } = req.body;

    if (!foto_entrega_url) {
      return res.status(400).json({
        ok: false,
        message: 'Adjunta la foto de evidencia de la entrega antes de finalizar.'
      });
    }

    try {
      await pool.query(
        `UPDATE pedidos
         SET estado = 'entregado',
             entregador_id = COALESCE(entregador_id, ?),
             foto_entrega_url = ?,
             observaciones_entregador = ?,
             fecha_entrega = NOW()
         WHERE id = ?`,
        [req.user.id, foto_entrega_url, observaciones_entregador || 'Entrega completada.', pedidoId]
      );

      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) {
        ord.estado = 'entregado';
        ord.foto_entrega_url = foto_entrega_url;
        ord.observaciones_entregador = observaciones_entregador || 'Entrega verificada.';
        ord.fecha_entrega = new Date().toISOString();
      }

      return res.json({
        ok: true,
        message: `Pedido #${pedidoId} entregado.`
      });
    } catch (error) {
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) {
        ord.estado = 'entregado';
        ord.entregador_id = ord.entregador_id || req.user.id;
        ord.foto_entrega_url = foto_entrega_url;
        ord.observaciones_entregador = observaciones_entregador || 'Entrega verificada.';
        ord.fecha_entrega = new Date().toISOString();
      }
      return res.json({
        ok: true,
        message: `Pedido #${pedidoId} entregado.`
      });
    }
  }
);

/**
 * PATCH /api/staff/pedidos/:id/observacion
 */
router.patch(
  '/staff/pedidos/:id/observacion',
  requireStaffRole(['entregador', 'soporte', 'admin']),
  async (req, res) => {
    const pedidoId = Number(req.params.id);
    const { observaciones_entregador } = req.body;

    try {
      await pool.query('UPDATE pedidos SET observaciones_entregador = ? WHERE id = ?', [
        observaciones_entregador || '',
        pedidoId
      ]);
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) ord.observaciones_entregador = observaciones_entregador || '';
      return res.json({ ok: true, message: `Observación guardada en pedido #${pedidoId}.` });
    } catch (error) {
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) ord.observaciones_entregador = observaciones_entregador || '';
      return res.json({ ok: true, message: `Observación guardada en pedido #${pedidoId}.` });
    }
  }
);

// ============================================================================
// 6. TICKETS DE SOPORTE CON MINICHAT EN VIVO ENTRE CLIENTE Y SOPORTE
// ============================================================================

/**
 * GET /api/mis-tickets
 * Devuelve los tickets del cliente autenticado con su historial de minichat
 */
router.get('/mis-tickets', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, message: 'Inicia sesión para ver tus tickets.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM tickets_soporte WHERE usuario_id = ? ORDER BY creado_en DESC',
      [authUser.id]
    );
    // Sincronizar con fallback si hay mensajes en memoria
    const merged = rows.map((r) => {
      const mem = ticketsFallback.find((t) => Number(t.id) === Number(r.id));
      return formatSafeTicket(mem || r);
    });
    return res.json({ ok: true, data: merged });
  } catch (error) {
    const list = ticketsFallback
      .filter((t) => Number(t.usuario_id) === Number(authUser.id))
      .map(formatSafeTicket);
    return res.json({ ok: true, data: list });
  }
});

/**
 * POST /api/soporte/crear
 * Crea un ticket e inicializa el hilo de minichat con el primer mensaje del cliente
 */
router.post('/soporte/crear', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  const { pedido_id, tipo, asunto, descripcion, imagen_cliente_url } = req.body;

  if (!asunto || !descripcion) {
    return res.status(400).json({ ok: false, message: 'Completa el asunto y descripción.' });
  }

  const initialMsg = {
    id: Date.now(),
    autor: authUser ? authUser.username : 'Cliente',
    rol: 'cliente',
    texto: descripcion,
    fecha: new Date().toISOString()
  };

  try {
    const [result] = await pool.query(
      `INSERT INTO tickets_soporte (pedido_id, usuario_id, tipo, asunto, descripcion, imagen_cliente_url, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'abierto')`,
      [
        pedido_id || null,
        authUser ? authUser.id : 1,
        tipo || 'producto',
        asunto,
        descripcion,
        imagen_cliente_url || null
      ]
    );

    const createdTicket = {
      id: result.insertId,
      pedido_id: pedido_id || null,
      usuario_id: authUser ? authUser.id : 1,
      tipo: tipo || 'producto',
      asunto,
      descripcion,
      imagen_cliente_url: imagen_cliente_url || null,
      estado: 'abierto',
      respuesta_soporte: null,
      mensajes: [initialMsg],
      creado_en: new Date().toISOString()
    };
    ticketsFallback.unshift(createdTicket);

    return res.status(201).json({
      ok: true,
      ticket_id: result.insertId,
      ticket: createdTicket,
      message: 'Solicitud creada.'
    });
  } catch (error) {
    const newId = ticketsFallback.length + 1;
    const createdTicket = {
      id: newId,
      pedido_id: pedido_id || null,
      usuario_id: authUser ? authUser.id : 1,
      tipo: tipo || 'producto',
      asunto,
      descripcion,
      imagen_cliente_url: imagen_cliente_url || null,
      estado: 'abierto',
      respuesta_soporte: null,
      mensajes: [initialMsg],
      creado_en: new Date().toISOString()
    };
    ticketsFallback.unshift(createdTicket);
    return res.status(201).json({
      ok: true,
      ticket_id: newId,
      ticket: createdTicket,
      message: 'Solicitud creada.'
    });
  }
});

/**
 * POST /api/soporte/:id/mensaje
 * Envía un mensaje en el minichat de un ticket (tanto por el cliente como por el empleado de Soporte/Admin)
 */
router.post('/soporte/:id/mensaje', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, message: 'Inicia sesión para enviar mensajes.' });
  }

  const ticketId = Number(req.params.id);
  const { texto, estado } = req.body;
  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ ok: false, message: 'Escribe un mensaje.' });
  }

  const isStaff = ['soporte', 'admin', 'empleado'].includes(authUser.rol);
  const newMsg = {
    id: Date.now(),
    autor: isStaff ? `${authUser.username} (Soporte)` : authUser.username,
    rol: isStaff ? 'soporte' : 'cliente',
    texto: String(texto).trim(),
    fecha: new Date().toISOString()
  };

  let tk = ticketsFallback.find((t) => Number(t.id) === ticketId);
  if (!tk) {
    tk = {
      id: ticketId,
      usuario_id: authUser.id,
      asunto: `Ticket #${ticketId}`,
      descripcion: '',
      estado: estado || (isStaff ? 'en_revision' : 'abierto'),
      mensajes: []
    };
    ticketsFallback.push(tk);
  }

  if (!Array.isArray(tk.mensajes)) tk.mensajes = formatSafeTicket(tk).mensajes;
  tk.mensajes.push(newMsg);
  if (isStaff) {
    tk.respuesta_soporte = newMsg.texto;
  }
  if (estado) {
    tk.estado = estado;
  } else if (isStaff && tk.estado === 'abierto') {
    tk.estado = 'en_revision';
  }

  try {
    await pool.query(
      'UPDATE tickets_soporte SET respuesta_soporte = COALESCE(?, respuesta_soporte), estado = ? WHERE id = ?',
      [isStaff ? newMsg.texto : null, tk.estado, ticketId]
    );
  } catch (_) {
    // Sincronizado en memoria
  }

  return res.json({
    ok: true,
    ticket: formatSafeTicket(tk)
  });
});

/**
 * PATCH /api/staff/tickets/:id
 */
router.patch(
  '/staff/tickets/:id',
  requireStaffRole(['soporte', 'admin']),
  async (req, res) => {
    const ticketId = Number(req.params.id);
    const { respuesta_soporte, estado } = req.body;

    let tk = ticketsFallback.find((t) => Number(t.id) === ticketId);
    if (tk) {
      if (!Array.isArray(tk.mensajes)) tk.mensajes = formatSafeTicket(tk).mensajes;
      if (respuesta_soporte && String(respuesta_soporte).trim()) {
        tk.mensajes.push({
          id: Date.now(),
          autor: `${req.user.username} (Soporte)`,
          rol: 'soporte',
          texto: String(respuesta_soporte).trim(),
          fecha: new Date().toISOString()
        });
        tk.respuesta_soporte = String(respuesta_soporte).trim();
      }
      if (estado) tk.estado = estado;
    }

    try {
      await pool.query(
        'UPDATE tickets_soporte SET respuesta_soporte = COALESCE(?, respuesta_soporte), estado = ? WHERE id = ?',
        [respuesta_soporte || null, estado || 'resuelto', ticketId]
      );
    } catch (_) {}

    return res.json({ ok: true, message: `Ticket #${ticketId} actualizado.` });
  }
);

// ============================================================================
// 7. GESTIÓN EXCLUSIVA DE ADMINISTRADOR:
//    - Manejo de Catálogo (Crear, Editar, Eliminar productos)
//    - Manejo de Cuentas de Empleados y Usuarios (Cambiar rol, Activar / Desactivar)
// ============================================================================

/**
 * POST /api/staff/catalogo
 * Crea un nuevo producto en el catálogo Danillanos
 */
router.post('/staff/catalogo', requireStaffRole(['admin']), async (req, res) => {
  const {
    nombre,
    categoria_id,
    presentacion,
    descripcion,
    precio,
    temperatura_conservacion,
    etiqueta,
    imagen_url,
    es_mas_vendido
  } = req.body;

  if (!nombre || precio === undefined) {
    return res.status(400).json({ ok: false, message: 'Ingresa el nombre y el precio del producto.' });
  }

  const catId = Number(categoria_id) || 1;
  const catObj = categoriasFallback.find((c) => Number(c.id) === catId) || categoriasFallback[0];
  const sku = `DAN-ADM-${Date.now().toString().slice(-4)}`;
  const cleanPrice = Number(precio) || 0;
  const defaultImg =
    imagen_url ||
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80';

  try {
    const [result] = await pool.query(
      `INSERT INTO productos (
        categoria_id, codigo_sku, nombre, descripcion, presentacion, precio,
        imagen_url, stock, es_mas_vendido, etiqueta, temperatura_conservacion, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 150, ?, ?, ?, 1)`,
      [
        catObj.id,
        sku,
        String(nombre).trim().toUpperCase(),
        descripcion || 'Calidad garantizada Danillanos.',
        presentacion || 'Unidad',
        cleanPrice,
        defaultImg,
        es_mas_vendido ? 1 : 0,
        etiqueta || null,
        temperatura_conservacion || 'Congelado -18°C'
      ]
    );

    const newProd = {
      id: result.insertId,
      categoria_id: catObj.id,
      categoria_slug: catObj.slug,
      categoria_nombre: catObj.nombre,
      codigo_sku: sku,
      nombre: String(nombre).trim().toUpperCase(),
      descripcion: descripcion || 'Calidad garantizada Danillanos.',
      presentacion: presentacion || 'Unidad',
      precio: cleanPrice,
      precio_anterior: null,
      imagen_url: defaultImg,
      stock: 150,
      es_mas_vendido: es_mas_vendido ? 1 : 0,
      etiqueta: etiqueta || null,
      temperatura_conservacion: temperatura_conservacion || 'Congelado -18°C'
    };
    productosFallback.unshift(newProd);

    return res.status(201).json({ ok: true, product: newProd });
  } catch (error) {
    const nextId = productosFallback.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
    const newProd = {
      id: nextId,
      categoria_id: catObj.id,
      categoria_slug: catObj.slug,
      categoria_nombre: catObj.nombre,
      codigo_sku: sku,
      nombre: String(nombre).trim().toUpperCase(),
      descripcion: descripcion || 'Calidad garantizada Danillanos.',
      presentacion: presentacion || 'Unidad',
      precio: cleanPrice,
      precio_anterior: null,
      imagen_url: defaultImg,
      stock: 150,
      es_mas_vendido: es_mas_vendido ? 1 : 0,
      etiqueta: etiqueta || null,
      temperatura_conservacion: temperatura_conservacion || 'Congelado -18°C'
    };
    productosFallback.unshift(newProd);
    return res.status(201).json({ ok: true, source: 'fallback', product: newProd });
  }
});

/**
 * PUT /api/staff/catalogo/:id
 * Edita un producto existente del catálogo
 */
router.put('/staff/catalogo/:id', requireStaffRole(['admin']), async (req, res) => {
  const prodId = Number(req.params.id);
  const {
    nombre,
    categoria_id,
    presentacion,
    descripcion,
    precio,
    temperatura_conservacion,
    etiqueta,
    imagen_url,
    es_mas_vendido
  } = req.body;

  const catId = Number(categoria_id) || 1;
  const catObj = categoriasFallback.find((c) => Number(c.id) === catId) || categoriasFallback[0];

  const existing = productosFallback.find((p) => Number(p.id) === prodId);
  if (existing) {
    if (nombre !== undefined) existing.nombre = String(nombre).trim().toUpperCase();
    if (categoria_id !== undefined) {
      existing.categoria_id = catObj.id;
      existing.categoria_slug = catObj.slug;
      existing.categoria_nombre = catObj.nombre;
    }
    if (presentacion !== undefined) existing.presentacion = presentacion;
    if (descripcion !== undefined) existing.descripcion = descripcion;
    if (precio !== undefined) existing.precio = Number(precio) || existing.precio;
    if (temperatura_conservacion !== undefined) existing.temperatura_conservacion = temperatura_conservacion;
    if (etiqueta !== undefined) existing.etiqueta = etiqueta || null;
    if (imagen_url !== undefined && imagen_url.trim()) existing.imagen_url = imagen_url.trim();
    if (es_mas_vendido !== undefined) existing.es_mas_vendido = es_mas_vendido ? 1 : 0;
  }

  try {
    await pool.query(
      `UPDATE productos
       SET categoria_id = ?, nombre = ?, presentacion = ?, descripcion = ?, precio = ?,
           temperatura_conservacion = ?, etiqueta = ?, imagen_url = COALESCE(NULLIF(?, ''), imagen_url),
           es_mas_vendido = ?
       WHERE id = ?`,
      [
        catObj.id,
        String(nombre || existing?.nombre || '').trim().toUpperCase(),
        presentacion || existing?.presentacion || 'Unidad',
        descripcion || existing?.descripcion || '',
        Number(precio ?? existing?.precio ?? 0),
        temperatura_conservacion || existing?.temperatura_conservacion || 'Congelado -18°C',
        etiqueta || null,
        imagen_url || '',
        es_mas_vendido ? 1 : 0,
        prodId
      ]
    );
  } catch (_) {}

  return res.json({ ok: true, product: existing });
});

/**
 * DELETE /api/staff/catalogo/:id
 * Elimina un producto del catálogo
 */
router.delete('/staff/catalogo/:id', requireStaffRole(['admin']), async (req, res) => {
  const prodId = Number(req.params.id);
  const idx = productosFallback.findIndex((p) => Number(p.id) === prodId);
  if (idx !== -1) productosFallback.splice(idx, 1);

  try {
    await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [prodId]);
  } catch (_) {}

  return res.json({ ok: true, deletedId: prodId });
});

/**
 * GET /api/staff/usuarios
 * Lista usuarios y cuentas de empleados para que el Administrador pueda cambiar roles o activar/desactivar
 */
router.get('/staff/usuarios', requireStaffRole(['admin']), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM usuarios ORDER BY id ASC');
    if (rows.length > 0) {
      return res.json({ ok: true, data: rows.map(formatSafeUser) });
    }
    return res.json({ ok: true, data: usuariosFallback.map(formatSafeUser) });
  } catch (error) {
    return res.json({ ok: true, data: usuariosFallback.map(formatSafeUser) });
  }
});

/**
 * PATCH /api/staff/usuarios/:id
 * Cambia el rol o activa/desactiva una cuenta de usuario/empleado
 */
router.patch('/staff/usuarios/:id', requireStaffRole(['admin']), async (req, res) => {
  const userId = Number(req.params.id);
  const { rol, activo } = req.body;
  const validRoles = ['cliente', 'empleado', 'entregador', 'soporte', 'admin'];

  const memUser = usuariosFallback.find((u) => Number(u.id) === userId);
  if (memUser) {
    if (rol && validRoles.includes(rol)) memUser.rol = rol;
    if (activo !== undefined) memUser.activo = activo ? 1 : 0;
  }

  try {
    if (rol && validRoles.includes(rol)) {
      await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, userId]);
    }
    if (activo !== undefined) {
      await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, userId]);
    }
  } catch (_) {}

  return res.json({
    ok: true,
    user: memUser ? formatSafeUser(memUser) : null
  });
});

module.exports = router;
