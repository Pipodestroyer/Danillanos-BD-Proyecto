/**
 * @fileoverview Generador alternativo de script SQL comentado `database/schema_comments.sql`.
 * Proporciona un generador autónomo en la raíz del proyecto para crear o actualizar
 * el archivo de esquema SQL con anotaciones y documentación técnica expandida.
 *
 * @module generate-schema_comments
 */

const fs = require('fs');
const path = require('path');
const { categoriasDanillanos, productosDanillanos, carruselDanillanos } = require('./backend/data/catalogData');
const { hashPassword, encryptData, hashLookup } = require('./backend/utils/security');

/**
 * Escapa valores para su inclusión segura en sentencias SQL literales.
 *
 * @function sqlEscape
 * @param {string|number|null|undefined} val - Valor a escapar.
 * @returns {string} Representación literal compatible con SQL.
 */
function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Genera el script SQL documentado y lo guarda en `database/schema_comments.sql`.
 *
 * @function generateSchemaCommentsSql
 * @returns {void}
 */
function generateSchemaCommentsSql() {
  const lines = [];

  lines.push(`-- ============================================================================`);
  lines.push(`-- DANILLANOS - TIENDA DE CÁRNICOS, CONGELADOS E INSUMOS PARA RESTAURANTES`);
  lines.push(`-- Esquema MySQL Documentado: Tablas, Relaciones, Vistas, Procedimientos y Triggers`);
  lines.push(`-- ============================================================================\n`);

  lines.push(`CREATE DATABASE IF NOT EXISTS danillanos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  lines.push(`USE danillanos_db;\n`);

  lines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
  lines.push(`DROP TABLE IF EXISTS tickets_soporte;`);
  lines.push(`DROP TABLE IF EXISTS pedido_items;`);
  lines.push(`DROP TABLE IF EXISTS pedidos;`);
  lines.push(`DROP TABLE IF EXISTS usuario_direcciones;`);
  lines.push(`DROP TABLE IF EXISTS usuarios;`);
  lines.push(`DROP TABLE IF EXISTS carrusel_promociones;`);
  lines.push(`DROP TABLE IF EXISTS productos;`);
  lines.push(`DROP TABLE IF EXISTS categorias;`);
  lines.push(`DROP VIEW IF EXISTS resumen_base;`);
  lines.push(`DROP VIEW IF EXISTS resumen_ventas_categoria;`);
  lines.push(`DROP VIEW IF EXISTS resumen_dist_metodo_pago;`);
  lines.push(`DROP PROCEDURE IF EXISTS sp_catalogo_completo;`);
  lines.push(`DROP TRIGGER IF EXISTS tr_contar_stock;`);
  lines.push(`SET FOREIGN_KEY_CHECKS = 1;\n`);

  // 1. Categorías
  lines.push(`-- ----------------------------------------------------------------------------
-- Tabla: categorias
-- Almacena las 9 categorías comerciales de productos con su identificador e ícono visual.
-- ----------------------------------------------------------------------------
CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  icono VARCHAR(60) DEFAULT 'restaurant',
  descripcion VARCHAR(255),
  activo TINYINT(1) DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n`);

  // 2. Productos (235 items del listado de precios)
  lines.push(`-- ----------------------------------------------------------------------------
-- Tabla: productos
-- Contiene los 235 artículos del catálogo oficial con SKU único, precio, control de stock y refrigeración.
-- ----------------------------------------------------------------------------
CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  codigo_sku VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(160) NOT NULL,
  descripcion TEXT,
  presentacion VARCHAR(80) NOT NULL,
  precio DECIMAL(12, 2) NOT NULL,
  precio_anterior DECIMAL(12, 2) DEFAULT NULL,
  imagen_url VARCHAR(500) DEFAULT NULL,
  stock INT NOT NULL DEFAULT 100,
  es_mas_vendido TINYINT(1) DEFAULT 0,
  etiqueta VARCHAR(50) DEFAULT NULL,
  temperatura_conservacion VARCHAR(60) DEFAULT 'Ambiente',
  activo TINYINT(1) DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_producto_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);\n`);

  // 3. Carrusel Promociones
  lines.push(`-- ----------------------------------------------------------------------------
-- Tabla: carrusel_promociones
-- Gestiona las diapositivas promocionales visualizadas en el encabezado de la tienda.
-- ----------------------------------------------------------------------------
CREATE TABLE carrusel_promociones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT DEFAULT NULL,
  subtitulo VARCHAR(100) NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  descripcion VARCHAR(320) NOT NULL,
  precio_destacado DECIMAL(12, 2) DEFAULT NULL,
  imagen_url VARCHAR(500) NOT NULL,
  texto_boton VARCHAR(60) NOT NULL DEFAULT 'Añadir al carrito',
  tipo_accion ENUM('add_to_cart', 'buy_now', 'ver_catalogo') DEFAULT 'add_to_cart',
  orden INT DEFAULT 1,
  activo TINYINT(1) DEFAULT 1,
  CONSTRAINT fk_carrusel_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);\n`);

  // 4. Usuarios con cifrado AES-256-GCM y Scrypt
  lines.push(`-- ----------------------------------------------------------------------------
