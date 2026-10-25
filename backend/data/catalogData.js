/**
 * ============================================================================
 * CATÁLOGO OFICIAL COMPLETO DANILLANOS (235 PRODUCTOS DEL LISTADO DE PRECIOS)
 * Dirección Sede Principal: CLLE 15 # 12 -91 AVENIDA LOS MARACOS, Villavicencio
 * ============================================================================
 */

const categoriasDanillanos = [
  {
    id: 1,
    nombre: 'Cárnicos y Embutidos',
    slug: 'embutidos',
    icono: 'kebab_dining',
    descripcion: 'Chorizos, costillas ahumadas, hamburguesas, jamones, salchichas y tocinetas'
  },
  {
    id: 2,
    nombre: 'Línea de Panes',
    slug: 'pan',
    icono: 'bakery_dining',
    descripcion: 'Panes para hamburguesa, perro caliente y tajado artesanal e industrial'
  },
  {
    id: 3,
    nombre: 'Congelados',
    slug: 'congelados',
    icono: 'ac_unit',
    descripcion: 'Papas francesas, criollas, yuca, maíz, pastas para empanada, milanesas y nuggets'
  },
  {
    id: 4,
    nombre: 'Pulpas de Fruta',
    slug: 'pulpas',
    icono: 'local_drink',
    descripcion: 'Pulpas congeladas naturales y mezclas listas para limonadas y jugos'
  },
  {
    id: 5,
    nombre: 'Salsas y Aderezos',
    slug: 'salsas',
    icono: 'soup_kitchen',
    descripcion: 'Líneas Río Grande, Salsabor, Company y Alimentek en kilo, galón y sobres'
  },
  {
    id: 6,
    nombre: 'Adobos y Sazonadores',
    slug: 'adobos',
    icono: 'Auto_awesome',
    descripcion: 'Adobo criollo, pasta de ajo, ají La Granja, miel, salsa soya, negra y vinagres'
  },
  {
    id: 7,
    nombre: 'Desechables e Icopores',
    slug: 'desechables',
    icono: 'takeout_dining',
    descripcion: 'Contenedores de icopor, cajas porta comidas, papel aluminio, vasos, palillos y servilletas'
  },
  {
    id: 8,
    nombre: 'Don Maní y Frutos Secos',
    slug: 'secos',
    icono: 'nutrition',
    descripcion: 'Arándanos, maní dulce, natural, picante, salado, mixto y mantequilla de maní'
  },
  {
    id: 9,
    nombre: 'Dulcería y Otros',
    slug: 'otros',
    icono: 'icecream',
    descripcion: 'Leche condensada, manjar blanco, syropes, jarabes, obleas, conos, piña en trozos y más'
  }
];

// Imágenes representativas por tipo de producto (fáciles de personalizar individualmente)
const IMG_MAP = {
  alitas: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=700&q=80',
  chorizo: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80',
  costilla: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=700&q=80',
  hamburguesa: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',
  jamon: 'https://images.unsplash.com/photo-1524438418049-ab2acb7aa48f?auto=format&fit=crop&w=700&q=80',
  salchicha: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=700&q=80',
  tocineta: 'https://images.unsplash.com/photo-1606851094655-b2593a9af63f?auto=format&fit=crop&w=700&q=80',
  pan: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80',
  papa: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=700&q=80',
  congelado: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=700&q=80',
  pulpa: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=700&q=80',
  adobo: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=700&q=80',
  salsa: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=700&q=80',
  desechable: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80',
  secos: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=700&q=80',
  dulceria: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=700&q=80'
};

function resolveImage(nombre, catSlug) {
  const n = nombre.toUpperCase();
  if (n.includes('ALITAS')) return IMG_MAP.alitas;
  if (n.includes('CHORIZO') || n.includes('BUTIFARRA')) return IMG_MAP.chorizo;
  if (n.includes('COSTILLA')) return IMG_MAP.costilla;
  if (n.includes('HAMB') || n.includes('HB ')) return IMG_MAP.hamburguesa;
  if (n.includes('JAMON')) return IMG_MAP.jamon;
  if (n.includes('SALCHICHA')) return IMG_MAP.salchicha;
  if (n.includes('TOCINETA')) return IMG_MAP.tocineta;
  if (catSlug === 'pan') return IMG_MAP.pan;
  if (n.includes('PAPA') || n.includes('CRIOLLA') || n.includes('PATACON') || n.includes('YUCA')) return IMG_MAP.papa;
  if (catSlug === 'congelados') return IMG_MAP.congelado;
  if (catSlug === 'pulpas') return IMG_MAP.pulpa;
  if (catSlug === 'adobos') return IMG_MAP.adobo;
  if (catSlug === 'salsas') return IMG_MAP.salsa;
  if (catSlug === 'desechables') return IMG_MAP.desechable;
  if (catSlug === 'secos') return IMG_MAP.secos;
  return IMG_MAP.dulceria;
}

