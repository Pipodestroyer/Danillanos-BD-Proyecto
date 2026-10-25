/**
 * Datos de respaldo (Fallback) sincronizados con los 235 productos del PDF de Danillanos,
 * usuarios encriptados por rol, direcciones en Villavicencio/Meta, pedidos y tickets con minichat.
 */

const {
  categoriasDanillanos,
  productosDanillanos,
  carruselDanillanos
} = require('./catalogData');
const { hashPassword, encryptData, hashLookup } = require('../utils/security');

const defaultPassHash = hashPassword('Danillanos2026*');

const usuariosFallback = [
  {
    id: 1,
    username: 'Restaurante El Llanerazo',
    nombre_completo_enc: encryptData('Carlos Andrés Méndez'),
    nombres_enc: encryptData('Carlos Andrés'),
    apellidos_enc: encryptData('Méndez'),
    empresa_enc: encryptData('Restaurante El Llanerazo'),
    tipo_documento: 'NIT',
    numero_documento_enc: encryptData('901452881-2'),
    email_hash: hashLookup('cliente@danillanos.com'),
    email_enc: encryptData('cliente@danillanos.com'),
    password_hash: defaultPassHash,
    telefono_enc: encryptData('3114567890'),
    avatar_url: null,
    rol: 'cliente',
    activo: 1
  },
  {
    id: 2,
    username: 'Laura Gómez',
    nombre_completo_enc: encryptData('Laura Marcela Gómez Rojas'),
    nombres_enc: encryptData('Laura Marcela'),
    apellidos_enc: encryptData('Gómez Rojas'),
    empresa_enc: encryptData('Danillanos S.A.S.'),
    tipo_documento: 'CC',
    numero_documento_enc: encryptData('1121889012'),
    email_hash: hashLookup('empleado@danillanos.com'),
    email_enc: encryptData('empleado@danillanos.com'),
    password_hash: defaultPassHash,
    telefono_enc: encryptData('3129876543'),
    avatar_url: null,
    rol: 'empleado',
    activo: 1
  },
  {
    id: 3,
    username: 'Diego Vargas',
    nombre_completo_enc: encryptData('Diego Alejandro Vargas Castro'),
    nombres_enc: encryptData('Diego Alejandro'),
    apellidos_enc: encryptData('Vargas Castro'),
    empresa_enc: encryptData('Danillanos S.A.S.'),
    tipo_documento: 'CC',
    numero_documento_enc: encryptData('1121904511'),
    email_hash: hashLookup('entregador@danillanos.com'),
    email_enc: encryptData('entregador@danillanos.com'),
    password_hash: defaultPassHash,
    telefono_enc: encryptData('3145558899'),
    avatar_url: null,
    rol: 'entregador',
    activo: 1
  },
  {
    id: 4,
    username: 'Sofía Martínez',
    nombre_completo_enc: encryptData('Sofía Martínez Atención Soporte'),
    nombres_enc: encryptData('Sofía'),
    apellidos_enc: encryptData('Martínez'),
    empresa_enc: encryptData('Danillanos S.A.S.'),
    tipo_documento: 'CC',
    numero_documento_enc: encryptData('1121940123'),
    email_hash: hashLookup('soporte@danillanos.com'),
    email_enc: encryptData('soporte@danillanos.com'),
    password_hash: defaultPassHash,
    telefono_enc: encryptData('3152223344'),
    avatar_url: null,
    rol: 'soporte',
    activo: 1
  },
  {
    id: 5,
    username: 'Gerencia Danillanos',
    nombre_completo_enc: encryptData('Juan Fernando Galindo (Administrador)'),
    nombres_enc: encryptData('Juan Fernando'),
    apellidos_enc: encryptData('Galindo'),
    empresa_enc: encryptData('Danillanos S.A.S.'),
    tipo_documento: 'CC',
    numero_documento_enc: encryptData('1121800999'),
    email_hash: hashLookup('admin@danillanos.com'),
    email_enc: encryptData('admin@danillanos.com'),
    password_hash: defaultPassHash,
    telefono_enc: encryptData('3101112233'),
    avatar_url: null,
    rol: 'admin',
    activo: 1
  },
  {
    id: 6,
    username: 'Andrés Castro',
    nombre_completo_enc: encryptData('Andrés Felipe Castro (Ruta Norte)'),
    nombres_enc: encryptData('Andrés Felipe'),
    apellidos_enc: encryptData('Castro'),
    empresa_enc: encryptData('Danillanos S.A.S.'),
    tipo_documento: 'CC',
    numero_documento_enc: encryptData('1121955320'),
    email_hash: hashLookup('entregador2@danillanos.com'),
    email_enc: encryptData('entregador2@danillanos.com'),
    password_hash: defaultPassHash,
    telefono_enc: encryptData('3167778899'),
    avatar_url: null,
    rol: 'entregador',
    activo: 1
  }
];