-- Tabla: usuarios
-- Registra credenciales y datos personales protegidos mediante Scrypt (claves) y AES-256-GCM (PII).
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  nombre_completo_enc TEXT NOT NULL COMMENT 'Cifrado AES-256-GCM',
  nombres_enc TEXT DEFAULT NULL COMMENT 'Nombres cifrados AES-256-GCM',
  apellidos_enc TEXT DEFAULT NULL COMMENT 'Apellidos cifrados AES-256-GCM',
  empresa_enc TEXT DEFAULT NULL COMMENT 'Empresa opcional cifrada AES-256-GCM',
  tipo_documento VARCHAR(20) DEFAULT 'CC',
  numero_documento_enc TEXT DEFAULT NULL COMMENT 'Documento cifrado AES-256-GCM',
  email_hash VARCHAR(128) NOT NULL UNIQUE COMMENT 'HMAC-SHA256 para búsqueda indexada',
  email_enc TEXT NOT NULL COMMENT 'Cifrado AES-256-GCM',
  password_hash VARCHAR(255) DEFAULT NULL COMMENT 'Hash Scrypt con Salt',
  google_id_enc TEXT DEFAULT NULL COMMENT 'ID OAuth Google Cifrado',
  telefono_enc TEXT DEFAULT NULL COMMENT 'Celular Cifrado AES-256-GCM',
  avatar_url VARCHAR(500) DEFAULT NULL,
  rol ENUM('cliente', 'empleado', 'entregador', 'soporte', 'admin') NOT NULL DEFAULT 'cliente',
  activo TINYINT(1) DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n`);

  // 5. Direcciones con Coordenadas GPS
  lines.push(`-- ----------------------------------------------------------------------------
-- Tabla: usuario_direcciones
-- Registra hasta 5 domicilios por cliente con geoposición (lat/lng) para validación de cobertura.
-- ----------------------------------------------------------------------------
CREATE TABLE usuario_direcciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  etiqueta VARCHAR(60) NOT NULL DEFAULT 'Principal',
  direccion_enc TEXT NOT NULL COMMENT 'Dirección cifrada AES-256-GCM',
  barrio_referencia VARCHAR(140) DEFAULT NULL,
  municipio VARCHAR(80) NOT NULL DEFAULT 'Villavicencio',
  departamento VARCHAR(80) NOT NULL DEFAULT 'Meta',
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  es_villavicencio TINYINT(1) NOT NULL DEFAULT 1,
  tiempo_entrega_estimado VARCHAR(100) NOT NULL DEFAULT 'Envío el mismo día (Villavicencio)',
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_direccion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);\n`);

  // 6. Pedidos y Trazabilidad Operativa
  lines.push(`-- ----------------------------------------------------------------------------
-- Tabla: pedidos
-- Control central de órdenes, estado de entrega, asignación de despachador y comprobantes fotográficos.
-- ----------------------------------------------------------------------------
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT DEFAULT NULL,
  nombre_recibe_enc TEXT NOT NULL COMMENT 'Nombre de quien recibe cifrado AES-256-GCM',
  telefono_cliente_enc TEXT NOT NULL COMMENT 'Teléfono cifrado AES-256-GCM',
  direccion_entrega_enc TEXT NOT NULL COMMENT 'Dirección cifrada AES-256-GCM',
  municipio VARCHAR(80) NOT NULL DEFAULT 'Villavicencio',
  lat DECIMAL(10, 7) NOT NULL DEFAULT 4.1420000,
  lng DECIMAL(10, 7) NOT NULL DEFAULT -73.6266000,
  es_villavicencio TINYINT(1) NOT NULL DEFAULT 1,
  tiempo_entrega_estimado VARCHAR(100) NOT NULL DEFAULT 'Envío el mismo día (Villavicencio)',
  metodo_pago ENUM('pse', 'nequi', 'bancolombia', 'tarjeta', 'efectivo') NOT NULL DEFAULT 'efectivo',
  referencia_pago VARCHAR(100) DEFAULT NULL,
  total DECIMAL(12, 2) NOT NULL,
  estado ENUM('pendiente', 'en_proceso', 'en_camino', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente',
  observaciones_cliente TEXT DEFAULT NULL,
  razon_cancelacion TEXT DEFAULT NULL,
  reembolso_estado ENUM('no_aplica', 'reembolsado') NOT NULL DEFAULT 'no_aplica',
  entregador_id INT DEFAULT NULL,
  observaciones_entregador TEXT DEFAULT NULL,
  foto_entrega_url LONGTEXT DEFAULT NULL COMMENT 'Foto de evidencia tomada por el entregador',
  fecha_confirmacion DATETIME DEFAULT NULL,
  fecha_entrega DATETIME DEFAULT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedido_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);\n`);

  // 7. Detalle de Items de Pedido
  lines.push(`-- ----------------------------------------------------------------------------
