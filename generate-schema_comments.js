/**
 * Generador automático de database/schema.sql con los 235 productos del PDF,
 * tablas de usuarios encriptados (AES-256-GCM + Scrypt), direcciones con coordenadas
 * de Google Maps (Villavicencio y Meta), pedidos, fotos de entrega y soporte.
 */

const fs = require('fs');
const path = require('path');
const { categoriasDanillanos, productosDanillanos, carruselDanillanos } = require('../backend/data/catalogData');
const { hashPassword, encryptData, hashLookup } = require('../backend/utils/security');

function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function generateSchemaSql() {
  const lines = [];

  lines.push(`-- ============================================================================`);
  lines.push(`-- DANILLANOS - TIENDA DE CÁRNICOS, CONGELADOS E INSUMOS PARA RESTAURANTES`);
  lines.push(`-- Esquema Completo MySQL (235 Productos + Usuarios Encriptados + Roles + Mapa)`);
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
  lines.push(`CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  icono VARCHAR(60) DEFAULT 'restaurant',
  descripcion VARCHAR(255),
  activo TINYINT(1) DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n`);

  // 2. Productos (235 items del listado de precios)
  lines.push(`CREATE TABLE productos (
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
  lines.push(`CREATE TABLE carrusel_promociones (
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

  // 4. Usuarios (Con encriptación AES-256-GCM para PII y Scrypt para contraseñas)
  lines.push(`CREATE TABLE usuarios (
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

  // 5. Direcciones por Cuenta (Máximo 5 por usuario, con coordenadas Google Maps y radio Villavicencio/Meta)
  lines.push(`CREATE TABLE usuario_direcciones (
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

  // 6. Pedidos (Con soporte para flujo Empleado -> Entregador -> Foto Entrega -> Soporte y Reembolsos)
  lines.push(`CREATE TABLE pedidos (
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
  lines.push(`CREATE TABLE pedido_items (
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

  // 8. Tickets de Soporte / Inconformidades (con soporte para imágenes enviadas por clientes)
  lines.push(`CREATE TABLE tickets_soporte (
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

  // 9. Vistas (Views), Procedimientos Almacenados (Procedures) y Disparadores (Triggers)
  lines.push(`-- ============================================================================
-- VIEWS, PROCCEDURES Y TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Proporciona indicadores clave sobre las ventas y el estado operativo de los pedidos en la tienda.
--   - total_vendido: Suma el monto total únicamente de los pedidos entregados.
--   - por_aceptar: Evalúa la cantidad de pedidos pendientes de confirmación.
--   - en_bodega_o_en_reparto: Evalúa los pedidos en bodega o en ruta.
--   - entregados: Evalúa el total de pedidos finalizados.
-- ----------------------------------------------------------------------------
CREATE VIEW resumen_base AS
SELECT
	SUM(CASE WHEN pe.estado = 'entregado' THEN pe.total ELSE 0 END) AS total_vendido,
	COUNT(CASE WHEN pe.estado = 'pendiente' THEN 1 ELSE 0 END) AS por_aceptar,
    COUNT(CASE WHEN pe.estado = 'en_proceso' OR pe.estado = 'en_camino 'THEN 1 ELSE 0 END) AS en_bodega_o_en_reparto,
    COUNT(CASE WHEN pe.estado = 'entregado' THEN 1 ELSE 0 END) AS entregados
FROM pedidos AS pe;

-- ----------------------------------------------------------------------------
-- Calcula el total de ingresos agrupado por cada categoría.
--   - Relaciona las tablas pedido_items, pedidos, productos y categorias mediante INNER JOIN.
--   - Suma el valor de los productos entregados de la misma categoria y agrupa el resultado
--     por el nombre de la categoría.
-- ----------------------------------------------------------------------------
CREATE VIEW resumen_ventas_categoria AS
SELECT
	c.nombre,
    SUM(CASE WHEN pe.estado = 'entregado' THEN peit.subtotal ELSE 0 END) AS ventas
FROM pedido_items AS peit
INNER JOIN pedidos AS pe ON pe.id = peit.pedido_id
INNER JOIN productos as pr on pr.id = peit.producto_id
INNER JOIN categorias as c on c.id = pr.categoria_id
GROUP BY c.nombre;

-- ----------------------------------------------------------------------------
-- Muestra la distribución del dinero recaudado según cada método
-- de pago en Danillanos.
--   - Define una tabla derivada (e) con los 5 métodos de pago ('pse', 'nequi',
--     'bancolombia', 'tarjeta', 'efectivo').
--   - La cruza (INNER JOIN) con la tabla pedidos y suma el total (pe.total)
--     agrupado por cada método de pago.
-- ----------------------------------------------------------------------------
CREATE VIEW resumen_dist_metodo_pago AS
SELECT
	e.metodo AS metodo_pago,
    SUM(pe.total) AS total
FROM (
	SELECT 'pse' AS metodo
    UNION ALL SELECT 'nequi'
    UNION ALL SELECT 'bancolombia'
    UNION ALL SELECT 'tarjeta'
    UNION ALL SELECT 'efectivo'
) AS e
INNER JOIN pedidos AS pe ON e.metodo = pe.metodo_pago
GROUP BY e.metodo;

-- ----------------------------------------------------------------------------
-- Permite consultar de forma dinámica el catálogo de productos activos
-- según la opción solicitada por el usuario o el sistema.
-- -
-- p_opcion VARCHAR(50) - Filtro de consulta del catálogo.
--   1. Si p_opcion corresponde al nombre de una de las 9 categorías, filtra
--      y devuelve los productos activos pertenecientes a dicha categoría.
--   2. Si p_opcion es 'Más Vendidos', devuelve únicamente los productos activos
--      destacados con la marca es_mas_vendido = 1.
--   3. Si p_opcion es 'Todos', devuelve la totalidad de los productos activos.
--   4. Si p_opcion no coincide con ninguno de los valores anteriores, retorna
--      con un error 'Opción invalida'.
-- ----------------------------------------------------------------------------
DELIMITER //
CREATE PROCEDURE sp_catalogo_completo(IN p_opcion VARCHAR(50))
BEGIN
	IF (p_opcion IN ('Cárnicos y Embutidos', 'Línea de Panes', 'Congelados', 'Pulpas de Fruta', 'Salsas y Aderezos', 'Adobos y Sazonadores', 'Desechables e Icopores', 'Don Maní y Frutos Secos', 'Dulcería y Otros')) THEN
		SELECT 	p.codigo_sku as codigo,p.nombre,p.descripcion,p.presentacion,p.precio AS precio_unitario,p.precio_anterior,p.imagen_url,p.etiqueta,p.temperatura_conservacion
		FROM productos AS p
		INNER JOIN categorias AS c ON c.id = p.categoria_id
		WHERE c.nombre = p_opcion AND p.activo = 1;
	ELSEIF (p_opcion IN ('Más Vendidos')) THEN
		SELECT 	p.codigo_sku as codigo,p.nombre,p.descripcion,p.presentacion,p.precio AS precio_unitario,p.precio_anterior,p.imagen_url,p.etiqueta,p.temperatura_conservacion
		FROM productos AS p
        WHERE p.es_mas_vendido = 1 AND p.activo = 1;
	ELSEIF (p_opcion IN ('Todos')) THEN
		SELECT 	p.codigo_sku as codigo,p.nombre,p.descripcion,p.presentacion,p.precio AS precio_unitario,p.precio_anterior,p.imagen_url,p.etiqueta,p.temperatura_conservacion
		FROM productos AS p
		WHERE p.activo = 1;
	ELSE 
		SELECT 'Opción invalida';
	END IF;
END //

-- ----------------------------------------------------------------------------
-- Actualizar de forma automática el stock (cantidad vendida) en la tabla
-- productos cuando se registra (inserta en la tabla pedido_items) un ítem 
-- dentro de un pedido.
--   - Por cada fila insertada, actualiza la columna stock de la tabla
--     productos sumando la cantidad registrada en el nuevo ítem.
-- ----------------------------------------------------------------------------
CREATE TRIGGER tr_contar_stock
AFTER INSERT ON pedido_items
FOR EACH ROW
BEGIN
	UPDATE productos
    SET stock = stock + NEW.cantidad
    WHERE id = NEW.pedido_id;
END //

DELIMITER ;\n`);

  // Insertar Categorías
  lines.push(`-- ============================================================================`);
  lines.push(`-- INSERCIÓN DE LAS 9 CATEGORÍAS OFICIALES`);
  lines.push(`-- ============================================================================`);
  const catValues = categoriasDanillanos.map(
    (c) => `  (${c.id}, ${sqlEscape(c.nombre)}, ${sqlEscape(c.slug)}, ${sqlEscape(c.icono)}, ${sqlEscape(c.descripcion)})`
  );
  lines.push(`INSERT INTO categorias (id, nombre, slug, icono, descripcion) VALUES\n${catValues.join(',\n')};\n`);

  // Insertar los 235 Productos
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

  // Insertar Carrusel
  const carValues = carruselDanillanos.map(
    (c) =>
      `  (${c.id}, ${c.producto_id}, ${sqlEscape(c.subtitulo)}, ${sqlEscape(c.titulo)}, ${sqlEscape(c.descripcion)}, ${c.precio_destacado}, ${sqlEscape(c.imagen_url)}, ${sqlEscape(c.texto_boton)}, ${sqlEscape(c.tipo_accion)}, ${c.orden})`
  );
  lines.push(
    `INSERT INTO carrusel_promociones (id, producto_id, subtitulo, titulo, descripcion, precio_destacado, imagen_url, texto_boton, tipo_accion, orden) VALUES\n${carValues.join(',\n')};\n`
  );

  // Insertar Usuarios Semilla Encriptados (1 para cada rol: cliente, empleado, entregador, soporte, admin)
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

  // Insertar Direcciones de Ejemplo para el Cliente 1 (En Villavicencio y en Acacías - Meta)
  const dirValues = [];
  // Sin direcciones semilla (bd limpia para clientes reales)

  // Insertar Pedidos de Ejemplo en distintos estados para demostrar todos los paneles de inmediato
  const samplePhotoSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#141821"/><rect x="24" y="24" width="432" height="272" rx="18" fill="#1e2433" stroke="#22c55e" stroke-width="3"/><text x="240" y="130" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">EVIDENCIA DE ENTREGA #1003</text><text x="240" y="165" fill="#94a3b8" font-family="sans-serif" font-size="15" text-anchor="middle">Recibido conforme en: Av. Los Maracos, Villavicencio</text><text x="240" y="205" fill="#22c55e" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">✔ Cadena de Frío Verificada (-18°C)</text></svg>`
    );

  const sampleClientExpirySvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#181c24"/><rect x="24" y="24" width="432" height="272" rx="16" fill="#232834" stroke="#f59e0b" stroke-width="3"/><text x="240" y="120" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">FOTO ENVIADA POR EL CLIENTE</text><text x="240" y="160" fill="#fbbf24" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Lote #2026-10 • Consulta Fecha de Vencimiento</text><text x="240" y="195" fill="#9ca5b4" font-family="sans-serif" font-size="14" text-anchor="middle">Adjunto desde el Centro de Soporte Danillanos</text></svg>`
    );

  const pedidosValues = [];
  // Sin pedidos semilla (bd limpia para clientes reales)

  // Items de los pedidos semilla
  const itemsValues = [];
  // Sin items semilla

  // Ticket de ejemplo para el rol Soporte (con imagen adjunta del cliente)
  lines.push(
    `INSERT INTO tickets_soporte (id, pedido_id, usuario_id, tipo, asunto, descripcion, imagen_cliente_url, estado, respuesta_soporte) VALUES
  (1, 5, 1, 'producto', 'Verificación de lote y fecha de vencimiento en entrega #5', 'Adjunto foto del lote recibido para confirmar fecha de vencimiento y copia de factura electrónica.', ${sqlEscape(sampleClientExpirySvg)}, 'en_revision', 'Soporte Danillanos: Hemos verificado la foto del lote adjunta; tiene vigencia de 6 meses en congelación (-18°C).');\n`
  );

  const schemaPath = path.join(__dirname, 'schema.sql');
  fs.writeFileSync(schemaPath, lines.join('\n'), 'utf8');
  console.log(`✅ Archivo database/schema.sql generado con ${productosDanillanos.length} productos y estructura completa.`);
}

generateSchemaSql();