const direccionesFallback = [
  {
    id: 1,
    usuario_id: 1,
    etiqueta: 'Restaurante Principal',
    direccion_enc: encryptData('Av. 40 # 26C - 15 Barrio Siete de Agosto'),
    barrio_referencia: 'Frente al parque',
    municipio: 'Villavicencio',
    departamento: 'Meta',
    lat: 4.1392,
    lng: -73.6351,
    es_villavicencio: 1,
    tiempo_entrega_estimado: 'Envío el mismo día (Villavicencio)',
    es_principal: 1
  },
  {
    id: 2,
    usuario_id: 1,
    etiqueta: 'Sucursal Primavera',
    direccion_enc: encryptData('Calle 35 # 41 - 20 Barrio Barzal Alto'),
    barrio_referencia: 'Local 2 Esquina',
    municipio: 'Villavicencio',
    departamento: 'Meta',
    lat: 4.1468,
    lng: -73.6412,
    es_villavicencio: 1,
    tiempo_entrega_estimado: 'Envío el mismo día (Villavicencio)',
    es_principal: 0
  },
  {
    id: 3,
    usuario_id: 1,
    etiqueta: 'Sede Campestre Acacías',
    direccion_enc: encryptData('Carrera 23 # 14 - 08 Centro Acacías'),
    barrio_referencia: 'Bodega Roja',
    municipio: 'Acacías',
    departamento: 'Meta',
    lat: 3.9869,
    lng: -73.7579,
    es_villavicencio: 0,
    tiempo_entrega_estimado: 'Llega el 00 de octubre',
    es_principal: 0
  }
];

const samplePhotoSvg =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#141821"/><rect x="24" y="24" width="432" height="272" rx="18" fill="#1e2433" stroke="#22c55e" stroke-width="3"/><text x="240" y="130" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">EVIDENCIA DE ENTREGA #5</text><text x="240" y="165" fill="#94a3b8" font-family="sans-serif" font-size="15" text-anchor="middle">Recibido conforme en: Barrio La Grama, Villavicencio</text><text x="240" y="205" fill="#22c55e" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">✔ Cadena de Frío Verificada (-18°C)</text></svg>`
  );

