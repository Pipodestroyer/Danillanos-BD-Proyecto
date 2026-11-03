const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'backend', 'routes', 'api.js');
let code = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

function replaceExact(oldStr, newStr, name) {
  oldStr = oldStr.replace(/\r\n/g, '\n');
  newStr = newStr.replace(/\r\n/g, '\n');
  if (!code.includes(oldStr)) {
    console.error(`❌ FAILED to find exact string for: ${name}`);
    process.exit(1);
  }
  code = code.replace(oldStr, newStr);
  console.log(`✅ Replaced: ${name}`);
}

// 1. Reemplazar import de fallbackData
const oldImport = `const {
  categoriasFallback,
  productosFallback,
  carruselFallback,
  usuariosFallback,
  direccionesFallback,
  pedidosFallback,
  ticketsFallback,
  saveFallbackStore,
  loadFallbackStore
} = require('../data/fallbackData');`;

const newImport = `/**
 * Envía una respuesta de error de base de datos directa y transparente al cliente,
 * con diagnóstico técnico explícito para el desarrollador.
 *
 * @param {import('express').Response} res - Objeto de respuesta HTTP.
 * @param {Error} error - Excepción o error capturado.
 * @param {string} actionDescription - Descripción de la operación ejecutada.
 * @returns {import('express').Response}
 */
function sendDatabaseError(res, error, actionDescription) {
  console.error(\`🚨 [DATABASE ERROR] Fallo en "\${actionDescription}":\`, error.message);
  const isConnError = error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
  const isMissingTable = error.code === 'ER_NO_SUCH_TABLE';

  let devHint = 'Verifica que la base de datos MySQL esté encendida y que DATABASE_URL o MYSQL_URL en Railway sea correcta.';
  if (isMissingTable) {
    devHint = 'Las tablas no existen en la base de datos MySQL. Se requiere reiniciar el servidor para que autoInitializeDatabaseIfEmpty las cree o ejecutar: npm run db:setup';
  } else if (isConnError) {
    devHint = 'No hay conectividad con el host MySQL. Revisa el host y puerto en Railway.';
  }

  return res.status(503).json({
    ok: false,
    success: false,
    error: 'Error de conexión o fallo en la base de datos del servidor.',
    devDetails: {
      action: actionDescription,
      code: error.code || 'DB_ERROR',
      message: error.message,
      sqlMessage: error.sqlMessage || null,
      sqlState: error.sqlState || null,
      hint: devHint
    }
  });
}`;

replaceExact(oldImport, newImport, 'import fallbackData');

// 2. resolveDriverName
const oldDriver = `function resolveDriverName(entregadorId) {
  if (!entregadorId) return null;
  const driverRow = usuariosFallback.find((u) => Number(u.id) === Number(entregadorId));
  if (!driverRow) return \`Entregador #\${entregadorId}\`;
  return decryptData(driverRow.nombre_completo_enc) || driverRow.username;
}`;

const newDriver = `function resolveDriverName(entregadorId) {
  if (!entregadorId) return null;
  return \`Entregador #\${entregadorId}\`;
}`;

replaceExact(oldDriver, newDriver, 'resolveDriverName');

// 3. resolveLiveAuthenticatedUser
const oldResolveLive = `  try {
    const [rows] = await pool.query(
      'SELECT id, username, nombre_completo_enc, email_enc, rol, activo FROM usuarios WHERE id = ? LIMIT 1',
      [Number(authUser.id)]
    );
    if (rows && rows[0]) {
      const dbUser = rows[0];
      if (Number(dbUser.activo) === 0) return null;
      return {
        ...authUser,
        id: Number(dbUser.id),
        username: dbUser.username || authUser.username,
        nombre_completo: decryptData(dbUser.nombre_completo_enc) || dbUser.username || authUser.username,
        email: decryptData(dbUser.email_enc) || authUser.email,
        rol: normalizeStaffRole(dbUser.rol)
      };
    }
    return null;
  } catch (_) {
    const fbRow = usuariosFallback.find((u) => Number(u.id) === Number(authUser.id));
    if (!fbRow || Number(fbRow.activo) === 0) return null;
    return {
      ...authUser,
      id: Number(fbRow.id),
      username: fbRow.username || authUser.username,
      nombre_completo: decryptData(fbRow.nombre_completo_enc) || fbRow.username || authUser.username,
      email: decryptData(fbRow.email_enc) || authUser.email,
      rol: normalizeStaffRole(fbRow.rol)
    };
  }`;

const newResolveLive = `  try {
    const [rows] = await pool.query(
      'SELECT id, username, nombre_completo_enc, email_enc, rol, activo FROM usuarios WHERE id = ? LIMIT 1',
      [Number(authUser.id)]
    );
    if (rows && rows[0]) {
      const dbUser = rows[0];
      if (Number(dbUser.activo) === 0) return null;
      return {
        ...authUser,
        id: Number(dbUser.id),
        username: dbUser.username || authUser.username,
        nombre_completo: decryptData(dbUser.nombre_completo_enc) || dbUser.username || authUser.username,
        email: decryptData(dbUser.email_enc) || authUser.email,
        rol: normalizeStaffRole(dbUser.rol)
      };
    }
    return null;
  } catch (err) {
    console.error('[resolveLiveAuthenticatedUser] Error al verificar usuario en BD:', err.message);
    return null;
  }`;

replaceExact(oldResolveLive, newResolveLive, 'resolveLiveAuthenticatedUser');

// 4. GET /carrusel
const oldCarrusel = `router.get('/carrusel', async (req, res) => {
  try {
    const [rows] = await pool.query(\`
      SELECT id, producto_id, subtitulo, titulo, descripcion, precio_destacado,
             imagen_url, texto_boton, tipo_accion, orden
      FROM carrusel_promociones
      WHERE activo = 1
      ORDER BY orden ASC
    \`);
    return res.json({ source: 'mysql', data: rows });
  } catch (error) {
    return res.json({ source: 'fallback', data: carruselFallback });
  }
});`;

const newCarrusel = `router.get('/carrusel', async (req, res) => {
  try {
    const [rows] = await pool.query(\`
      SELECT id, producto_id, subtitulo, titulo, descripcion, precio_destacado,
             imagen_url, texto_boton, tipo_accion, orden
      FROM carrusel_promociones
      WHERE activo = 1
      ORDER BY orden ASC
    \`);
    return res.json({ source: 'mysql', data: rows });
  } catch (error) {
    return sendDatabaseError(res, error, 'Carga de promociones del carrusel');
  }
});`;

replaceExact(oldCarrusel, newCarrusel, 'GET /carrusel');

// 5. GET /categorias
const oldCategorias = `router.get('/categorias', async (req, res) => {
  try {
    const [rows] = await pool.query(\`
      SELECT id, nombre, slug, icono, descripcion
      FROM categorias
      WHERE activo = 1
      ORDER BY id ASC
    \`);
    return res.json({ source: 'mysql', data: rows });
  } catch (error) {
    return res.json({ source: 'fallback', data: categoriasFallback });
  }
});`;

const newCategorias = `router.get('/categorias', async (req, res) => {
  try {
    const [rows] = await pool.query(\`
      SELECT id, nombre, slug, icono, descripcion
      FROM categorias
      WHERE activo = 1
      ORDER BY id ASC
    \`);
    return res.json({ source: 'mysql', data: rows });
  } catch (error) {
    return sendDatabaseError(res, error, 'Carga de categorías');
  }
});`;

replaceExact(oldCategorias, newCategorias, 'GET /categorias');

// 6. GET /productos catch
const oldProdCatch = `    return res.json({ ok: true, source: 'mysql', apiVersion: 3, total: formatted.length, data: formatted });
  } catch (error) {
    let fallbackChanged = false;
    let filtered = productosFallback.map((p) => {
      const { product, justExpired } = formatProductWithDiscount(p);
      if (justExpired) {
        p.descuento_porcentaje = 0;
        p.descuento_tipo = 'manual';
        p.descuento_expira_en = null;
        p.descuento_expira_ms = null;
        p.descuento_unidades_limite = null;
        p.descuento_unidades_vendidas = 0;
        fallbackChanged = true;
      }
      return product;
    });
    if (fallbackChanged) saveFallbackStore();

    if (categoria === 'ofertas') {
      filtered = filtered.filter((p) => p.descuento_activo);
    } else if (categoria && categoria !== 'todos') {
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

    return res.json({ ok: true, source: 'fallback', apiVersion: 3, total: filtered.length, data: filtered });
  }
});`;

const newProdCatch = `    return res.json({ ok: true, source: 'mysql', apiVersion: 3, total: formatted.length, data: formatted });
  } catch (error) {
    return sendDatabaseError(res, error, 'Carga del catálogo de productos');
  }
});`;

replaceExact(oldProdCatch, newProdCatch, 'GET /productos catch');

// 7. POST /auth/register catch
const oldRegCatch = `    const token = signToken({ id: newUser.id, rol: newUser.rol, username: newUser.username });
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
    const token = signToken({
      id: safeUser.id,
      rol: safeUser.rol,
      username: safeUser.username,
      email: safeUser.email,
      avatar_url: safeUser.avatar_url,
      is_google: Boolean(safeUser.is_google_account)
    });

    return res.status(201).json({
      ok: true,
      source: 'fallback',
      message: 'Cuenta creada y encriptada con éxito.',
      token,
      user: safeUser,
      direcciones: []
    });
  }
});`;

const newRegCatch = `    const token = signToken({ id: newUser.id, rol: newUser.rol, username: newUser.username });
    return res.status(201).json({
      ok: true,
      message: 'Cuenta creada y encriptada con éxito.',
      token,
      user: newUser,
      direcciones: []
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Registro de nuevo usuario');
  }
});`;

replaceExact(oldRegCatch, newRegCatch, 'POST /auth/register catch');

// 8. POST /auth/login catch
const oldLoginCatch = `    return res.json({
      ok: true,
      message: \`Bienvenido(a), \${safeUser.nombre_completo}\`,
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
    const token = signToken({
      id: safeUser.id,
      rol: safeUser.rol,
      username: safeUser.username,
      email: safeUser.email,
      avatar_url: safeUser.avatar_url,
      is_google: Boolean(safeUser.is_google_account)
    });

    return res.json({
      ok: true,
      source: 'fallback',
      message: \`Bienvenido(a), \${safeUser.nombre_completo}\`,
      token,
      user: safeUser,
      direcciones: dirs
    });
  }
});`;

const newLoginCatch = `    return res.json({
      ok: true,
      message: \`Bienvenido(a), \${safeUser.nombre_completo}\`,
      token,
      user: safeUser,
      direcciones: dirRows.map(formatSafeAddress)
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Inicio de sesión / Autenticación');
  }
});`;

replaceExact(oldLoginCatch, newLoginCatch, 'POST /auth/login catch');