-- Tabla: pedido_items
-- Detalle de productos, cantidades unitarias y subtotales asociados a cada pedido.
-- ----------------------------------------------------------------------------
CREATE TABLE pedido_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  producto_id INT NOT NULL,
  nombre_producto VARCHAR(160) NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12, 2) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  CONSTRAINT fk_item_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_item_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);\n`);

  // 8. Tickets de Soporte
  lines.push(`-- ----------------------------------------------------------------------------
-- Tabla: tickets_soporte
-- Módulo de PQRS con soporte para imágenes de inconformidad (vencimientos, averías) y respuestas.
-- ----------------------------------------------------------------------------
CREATE TABLE tickets_soporte (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  tipo ENUM('envio', 'pago', 'producto', 'reembolso', 'otro') DEFAULT 'envio',
  asunto VARCHAR(160) NOT NULL,
  descripcion TEXT NOT NULL,
  imagen_cliente_url LONGTEXT DEFAULT NULL COMMENT 'Foto adjunta por el cliente (ej. fecha de vencimiento)',
  estado ENUM('abierto', 'en_revision', 'resuelto') DEFAULT 'abierto',
  respuesta_soporte TEXT DEFAULT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ticket_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);\n`);

  // 9. Vistas, Procedimientos Almacenados y Triggers
  lines.push(`-- ============================================================================
-- VISTAS ANALÍTICAS, PROCEDIMIENTOS ALMACENADOS Y DISPARADORES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Vista: resumen_base
-- Consolida los indicadores clave de desempeño (KPIs): ventas totales acumuladas,
-- pedidos por confirmar, órdenes en preparación/tránsito y pedidos finalizados.
-- ----------------------------------------------------------------------------
CREATE VIEW resumen_base AS
SELECT
  SUM(CASE WHEN pe.estado = 'entregado' THEN pe.total ELSE 0 END) AS total_vendido,
  COUNT(CASE WHEN pe.estado = 'pendiente' THEN 1 ELSE 0 END) AS por_aceptar,
  COUNT(CASE WHEN pe.estado = 'en_proceso' OR pe.estado = 'en_camino' THEN 1 ELSE 0 END) AS en_bodega_o_en_reparto,
  COUNT(CASE WHEN pe.estado = 'entregado' THEN 1 ELSE 0 END) AS entregados
FROM pedidos AS pe;

-- ----------------------------------------------------------------------------
-- Vista: resumen_ventas_categoria
-- Totaliza los ingresos recaudados por cada categoría a partir de ítems entregados.
-- ----------------------------------------------------------------------------
CREATE VIEW resumen_ventas_categoria AS
SELECT
  c.nombre,
  SUM(CASE WHEN pe.estado = 'entregado' THEN peit.subtotal ELSE 0 END) AS ventas
FROM pedido_items AS peit
INNER JOIN pedidos AS pe ON pe.id = peit.pedido_id
INNER JOIN productos AS pr ON pr.id = peit.producto_id
INNER JOIN categorias AS c ON c.id = pr.categoria_id
GROUP BY c.nombre;

-- ----------------------------------------------------------------------------
-- Vista: resumen_dist_metodo_pago
-- Agrupa el monto total recaudado desglosado por cada pasarela o modalidad de pago.
-- ----------------------------------------------------------------------------
CREATE VIEW resumen_dist_metodo_pago AS
SELECT
  e.metodo AS metodo_pago,
  COALESCE(SUM(pe.total), 0) AS total