const pedidosFallback = [
  {
    id: 1,
    usuario_id: 1,
    nombre_recibe_enc: encryptData('Carlos Andrés Méndez'),
    telefono_cliente_enc: encryptData('3114567890'),
    direccion_entrega_enc: encryptData('Av. 40 # 26C - 15 Barrio Siete de Agosto'),
    municipio: 'Villavicencio',
    lat: 4.1392,
    lng: -73.6351,
    es_villavicencio: 1,
    tiempo_entrega_estimado: 'Envío el mismo día (Villavicencio)',
    metodo_pago: 'tarjeta',
    referencia_pago: 'PAY-TC-98231',
    total: 122900,
    estado: 'pendiente',
    observaciones_cliente: 'Entregar por la entrada de proveedores antes de las 4pm.',
    razon_cancelacion: null,
    reembolso_estado: 'no_aplica',
    entregador_id: null,
    observaciones_entregador: null,
    foto_entrega_url: null,
    creado_en: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    items: [
      { producto_id: 24, nombre_producto: 'HB LLANERO CAJA X30UNID 85GR', cantidad: 1, precio_unitario: 51400, subtotal: 51400 },
      { producto_id: 52, nombre_producto: 'PAPA FRANCESA IMPORTADA X 2.5 KG', cantidad: 2, precio_unitario: 17500, subtotal: 35000 },
      { producto_id: 106, nombre_producto: 'SALSA BBQ X GALON RIO GRANDE', cantidad: 1, precio_unitario: 28500, subtotal: 28500 },
      { producto_id: 188, nombre_producto: 'ICOPOR J1 X20 UNIDADES', cantidad: 1, precio_unitario: 8000, subtotal: 8000 }
    ]
  },
  {
    id: 2,
    usuario_id: 1,
    nombre_recibe_enc: encryptData('Administrador Sede Acacías'),
    telefono_cliente_enc: encryptData('3105559922'),
    direccion_entrega_enc: encryptData('Carrera 23 # 14 - 08 Centro Acacías'),
    municipio: 'Acacías',
    lat: 3.9869,
    lng: -73.7579,
    es_villavicencio: 0,
    tiempo_entrega_estimado: 'Llega el 00 de octubre',
    metodo_pago: 'pse',
    referencia_pago: 'PSE-BAN-44120',
    total: 148500,
    estado: 'pendiente',
    observaciones_cliente: 'Llamar 15 minutos antes de llegar al municipio.',
    razon_cancelacion: null,
    reembolso_estado: 'no_aplica',
    entregador_id: null,
    observaciones_entregador: null,
    foto_entrega_url: null,
    creado_en: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    items: [
      { producto_id: 17, nombre_producto: 'COSTILLA CARAMELO 3 KILOS', cantidad: 1, precio_unitario: 84000, subtotal: 84000 },
      { producto_id: 159, nombre_producto: 'ALIMENTEK MAYO TOCINETA X900 GR', cantidad: 2, precio_unitario: 19000, subtotal: 38000 },
      { producto_id: 6, nombre_producto: 'CHORIZO CUNCIA X 10', cantidad: 1, precio_unitario: 26500, subtotal: 26500 }
    ]
  },
  {
    id: 3,
    usuario_id: 1,
    nombre_recibe_enc: encryptData('Chef Mauricio Rincón - Burger House'),
    telefono_cliente_enc: encryptData('3158887766'),
    direccion_entrega_enc: encryptData('Calle 35 # 41 - 20 Barrio Barzal Alto'),
    municipio: 'Villavicencio',
    lat: 4.1468,
    lng: -73.6412,
    es_villavicencio: 1,
    tiempo_entrega_estimado: 'Envío el mismo día (Villavicencio)',
    metodo_pago: 'nequi',
    referencia_pago: 'NEQ-31588877',
    total: 96400,
    estado: 'en_camino',
    observaciones_cliente: 'Timbrar en el segundo piso, cocina principal.',
    razon_cancelacion: null,
    reembolso_estado: 'no_aplica',
    entregador_id: 3,
    observaciones_entregador: null,
    foto_entrega_url: null,
    creado_en: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    items: [
      { producto_id: 21, nombre_producto: 'HAMB. LLANERA X 10 UND X 90 GRS (cuadrada)', cantidad: 2, precio_unitario: 20200, subtotal: 40400 },
      { producto_id: 40, nombre_producto: 'PAN HAMBURGUESA ARTESANAL BIMBO X 10 UND', cantidad: 2, precio_unitario: 12900, subtotal: 25800 },
      { producto_id: 165, nombre_producto: 'ALIMENTEK QUESO CHEDDAR X900 GR', cantidad: 1, precio_unitario: 17700, subtotal: 17700 },
      { producto_id: 31, nombre_producto: 'SALCHICHA DEL RANCHO X 15 UND', cantidad: 1, precio_unitario: 12500, subtotal: 12500 }
    ]
  },
  {
    id: 4,
    usuario_id: 1,
    nombre_recibe_enc: encryptData('Asadero Brasa Llanera - Porfía'),
    telefono_cliente_enc: encryptData('3184441100'),
    direccion_entrega_enc: encryptData('Calle 51 Sur # 43 - 10 Ciudad Porfía'),
    municipio: 'Villavicencio',
    lat: 4.0985,
    lng: -73.6682,
    es_villavicencio: 1,
    tiempo_entrega_estimado: 'Envío el mismo día (Villavicencio)',
    metodo_pago: 'efectivo',
    referencia_pago: 'EFE-CONTRAENTREGA',
    total: 168000,
    estado: 'en_proceso',
    observaciones_cliente: 'Pagan en efectivo exacto al recibir las costillas.',
    razon_cancelacion: null,
    reembolso_estado: 'no_aplica',
    entregador_id: 3,
    observaciones_entregador: null,
    foto_entrega_url: null,
    creado_en: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    items: [
      { producto_id: 17, nombre_producto: 'COSTILLA CARAMELO 3 KILOS', cantidad: 2, precio_unitario: 84000, subtotal: 168000 }
    ]
  },
  {
    id: 5,
    usuario_id: 1,
    nombre_recibe_enc: encryptData('Pizzería & Rápidas La Grama'),
    telefono_cliente_enc: encryptData('3207771234'),
    direccion_entrega_enc: encryptData('Calle 44 # 30 - 18 Barrio La Grama'),
    municipio: 'Villavicencio',
    lat: 4.1562,
    lng: -73.6385,
    es_villavicencio: 1,
    tiempo_entrega_estimado: 'Envío el mismo día (Villavicencio)',
    metodo_pago: 'bancolombia',
    referencia_pago: 'BCO-QR-77510',
    total: 89300,
    estado: 'entregado',
    observaciones_cliente: 'Dejar en recepción con sello.',
    razon_cancelacion: null,
    reembolso_estado: 'no_aplica',
    entregador_id: 3,
    observaciones_entregador: 'Entregado a tiempo y verificada temperatura con el encargado.',
    foto_entrega_url: samplePhotoSvg,
    fecha_entrega: new Date().toISOString(),
    creado_en: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    items: [
      { producto_id: 62, nombre_producto: 'NUGGETS X60 UNIDADES', cantidad: 1, precio_unitario: 36900, subtotal: 36900 },
      { producto_id: 52, nombre_producto: 'PAPA FRANCESA IMPORTADA X 2.5 KG', cantidad: 2, precio_unitario: 17500, subtotal: 35000 },
      { producto_id: 137, nombre_producto: 'SALSA ROSADA SALSABOR KILO', cantidad: 1, precio_unitario: 7700, subtotal: 7700 },
      { producto_id: 204, nombre_producto: 'OBLEA MEDIANA', cantidad: 1, precio_unitario: 9700, subtotal: 9700 }
    ]
  }
];