// 9. POST /auth/google catch
const oldGoogleCatch = `    return res.json({
      ok: true,
      message: \`Bienvenido(a), \${safeUser.nombre_completo}\`,
      token,
      user: safeUser,
      direcciones: dirRows.map(formatSafeAddress)
    });
  } catch (error) {
    let userRow = usuariosFallback.find((u) => u.email_hash === emailHash);
    if (userRow && Number(userRow.activo) === 0) {
      return res.status(403).json({
        ok: false,
        message: 'Esta cuenta se encuentra desactivada. Comunícate con el administrador.'
      });
    }
    if (!userRow) {
      userRow = {
        id: usuariosFallback.length + 1,
        username,
        nombre_completo_enc: nombreEnc,
        email_hash: emailHash,
        email_enc: emailEnc,
        google_id_enc: googleIdEnc,
        avatar_url: (avatar_url && !avatar_url.includes('test-avatar-photo')) ? avatar_url : null,
        rol: 'cliente',
        activo: 1
      };
      usuariosFallback.push(userRow);
    } else {
      if (avatar_url && !avatar_url.includes('test-avatar-photo')) {
        userRow.avatar_url = avatar_url;
      }
      if (!userRow.google_id_enc) {
        userRow.google_id_enc = googleIdEnc;
      }
    }

    saveFallbackStore();
    const safeUser = formatSafeUser(userRow);
    const token = signToken({
      id: safeUser.id,
      rol: safeUser.rol,
      username: safeUser.username,
      email: safeUser.email,
      avatar_url: safeUser.avatar_url,
      is_google: Boolean(safeUser.is_google_account)
    });
    return res.json({
      ok: true,
      source: 'fallback',
      token,
      user: safeUser,
      direcciones: direccionesFallback.filter((d) => d.usuario_id === safeUser.id).map(formatSafeAddress)
    });
  }
});`;

const newGoogleCatch = `    return res.json({
      ok: true,
      message: \`Bienvenido(a), \${safeUser.nombre_completo}\`,
      token,
      user: safeUser,
      direcciones: dirRows.map(formatSafeAddress)
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Autenticación con Google');
  }
});`;

replaceExact(oldGoogleCatch, newGoogleCatch, 'POST /auth/google catch');

// 10. GET /auth/me
const oldAuthMe = `router.get('/auth/me', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.json({ authenticated: false, user: null, direcciones: [] });
  }

  if (typeof loadFallbackStore === 'function') {
    loadFallbackStore();
  }

  let userRow = null;
  let dirRows = [];

  try {
    const emailHash = authUser.email ? hashLookup(authUser.email) : null;
    let rows = [];
    if (emailHash) {
      [rows] = await pool.query(
        'SELECT * FROM usuarios WHERE email_hash = ? AND activo = 1 LIMIT 1',
        [emailHash]
      );
    }
    if ((!rows || rows.length === 0) && authUser.id) {
      [rows] = await pool.query(
        'SELECT * FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1',
        [authUser.id]
      );
    }
    if (rows && rows[0]) {
      userRow = rows[0];
      const [dirs] = await pool.query(
        'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
        [userRow.id]
      );
      dirRows = dirs.map(formatSafeAddress);
    }
  } catch (_) {
    // Continuar a fallback únicamente cuando MySQL no esté disponible
    userRow = usuariosFallback.find(
      (u) =>
        Number(u.activo) !== 0 &&
        (Number(u.id) === Number(authUser.id) ||
          (authUser.email && u.email_enc && decryptData(u.email_enc) === authUser.email) ||
          (authUser.username && u.username === authUser.username))
    );
    if (userRow) {
      dirRows = direccionesFallback
        .filter((d) => Number(d.usuario_id) === Number(userRow.id))
        .map(formatSafeAddress);
    }
  }

  if (!userRow || Number(userRow.activo) === 0) {
    return res.json({ authenticated: false, user: null, direcciones: [] });
  }

  const safeUser = formatSafeUser(userRow);
  const memUser = usuariosFallback.find((u) =>
    Number(u.id) === Number(authUser.id) ||
    (authUser.email && u.email_enc && decryptData(u.email_enc) === authUser.email)
  );
  if (memUser) {
    const memSafe = formatSafeUser(memUser);
    if (!safeUser.telefono && memSafe.telefono) safeUser.telefono = memSafe.telefono;
    if (!safeUser.avatar_url && memSafe.avatar_url) safeUser.avatar_url = memSafe.avatar_url;
    if (!safeUser.has_password && memSafe.has_password) safeUser.has_password = true;
  }

  return res.json({
    authenticated: true,
    user: safeUser,
    direcciones: dirRows
  });
});`;

const newAuthMe = `router.get('/auth/me', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.json({ authenticated: false, user: null, direcciones: [] });
  }

  let userRow = null;
  let dirRows = [];

  try {
    const emailHash = authUser.email ? hashLookup(authUser.email) : null;
    let rows = [];
    if (emailHash) {
      [rows] = await pool.query(
        'SELECT * FROM usuarios WHERE email_hash = ? AND activo = 1 LIMIT 1',
        [emailHash]
      );
    }
    if ((!rows || rows.length === 0) && authUser.id) {
      [rows] = await pool.query(
        'SELECT * FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1',
        [authUser.id]
      );
    }
    if (rows && rows[0]) {
      userRow = rows[0];
      const [dirs] = await pool.query(
        'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
        [userRow.id]
      );
      dirRows = dirs.map(formatSafeAddress);
    }
  } catch (error) {
    return sendDatabaseError(res, error, 'Consulta de datos de usuario autenticado');
  }

  if (!userRow || Number(userRow.activo) === 0) {
    return res.json({ authenticated: false, user: null, direcciones: [] });
  }

  const safeUser = formatSafeUser(userRow);
  return res.json({
    authenticated: true,
    user: safeUser,
    direcciones: dirRows
  });
});`;

replaceExact(oldAuthMe, newAuthMe, 'GET /auth/me');

// 11. PATCH /auth/perfil
const oldAuthPerfil = `router.patch('/auth/perfil', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, error: 'No autorizado. Inicie sesión para actualizar su perfil.' });
  }

  const { nombre_completo, empresa, tipo_documento, numero_documento, telefono, email, avatar_url } = req.body || {};

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

  if (typeof loadFallbackStore === 'function') {
    loadFallbackStore();
  }

  // 1. Siempre actualizar en memoria y persistir en disco
  let memUser = usuariosFallback.find((u) =>
    Number(u.id) === Number(authUser.id) ||
    (authUser.email && u.email_enc && decryptData(u.email_enc) === authUser.email) ||
    (email && u.email_enc && decryptData(u.email_enc) === email) ||
    (authUser.username && u.username === authUser.username)
  );

  if (!memUser) {
    const finalEmail = (email && !email.endsWith('@danillanos.com'))
      ? email
      : (authUser.email && !authUser.email.endsWith('@danillanos.com'))
        ? authUser.email
        : \`\${authUser.username || "usuario"}@danillanos.com\`;
    const finalAvatar = (avatar_url && !avatar_url.includes('test-avatar-photo'))
      ? avatar_url
      : (authUser.avatar_url && !authUser.avatar_url.includes('test-avatar-photo'))
        ? authUser.avatar_url
        : null;
    memUser = {
      id: authUser.id || Date.now(),
      username: authUser.username || cleanNombre,
      nombre_completo_enc: nombreEnc,
      nombres_enc: encryptData(cleanNombre.split(" ")[0] || cleanNombre),
      apellidos_enc: encryptData(cleanNombre.split(" ").slice(1).join(" ") || ""),
      empresa_enc: empresaEnc,
      tipo_documento: cleanTipoDoc,
      numero_documento_enc: numDocEnc,
      email_hash: hashLookup(finalEmail),
      email_enc: encryptData(finalEmail),
      telefono_enc: telEnc,
      avatar_url: finalAvatar,
      google_id_enc: (authUser.is_google || (finalAvatar && finalAvatar.includes('googleusercontent.com')))
        ? encryptData(\`google_\${authUser.id || Date.now()}\`)
        : null,
      rol: authUser.rol || "cliente",
      activo: 1
    };
    usuariosFallback.push(memUser);
  } else {
    memUser.nombre_completo_enc = nombreEnc;
    memUser.empresa_enc = empresaEnc;
    memUser.tipo_documento = cleanTipoDoc;
    memUser.numero_documento_enc = numDocEnc;
    memUser.telefono_enc = telEnc;
    if (avatar_url && !avatar_url.includes('test-avatar-photo')) {
      memUser.avatar_url = avatar_url;
    } else if (!memUser.avatar_url && authUser.avatar_url && !authUser.avatar_url.includes('test-avatar-photo')) {
      memUser.avatar_url = authUser.avatar_url;
    }
    if (email && (!memUser.email_enc || decryptData(memUser.email_enc).endsWith('@danillanos.com'))) {
      memUser.email_enc = encryptData(email);
      memUser.email_hash = hashLookup(email);
    }
  }

  saveFallbackStore();

  let safeUser = formatSafeUser(memUser);

  // 2. Intentar actualizar en MySQL si la base de datos está disponible
  try {
    const emailHash = authUser.email ? hashLookup(authUser.email) : null;
    let targetRow = null;
    if (emailHash) {
      const [fRows] = await pool.query('SELECT * FROM usuarios WHERE email_hash = ? LIMIT 1', [emailHash]);
      if (fRows && fRows[0]) targetRow = fRows[0];
    }
    if (!targetRow && authUser.id) {
      const [fRows] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [authUser.id]);
      if (fRows && fRows[0]) targetRow = fRows[0];
    }

    if (targetRow) {
      await pool.query(
        \`UPDATE usuarios 
         SET nombre_completo_enc = ?, empresa_enc = ?, tipo_documento = ?, numero_documento_enc = ?, telefono_enc = ?
         WHERE id = ?\`,
        [nombreEnc, empresaEnc, cleanTipoDoc, numDocEnc, telEnc, targetRow.id]
      );

      const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [targetRow.id]);
      if (rows && rows[0]) {
        const dbSafe = formatSafeUser(rows[0]);
        if (dbSafe && dbSafe.telefono) {
          safeUser = dbSafe;
        }
      }
    }
  } catch (_) {
    // Si la BD externa está desconectada, safeUser ya está 100% garantizado con memUser
  }

  return res.json({
    ok: true,
    message: 'Información de perfil actualizada exitosamente.',
    user: safeUser
  });
});`;