FROM (
  SELECT 'pse' AS metodo
  UNION ALL SELECT 'nequi'
  UNION ALL SELECT 'bancolombia'
  UNION ALL SELECT 'tarjeta'
  UNION ALL SELECT 'efectivo'
) AS e
LEFT JOIN pedidos AS pe ON e.metodo = pe.metodo_pago
GROUP BY e.metodo;

-- ----------------------------------------------------------------------------
-- Procedimiento Almacenado: sp_catalogo_completo
-- Permite consultar dinámicamente los productos activos según la opción solicitada
-- (por nombre de categoría, 'Más Vendidos' o 'Todos').
-- ----------------------------------------------------------------------------
DELIMITER //
CREATE PROCEDURE sp_catalogo_completo(IN p_opcion VARCHAR(50))
BEGIN
  IF (p_opcion IN ('Cárnicos y Embutidos', 'Línea de Panes', 'Congelados', 'Pulpas de Fruta', 'Salsas y Aderezos', 'Adobos y Sazonadores', 'Desechables e Icopores', 'Don Maní y Frutos Secos', 'Dulcería y Otros')) THEN
    SELECT p.codigo_sku AS codigo, p.nombre, p.descripcion, p.presentacion, p.precio AS precio_unitario, p.precio_anterior, p.imagen_url, p.etiqueta, p.temperatura_conservacion
    FROM productos AS p
    INNER JOIN categorias AS c ON c.id = p.categoria_id
    WHERE c.nombre = p_opcion AND p.activo = 1;
  ELSEIF (p_opcion = 'Más Vendidos') THEN
    SELECT p.codigo_sku AS codigo, p.nombre, p.descripcion, p.presentacion, p.precio AS precio_unitario, p.precio_anterior, p.imagen_url, p.etiqueta, p.temperatura_conservacion
    FROM productos AS p
    WHERE p.es_mas_vendido = 1 AND p.activo = 1;
  ELSEIF (p_opcion = 'Todos') THEN
    SELECT p.codigo_sku AS codigo, p.nombre, p.descripcion, p.presentacion, p.precio AS precio_unitario, p.precio_anterior, p.imagen_url, p.etiqueta, p.temperatura_conservacion
    FROM productos AS p
    WHERE p.activo = 1;
  ELSE
    SELECT 'Opción inválida' AS mensaje;
  END IF;
END //

-- ----------------------------------------------------------------------------
-- Disparador: tr_contar_stock
-- Actualiza automáticamente el stock descontando las unidades registradas en cada ítem de pedido.
-- ----------------------------------------------------------------------------
CREATE TRIGGER tr_contar_stock
AFTER INSERT ON pedido_items
FOR EACH ROW
BEGIN
  UPDATE productos
  SET stock = GREATEST(0, stock - NEW.cantidad)
  WHERE id = NEW.producto_id;
END //