// Lista maestra de los 235 ítems exactos del PDF de Danillanos
// Formato: [categoria_id, categoria_slug, nombre, precio, es_mas_vendido, etiqueta]
const rawItems = [
  // ================= PÁGINA 1: LÍNEA DE CÁRNICOS (EMBUTIDOS) =================
  [1, 'embutidos', 'ALITAS DE POLLO X 500 GRS', 15000, 1, 'Más Vendido'],
  [1, 'embutidos', 'BUTIFARRA X450 GR', 10400, 0, 'Tradicional'],
  [1, 'embutidos', 'CHORIZO CASERO X10', 18850, 1, 'Más Vendido'],
  [1, 'embutidos', 'CHORIZO CASERO X5', 9550, 0, null],
  [1, 'embutidos', 'CHORIZO COCTEL X LB', 13400, 0, null],
  [1, 'embutidos', 'CHORIZO CUNCIA X 10', 20550, 1, 'Favorito Llanero'],
  [1, 'embutidos', 'CHORIZO CUNCIA X 4', 5900, 0, null],
  [1, 'embutidos', 'CHORIZO CUNCIA X 5', 10900, 0, null],
  [1, 'embutidos', 'CHORIZO CUNCIA X 8', 10900, 0, null],
  [1, 'embutidos', 'CHORIZO SANTARROSANO DS X 10', 21350, 1, 'Premium'],
  [1, 'embutidos', 'CHORIZO SANTARROSANO DS X5', 10900, 0, null],
  [1, 'embutidos', 'COSTILLA AHUMADA DS X 250 GR', 9300, 0, null],
  [1, 'embutidos', 'COSTILLA AHUMADA DS X 450 GRS', 16300, 1, 'Más Vendido'],
  [1, 'embutidos', 'COSTILLA PREMIUM X250', 8300, 0, null],
  [1, 'embutidos', 'COSTILLA PREMIUM X450', 14300, 0, 'Premium'],
  [1, 'embutidos', 'COSTILLA CR CALI X 3 KLS', 75900, 0, 'Formato Restaurante'],
  [1, 'embutidos', 'COSTILLA CARAMELO 3 KILOS', 84000, 1, 'Especial Restaurante'],
  [1, 'embutidos', 'COSTILLA ESPECIAL CR SIN HUESO X 250GR', 8000, 0, null],
  [1, 'embutidos', 'COSTILLA ESPECIAL CR SIN HUESO X 500GR', 16000, 0, null],
  [1, 'embutidos', 'COSTILLA RECORTE KILO', 24500, 0, null],
  [1, 'embutidos', 'HAMB. LLANERA X 10 UND X 90 GRS (cuadrada)', 20200, 1, 'Más Vendido'],
  [1, 'embutidos', 'HAMB. PREASADA X 500 GR', 6000, 0, null],
  [1, 'embutidos', 'HAMB. PURA CARNE X10 UND (cuadrada)', 26300, 1, '100% Carne'],
  [1, 'embutidos', 'HB LLANERO CAJA X30UNID 85GR', 51400, 1, 'Caja Negocio'],
  [1, 'embutidos', 'HB LLANERO CAJA X30UNID 115GR', 66400, 0, 'Caja Negocio'],
  [1, 'embutidos', 'JAMON DS X 500gr', 11600, 0, null],
  [1, 'embutidos', 'JAMON YORK JJ X 500 GRS', 5500, 0, 'Económico'],
  [1, 'embutidos', 'JAMON AHUMADO JJ X 500', 7800, 0, null],

  // ================= PÁGINA 2: CÁRNICOS + LÍNEA DE PANES =================
  [1, 'embutidos', 'SALCHICHA AMERICANA X 15 UND', 28100, 0, null],
  [1, 'embutidos', 'SALCHICHA MANGUERA X15', 26600, 0, null],
  [1, 'embutidos', 'SALCHICHA DEL RANCHO X 15 UND', 12500, 0, null],
  [1, 'embutidos', 'SALCHICHA SUPERPERRERO DS X 15', 26100, 1, 'Perros Calientes'],
  [1, 'embutidos', 'SALCHICHA PERRERA MGS X15', 18200, 0, null],
  [1, 'embutidos', 'TOCINETA DS X 250 GR', 7500, 0, null],
  [1, 'embutidos', 'TOCINETA DS X 450 GR', 13400, 1, 'Más Vendido'],
  [1, 'embutidos', 'TOCINETA LLANERA X900', 16850, 0, null],
  [1, 'embutidos', 'TOCINETA OFIR X900', 21500, 0, 'Bloque 900g'],
  [1, 'embutidos', 'TOCINETA RECORTE DS X KILO', 21150, 0, null],

  [2, 'pan', 'PAN HAMBURGUESA AJONJOLI GUADALUPE', 10500, 0, 'Fresco'],
  [2, 'pan', 'PAN HAMBURGUESA ARTESANAL BIMBO X 10 UND', 12900, 1, 'Más Vendido'],
  [2, 'pan', 'PAN TAJADO BIMBO EXTRALARGO', 8500, 0, null],
  [2, 'pan', 'PAN PERRO BIMBO X10 UND', 11850, 0, null],

  // ================= PÁGINA 3: LÍNEA DE CONGELADOS =================
  [3, 'congelados', 'CRIOLLA X 1000 GR', 11800, 1, 'Congelado IQF'],
  [3, 'congelados', 'CRIOLLA X LIBRA', 6100, 0, null],
  [3, 'congelados', 'CROQUETA YUCA X 1000 GR', 7500, 0, 'Listo para Freír'],
  [3, 'congelados', 'CROQUETA YUCA X 500 GR', 4000, 0, null],
  [3, 'congelados', 'MAIZ DULCE X KILO', 8000, 0, null],
  [3, 'congelados', 'MAIZ DULCE X 500gr', 5000, 0, null],
  [3, 'congelados', 'MAIZ PORCIONADO X20 UNID', 28000, 0, 'Restaurantes'],
  [3, 'congelados', 'MIX DE VERDURA X KILO', 11500, 0, null],
  [3, 'congelados', 'MIX DE VERDURA X LIBRA', 6300, 0, null],
  [3, 'congelados', 'PAPA FRANCESA IMPORTADA X 2.5 KG', 17500, 1, 'Más Vendido'],
  [3, 'congelados', 'PAPA FRANCESA X 500 GR', 5000, 0, null],
  [3, 'congelados', 'PAPA FRANCESA X 1000 GR', 9800, 1, 'Extra Crujiente'],
  [3, 'congelados', 'PAPA PORCIONADA X 20 UND', 30000, 0, null],
  [3, 'congelados', 'PASTA CUADRADA PARA FLAUTA X 600 GRS', 4800, 0, null],
  [3, 'congelados', 'PASTA EMPANADA REDONDA X 500 GRS', 4500, 0, null],
  [3, 'congelados', 'PASTA EMPANADA REDONDA X 600 GRS', 4650, 0, null],
  [3, 'congelados', 'PATACON TOSTON X 1000 GR', 11800, 0, null],
  [3, 'congelados', 'MILANESA DE POLLO X22 UNID 100GR', 64200, 0, 'Caja x22'],
  [3, 'congelados', 'HAMBURGUESA POLLO X22 UNID 100GR', 64200, 0, 'Caja x22'],
  [3, 'congelados', 'NUGGETS X60 UNIDADES', 36900, 1, 'Familiar x60'],

  // ================= PÁGINAS 3 Y 4: LÍNEA CONGELADOS - PULPAS =================
  [4, 'pulpas', 'PULPA FRUTOS AMARILLOS X 8 X125GR', 21000, 0, 'Fruta Natural'],
  [4, 'pulpas', 'PULPA CONGELADA DE LULO X8UN X 125GR', 15600, 0, null],
  [4, 'pulpas', 'PULPA CONGELADA FRESA X 8UND X 125 GR', 14700, 0, null],
  [4, 'pulpas', 'PULPA CONGELADA FRUTOS ROJOS X8UND 125GR', 15600, 0, null],
  [4, 'pulpas', 'PULPA CONGELADA HIERBABUENA 8X125 GR', 20600, 0, null],
  [4, 'pulpas', 'PULPA CONGELADA MANGO 8X125 GR', 16100, 0, null],
  [4, 'pulpas', 'PULPA CONGELADA MARACUYA X8UN X125 GR', 26400, 1, 'Más Vendido'],
  [4, 'pulpas', 'PULPA CONGELADA MORA X8 X125 GR', 16100, 0, null],
  [4, 'pulpas', 'PULPA CONGELADA DE GUANABANA X8 X125', 18900, 0, null],
  [4, 'pulpas', 'PULPA LIMONADA CEREZA X8UND X125GR', 20600, 0, 'Limonada Lista'],
  [4, 'pulpas', 'PULPA LIMONADA DE COCO X8UND X125GR', 27700, 1, 'Favorito'],
  [4, 'pulpas', 'PULPA LIMONADA MANGO BICHE X8 UND', 20700, 0, null],
  [4, 'pulpas', 'PULPA LIMONADA NATURAL X8UND', 16100, 0, null],
  [4, 'pulpas', 'PULPA LIMONADA NARANJA X8 UND 125GR', 18600, 0, null],
  [4, 'pulpas', 'PULPA LIMONADA MANDARINA X8 UND 125GR', 19600, 0, null],
  [4, 'pulpas', 'PULPA PIÑA COLADA X8 UND 125GR', 26400, 0, null],
  [4, 'pulpas', 'PULPA LIMONADA PANELADA X8 UND 125GR', 18000, 0, null],

  // ================= PÁGINA 4 Y 9: LÍNEA ADOBO Y SAZONADORES =================
  [6, 'adobos', 'ADOBO CRIOLLO X 1000 GR', 8100, 0, 'Sazón Casero'],
  [6, 'adobos', 'ADOBO CRIOLLO X 110 GR', 1500, 0, null],
  [6, 'adobos', 'ADOBO CRIOLLO X 245 GR', 2800, 0, null],
  [6, 'adobos', 'ADOBO CRIOLLO X 4000 GR', 28000, 0, 'Garrafa 4Kg'],
  [6, 'adobos', 'ADOBO CRIOLLO X 500 GR', 5600, 0, null],
  [6, 'adobos', 'ADOBO CRIOLLO X 50 GR X12 UND', 11800, 0, null],
  [6, 'adobos', 'AJI LA GRANJA X 110 GR', 1500, 0, null],
  [6, 'adobos', 'AJI LA GRANJA X 245 GR', 2800, 0, null],
  [6, 'adobos', 'AJI LA GRANJA X 4 KL', 28000, 0, 'Institucional'],
  [6, 'adobos', 'AJI LA GRANJA X 500 GR', 5600, 0, null],
  [6, 'adobos', 'AJI LA GRANJA X 50 GR X 12UND', 11800, 0, null],
  [6, 'adobos', 'AJI LA GRANJA X KILO', 8100, 0, null],
  [6, 'adobos', 'PASTA DE AJO X KILO', 8100, 0, null],
  [6, 'adobos', 'PASTA DE AJO X 110 GR', 1800, 0, null],
  [6, 'adobos', 'PASTA DE AJO X245GR', 2800, 0, null],
  [6, 'adobos', 'PASTA DE AJO X 4 KLS', 28000, 0, null],
  [6, 'adobos', 'PASTA DE AJO X 500 GR', 5600, 0, null],
  [6, 'adobos', 'PASTA DE AJO X 50 GR X12 UND', 11800, 0, null],
  [6, 'adobos', 'MIEL GRANJA X1000', 10000, 0, null],
  [6, 'adobos', 'MIEL LA GRANJA X 500 GR', 5500, 0, null],
  [6, 'adobos', 'SALSA SOYA GAVIUS *1000 ML', 7000, 0, null],
  [6, 'adobos', 'SALSA SOYA GAVIUS *3800 ML', 19200, 0, 'Galón'],
  [6, 'adobos', 'SALSA NEGRA GAVIUS *1000 ML', 7000, 0, null],
  [6, 'adobos', 'SALSA NEGRA GAVIUS *3800 ML', 19200, 0, 'Galón'],
  [6, 'adobos', 'VINAGRE BLANCO *1000 ML', 3250, 0, null],
  [6, 'adobos', 'VINAGRE BLANCO *3000 ML', 8000, 0, null],

  // ================= PÁGINA 5: SALSAS RÍO GRANDE Y SALSABOR =================
  [5, 'salsas', 'SALSA BBQ X GALON RIO GRANDE', 28500, 1, 'Río Grande'],
  [5, 'salsas', 'SALSA BBQ KILO RIOGRANDE', 8500, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA BBQ DULCE RIOGRANDE KILO', 14500, 0, 'Río Grande'],
  [5, 'salsas', 'ADEREZO PIÑA X KILO RIOGRANDE', 15800, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA DE PIÑA RIOGRANDE KILO', 6800, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA DULCE MAIZ RIOGRANDE X GALON', 49800, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA DULCE MAIZ RIOGRANDE X KILO', 14800, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA GUACAMOLE CON AJI X KILO RIOGRANDE', 15950, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA GUACAMOLE SIN AJI X KILO RIOGRANDE', 15950, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA TARTARA RIOGRANDE X KILO', 13650, 1, 'Más Vendido'],
  [5, 'salsas', 'SALSA TOMATE RIOGRANDE X KILO', 8500, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA TOMATE RIO GRANDE X GALON', 29500, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA MOSTAZA RIOGRANDE GALON', 22500, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA MOSTAZA RIOGRANDE KILO', 6500, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA CON AJO CAMPO GALON', 72700, 0, 'Galón'],
  [5, 'salsas', 'SALSA MAYONESA CAMPO GALON', 68000, 0, 'Galón'],
  [5, 'salsas', 'SALSA BBQ BUFALO RIO GRANDE KILO', 14900, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA MIEL MOSTAZA RIO GRANDE KILO', 11900, 0, 'Río Grande'],
  [5, 'salsas', 'SALSA ROSADA RIOGRANDE GALON', 33000, 0, 'Río Grande'],

  [5, 'salsas', 'PASTA TOMATE FINAS HIERBAS SALSABOR GALON', 30650, 0, 'Salsabor'],
  [5, 'salsas', 'PASTA DE TOMATE SALSABOR GALON', 27300, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA BBQ SALSABOR GALON', 23400, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA BBQ SALSABOR KILO', 8000, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA TOMATE SALSABOR GALON', 23400, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA TOMATE SALSABOR KILO', 5700, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA MAYONESA SALSABOR GALON', 35000, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA MAYONESA SALSABOR KILO', 9400, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA NEGRA SALSABOR GALON', 17300, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA PIÑA SALSABOR GALON', 21200, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA PIÑA SALSABOR KILO', 6700, 0, 'Salsabor'],

  // ================= PÁGINA 6: SALSABOR + COMPANY + ALIMENTEK =================
  [5, 'salsas', 'SALSA ROSADA SALSABOR GALON', 23400, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA ROSADA SALSABOR KILO', 7700, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA SOYA SALSABOR GALON', 18900, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA TARTARA SALSABOR KILO', 7700, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA TARTARA GOURMETH SALSABOR GLN', 41500, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA DULCE MAIZ SALSABOR GALON', 42800, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA DULCE MAIZ SALSABOR KILO', 12000, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA QUESO SALSABOR GALON', 41500, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA QUESO SALSABOR KILO', 11100, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA BBQ SALSABOR GOURMETH GALON', 32600, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA TOMATE SALSABOR GOURMETH GALON', 24200, 0, 'Salsabor'],
  [5, 'salsas', 'SALSA BBQ BUQUIN GLN', 24850, 0, 'Buquin'],
  [5, 'salsas', 'SALSA TOMATE BUQUIN GLN', 22200, 0, 'Buquin'],

  [5, 'salsas', 'SALSA TOMATE SOBRES COMPANY', 5850, 0, 'Porciones Sobres'],
  [5, 'salsas', 'SALSA MIEL SOBRES COMPANY', 6650, 0, 'Porciones Sobres'],
  [5, 'salsas', 'SALSA BBQ SOBRES COMPANY', 7350, 0, 'Porciones Sobres'],
  [5, 'salsas', 'SALSA ROSADA SOBRES COMPANY', 8000, 0, 'Porciones Sobres'],

  [5, 'salsas', 'ALIMENTEK MAYO AJO X900 GR', 21600, 1, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK MAYO AJO X4000 GR', 69300, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK BBQ X1000 GR', 14500, 0, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK BBQ X4000 GR', 34000, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK MAIZ DULCE X900 GR', 18500, 0, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK MAIZ DULCE X4000 GR', 56000, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK MAYO TOCINETA X900 GR', 19000, 1, 'Más Vendido'],
  [5, 'salsas', 'ALIMENTEK MAYO TOCINETA X4000 GR', 57500, 0, 'Alimentek 4Kg'],

  // ================= PÁGINA 7: ALIMENTEK + LÍNEA DESECHABLES =================
  [5, 'salsas', 'ALIMENTEK MAYONESA X900 GR', 21000, 0, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK MAYONESA X4000 GR', 64000, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK PARRILLA Y CARBON X900 GR', 18400, 0, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK PARRILLA Y CARBON X4000 GR', 52500, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK QUESO CHEDDAR X900 GR', 17700, 1, 'Queso Cheddar'],
  [5, 'salsas', 'ALIMENTEK QUESO CHEDDAR X4000 GR', 52600, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK TARTARA FRAGATA X900 GR', 19600, 0, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK TARTARA FRAGATA X4000 GR', 62500, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK TOMATE X1000 GR', 14000, 0, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK TOMATE X4000 GR', 35000, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK MOSTAZA X1000 GR', 14600, 0, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK MOSTAZA X4000 GR', 30000, 0, 'Alimentek 4Kg'],
  [5, 'salsas', 'ALIMENTEK ROSADA X1000 GR', 18000, 0, 'Alimentek'],
  [5, 'salsas', 'ALIMENTEK ROSADA X4000 GR', 40700, 0, 'Alimentek 4Kg'],

  [7, 'desechables', 'CARTON PORTA HAMBURGUESA', 100, 0, 'Empaque'],
  [7, 'desechables', 'CARTON PORTA PERRO', 100, 0, 'Empaque'],
  [7, 'desechables', 'CARTON PORTA PIZZA', 100, 0, 'Empaque'],
  [7, 'desechables', 'PALILLO HAMBURGUESA', 1850, 0, 'Insumo'],
  [7, 'desechables', 'PALILLO MESA', 1000, 0, 'Insumo'],
  [7, 'desechables', 'PALILLOS PINCHO X 25 CM', 4200, 0, 'Asados / Pinchos'],
  [7, 'desechables', 'PALO PALETA X MILLAR', 18000, 0, 'x1000 Unidades'],
  [7, 'desechables', 'PAPEL ALUMINIO ROLLO X 16 MTS', 7500, 0, 'Cocina'],
  [7, 'desechables', 'PAPEL ALUMINIO ROLLO X 100 MTS', 37500, 1, 'Rollo Industrial'],
  [7, 'desechables', 'PORTA ENSALADA/ SOPA P1 X 20UN', 10000, 0, 'x20 Unidades'],
  [7, 'desechables', 'SERVILLETA X 300', 5300, 0, 'x300 Unidades'],
  [7, 'desechables', 'VASOS DESECHABLE 3.3 ONZ', 1500, 0, 'Bebidas'],
  [7, 'desechables', 'VASOS DESECHABLE 7 ONZ', 2200, 0, 'Bebidas'],
  [7, 'desechables', 'ICOPOR J1 X20 UNIDADES', 11500, 1, 'Más Vendido'],
  [7, 'desechables', 'ICOPOR P1 X20 UNIDADES', 13150, 0, 'x20 Unidades'],
  [7, 'desechables', 'ICOPOR C1 X20 UNIDADES', 7100, 0, 'x20 Unidades'],
  [7, 'desechables', 'ICOPOR K1 X20 UNIDADES', 9900, 0, 'x20 Unidades'],

  // ================= PÁGINA 8: DON MANÍ + LÍNEA OTROS PRODUCTOS =================
  [8, 'secos', 'ARANDANOS LIBRA', 20500, 0, 'Don Maní'],
  [8, 'secos', 'MANI DULCE LIBRA', 7400, 0, 'Don Maní'],
  [8, 'secos', 'MANI NATURAL LIBRA', 10200, 0, 'Don Maní'],
  [8, 'secos', 'MANI PICANTE LIBRA', 10200, 0, 'Don Maní'],
  [8, 'secos', 'MANI SALADO LIBRA', 10200, 0, 'Don Maní'],
  [8, 'secos', 'MANTEQUILLA DE MANI', 12200, 1, 'Don Maní'],
  [8, 'secos', 'MANI MIXTO X100GR', 2200, 0, 'Don Maní'],
  [8, 'secos', 'MANI MIXTO X250GR', 5200, 0, 'Don Maní'],

  [9, 'otros', 'CABELLO DE ANGEL LIBRA', 4900, 0, null],
  [9, 'otros', 'CABELLO DE ANGEL KILO', 8950, 0, null],
  [9, 'otros', 'CABELLO DE ANGEL X200', 2900, 0, null],
  [9, 'otros', 'OBLEA GRANDE', 15800, 0, 'Postres'],
  [9, 'otros', 'OBLEA MEDIANA', 9700, 0, 'Postres'],
  [9, 'otros', 'OBLEA MINI', 7850, 0, 'Postres'],
  [9, 'otros', 'PIÑA EN TROZOS X 1 KG', 5200, 0, 'Para Perros/Pizzas'],
  [9, 'otros', 'PIÑA EN TROZOS X 2.5 KL', 12150, 1, 'Formato Negocio'],
  [9, 'otros', 'PIÑA EN TROZOS X 500 GRS', 3800, 0, null],
  [9, 'otros', 'ZUMO DE LIMON X 2000', 8050, 0, '2 Litros'],
  [9, 'otros', 'ZUMO LIMON X 1000', 4300, 0, '1 Litro'],
  [9, 'otros', 'ZUMO LIMON X 500 ML', 2100, 0, '500 ml'],
  [9, 'otros', 'CONO PEQUEÑO X10 UNIDADES', 4900, 0, 'Heladería'],
  [9, 'otros', 'CONO GRANDE X10 UNIDADES', 5000, 0, 'Heladería'],
  [9, 'otros', 'GALLETAS CORAZONES X50 UNIDADES', 5400, 0, 'Heladería'],
  [9, 'otros', 'CANASTILLA GALLETA X10 UNIDADES', 5950, 0, 'Heladería'],
  [9, 'otros', 'BARQUILLO PIAZZA X24 UND', 12500, 0, 'Heladería'],

  // ================= PÁGINA 9: DULCERÍA =================
  [9, 'otros', 'GRAGEA COLOR FIESTA X250 ML', 4200, 0, 'Repostería'],
  [9, 'otros', 'GRAGEA COLOR FIESTA X500 ML', 6700, 0, 'Repostería'],
  [9, 'otros', 'JARABE PARA RASPADO CEREZA *500 ML', 2800, 0, 'Raspados'],
  [9, 'otros', 'JARABE PARA RASPADO CHICLE *500 ML', 2800, 0, 'Raspados'],
  [9, 'otros', 'JARABE PARA RASPADO LIMON *500 ML', 2800, 0, 'Raspados'],
  [9, 'otros', 'JARABE PARA RASPADO MARACUYA *500 ML', 2800, 0, 'Raspados'],
  [9, 'otros', 'JARABE PARA RASPADO MORA *500 ML', 2800, 0, 'Raspados'],
  [9, 'otros', 'JARABE PARA RASPADO FRESA *500 ML', 2800, 0, 'Raspados'],
  [9, 'otros', 'JARABE PARA RASPADO KOLA *500 ML', 2800, 0, 'Raspados'],
  [9, 'otros', 'LECHE CONDENSADA X4.700 GR', 45000, 0, 'Institucional'],
  [9, 'otros', 'LECHE CONDENSADA DULCE LACTEO X1000 KG', 11050, 0, 'Dulcería'],
  [9, 'otros', 'LECHE CONDENSADA DULCE LACTEO X500 GR', 5000, 0, 'Dulcería'],
  [9, 'otros', 'LECHE CONDENSADA ELITE DOYPACK X250 GR', 3100, 0, 'Dulcería'],
  [9, 'otros', 'MANJAR BLANCO *250 GR', 4500, 0, 'Tradicional'],
  [9, 'otros', 'MANJAR BLANCO *850 GR MATERA', 10500, 0, 'Tradicional'],
  [9, 'otros', 'MANJAR BLANCO X4.500 KL', 33000, 0, 'Institucional'],
  [9, 'otros', 'SYROPE DOLCE SABOR A CARAMELO *600 GR', 9900, 0, 'Topping'],
  [9, 'otros', 'SYROPE DOLCE SABOR A CHOCOLATE *600 GR', 11400, 0, 'Topping'],
  [9, 'otros', 'SYROPE DOLCE SABOR A FRESA *600 GR', 9900, 0, 'Topping']
];

const catNameById = Object.fromEntries(categoriasDanillanos.map((c) => [c.id, c.nombre]));

const productosDanillanos = rawItems.map((item, idx) => {
  const [categoria_id, categoria_slug, nombre, precio, es_mas_vendido, etiqueta] = item;
  const id = idx + 1;
  const sku = `DAN-${categoria_slug.slice(0, 3).toUpperCase()}-${String(id).padStart(3, '0')}`;

  let temp = 'Ambiente Fresco';
  if (categoria_slug === 'congelados' || categoria_slug === 'pulpas') temp = '-18°C Ultracongelado';
  else if (categoria_slug === 'embutidos') temp = '0°C a 4°C Refrigerado';

  return {
    id,
    categoria_id,
    categoria_slug,
    categoria_nombre: catNameById[categoria_id],
    codigo_sku: sku,
    nombre,
    descripcion: `Insumo garantizado por Danillanos (${catNameById[categoria_id]}) ideal para restaurantes, comidas rápidas y hogar.`,
    presentacion: nombre.includes('X') ? nombre.substring(nombre.indexOf('X')).trim() : 'Unidad Estándar',
    precio,
    precio_anterior: es_mas_vendido ? Math.round(precio * 1.12) : null,
    imagen_url: resolveImage(nombre, categoria_slug),
    stock: 120,
    es_mas_vendido,
    etiqueta,
    temperatura_conservacion: temp
  };
});

const carruselDanillanos = [
  {
    id: 1,
    producto_id: 24,
    subtitulo: 'TODO PARA TU RESTAURANTE Y HOGAR',
    titulo: 'Cárnicos, Hamburguesas, Costillas y Chorizos Llaneros',
    descripcion: 'Distribuimos calidad desde nuestra sede en Av. Los Maracos (Clle 15 # 12-91). Envíos el mismo día en Villavicencio.',
    precio_destacado: 18850,
    imagen_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=80',
    texto_boton: 'Añadir al carrito',
    tipo_accion: 'add_to_cart',
    orden: 1
  },
  {
    id: 2,
    producto_id: 52,
    subtitulo: 'LÍNEA ULTRACONGELADOS Y PULPAS',
    titulo: 'Papas Francesas, Criollas, Nuggets y Pulpas 100% Fruta',
    descripcion: 'Cadena de frío garantizada. Surte tu negocio de comidas rápidas con los mejores precios del Meta.',
    precio_destacado: 17500,
    imagen_url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=1600&q=80',
    texto_boton: 'Comprar ahora',
    tipo_accion: 'buy_now',
    orden: 2
  },
  {
    id: 3,
    producto_id: 106,
    subtitulo: 'SALSAS INSTITUCIONALES Y DESECHABLES',
    titulo: 'Río Grande, Salsabor, Alimentek, Icopores y Empaques',
    descripcion: 'Desde galones de salsa BBQ, Mayonesa y Queso Cheddar hasta contenedores de icopor, aluminio y servilletas.',
    precio_destacado: 21600,
    imagen_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1600&q=80',
    texto_boton: 'Añadir al carrito',
    tipo_accion: 'add_to_cart',
    orden: 3
  },
  {
    id: 4,
    producto_id: 17,
    subtitulo: 'ESPECIALISTAS EN COSTILLAS Y TOCINETA',
    titulo: 'Costilla Caramelo, Ahumada, San Luis y Tocineta Llanera',
    descripcion: 'Cortes seleccionados con el sello de calidad Danillanos. Entregas programadas a todo el departamento del Meta.',
    precio_destacado: 16300,
    imagen_url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1600&q=80',
    texto_boton: 'Comprar corte ahora',
    tipo_accion: 'buy_now',
    orden: 4
  }
];

module.exports = {
  categoriasDanillanos,
  productosDanillanos,
  carruselDanillanos
};