const newAuthPerfil = `router.patch('/auth/perfil', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, error: 'Sesión no válida o expirada. Inicie sesión nuevamente.' });
  }

  const {
    nombre_completo,
    empresa,
    tipo_documento,
    numero_documento,
    telefono,
    avatar_url,
    email
  } = req.body;

  const cleanNombre = (nombre_completo || authUser.nombre_completo || authUser.username || '').trim();
  const cleanEmpresa = (empresa || '').trim();
  const cleanTipoDoc = (tipo_documento || 'CC').trim();
  const cleanNumDoc = (numero_documento || '').trim();
  const cleanTel = (telefono || '').trim();

  const nombreEnc = cleanNombre ? encryptData(cleanNombre) : null;
  const empresaEnc = cleanEmpresa ? encryptData(cleanEmpresa) : null;
  const numDocEnc = cleanNumDoc ? encryptData(cleanNumDoc) : null;
  const telEnc = cleanTel ? encryptData(cleanTel) : null;

  try {
    const emailHash = authUser.email ? hashLookup(authUser.email) : null;
    let targetRow = null;
    if (emailHash) {
      const [fRows] = await pool.query('SELECT * FROM usuarios WHERE email_hash = ? LIMIT 1', [emailHash]);
      if (fRows && fRows[0]) targetRow = fRows[0];
    }
    if (!targetRow && authUser.id) {
      const [fRows] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [authUser.id]);
      if (fRows && fRows[0]) targetRow = fRows[0];
    }

    if (!targetRow) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado en la base de datos.' });
    }

    await pool.query(
      \`UPDATE usuarios 
       SET nombre_completo_enc = ?, empresa_enc = ?, tipo_documento = ?, numero_documento_enc = ?, telefono_enc = ?
       WHERE id = ?\`,
      [nombreEnc, empresaEnc, cleanTipoDoc, numDocEnc, telEnc, targetRow.id]
    );

    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [targetRow.id]);
    const safeUser = formatSafeUser(rows[0]);

    return res.json({
      ok: true,
      message: 'Información de perfil actualizada exitosamente.',
      user: safeUser
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Actualización de perfil');
  }
});`;

replaceExact(oldAuthPerfil, newAuthPerfil, 'PATCH /auth/perfil');

// 12. POST /auth/cambiar-password
const oldCambiarPass = `router.post('/auth/cambiar-password', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, error: 'Sesión no válida o expirada. Inicie sesión nuevamente.' });
  }

  const { password_actual, nueva_password } = req.body || {};

  if (!nueva_password || String(nueva_password).trim().length < 6) {
    return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  const cleanNewPass = String(nueva_password).trim();

  try {
    const emailHash = authUser.email ? hashLookup(authUser.email) : null;
    let rows = [];
    if (emailHash) {
      [rows] = await pool.query('SELECT * FROM usuarios WHERE email_hash = ? AND activo = 1 LIMIT 1', [emailHash]);
    }
    if ((!rows || rows.length === 0) && authUser.id) {
      [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1', [authUser.id]);
    }
    const userRow = rows ? rows[0] : null;

    if (userRow) {
      if (userRow.password_hash) {
        if (!password_actual || !String(password_actual).trim()) {
          return res.status(400).json({ ok: false, error: 'Debes ingresar tu contraseña actual para cambiarla.' });
        }
        if (!verifyPassword(String(password_actual), userRow.password_hash)) {
          return res.status(400).json({ ok: false, error: 'La contraseña actual no es correcta.' });
        }
      }

      const newHash = hashPassword(cleanNewPass);
      await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [newHash, userRow.id]);
      userRow.password_hash = newHash;

      let memUser = usuariosFallback.find((u) =>
        (emailHash && u.email_hash === emailHash) ||
        Number(u.id) === Number(userRow.id) ||
        Number(u.id) === Number(authUser.id)
      );
      if (memUser) {
        memUser.password_hash = newHash;
      }
      saveFallbackStore();

      const safeUser = formatSafeUser(userRow);
      return res.json({
        ok: true,
        message: 'Contraseña actualizada exitosamente.',
        user: safeUser
      });
    }

    let memUser = usuariosFallback.find((u) => Number(u.id) === Number(authUser.id));
    if (!memUser) {
      const newHash = hashPassword(cleanNewPass);
      memUser = {
        id: authUser.id || Date.now(),
        username: authUser.username || 'Usuario',
        nombre_completo_enc: encryptData(authUser.username || 'Usuario'),
        email_hash: authUser.email ? hashLookup(authUser.email) : hashLookup(\`\${authUser.username || 'user'}@danillanos.com\`),
        email_enc: authUser.email ? encryptData(authUser.email) : encryptData(\`\${authUser.username || 'user'}@danillanos.com\`),
        password_hash: newHash,
        rol: authUser.rol || 'cliente',
        activo: 1
      };
      usuariosFallback.push(memUser);
      saveFallbackStore();
      return res.json({
        ok: true,
        source: 'fallback',
        message: 'Contraseña actualizada exitosamente.',
        user: formatSafeUser(memUser)
      });
    }

    if (memUser.password_hash) {
      if (!password_actual || !String(password_actual).trim()) {
        return res.status(400).json({ ok: false, error: 'Debes ingresar tu contraseña actual para cambiarla.' });
      }
      if (!verifyPassword(String(password_actual), memUser.password_hash)) {
        return res.status(400).json({ ok: false, error: 'La contraseña actual no es correcta.' });
      }
    }
    const newHash = hashPassword(cleanNewPass);
    memUser.password_hash = newHash;
    saveFallbackStore();
    const safeUser = formatSafeUser(memUser);
    return res.json({
      ok: true,
      message: 'Contraseña actualizada exitosamente.',
      user: safeUser
    });
  } catch (error) {
    let memUser = usuariosFallback.find((u) =>
      Number(u.id) === Number(authUser.id) ||
      (authUser.email && u.email_enc && decryptData(u.email_enc) === authUser.email) ||
      (authUser.username && u.username === authUser.username)
    );

    if (!memUser) {
      const newHash = hashPassword(cleanNewPass);
      memUser = {
        id: authUser.id || Date.now(),
        username: authUser.username || 'Usuario',
        nombre_completo_enc: encryptData(authUser.username || 'Usuario'),
        email_hash: authUser.email ? hashLookup(authUser.email) : hashLookup(\`\${authUser.username || 'user'}@danillanos.com\`),
        email_enc: authUser.email ? encryptData(authUser.email) : encryptData(\`\${authUser.username || 'user'}@danillanos.com\`),
        password_hash: newHash,
        rol: authUser.rol || 'cliente',
        activo: 1
      };
      usuariosFallback.push(memUser);
      saveFallbackStore();
      return res.json({
        ok: true,
        source: 'fallback',
        message: 'Contraseña actualizada exitosamente.',
        user: formatSafeUser(memUser)
      });
    }

    if (memUser.password_hash) {
      if (!password_actual || !String(password_actual).trim()) {
        return res.status(400).json({ ok: false, error: 'Debes ingresar tu contraseña actual para cambiarla.' });
      }
      if (!verifyPassword(String(password_actual), memUser.password_hash)) {
        return res.status(400).json({ ok: false, error: 'La contraseña actual no es correcta.' });
      }
    }
    const fallbackHash = hashPassword(cleanNewPass);
    memUser.password_hash = fallbackHash;
    saveFallbackStore();
    return res.json({
      ok: true,
      source: 'fallback',
      message: 'Contraseña actualizada exitosamente.',
      user: formatSafeUser(memUser)
    });
  }
});`;

const newCambiarPass = `router.post('/auth/cambiar-password', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, error: 'Sesión no válida o expirada. Inicie sesión nuevamente.' });
  }

  const { password_actual, nueva_password } = req.body || {};

  if (!nueva_password || String(nueva_password).trim().length < 6) {
    return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  const cleanNewPass = String(nueva_password).trim();

  try {
    const emailHash = authUser.email ? hashLookup(authUser.email) : null;
    let rows = [];
    if (emailHash) {
      [rows] = await pool.query('SELECT * FROM usuarios WHERE email_hash = ? AND activo = 1 LIMIT 1', [emailHash]);
    }
    if ((!rows || rows.length === 0) && authUser.id) {
      [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1', [authUser.id]);
    }
    const userRow = rows ? rows[0] : null;

    if (!userRow) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado en la base de datos.' });
    }

    if (userRow.password_hash) {
      if (!password_actual || !String(password_actual).trim()) {
        return res.status(400).json({ ok: false, error: 'Debes ingresar tu contraseña actual para cambiarla.' });
      }
      if (!verifyPassword(String(password_actual), userRow.password_hash)) {
        return res.status(400).json({ ok: false, error: 'La contraseña actual no es correcta.' });
      }
    }

    const newHash = hashPassword(cleanNewPass);
    await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [newHash, userRow.id]);
    userRow.password_hash = newHash;

    const safeUser = formatSafeUser(userRow);
    return res.json({
      ok: true,
      message: 'Contraseña actualizada exitosamente.',
      user: safeUser
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Actualización de contraseña');
  }
});`;

replaceExact(oldCambiarPass, newCambiarPass, 'POST /auth/cambiar-password');

// 13. GET /direcciones
const oldGetDir = `router.get('/direcciones', async (req, res) => {
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
});`;

const newGetDir = `router.get('/direcciones', async (req, res) => {
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
    return sendDatabaseError(res, error, 'Carga de direcciones');
  }
});`;

replaceExact(oldGetDir, newGetDir, 'GET /direcciones');

// 14. POST /direcciones
const oldPostDir = `    return res.status(201).json({
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
});`;

const newPostDir = `    return res.status(201).json({
      ok: true,
      message: 'Dirección y pin guardados correctamente en tu cuenta.',
      addedId: result.insertId,
      direcciones: dirRows.map(formatSafeAddress)
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Guardado de dirección');
  }
});`;

replaceExact(oldPostDir, newPostDir, 'POST /direcciones');

// 15. DELETE /direcciones/:id
const oldDelDir = `    const [dirRows] = await pool.query(
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
});`;

const newDelDir = `    const [dirRows] = await pool.query(
      'SELECT * FROM usuario_direcciones WHERE usuario_id = ? ORDER BY es_principal DESC, id ASC',
      [authUser.id]
    );
    return res.json({ ok: true, direcciones: dirRows.map(formatSafeAddress) });
  } catch (error) {
    return sendDatabaseError(res, error, 'Eliminación de dirección');
  }
});`;

replaceExact(oldDelDir, newDelDir, 'DELETE /direcciones/:id');

// 16. GET /mis-pedidos
const oldMisPedidos = `router.get('/mis-pedidos', async (req, res) => {
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
      \`SELECT pi.* FROM pedido_items pi
       INNER JOIN pedidos p ON pi.pedido_id = p.id
       WHERE p.usuario_id = ?\`,
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
});`;

const newMisPedidos = `router.get('/mis-pedidos', async (req, res) => {
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
      \`SELECT pi.* FROM pedido_items pi
       INNER JOIN pedidos p ON pi.pedido_id = p.id
       WHERE p.usuario_id = ?\`,
      [authUser.id]
    );

    const formatted = orders.map((ord) =>
      formatSafeOrder(
        ord,
        items.filter((i) => i.pedido_id === ord.id)
      )
    );

    let clientTickets = [];
    try {
      const [tRows] = await pool.query(
        'SELECT * FROM tickets_soporte WHERE usuario_id = ? ORDER BY creado_en DESC',
        [authUser.id]
      );
      clientTickets = tRows.map(formatSafeTicket);
    } catch (_) {}

    return res.json({ ok: true, apiVersion: 3, data: formatted, tickets: clientTickets });
  } catch (error) {
    return sendDatabaseError(res, error, 'Carga de pedidos del usuario');
  }
});`;