const sampleClientExpirySvg =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#181c24"/><rect x="24" y="24" width="432" height="272" rx="16" fill="#232834" stroke="#f59e0b" stroke-width="3"/><text x="240" y="120" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">FOTO ENVIADA POR EL CLIENTE</text><text x="240" y="160" fill="#fbbf24" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Lote #2026-10 • Consulta Fecha de Vencimiento</text><text x="240" y="195" fill="#9ca5b4" font-family="sans-serif" font-size="14" text-anchor="middle">Adjunto desde el Centro de Soporte Danillanos</text></svg>`
  );

const ticketsFallback = [
  {
    id: 1,
    pedido_id: 5,
    usuario_id: 1,
    tipo: 'producto',
    asunto: 'Consulta sobre lote y conservación en entrega #5',
    descripcion: 'Adjunto foto del lote recibido para confirmar fecha de vencimiento.',
    imagen_cliente_url: sampleClientExpirySvg,
    estado: 'en_revision',
    respuesta_soporte: 'Hemos verificado el lote adjunto; cuenta con 6 meses de vigencia a -18°C.',
    mensajes: [
      {
        id: 1,
        autor: 'Carlos Andrés Méndez',
        rol: 'cliente',
        texto: 'Hola equipo Danillanos, adjunto foto del lote recibido en el Pedido #5 para confirmar su fecha de vencimiento.',
        fecha: new Date(Date.now() - 3600 * 1000 * 2).toISOString()
      },
      {
        id: 2,
        autor: 'Sofía Martínez (Soporte)',
        rol: 'soporte',
        texto: '¡Hola Carlos! Verificamos la imagen del lote #2026-10: tiene vigencia de 6 meses conservado a -18°C. ¿Deseas que te enviemos el certificado de calidad?',
        fecha: new Date(Date.now() - 3600 * 1000 * 1).toISOString()
      }
    ],
    creado_en: new Date().toISOString()
  }
];

module.exports = {
  categoriasFallback: categoriasDanillanos,
  productosFallback: productosDanillanos,
  carruselFallback: carruselDanillanos,
  usuariosFallback,
  direccionesFallback,
  pedidosFallback,
  ticketsFallback
};
