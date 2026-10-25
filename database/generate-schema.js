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
      username: 'Restaurante El Llanerazo',
      nombre_completo: 'Carlos Andrés Méndez (Cliente)',
      nombres: 'Carlos Andrés',
      apellidos: 'Méndez',
      empresa: 'Restaurante El Llanerazo',
      tipo_documento: 'NIT',
      numero_documento: '901452881-2',
      email: 'cliente@danillanos.com',
      telefono: '3114567890',
      rol: 'cliente'
    },
    {
      id: 2,
      username: 'Laura Gómez',
      nombre_completo: 'Laura Marcela Gómez Rojas',
      nombres: 'Laura Marcela',
      apellidos: 'Gómez Rojas',
      empresa: 'Danillanos S.A.S.',
      tipo_documento: 'CC',
      numero_documento: '1121889012',
      email: 'empleado@danillanos.com',
      telefono: '3129876543',
      rol: 'empleado'
    },
    {
      id: 3,
      username: 'Diego Vargas',
      nombre_completo: 'Diego Alejandro Vargas Castro',
      nombres: 'Diego Alejandro',
      apellidos: 'Vargas Castro',
      empresa: 'Danillanos S.A.S.',
      tipo_documento: 'CC',
      numero_documento: '1121904511',
      email: 'entregador@danillanos.com',
      telefono: '3145558899',
      rol: 'entregador'
    },
    {
      id: 4,
      username: 'Sofía Martínez',
      nombre_completo: 'Sofía Martínez Atención Soporte',
      nombres: 'Sofía',
      apellidos: 'Martínez',
      empresa: 'Danillanos S.A.S.',
      tipo_documento: 'CC',
      numero_documento: '1121940123',
      email: 'soporte@danillanos.com',
      telefono: '3152223344',
      rol: 'soporte'
    },
    {
      id: 5,
      username: 'Gerencia Danillanos',
      nombre_completo: 'Juan Fernando Galindo (Administrador)',
      nombres: 'Juan Fernando',
      apellidos: 'Galindo',
      empresa: 'Danillanos S.A.S.',
      tipo_documento: 'CC',
      numero_documento: '1121800999',
      email: 'admin@danillanos.com',
      telefono: '3101112233',
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
  const dirValues = [
    `  (1, 1, 'Restaurante Principal', ${sqlEscape(encryptData('Av. 40 # 26C - 15 Barrio Siete de Agosto'))}, 'Frente al parque', 'Villavicencio', 'Meta', 4.1392000, -73.6351000, 1, 'Envío el mismo día (Villavicencio)', 1)`,
    `  (2, 1, 'Sucursal Primavera', ${sqlEscape(encryptData('Calle 35 # 41 - 20 Barrio Barzal Alto'))}, 'Local 2 Esquina', 'Villavicencio', 'Meta', 4.1468000, -73.6412000, 1, 'Envío el mismo día (Villavicencio)', 0)`,
    `  (3, 1, 'Sede Campestre Acacías', ${sqlEscape(encryptData('Carrera 23 # 14 - 08 Centro Acacías'))}, 'Bodega Roja', 'Acacías', 'Meta', 3.9869000, -73.7579000, 0, 'Llega el 00 de octubre', 0)`
  ];
  lines.push(
    `INSERT INTO usuario_direcciones (id, usuario_id, etiqueta, direccion_enc, barrio_referencia, municipio, departamento, lat, lng, es_villavicencio, tiempo_entrega_estimado, es_principal) VALUES\n${dirValues.join(',\n')};\n`
  );

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

  const pedidosValues = [
    // Pedido 1: Pendiente (Punto 1: Recibido - Para que el Empleado General pueda confirmarlo o cancelarlo)
    `  (1, 1, ${sqlEscape(encryptData('Carlos Andrés Méndez'))}, ${sqlEscape(encryptData('3114567890'))}, ${sqlEscape(encryptData('Av. 40 # 26C - 15 Barrio Siete de Agosto'))}, 'Villavicencio', 4.1392000, -73.6351000, 1, 'Envío el mismo día (Villavicencio)', 'tarjeta', 'PAY-TC-98231', 122900.00, 'pendiente', 'Por favor entregar por la entrada de proveedores antes de las 4pm.', NULL, 'no_aplica', NULL, NULL, NULL, NULL, NULL)`,
    // Pedido 2: Pendiente fuera de Villavicencio (Acacías - Meta -> Llega el 00 de octubre)
    `  (2, 1, ${sqlEscape(encryptData('Administrador Sede Acacías'))}, ${sqlEscape(encryptData('3105559922'))}, ${sqlEscape(encryptData('Carrera 23 # 14 - 08 Centro Acacías'))}, 'Acacías', 3.9869000, -73.7579000, 0, 'Llega el 00 de octubre', 'pse', 'PSE-BAN-44120', 148500.00, 'pendiente', 'Llamar 15 minutos antes de llegar al municipio.', NULL, 'no_aplica', NULL, NULL, NULL, NULL, NULL)`,
    // Pedido 3: En Camino / En Reparto (Punto 3: En Reparto - Parada actual del Entregador)
    `  (3, 1, ${sqlEscape(encryptData('Chef Mauricio Rincón - Burger House'))}, ${sqlEscape(encryptData('3158887766'))}, ${sqlEscape(encryptData('Calle 35 # 41 - 20 Barrio Barzal Alto'))}, 'Villavicencio', 4.1468000, -73.6412000, 1, 'Envío el mismo día (Villavicencio)', 'nequi', 'NEQ-31588877', 96400.00, 'en_camino', 'Timbrar en el segundo piso, cocina principal.', NULL, 'no_aplica', 3, NULL, NULL, NOW(), NULL)`,
    // Pedido 4: En Proceso (Punto 2: Confirmado en Bodega - Segunda parada en el mapa del Entregador)
    `  (4, 1, ${sqlEscape(encryptData('Asadero Brasa Llanera - Porfía'))}, ${sqlEscape(encryptData('3184441100'))}, ${sqlEscape(encryptData('Calle 51 Sur # 43 - 10 Ciudad Porfía'))}, 'Villavicencio', 4.0985000, -73.6682000, 1, 'Envío el mismo día (Villavicencio)', 'efectivo', 'EFE-CONTRAENTREGA', 168000.00, 'en_proceso', 'Pagan en efectivo exacto al recibir las costillas.', NULL, 'no_aplica', 3, NULL, NULL, NOW(), NULL)`,
    // Pedido 5: Entregado con Foto tomada por el Entregador (Punto 4: Entregado - Visible en Soporte)
    `  (5, 1, ${sqlEscape(encryptData('Pizzería & Rápidas La Grama'))}, ${sqlEscape(encryptData('3207771234'))}, ${sqlEscape(encryptData('Calle 44 # 30 - 18 Barrio La Grama'))}, 'Villavicencio', 4.1562000, -73.6385000, 1, 'Envío el mismo día (Villavicencio)', 'bancolombia', 'BCO-QR-77510', 89300.00, 'entregado', 'Dejar en recepción con sello.', NULL, 'no_aplica', 3, 'Entregado a tiempo y verificada temperatura con el encargado.', ${sqlEscape(samplePhotoSvg)}, NOW(), NOW())`
  ];
  lines.push(
    `INSERT INTO pedidos (id, usuario_id, nombre_recibe_enc, telefono_cliente_enc, direccion_entrega_enc, municipio, lat, lng, es_villavicencio, tiempo_entrega_estimado, metodo_pago, referencia_pago, total, estado, observaciones_cliente, razon_cancelacion, reembolso_estado, entregador_id, observaciones_entregador, foto_entrega_url, fecha_confirmacion, fecha_entrega) VALUES\n${pedidosValues.join(',\n')};\n`
  );

  // Items de los pedidos semilla
  const itemsValues = [
    `  (1, 24, 'HB LLANERO CAJA X30UNID 85GR', 1, 51400.00, 51400.00)`,
    `  (1, 52, 'PAPA FRANCESA IMPORTADA X 2.5 KG', 2, 17500.00, 35000.00)`,
    `  (1, 106, 'SALSA BBQ X GALON RIO GRANDE', 1, 28500.00, 28500.00)`,
    `  (1, 188, 'ICOPOR J1 X20 UNIDADES', 1, 8000.00, 8000.00)`,

    `  (2, 17, 'COSTILLA CARAMELO 3 KILOS', 1, 84000.00, 84000.00)`,
    `  (2, 159, 'ALIMENTEK MAYO TOCINETA X900 GR', 2, 19000.00, 38000.00)`,
    `  (2, 6, 'CHORIZO CUNCIA X 10', 1, 26500.00, 26500.00)`,

    `  (3, 21, 'HAMB. LLANERA X 10 UND X 90 GRS (cuadrada)', 2, 20200.00, 40400.00)`,
    `  (3, 40, 'PAN HAMBURGUESA ARTESANAL BIMBO X 10 UND', 2, 12900.00, 25800.00)`,
    `  (3, 165, 'ALIMENTEK QUESO CHEDDAR X900 GR', 1, 17700.00, 17700.00)`,
    `  (3, 31, 'SALCHICHA DEL RANCHO X 15 UND', 1, 12500.00, 12500.00)`,

    `  (4, 17, 'COSTILLA CARAMELO 3 KILOS', 2, 84000.00, 168000.00)`,

    `  (5, 62, 'NUGGETS X60 UNIDADES', 1, 36900.00, 36900.00)`,
    `  (5, 52, 'PAPA FRANCESA IMPORTADA X 2.5 KG', 2, 17500.00, 35000.00)`,
    `  (5, 137, 'SALSA ROSADA SALSABOR KILO', 1, 7700.00, 7700.00)`,
    `  (5, 204, 'OBLEA MEDIANA', 1, 9700.00, 9700.00)`
  ];
  lines.push(
    `INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES\n${itemsValues.join(',\n')};\n`
  );

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