replaceExact(oldMisPedidos, newMisPedidos, 'GET /mis-pedidos');

// 17. PATCH /pedidos/:id/cancelar
const oldCancelOrder = `      const memOrd = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (memOrd) {
        memOrd.estado = 'cancelado';
        memOrd.razon_cancelacion = motivo;
        memOrd.reembolso_estado = reembolsoEstado;
      }
      return res.json({
        ok: true,
        reembolso_estado: reembolsoEstado,
        message: \`Pedido #\${pedidoId} cancelado correctamente.\`
      });
    }
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  } catch (_) {}

  const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
  if (!ord) {
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  }
  if (Number(ord.usuario_id) !== Number(authUser.id)) {
    return res.status(403).json({ ok: false, message: 'No autorizado para cancelar este pedido.' });
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
    message: \`Pedido #\${pedidoId} cancelado correctamente.\`
  });
});`;

const newCancelOrder = `      return res.json({
        ok: true,
        reembolso_estado: reembolsoEstado,
        message: \`Pedido #\${pedidoId} cancelado correctamente.\`
      });
    }
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  } catch (error) {
    return sendDatabaseError(res, error, 'Cancelación de pedido');
  }
});`;

replaceExact(oldCancelOrder, newCancelOrder, 'PATCH /pedidos/:id/cancelar');

// 18. POST /pedidos (fbRef & catch)
const oldProdCheckInOrder = `      const fbRef = productosFallback.find((p) => Number(p.id) === Number(item.id));
      if (!dbProd && !fbRef) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ ok: false, message: 'Uno de los productos seleccionados ya no está disponible.' });
      }
      let unitPrice = fbRef ? Number(formatProductWithDiscount(fbRef).product.precio) : 0;

      if (dbProd) {`;

const newProdCheckInOrder = `      if (!dbProd) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ ok: false, message: 'Uno de los productos seleccionados ya no está disponible.' });
      }
      let unitPrice = 0;

      if (dbProd) {`;

replaceExact(oldProdCheckInOrder, newProdCheckInOrder, 'POST /pedidos prodCheck');

const oldFbProdUpdateInOrder = `        const fbProd = productosFallback.find((p) => Number(p.id) === Number(dbProd.id));
        if (fbProd && fbProd.descuento_porcentaje > 0 && fbProd.descuento_tipo === 'unidades') {
          const nextFbSold = Number(fbProd.descuento_unidades_vendidas || 0) + qty;
          if (Number(fbProd.descuento_unidades_limite || 0) > 0 && nextFbSold >= Number(fbProd.descuento_unidades_limite)) {
            fbProd.descuento_porcentaje = 0;
            fbProd.descuento_tipo = 'manual';
            fbProd.descuento_unidades_limite = null;
            fbProd.descuento_unidades_vendidas = 0;
          } else {
            fbProd.descuento_unidades_vendidas = nextFbSold;
          }
        }`;

replaceExact(oldFbProdUpdateInOrder, '', 'POST /pedidos remove fbProd update');

const oldOrderCatch = `    return res.status(201).json({
      ok: true,
      pedido_id: pedidoId,
      total: finalOrderTotal,
      tiempo_entrega_estimado: zone.tiempo_entrega_estimado,
      message: '¡Pedido registrado y encriptado con éxito!'
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }

    let fbDiscountMutated = false;
    const resolvedFallbackItems = items.map((i) => {
      const qty = Math.max(1, Number(i.cantidad) || 1);
      const fbProd = productosFallback.find((p) => Number(p.id) === Number(i.id));
      let unitPrice = Number(i.precio) || 0;
      if (fbProd) {
        const { product: liveFb, justExpired } = formatProductWithDiscount(fbProd);
        unitPrice = Number(liveFb.precio);
        if (justExpired) {
          fbProd.descuento_porcentaje = 0;
          fbProd.descuento_tipo = 'manual';
          fbProd.descuento_expira_en = null;
          fbProd.descuento_unidades_limite = null;
          fbProd.descuento_unidades_vendidas = 0;
          fbDiscountMutated = true;
        } else if (liveFb.descuento_activo && liveFb.descuento_tipo === 'unidades') {
          const nextSold = Number(fbProd.descuento_unidades_vendidas || 0) + qty;
          if (Number(fbProd.descuento_unidades_limite || 0) > 0 && nextSold >= Number(fbProd.descuento_unidades_limite)) {
            fbProd.descuento_porcentaje = 0;
            fbProd.descuento_tipo = 'manual';
            fbProd.descuento_unidades_limite = null;
            fbProd.descuento_unidades_vendidas = 0;
          } else {
            fbProd.descuento_unidades_vendidas = nextSold;
          }
          fbDiscountMutated = true;
        }
      }
      return {
        producto_id: i.id,
        nombre_producto: i.nombre,
        cantidad: qty,
        precio_unitario: unitPrice,
        subtotal: unitPrice * qty
      };
    });
    if (fbDiscountMutated) saveFallbackStore();
    const fallbackTotal = resolvedFallbackItems.reduce((acc, i) => acc + i.subtotal, 0);

    const fallbackId = pedidosFallback.length + 1;
    pedidosFallback.unshift({
      id: fallbackId,
      usuario_id: authUser.id,
      nombre_recibe_enc: nombreEnc,
      telefono_cliente_enc: telEnc,
      direccion_entrega_enc: dirEnc,
      municipio: zone.municipio,
      lat: zone.lat,
      lng: zone.lng,
      es_villavicencio: zone.es_villavicencio,
      tiempo_entrega_estimado: zone.tiempo_entrega_estimado,
      metodo_pago: validMethod,
      referencia_pago: referencia_pago || \`DAN-\${Date.now().toString().slice(-6)}\`,
      total: fallbackTotal,
      estado: 'pendiente',
      observaciones_cliente: observaciones_cliente || '',
      razon_cancelacion: null,
      reembolso_estado: 'no_aplica',
      creado_en: new Date().toISOString(),
      items: resolvedFallbackItems
    });
    saveFallbackStore();

    return res.status(201).json({
      ok: true,
      source: 'fallback',
      pedido_id: fallbackId,
      total: fallbackTotal,
      tiempo_entrega_estimado: zone.tiempo_entrega_estimado,
      message: '¡Pedido registrado con éxito!'
    });
  }
});`;

const newOrderCatch = `    return res.status(201).json({
      ok: true,
      pedido_id: pedidoId,
      total: finalOrderTotal,
      tiempo_entrega_estimado: zone.tiempo_entrega_estimado,
      message: '¡Pedido registrado y encriptado con éxito!'
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    return sendDatabaseError(res, error, 'Creación de pedido');
  }
});`;

replaceExact(oldOrderCatch, newOrderCatch, 'POST /pedidos catch');

// 19. GET /staff/pedidos
const oldStaffOrdersCatch = `    const scoped = scopeStaffPayloadByRole(req.user, formatted, formattedTickets, entregadores, staffUsers);

    return res.json({
      ok: true,
      apiVersion: 3,
      sede: DANILLANOS_HQ,
      ...scoped
    });
  } catch (error) {
    const formatted = pedidosFallback.map((ord) => formatSafeOrder(ord, ord.items || []));
    const staffUsers = usuariosFallback.filter((u) => u.rol !== 'cliente').map(formatSafeUser);
    const entregadores = staffUsers.filter((u) => u.rol === 'entregador' && u.activo !== false);
    const formattedTickets = ['admin', 'soporte'].includes(req.user.rol)
      ? ticketsFallback.map(formatSafeTicket)
      : [];
    const scoped = scopeStaffPayloadByRole(req.user, formatted, formattedTickets, entregadores, staffUsers);

    return res.json({
      ok: true,
      apiVersion: 3,
      source: 'fallback',
      sede: DANILLANOS_HQ,
      ...scoped
    });
  }
});`;

const newStaffOrdersCatch = `    const scoped = scopeStaffPayloadByRole(req.user, formatted, formattedTickets, entregadores, staffUsers);

    return res.json({
      ok: true,
      apiVersion: 3,
      sede: DANILLANOS_HQ,
      ...scoped
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Carga de pedidos de staff');
  }
});`;

replaceExact(oldStaffOrdersCatch, newStaffOrdersCatch, 'GET /staff/pedidos catch');

// 20. PATCH /staff/pedidos/:id/confirmar
const oldConfirmar = `      await pool.query(
        \`UPDATE pedidos
         SET estado = 'en_proceso',
             fecha_confirmacion = NOW()
         WHERE id = ? AND estado = 'pendiente'\`,
        [pedidoId]
      );
      const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (ord) {
        ord.estado = 'en_proceso';
        ord.fecha_confirmacion = new Date().toISOString();
      }
      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} aceptado y enviado a Bodega para alistamiento.\`
      });
    } catch (error) {
      const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (!ord) {
        return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
      }
      if (ord.estado !== 'pendiente') {
        return res.status(400).json({
          ok: false,
          message: \`El pedido #\${pedidoId} ya fue procesado.\`
        });
      }
      ord.estado = 'en_proceso';
      ord.fecha_confirmacion = new Date().toISOString();
      saveFallbackStore();
      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} aceptado y enviado a Bodega para alistamiento.\`
      });
    }
  }
);`;

const newConfirmar = `      await pool.query(
        \`UPDATE pedidos
         SET estado = 'en_proceso',
             fecha_confirmacion = NOW()
         WHERE id = ? AND estado = 'pendiente'\`,
        [pedidoId]
      );
      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} aceptado y enviado a Bodega para alistamiento.\`
      });
    } catch (error) {
      return sendDatabaseError(res, error, 'Confirmación de pedido por empleado');
    }
  }
);`;

replaceExact(oldConfirmar, newConfirmar, 'PATCH /staff/pedidos/:id/confirmar');

// 21. PATCH /staff/pedidos/:id/en-reparto
const oldEnReparto = `      await pool.query(
        \`UPDATE pedidos
         SET estado = 'en_camino', entregador_id = ?
         WHERE id = ? AND estado = 'en_proceso'\`,
        [chosenDriverId, pedidoId]
      );
      const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (ord) {
        ord.estado = 'en_camino';
        ord.entregador_id = chosenDriverId;
      }
      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} alistado y asignado al entregador para reparto.\`
      });
    } catch (error) {
      const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (!ord) {
        return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
      }
      if (ord.estado !== 'en_proceso') {
        return res.status(400).json({
          ok: false,
          message: \`El pedido #\${pedidoId} ya fue despachado o no está en bodega.\`
        });
      }
      ord.estado = 'en_camino';
      ord.entregador_id = chosenDriverId;
      saveFallbackStore();
      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} alistado y asignado al entregador para reparto.\`
      });
    }
  }
);`;