DELIMITER ;\n`);

  // Inserción de Categorías
  lines.push(`-- ============================================================================`);
  lines.push(`-- INSERCIÓN DE LAS 9 CATEGORÍAS OFICIALES`);
  lines.push(`-- ============================================================================`);
  const catValues = categoriasDanillanos.map(
    (c) => `  (${c.id}, ${sqlEscape(c.nombre)}, ${sqlEscape(c.slug)}, ${sqlEscape(c.icono)}, ${sqlEscape(c.descripcion)})`
  );
  lines.push(`INSERT INTO categorias (id, nombre, slug, icono, descripcion) VALUES\n${catValues.join(',\n')};\n`);

  // Inserción de 235 Productos
  lines.push(`-- ============================================================================`);
  lines.push(`-- INSERCIÓN DE LOS 235 PRODUCTOS DEL LISTADO DE PRECIOS DANILLANOS`);
  lines.push(`-- ============================================================================`);
  const prodValues = productosDanillanos.map(
    (p) =>
      `  (${p.id}, ${p.categoria_id}, ${sqlEscape(p.codigo_sku)}, ${sqlEscape(p.nombre)}, ${sqlEscape(p.descripcion)}, ${sqlEscape(p.presentacion)}, ${p.precio}, ${sqlEscape(p.precio_anterior)}, ${sqlEscape(p.imagen_url)}, ${p.stock}, ${p.es_mas_vendido}, ${sqlEscape(p.etiqueta)}, ${sqlEscape(p.temperatura_conservacion)})`
  );
  lines.push(
    `INSERT INTO productos (id, categoria_id, codigo_sku, nombre, descripcion, presentacion, precio, precio_anterior, imagen_url, stock, es_mas_vendido, etiqueta, temperatura_conservacion) VALUES\n${prodValues.join(',\n')};\n`
  );

  // Inserción del Carrusel
  lines.push(`-- ============================================================================`);
  lines.push(`-- INSERCIÓN DE LAS DIAPOSITIVAS PROMOCIONALES DEL CARRUSEL`);
  lines.push(`-- ============================================================================`);
  const carValues = carruselDanillanos.map(
    (c) =>
      `  (${c.id}, ${c.producto_id}, ${sqlEscape(c.subtitulo)}, ${sqlEscape(c.titulo)}, ${sqlEscape(c.descripcion)}, ${c.precio_destacado}, ${sqlEscape(c.imagen_url)}, ${sqlEscape(c.texto_boton)}, ${sqlEscape(c.tipo_accion)}, ${c.orden})`
  );
  lines.push(
    `INSERT INTO carrusel_promociones (id, producto_id, subtitulo, titulo, descripcion, precio_destacado, imagen_url, texto_boton, tipo_accion, orden) VALUES\n${carValues.join(',\n')};\n`
  );

  // Inserción de Usuario Administrador Inicial
  lines.push(`-- ============================================================================`);
  lines.push(`-- INSERCIÓN DEL USUARIO ADMINISTRADOR INICIAL ENCRIPTADO`);
  lines.push(`-- ============================================================================`);
  const defaultPassHash = hashPassword('Danillanos2026*');
  const seedUsers = [
    {
      id: 1,
      username: 'Administrador Danillanos',
      nombre_completo: 'Administrador General Danillanos',
      nombres: 'Administrador',
      apellidos: 'Danillanos',
      empresa: 'Danillanos Cárnicos y Congelados S.A.S.',
      tipo_documento: 'NIT',
      numero_documento: '900000000-1',
      email: 'admin@danillanos.com',
      telefono: '3109998877',
      rol: 'admin'
    }
  ];

  const userValues = seedUsers.map(
    (u) =>
      `  (${u.id}, ${sqlEscape(u.username)}, ${sqlEscape(encryptData(u.nombre_completo))}, ${sqlEscape(encryptData(u.nombres))}, ${sqlEscape(encryptData(u.apellidos))}, ${sqlEscape(encryptData(u.empresa))}, ${sqlEscape(u.tipo_documento)}, ${sqlEscape(encryptData(u.numero_documento))}, ${sqlEscape(hashLookup(u.email))}, ${sqlEscape(encryptData(u.email))}, ${sqlEscape(defaultPassHash)}, ${sqlEscape(encryptData(u.telefono))}, ${sqlEscape(u.rol)})`
  );
  lines.push(
    `INSERT INTO usuarios (id, username, nombre_completo_enc, nombres_enc, apellidos_enc, empresa_enc, tipo_documento, numero_documento_enc, email_hash, email_enc, password_hash, telefono_enc, rol) VALUES\n${userValues.join(',\n')};\n`
  );

  // Inserción de Ticket de Soporte
  lines.push(`-- ============================================================================`);
  lines.push(`-- INSERCIÓN DE TICKET DE SOPORTE DE EJEMPLO`);
  lines.push(`-- ============================================================================`);
  const sampleClientExpirySvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#181c24"/><rect x="24" y="24" width="432" height="272" rx="16" fill="#232834" stroke="#f59e0b" stroke-width="3"/><text x="240" y="120" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">FOTO ENVIADA POR EL CLIENTE</text><text x="240" y="160" fill="#fbbf24" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Lote #2026-10 • Consulta Fecha de Vencimiento</text><text x="240" y="195" fill="#9ca5b4" font-family="sans-serif" font-size="14" text-anchor="middle">Adjunto desde el Centro de Soporte Danillanos</text></svg>`
    );

  lines.push(
    `INSERT INTO tickets_soporte (id, pedido_id, usuario_id, tipo, asunto, descripcion, imagen_cliente_url, estado, respuesta_soporte) VALUES
  (1, 5, 1, 'producto', 'Verificación de lote y fecha de vencimiento en entrega #5', 'Adjunto foto del lote recibido para confirmar fecha de vencimiento y copia de factura electrónica.', ${sqlEscape(sampleClientExpirySvg)}, 'en_revision', 'Soporte Danillanos: Hemos verificado la foto del lote adjunta; tiene vigencia de 6 meses en congelación (-18°C).');\n`
  );

  const schemaCommentsPath = path.join(__dirname, 'database', 'schema_comments.sql');
  fs.writeFileSync(schemaCommentsPath, lines.join('\n'), 'utf8');
  console.log(`✅ Archivo database/schema_comments.sql generado con ${productosDanillanos.length} productos y estructura completa.`);
}

generateSchemaCommentsSql();