const newEnReparto = `      await pool.query(
        \`UPDATE pedidos
         SET estado = 'en_camino', entregador_id = ?
         WHERE id = ? AND estado = 'en_proceso'\`,
        [chosenDriverId, pedidoId]
      );
      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} alistado y asignado al entregador para reparto.\`
      });
    } catch (error) {
      return sendDatabaseError(res, error, 'Despacho de pedido a reparto por bodega');
    }
  }
);`;

replaceExact(oldEnReparto, newEnReparto, 'PATCH /staff/pedidos/:id/en-reparto');

// 22. PATCH /staff/pedidos/:id/cancelar
const oldStaffCancel = `      await pool.query(
        \`UPDATE pedidos
         SET estado = 'cancelado',
             razon_cancelacion = ?,
             reembolso_estado = ?
         WHERE id = ?\`,
        [razon_cancelacion.trim(), reembolsoEstado, pedidoId]
      );

      const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (ord) {
        ord.estado = 'cancelado';
        ord.razon_cancelacion = razon_cancelacion.trim();
        ord.reembolso_estado = reembolsoEstado;
      }

      return res.json({
        ok: true,
        reembolso_estado: reembolsoEstado,
        message: \`Pedido #\${pedidoId} cancelado.\`
      });
    } catch (error) {
      const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (!ord || !canRoleCancelOrder(ord)) {
        return res.status(403).json({
          ok: false,
          message: 'No es posible cancelar este pedido desde tu rol actual.'
        });
      }
      const requiresRefund = ['tarjeta', 'pse', 'nequi', 'bancolombia'].includes(ord.metodo_pago);
      ord.estado = 'cancelado';
      ord.razon_cancelacion = razon_cancelacion.trim();
      ord.reembolso_estado = requiresRefund ? 'reembolsado' : 'no_aplica';
      saveFallbackStore();
      return res.json({
        ok: true,
        reembolso_estado: ord.reembolso_estado,
        message: \`Pedido #\${pedidoId} cancelado.\`
      });
    }
  }
);`;

const newStaffCancel = `      await pool.query(
        \`UPDATE pedidos
         SET estado = 'cancelado',
             razon_cancelacion = ?,
             reembolso_estado = ?
         WHERE id = ?\`,
        [razon_cancelacion.trim(), reembolsoEstado, pedidoId]
      );

      return res.json({
        ok: true,
        reembolso_estado: reembolsoEstado,
        message: \`Pedido #\${pedidoId} cancelado.\`
      });
    } catch (error) {
      return sendDatabaseError(res, error, 'Cancelación de pedido por staff');
    }
  }
);`;

replaceExact(oldStaffCancel, newStaffCancel, 'PATCH /staff/pedidos/:id/cancelar');

// 23. PATCH /staff/pedidos/:id/entregar
const oldEntregar = `      await pool.query(
        \`UPDATE pedidos
         SET estado = 'entregado',
             entregador_id = COALESCE(entregador_id, ?),
             foto_entrega_url = ?,
             observaciones_entregador = ?,
             fecha_entrega = NOW()
         WHERE id = ? AND estado = 'en_camino'\`,
        [req.user.id, foto_entrega_url, observaciones_entregador || 'Entrega completada.', pedidoId]
      );

      const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (ord) {
        ord.estado = 'entregado';
        ord.foto_entrega_url = foto_entrega_url;
        ord.observaciones_entregador = observaciones_entregador || 'Entrega verificada.';
        ord.fecha_entrega = new Date().toISOString();
      }

      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} entregado.\`
      });
    } catch (error) {
      const ord = pedidosFallback.find((p) => Number(p.id) === pedidoId);
      if (!ord || ord.estado !== 'en_camino') {
        return res.status(400).json({ ok: false, message: 'El pedido no se encuentra en ruta de entrega.' });
      }
      ord.estado = 'entregado';
      ord.entregador_id = ord.entregador_id || req.user.id;
      ord.foto_entrega_url = foto_entrega_url;
      ord.observaciones_entregador = observaciones_entregador || 'Entrega verificada.';
      ord.fecha_entrega = new Date().toISOString();
      saveFallbackStore();
      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} entregado.\`
      });
    }
  }
);`;

const newEntregar = `      await pool.query(
        \`UPDATE pedidos
         SET estado = 'entregado',
             entregador_id = COALESCE(entregador_id, ?),
             foto_entrega_url = ?,
             observaciones_entregador = ?,
             fecha_entrega = NOW()
         WHERE id = ? AND estado = 'en_camino'\`,
        [req.user.id, foto_entrega_url, observaciones_entregador || 'Entrega completada.', pedidoId]
      );

      return res.json({
        ok: true,
        message: \`Pedido #\${pedidoId} entregado.\`
      });
    } catch (error) {
      return sendDatabaseError(res, error, 'Finalización y entrega de pedido');
    }
  }
);`;

replaceExact(oldEntregar, newEntregar, 'PATCH /staff/pedidos/:id/entregar');

// 24. PATCH /staff/pedidos/:id/observacion
const oldObs = `      await pool.query('UPDATE pedidos SET observaciones_entregador = ? WHERE id = ?', [
        observaciones_entregador || '',
        pedidoId
      ]);
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) ord.observaciones_entregador = observaciones_entregador || '';
      return res.json({ ok: true, message: \`Observación guardada en pedido #\${pedidoId}.\` });
    } catch (error) {
      const ord = pedidosFallback.find((p) => p.id === pedidoId);
      if (ord) ord.observaciones_entregador = observaciones_entregador || '';
      return res.json({ ok: true, message: \`Observación guardada en pedido #\${pedidoId}.\` });
    }
  }
);`;

const newObs = `      await pool.query('UPDATE pedidos SET observaciones_entregador = ? WHERE id = ?', [
        observaciones_entregador || '',
        pedidoId
      ]);
      return res.json({ ok: true, message: \`Observación guardada en pedido #\${pedidoId}.\` });
    } catch (error) {
      return sendDatabaseError(res, error, 'Registro de observación');
    }
  }
);`;

replaceExact(oldObs, newObs, 'PATCH /staff/pedidos/:id/observacion');

// 25. GET /mis-tickets
const oldMisTickets = `router.get('/mis-tickets', async (req, res) => {
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
});`;

const newMisTickets = `router.get('/mis-tickets', async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ ok: false, message: 'Inicia sesión para ver tus tickets.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM tickets_soporte WHERE usuario_id = ? ORDER BY creado_en DESC',
      [authUser.id]
    );
    return res.json({ ok: true, data: rows.map(formatSafeTicket) });
  } catch (error) {
    return sendDatabaseError(res, error, 'Carga de tickets de soporte');
  }
});`;

replaceExact(oldMisTickets, newMisTickets, 'GET /mis-tickets');

// 26. POST /soporte/crear
const oldCrearTicket = `  if (safePedidoId) {
    try {
      const [ordRows] = await pool.query(
        'SELECT usuario_id FROM pedidos WHERE id = ? LIMIT 1',
        [safePedidoId]
      );
      if (!ordRows[0] || Number(ordRows[0].usuario_id) !== Number(authUser.id)) {
        safePedidoId = null;
      }
    } catch (_) {
      const ordMem = pedidosFallback.find((p) => Number(p.id) === safePedidoId);
      if (!ordMem || Number(ordMem.usuario_id) !== Number(authUser.id)) {
        safePedidoId = null;
      }
    }
  }

  const initialMsg = {
    id: Date.now(),
    autor: authUser.nombre_completo || authUser.username || 'Cliente',
    rol: 'cliente',
    texto: cleanDescripcion,
    fecha: new Date().toISOString()
  };

  try {
    const [result] = await pool.query(
      \`INSERT INTO tickets_soporte (pedido_id, usuario_id, tipo, asunto, descripcion, imagen_cliente_url, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'abierto')\`,
      [
        safePedidoId,
        authUser.id,
        cleanTipo,
        cleanAsunto,
        cleanDescripcion,
        imagen_cliente_url || null
      ]
    );

    const createdTicket = {
      id: result.insertId,
      pedido_id: safePedidoId,
      usuario_id: authUser.id,
      tipo: cleanTipo,
      asunto: cleanAsunto,
      descripcion: cleanDescripcion,
      imagen_cliente_url: imagen_cliente_url || null,
      estado: 'abierto',
      respuesta_soporte: null,
      mensajes: [initialMsg],
      creado_en: new Date().toISOString()
    };
    ticketsFallback.unshift(createdTicket);
    saveFallbackStore();

    return res.status(201).json({
      ok: true,
      ticket_id: result.insertId,
      ticket: createdTicket,
      message: 'Solicitud creada.'
    });
  } catch (error) {
    const newId = ticketsFallback.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) + 1;
    const createdTicket = {
      id: newId,
      pedido_id: safePedidoId,
      usuario_id: authUser.id,
      tipo: cleanTipo,
      asunto: cleanAsunto,
      descripcion: cleanDescripcion,
      imagen_cliente_url: imagen_cliente_url || null,
      estado: 'abierto',
      respuesta_soporte: null,
      mensajes: [initialMsg],
      creado_en: new Date().toISOString()
    };
    ticketsFallback.unshift(createdTicket);
    saveFallbackStore();
    return res.status(201).json({
      ok: true,
      ticket_id: newId,
      ticket: createdTicket,
      message: 'Solicitud creada.'
    });
  }
});`;

const newCrearTicket = `  if (safePedidoId) {
    try {
      const [ordRows] = await pool.query(
        'SELECT usuario_id FROM pedidos WHERE id = ? LIMIT 1',
        [safePedidoId]
      );
      if (!ordRows[0] || Number(ordRows[0].usuario_id) !== Number(authUser.id)) {
        safePedidoId = null;
      }
    } catch (_) {
      safePedidoId = null;
    }
  }

  const initialMsg = {
    id: Date.now(),
    autor: authUser.nombre_completo || authUser.username || 'Cliente',
    rol: 'cliente',
    texto: cleanDescripcion,
    fecha: new Date().toISOString()
  };

  try {
    const [result] = await pool.query(
      \`INSERT INTO tickets_soporte (pedido_id, usuario_id, tipo, asunto, descripcion, imagen_cliente_url, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'abierto')\`,
      [
        safePedidoId,
        authUser.id,
        cleanTipo,
        cleanAsunto,
        cleanDescripcion,
        imagen_cliente_url || null
      ]
    );

    const createdTicket = {
      id: result.insertId,
      pedido_id: safePedidoId,
      usuario_id: authUser.id,
      tipo: cleanTipo,
      asunto: cleanAsunto,
      descripcion: cleanDescripcion,
      imagen_cliente_url: imagen_cliente_url || null,
      estado: 'abierto',
      respuesta_soporte: null,
      mensajes: [initialMsg],
      creado_en: new Date().toISOString()
    };

    return res.status(201).json({
      ok: true,
      ticket_id: result.insertId,
      ticket: createdTicket,
      message: 'Solicitud creada.'
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Creación de ticket de soporte');
  }
});`;

replaceExact(oldCrearTicket, newCrearTicket, 'POST /soporte/crear');

// 27. POST /soporte/:id/mensaje
const oldTicketMsg = `  let dbTicket = null;
  try {
    const [dbRows] = await pool.query(
      'SELECT id, usuario_id, asunto, descripcion, estado FROM tickets_soporte WHERE id = ? LIMIT 1',
      [ticketId]
    );
    if (dbRows && dbRows[0]) {
      dbTicket = dbRows[0];
      if (!isStaff && Number(dbTicket.usuario_id) !== Number(liveUser.id)) {
        return res.status(403).json({ ok: false, message: 'No tienes permiso para acceder a este ticket.' });
      }
      if (dbTicket.estado === 'resuelto' || dbTicket.estado === 'cerrado') {
        return res.status(400).json({ ok: false, message: 'Este ticket ya fue resuelto y cerrado. El chat está bloqueado.' });
      }
    }
  } catch (_) {}

  let tk = ticketsFallback.find((t) => Number(t.id) === ticketId);
  if (tk && !isStaff && Number(tk.usuario_id) !== Number(liveUser.id)) {
    return res.status(403).json({ ok: false, message: 'No tienes permiso para acceder a este ticket.' });
  }
  if (!dbTicket && !tk) {
    return res.status(404).json({ ok: false, message: 'Ticket de soporte no encontrado.' });
  }
  if (tk && (tk.estado === 'resuelto' || tk.estado === 'cerrado')) {
    return res.status(400).json({ ok: false, message: 'Este ticket ya fue resuelto y cerrado. El chat está bloqueado.' });
  }

  const newMsg = {
    id: Date.now(),
    autor: isStaff ? \`\${liveUser.username} (Soporte)\` : (authUser.nombre_completo || liveUser.username),
    rol: isStaff ? 'soporte' : 'cliente',
    texto: cleanTexto,
    imagen_url: imagen_url || null,
    fecha: new Date().toISOString()
  };

  const validStaffStates = ['abierto', 'en_revision', 'resuelto', 'cerrado'];
  const requestedStaffState = isStaff && validStaffStates.includes(estado) ? estado : null;

  if (!tk) {
    tk = {
      id: ticketId,
      usuario_id: dbTicket ? dbTicket.usuario_id : liveUser.id,
      asunto: dbTicket ? dbTicket.asunto : \`Ticket #\${ticketId}\`,
      descripcion: dbTicket ? dbTicket.descripcion : '',
      estado: requestedStaffState || (dbTicket ? dbTicket.estado : 'abierto'),
      mensajes: dbTicket ? formatSafeTicket(dbTicket).mensajes : []
    };
    ticketsFallback.push(tk);
  }

  if (!Array.isArray(tk.mensajes)) tk.mensajes = formatSafeTicket(tk).mensajes;
  tk.mensajes.push(newMsg);
  if (isStaff && newMsg.texto) {
    tk.respuesta_soporte = newMsg.texto;
  }
  if (requestedStaffState) {
    tk.estado = requestedStaffState;
  } else if (isStaff && tk.estado === 'abierto') {
    tk.estado = 'en_revision';
  }
  saveFallbackStore();

  try {
    await pool.query(
      'UPDATE tickets_soporte SET respuesta_soporte = COALESCE(?, respuesta_soporte), estado = ? WHERE id = ?',
      [isStaff && newMsg.texto ? newMsg.texto : null, tk.estado, ticketId]
    );
  } catch (_) {
    // Sincronizado en memoria
  }

  return res.json({
    ok: true,
    ticket: formatSafeTicket(tk)
  });`;

const newTicketMsg = `  try {
    const [dbRows] = await pool.query(
      'SELECT id, usuario_id, asunto, descripcion, estado FROM tickets_soporte WHERE id = ? LIMIT 1',
      [ticketId]
    );
    if (!dbRows || !dbRows[0]) {
      return res.status(404).json({ ok: false, message: 'Ticket de soporte no encontrado.' });
    }
    const dbTicket = dbRows[0];
    if (!isStaff && Number(dbTicket.usuario_id) !== Number(liveUser.id)) {
      return res.status(403).json({ ok: false, message: 'No tienes permiso para acceder a este ticket.' });
    }
    if (dbTicket.estado === 'resuelto' || dbTicket.estado === 'cerrado') {
      return res.status(400).json({ ok: false, message: 'Este ticket ya fue resuelto y cerrado. El chat está bloqueado.' });
    }

    const validStaffStates = ['abierto', 'en_revision', 'resuelto', 'cerrado'];
    const requestedStaffState = isStaff && validStaffStates.includes(estado) ? estado : null;
    const nextState = requestedStaffState || (isStaff && dbTicket.estado === 'abierto' ? 'en_revision' : dbTicket.estado);
    const replyText = isStaff && cleanTexto ? cleanTexto : null;

    await pool.query(
      'UPDATE tickets_soporte SET respuesta_soporte = COALESCE(?, respuesta_soporte), estado = ? WHERE id = ?',
      [replyText, nextState, ticketId]
    );

    const [updatedRows] = await pool.query('SELECT * FROM tickets_soporte WHERE id = ? LIMIT 1', [ticketId]);
    const updatedTicket = formatSafeTicket(updatedRows[0]);
    updatedTicket.mensajes.push({
      id: Date.now(),
      autor: isStaff ? \`\${liveUser.username} (Soporte)\` : (authUser.nombre_completo || liveUser.username),
      rol: isStaff ? 'soporte' : 'cliente',
      texto: cleanTexto,
      imagen_url: imagen_url || null,
      fecha: new Date().toISOString()
    });

    return res.json({
      ok: true,
      ticket: updatedTicket
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Envío de mensaje en ticket de soporte');
  }`;

replaceExact(oldTicketMsg, newTicketMsg, 'POST /soporte/:id/mensaje');

// 28. PATCH /mis-tickets/:id/cerrar
const oldCerrarTicket = `  try {
    const [rows] = await pool.query(
      'SELECT id, usuario_id FROM tickets_soporte WHERE id = ? LIMIT 1',
      [ticketId]
    );
    if (rows[0] && Number(rows[0].usuario_id) !== Number(authUser.id)) {
      return res.status(403).json({ ok: false, message: 'No tienes permiso para cerrar este ticket.' });
    }
    await pool.query(
      'UPDATE tickets_soporte SET estado = "resuelto" WHERE id = ? AND usuario_id = ?',
      [ticketId, authUser.id]
    );
  } catch (_) {}

  let tk = ticketsFallback.find((t) => Number(t.id) === ticketId);
  if (tk) {
    if (Number(tk.usuario_id) !== Number(authUser.id)) {
      return res.status(403).json({ ok: false, message: 'No tienes permiso para cerrar este ticket.' });
    }
    tk.estado = 'resuelto';
    if (!Array.isArray(tk.mensajes)) tk.mensajes = formatSafeTicket(tk).mensajes;
    tk.mensajes.push({
      id: Date.now(),
      autor: \`\${authUser.nombre_completo || authUser.username || 'Cliente'} (Cliente)\`,
      rol: 'cliente',
      texto: 'El cliente ha marcado este ticket como cerrado y resuelto.',
      fecha: new Date().toISOString()
    });
    saveFallbackStore();
  }

  return res.json({
    ok: true,
    message: \`Ticket #\${ticketId} cerrado con éxito por el cliente.\`
  });
});`;

const newCerrarTicket = `  try {
    const [rows] = await pool.query(
      'SELECT id, usuario_id FROM tickets_soporte WHERE id = ? LIMIT 1',
      [ticketId]
    );
    if (!rows[0]) {
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado.' });
    }
    if (Number(rows[0].usuario_id) !== Number(authUser.id)) {
      return res.status(403).json({ ok: false, message: 'No tienes permiso para cerrar este ticket.' });
    }
    await pool.query(
      'UPDATE tickets_soporte SET estado = "resuelto" WHERE id = ? AND usuario_id = ?',
      [ticketId, authUser.id]
    );
    return res.json({
      ok: true,
      message: \`Ticket #\${ticketId} cerrado con éxito por el cliente.\`
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Cierre de ticket');
  }
});`;

replaceExact(oldCerrarTicket, newCerrarTicket, 'PATCH /mis-tickets/:id/cerrar');

// 29. PATCH /staff/tickets/:id
const oldStaffTicketUpdate = `    let tk = ticketsFallback.find((t) => Number(t.id) === ticketId);
    if (tk) {
      if (!Array.isArray(tk.mensajes)) tk.mensajes = formatSafeTicket(tk).mensajes;
      if (respuesta_soporte && String(respuesta_soporte).trim()) {
        tk.mensajes.push({
          id: Date.now(),
          autor: \`\${req.user.username} (Soporte)\`,
          rol: 'soporte',
          texto: String(respuesta_soporte).trim(),
          fecha: new Date().toISOString()
        });
        tk.respuesta_soporte = String(respuesta_soporte).trim();
      }
      if (estado) tk.estado = estado;
      saveFallbackStore();
    }

    try {
      await pool.query(
        'UPDATE tickets_soporte SET respuesta_soporte = COALESCE(?, respuesta_soporte), estado = ? WHERE id = ?',
        [respuesta_soporte || null, estado || 'resuelto', ticketId]
      );
    } catch (_) {}

    return res.json({ ok: true, message: \`Ticket #\${ticketId} actualizado.\` });
  }
);`;

const newStaffTicketUpdate = `    try {
      const [rows] = await pool.query('SELECT id FROM tickets_soporte WHERE id = ? LIMIT 1', [ticketId]);
      if (!rows[0]) {
        return res.status(404).json({ ok: false, message: 'Ticket no encontrado.' });
      }
      await pool.query(
        'UPDATE tickets_soporte SET respuesta_soporte = COALESCE(?, respuesta_soporte), estado = ? WHERE id = ?',
        [respuesta_soporte || null, estado || 'resuelto', ticketId]
      );
      return res.json({ ok: true, message: \`Ticket #\${ticketId} actualizado.\` });
    } catch (error) {
      return sendDatabaseError(res, error, 'Actualización de ticket por soporte');
    }
  }
);`;

replaceExact(oldStaffTicketUpdate, newStaffTicketUpdate, 'PATCH /staff/tickets/:id');

// 30. POST /staff/catalogo
const oldPostCatalogo = `  const catObj = categoriasFallback.find((c) => Number(c.id) === catId) || categoriasFallback[0];
  const sku = \`DAN-ADM-\${Date.now().toString().slice(-4)}\`;
  const cleanPrice = Math.max(0, Number(rawBasePrice) || 0);
  const disc = parseDiscountPayload(req.body, null);
  const defaultImg =
    imagen_url ||
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80';

  try {
    await ensureProductDiscountColumns();
    const [result] = await pool.query(
      \`INSERT INTO productos (
        categoria_id, codigo_sku, nombre, descripcion, presentacion, precio,
        descuento_porcentaje, descuento_tipo, descuento_expira_en, descuento_expira_ms,
        descuento_unidades_limite, descuento_unidades_vendidas,
        imagen_url, stock, es_mas_vendido, etiqueta, temperatura_conservacion, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 150, ?, ?, ?, 1)\`,
      [
        catObj.id,
        sku,
        String(nombre).trim().toUpperCase(),
        descripcion || 'Calidad garantizada Danillanos.',
        presentacion || 'Unidad',
        cleanPrice,
        disc.descuento_porcentaje,
        disc.descuento_tipo,
        disc.descuento_expira_mysql,
        disc.descuento_expira_ms,
        disc.descuento_unidades_limite,
        disc.descuento_unidades_vendidas,
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
      precio_base: cleanPrice,
      descuento_porcentaje: disc.descuento_porcentaje,
      descuento_tipo: disc.descuento_tipo,
      descuento_expira_en: disc.descuento_expira_en,
      descuento_expira_ms: disc.descuento_expira_ms,
      descuento_unidades_limite: disc.descuento_unidades_limite,
      descuento_unidades_vendidas: disc.descuento_unidades_vendidas,
      imagen_url: defaultImg,
      stock: 150,
      es_mas_vendido: es_mas_vendido ? 1 : 0,
      etiqueta: etiqueta || null,
      temperatura_conservacion: temperatura_conservacion || 'Congelado -18°C'
    };
    productosFallback.unshift(newProd);
    saveFallbackStore();

    return res.status(201).json({ ok: true, product: formatProductWithDiscount(newProd).product });
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
      precio_base: cleanPrice,
      descuento_porcentaje: disc.descuento_porcentaje,
      descuento_tipo: disc.descuento_tipo,
      descuento_expira_en: disc.descuento_expira_en,
      descuento_expira_ms: disc.descuento_expira_ms,
      descuento_unidades_limite: disc.descuento_unidades_limite,
      descuento_unidades_vendidas: disc.descuento_unidades_vendidas,
      imagen_url: defaultImg,
      stock: 150,
      es_mas_vendido: es_mas_vendido ? 1 : 0,
      etiqueta: etiqueta || null,
      temperatura_conservacion: temperatura_conservacion || 'Congelado -18°C'
    };
    productosFallback.unshift(newProd);
    saveFallbackStore();
    return res.status(201).json({ ok: true, source: 'fallback', product: formatProductWithDiscount(newProd).product });
  }
});`;

const newPostCatalogo = `  const sku = \`DAN-ADM-\${Date.now().toString().slice(-4)}\`;
  const cleanPrice = Math.max(0, Number(rawBasePrice) || 0);
  const disc = parseDiscountPayload(req.body, null);
  const defaultImg =
    imagen_url ||
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80';

  try {
    await ensureProductDiscountColumns();
    const [result] = await pool.query(
      \`INSERT INTO productos (
        categoria_id, codigo_sku, nombre, descripcion, presentacion, precio,
        descuento_porcentaje, descuento_tipo, descuento_expira_en, descuento_expira_ms,
        descuento_unidades_limite, descuento_unidades_vendidas,
        imagen_url, stock, es_mas_vendido, etiqueta, temperatura_conservacion, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 150, ?, ?, ?, 1)\`,
      [
        catId,
        sku,
        String(nombre).trim().toUpperCase(),
        descripcion || 'Calidad garantizada Danillanos.',
        presentacion || 'Unidad',
        cleanPrice,
        disc.descuento_porcentaje,
        disc.descuento_tipo,
        disc.descuento_expira_mysql,
        disc.descuento_expira_ms,
        disc.descuento_unidades_limite,
        disc.descuento_unidades_vendidas,
        defaultImg,
        es_mas_vendido ? 1 : 0,
        etiqueta || null,
        temperatura_conservacion || 'Congelado -18°C'
      ]
    );

    const [dbRows] = await pool.query(
      \`SELECT p.*, cat.slug AS categoria_slug, cat.nombre AS categoria_nombre
       FROM productos p
       INNER JOIN categorias cat ON p.categoria_id = cat.id
       WHERE p.id = ? LIMIT 1\`,
      [result.insertId]
    );

    return res.status(201).json({ ok: true, product: formatProductWithDiscount(dbRows[0]).product });
  } catch (error) {
    return sendDatabaseError(res, error, 'Creación de producto en catálogo');
  }
});`;

replaceExact(oldPostCatalogo, newPostCatalogo, 'POST /staff/catalogo');

// 31. PUT /staff/catalogo/:id
const oldPutCatalogo = `  const catId = Number(categoria_id) || 1;
  const catObj = categoriasFallback.find((c) => Number(c.id) === catId) || categoriasFallback[0];
  const existing = productosFallback.find((p) => Number(p.id) === prodId);

  const rawBasePrice = precio_base !== undefined ? precio_base : precio;
  const resolvedBasePrice =
    rawBasePrice !== undefined
      ? Math.max(0, Number(rawBasePrice) || 0)
      : Number(existing?.precio_base ?? existing?.precio ?? 0);

  const hasDiscountFields = req.body.descuento_porcentaje !== undefined;
  const disc = hasDiscountFields
    ? parseDiscountPayload(req.body, existing)
    : parseDiscountPayload({ preserve_vendidas: true }, existing);

  if (existing) {
    if (nombre !== undefined) existing.nombre = String(nombre).trim().toUpperCase();
    if (categoria_id !== undefined) {
      existing.categoria_id = catObj.id;
      existing.categoria_slug = catObj.slug;
      existing.categoria_nombre = catObj.nombre;
    }
    if (presentacion !== undefined) existing.presentacion = presentacion;
    if (descripcion !== undefined) existing.descripcion = descripcion;
    existing.precio = resolvedBasePrice;
    existing.precio_base = resolvedBasePrice;
    existing.descuento_porcentaje = disc.descuento_porcentaje;
    existing.descuento_tipo = disc.descuento_tipo;
    existing.descuento_expira_en = disc.descuento_expira_en;
    existing.descuento_expira_ms = disc.descuento_expira_ms;
    existing.descuento_unidades_limite = disc.descuento_unidades_limite;
    existing.descuento_unidades_vendidas = disc.descuento_unidades_vendidas;
    if (temperatura_conservacion !== undefined) existing.temperatura_conservacion = temperatura_conservacion;
    if (etiqueta !== undefined) existing.etiqueta = etiqueta || null;
    if (imagen_url !== undefined && imagen_url.trim()) existing.imagen_url = imagen_url.trim();
    if (es_mas_vendido !== undefined) existing.es_mas_vendido = es_mas_vendido ? 1 : 0;
    saveFallbackStore();
  }

  try {
    await ensureProductDiscountColumns();
    await pool.query(
      \`UPDATE productos
       SET categoria_id = ?, nombre = ?, presentacion = ?, descripcion = ?, precio = ?,
           descuento_porcentaje = ?, descuento_tipo = ?, descuento_expira_en = ?, descuento_expira_ms = ?,
           descuento_unidades_limite = ?, descuento_unidades_vendidas = ?,
           temperatura_conservacion = ?, etiqueta = ?, imagen_url = COALESCE(NULLIF(?, ''), imagen_url),
           es_mas_vendido = ?
       WHERE id = ?\`,
      [
        catObj.id,
        String(nombre || existing?.nombre || '').trim().toUpperCase(),
        presentacion || existing?.presentacion || 'Unidad',
        descripcion || existing?.descripcion || '',
        resolvedBasePrice,
        disc.descuento_porcentaje,
        disc.descuento_tipo,
        disc.descuento_expira_mysql,
        disc.descuento_expira_ms,
        disc.descuento_unidades_limite,
        disc.descuento_unidades_vendidas,
        temperatura_conservacion || existing?.temperatura_conservacion || 'Congelado -18°C',
        etiqueta || null,
        imagen_url || '',
        es_mas_vendido ? 1 : 0,
        prodId
      ]
    );
    const [dbRows] = await pool.query(
      \`SELECT p.*, cat.slug AS categoria_slug, cat.nombre AS categoria_nombre
       FROM productos p
       INNER JOIN categorias cat ON p.categoria_id = cat.id
       WHERE p.id = ? LIMIT 1\`,
      [prodId]
    );
    if (dbRows && dbRows[0]) {
      return res.json({ ok: true, product: formatProductWithDiscount(dbRows[0]).product });
    }
  } catch (err) {
    console.error('[PUT /staff/catalogo/:id] Error MySQL:', err.message);
  }

  return res.json({ ok: true, product: existing ? formatProductWithDiscount(existing).product : null });
});`;

const newPutCatalogo = `  const catId = Number(categoria_id) || 1;
  const rawBasePrice = precio_base !== undefined ? precio_base : precio;
  const cleanPrice = rawBasePrice !== undefined ? Math.max(0, Number(rawBasePrice) || 0) : undefined;
  const disc = parseDiscountPayload(req.body, null);

  try {
    await ensureProductDiscountColumns();
    const [existingRows] = await pool.query('SELECT * FROM productos WHERE id = ? LIMIT 1', [prodId]);
    if (!existingRows || !existingRows[0]) {
      return res.status(404).json({ ok: false, message: 'Producto no encontrado.' });
    }
    const currentProd = existingRows[0];
    const resolvedBasePrice = cleanPrice !== undefined ? cleanPrice : Number(currentProd.precio);

    await pool.query(
      \`UPDATE productos
       SET categoria_id = ?, nombre = ?, presentacion = ?, descripcion = ?, precio = ?,
           descuento_porcentaje = ?, descuento_tipo = ?, descuento_expira_en = ?, descuento_expira_ms = ?,
           descuento_unidades_limite = ?, descuento_unidades_vendidas = ?,
           temperatura_conservacion = ?, etiqueta = ?, imagen_url = COALESCE(NULLIF(?, ''), imagen_url),
           es_mas_vendido = ?
       WHERE id = ?\`,
      [
        catId,
        String(nombre || currentProd.nombre).trim().toUpperCase(),
        presentacion || currentProd.presentacion || 'Unidad',
        descripcion !== undefined ? descripcion : currentProd.descripcion,
        resolvedBasePrice,
        disc.descuento_porcentaje,
        disc.descuento_tipo,
        disc.descuento_expira_mysql,
        disc.descuento_expira_ms,
        disc.descuento_unidades_limite,
        disc.descuento_unidades_vendidas,
        temperatura_conservacion || currentProd.temperatura_conservacion || 'Congelado -18°C',
        etiqueta !== undefined ? etiqueta : currentProd.etiqueta,
        imagen_url || '',
        es_mas_vendido !== undefined ? (es_mas_vendido ? 1 : 0) : currentProd.es_mas_vendido,
        prodId
      ]
    );
    const [dbRows] = await pool.query(
      \`SELECT p.*, cat.slug AS categoria_slug, cat.nombre AS categoria_nombre
       FROM productos p
       INNER JOIN categorias cat ON p.categoria_id = cat.id
       WHERE p.id = ? LIMIT 1\`,
      [prodId]
    );
    return res.json({ ok: true, product: formatProductWithDiscount(dbRows[0]).product });
  } catch (error) {
    return sendDatabaseError(res, error, 'Actualización de producto');
  }
});`;

replaceExact(oldPutCatalogo, newPutCatalogo, 'PUT /staff/catalogo/:id');

// 32. PATCH /staff/catalogo/:id/descuento
const oldPatchDisc = `router.patch('/staff/catalogo/:id/descuento', requireStaffRole(['admin']), async (req, res) => {
  const prodId = Number(req.params.id);
  const existing = productosFallback.find((p) => Number(p.id) === prodId) || null;
  const disc = parseDiscountPayload(req.body, existing);

  if (existing) {
    if (existing.precio_base === undefined) {
      existing.precio_base = Number(existing.precio || 0);
    }
    existing.precio = Number(existing.precio_base);
    existing.descuento_porcentaje = disc.descuento_porcentaje;
    existing.descuento_tipo = disc.descuento_tipo;
    existing.descuento_expira_en = disc.descuento_expira_en;
    existing.descuento_expira_ms = disc.descuento_expira_ms;
    existing.descuento_unidades_limite = disc.descuento_unidades_limite;
    existing.descuento_unidades_vendidas = disc.descuento_unidades_vendidas;
    saveFallbackStore();
  }

  try {
    await ensureProductDiscountColumns();
    await pool.query(
      \`UPDATE productos
       SET descuento_porcentaje = ?,
           descuento_tipo = ?,
           descuento_expira_en = ?,
           descuento_expira_ms = ?,
           descuento_unidades_limite = ?,
           descuento_unidades_vendidas = ?
       WHERE id = ?\`,
      [
        disc.descuento_porcentaje,
        disc.descuento_tipo,
        disc.descuento_expira_mysql,
        disc.descuento_expira_ms,
        disc.descuento_unidades_limite,
        disc.descuento_unidades_vendidas,
        prodId
      ]
    );

    const [dbRows] = await pool.query(
      \`SELECT p.*, cat.slug AS categoria_slug, cat.nombre AS categoria_nombre
       FROM productos p
       INNER JOIN categorias cat ON p.categoria_id = cat.id
       WHERE p.id = ? LIMIT 1\`,
      [prodId]
    );
    if (dbRows && dbRows[0]) {
      return res.json({
        ok: true,
        source: 'mysql',
        product: formatProductWithDiscount(dbRows[0]).product,
        message:
          disc.descuento_porcentaje > 0
            ? \`Descuento del \${disc.descuento_porcentaje}% guardado en el servidor.\`
            : 'Descuento retirado; el producto volvió a su precio regular.'
      });
    }
  } catch (err) {
    console.error('[PATCH /staff/catalogo/:id/descuento] Error MySQL:', err.message);
  }

  if (!existing) {
    return res.status(404).json({ ok: false, message: 'Producto no encontrado en el catálogo.' });
  }

  return res.json({
    ok: true,
    source: 'fallback',
    product: formatProductWithDiscount(existing).product,
    message:
      disc.descuento_porcentaje > 0
        ? \`Descuento del \${disc.descuento_porcentaje}% aplicado exitosamente.\`
        : 'Descuento retirado; el producto volvió a su precio regular.'
  });
});`;

const newPatchDisc = `router.patch('/staff/catalogo/:id/descuento', requireStaffRole(['admin']), async (req, res) => {
  const prodId = Number(req.params.id);
  const disc = parseDiscountPayload(req.body, null);

  try {
    await ensureProductDiscountColumns();
    const [existingRows] = await pool.query('SELECT * FROM productos WHERE id = ? LIMIT 1', [prodId]);
    if (!existingRows || !existingRows[0]) {
      return res.status(404).json({ ok: false, message: 'Producto no encontrado en el catálogo.' });
    }

    await pool.query(
      \`UPDATE productos
       SET descuento_porcentaje = ?,
           descuento_tipo = ?,
           descuento_expira_en = ?,
           descuento_expira_ms = ?,
           descuento_unidades_limite = ?,
           descuento_unidades_vendidas = ?
       WHERE id = ?\`,
      [
        disc.descuento_porcentaje,
        disc.descuento_tipo,
        disc.descuento_expira_mysql,
        disc.descuento_expira_ms,
        disc.descuento_unidades_limite,
        disc.descuento_unidades_vendidas,
        prodId
      ]
    );

    const [dbRows] = await pool.query(
      \`SELECT p.*, cat.slug AS categoria_slug, cat.nombre AS categoria_nombre
       FROM productos p
       INNER JOIN categorias cat ON p.categoria_id = cat.id
       WHERE p.id = ? LIMIT 1\`,
      [prodId]
    );
    return res.json({
      ok: true,
      source: 'mysql',
      product: formatProductWithDiscount(dbRows[0]).product,
      message:
        disc.descuento_porcentaje > 0
          ? \`Descuento del \${disc.descuento_porcentaje}% guardado en el servidor.\`
          : 'Descuento retirado; el producto volvió a su precio regular.'
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Actualización de descuento');
  }
});`;

replaceExact(oldPatchDisc, newPatchDisc, 'PATCH /staff/catalogo/:id/descuento');

// 33. DELETE /staff/catalogo/:id
const oldDelCatalogo = `router.delete('/staff/catalogo/:id', requireStaffRole(['admin']), async (req, res) => {
  const prodId = Number(req.params.id);
  const idx = productosFallback.findIndex((p) => Number(p.id) === prodId);
  if (idx !== -1) {
    productosFallback.splice(idx, 1);
    saveFallbackStore();
  }

  try {
    await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [prodId]);
  } catch (_) {}

  return res.json({ ok: true, deletedId: prodId });
});`;

const newDelCatalogo = `router.delete('/staff/catalogo/:id', requireStaffRole(['admin']), async (req, res) => {
  const prodId = Number(req.params.id);

  try {
    const [resDb] = await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [prodId]);
    if (resDb.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: 'Producto no encontrado.' });
    }
    return res.json({ ok: true, deletedId: prodId });
  } catch (error) {
    return sendDatabaseError(res, error, 'Baja de producto del catálogo');
  }
});`;

replaceExact(oldDelCatalogo, newDelCatalogo, 'DELETE /staff/catalogo/:id');

// 34. GET /staff/usuarios
const oldGetStaffUsers = `router.get('/staff/usuarios', requireStaffRole(['admin']), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM usuarios WHERE rol != 'cliente' ORDER BY id ASC");
    if (rows.length > 0) {
      return res.json({ ok: true, data: rows.map(formatSafeUser) });
    }
    const staffFallback = usuariosFallback.filter((u) => u.rol !== 'cliente');
    return res.json({ ok: true, data: staffFallback.map(formatSafeUser) });
  } catch (error) {
    const staffFallback = usuariosFallback.filter((u) => u.rol !== 'cliente');
    return res.json({ ok: true, data: staffFallback.map(formatSafeUser) });
  }
});`;

const newGetStaffUsers = `router.get('/staff/usuarios', requireStaffRole(['admin']), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM usuarios WHERE rol != 'cliente' ORDER BY id ASC");
    return res.json({ ok: true, data: rows.map(formatSafeUser) });
  } catch (error) {
    return sendDatabaseError(res, error, 'Carga de usuarios de staff');
  }
});`;

replaceExact(oldGetStaffUsers, newGetStaffUsers, 'GET /staff/usuarios');

// 35. POST /staff/usuarios
const oldPostStaffUsers = `    await pool.query('UPDATE usuarios SET rol = ?, activo = 1 WHERE id = ?', [userRole, u.id]);
    const [updated] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [u.id]);
    const safe = formatSafeUser(updated[0]);
    return res.json({
      ok: true,
      user: safe,
      updated: true,
      message: \`Usuario \${cleanEmail} asignado exitosamente al rol de \${userRole.toUpperCase()}.\`
    });
  } catch (err) {
    let memUser = usuariosFallback.find(
      (u) => u.email_hash === emailHash || (u.email && u.email.toLowerCase() === cleanEmail)
    );
    if (!memUser) {
      return res.status(404).json({
        ok: false,
        message: 'El usuario no está registrado en la plataforma. Primero debe crearse una cuenta antes de poder añadirlo a la lista de empleados.'
      });
    }
    memUser.rol = userRole;
    memUser.activo = 1;
    saveFallbackStore();
    return res.json({
      ok: true,
      user: formatSafeUser(memUser),
      updated: true,
      message: \`Usuario \${cleanEmail} asignado exitosamente al rol de \${userRole.toUpperCase()}.\`
    });
  }
});`;

const newPostStaffUsers = `    await pool.query('UPDATE usuarios SET rol = ?, activo = 1 WHERE id = ?', [userRole, u.id]);
    const [updated] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [u.id]);
    const safe = formatSafeUser(updated[0]);
    return res.json({
      ok: true,
      user: safe,
      updated: true,
      message: \`Usuario \${cleanEmail} asignado exitosamente al rol de \${userRole.toUpperCase()}.\`
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Asignación de rol a usuario');
  }
});`;

replaceExact(oldPostStaffUsers, newPostStaffUsers, 'POST /staff/usuarios');

// 36. PATCH /staff/usuarios/:id
const oldPatchStaffUsers = `  const memUser = usuariosFallback.find((u) => Number(u.id) === userId);
  if (memUser) {
    if (normalizedRole && validRoles.includes(normalizedRole)) memUser.rol = normalizedRole;
    if (activo !== undefined) memUser.activo = activo ? 1 : 0;
    saveFallbackStore();
  }

  try {
    await ensureProductDiscountColumns();
    if (normalizedRole && validRoles.includes(normalizedRole)) {
      await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [normalizedRole, userId]);
    }
    if (activo !== undefined) {
      await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, userId]);
    }
    const [updatedRows] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [userId]);
    if (updatedRows && updatedRows[0]) {
      return res.json({
        ok: true,
        user: formatSafeUser(updatedRows[0])
      });
    }
  } catch (_) {}

  return res.json({
    ok: true,
    user: memUser ? formatSafeUser(memUser) : null
  });
});`;

const newPatchStaffUsers = `  try {
    await ensureProductDiscountColumns();
    if (normalizedRole && validRoles.includes(normalizedRole)) {
      await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [normalizedRole, userId]);
    }
    if (activo !== undefined) {
      await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, userId]);
    }
    const [updatedRows] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [userId]);
    if (!updatedRows || !updatedRows[0]) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    return res.json({
      ok: true,
      user: formatSafeUser(updatedRows[0])
    });
  } catch (error) {
    return sendDatabaseError(res, error, 'Modificación de estado de usuario');
  }
});`;

replaceExact(oldPatchStaffUsers, newPatchStaffUsers, 'PATCH /staff/usuarios/:id');

fs.writeFileSync(filePath, code, 'utf8');
console.log('🎉 Todas las sustituciones se completaron con precisión quirúrgica.');
const remaining = (code.match(/Fallback|source:\s*'fallback'/g) || []).length;
console.log('Restantes menciones de Fallback en api.js:', remaining);
