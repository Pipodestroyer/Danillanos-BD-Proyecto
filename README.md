# 🥩 Danillanos - Plataforma E-Commerce & Centro de Operaciones Logísticas

Plataforma integral de comercio electrónico y gestión logística para **Danillanos** (distribuidor mayorista y minorista de carnes, congelados, pulpas y salsas en Villavicencio y municipios del Meta, Colombia).

El sistema cuenta con una arquitectura desacoplada y robusta compuesta por un **Frontend SPA/Multi-página responsivo** (HTML5, CSS3 con tokens personalizados y JavaScript Vanilla modular), un backend en **Node.js + Express** con seguridad criptográfica de grado bancario (**AES-256-GCM + Scrypt KDF + Blind Indexing HMAC-SHA256**) y persistencia relacional en **MySQL** con sincronización automática de contingencia.

---

## 🏛️ Arquitectura General del Sistema

```
                      ┌───────────────────────────────────────────────┐
                      │             CLIENTE / NAVEGADOR               │
                      │  - Tienda Pública (index.html)                │
                      │  - Perfil, Mapa & Tickets (perfil.html)       │
                      │  - Pasarela Checkout 3 Pasos (pagos.html)     │
                      │  - Centro de Operaciones Staff (panel.html)   │
                      └──────────────────────┬────────────────────────┘
                                             │ HTTP REST / JSON + JWT
                                             ▼
                      ┌───────────────────────────────────────────────┐
                      │              BACKEND EXPRESS.JS               │
                      │  - Router API Modular (backend/routes/api.js) │
                      │  - Seguridad Criptográfica (AES + Scrypt)    │
                      │  - Persistencia de Contingencia Local JSON    │
                      │  - Cronograma de Despachos del Meta           │
                      └──────────────────────┬────────────────────────┘
                                             │ Pool MySQL2 (Promise) + SSL
                                             ▼
                      ┌───────────────────────────────────────────────┐
                      │          BASE DE DATOS RELACIONAL             │
                      │  - MySQL 8.0+ (Local o Cloud: Aiven/TiDB)     │
                      │  - 8 Tablas Relacionales Normalizadas         │
                      │  - Vistas Analíticas + Stored Procedures      │
                      └───────────────────────────────────────────────┘
```

---

## 📁 Estructura del Directorio

```
Danillanos-BD-Proyecto/
├── backend/
│   ├── config/
│   │   └── db.js                 # Pool de conexiones MySQL (mysql2/promise) con detección SSL
│   ├── data/
│   │   ├── catalogData.js        # Catálogo maestro normalizado (235 productos en 9 categorías)
│   │   └── fallbackData.js       # Almacén de contingencia en memoria y JSON local
│   ├── routes/
│   │   └── api.js                # Enrutador REST principal (33 endpoints documentados)
│   ├── utils/
│   │   └── security.js           # Criptografía: AES-256-GCM, Scrypt KDF, Blind Index y JWT
│   └── server.js                 # Servidor Express, middlewares, estáticos y diagnóstico
├── database/
│   ├── build-frontend-config.js  # Compilador de configuración frontend sincronizada
│   ├── generate-schema.js        # Generador de esquema SQL con vistas, procedimientos y semillas
│   ├── schema.sql                # Definición DDL y DML completa de MySQL
│   └── schema_comments.sql       # Script SQL completamente comentado para DBA
├── frontend/
│   ├── css/
│   │   └── styles.css            # Sistema de diseño, tokens CSS, modo claro/oscuro y componentes
│   ├── js/
│   │   ├── app.js                # Lógica cliente: Auth, Carrito, Mapa Leaflet, Checkout y Paneles
│   │   └── config.js             # Parámetros frontend sincronizados con el backend
│   ├── 404.html                  # Página de recurso no encontrado y redirección
│   ├── index.html                # Tienda principal, hero carrusel, buscador y catálogo
│   ├── pagos.html                # Pasarela de compras en 3 pasos con cálculo de entrega
│   ├── panel.html                # Centro operativo multirrol (Admin, Empleado, Repartidor, Soporte)
│   └── perfil.html               # Gestión de cuenta, direcciones con Leaflet, tracking y PQRS
├── generate-schema_comments.js   # Generador automatizado de schema_comments.sql
├── run-schema.js                 # Ejecutor del DDL contra la base de datos MySQL activa
├── package.json                  # Dependencias y scripts del proyecto
└── README.md                     # Documentación arquitectónica para desarrolladores
```

---

## 🔐 Seguridad y Protección de Datos Personales

El sistema implementa estrictas medidas de seguridad basadas en el estándar de la **Ley de Protección de Datos Personales (Ley 1581 de 2012)**:

1. **Cifrado Simétrico en Reposo (AES-256-GCM)**:
   - Los datos personales sensibles del cliente (teléfono, empresa, tipo y número de documento) se cifran con una clave de 256 bits derivada por entorno (`ENCRYPTION_KEY`).
   - Se utiliza un vector de inicialización (IV) único de 16 bytes por registro junto a una etiqueta de autenticación (Auth Tag) de 16 bytes que previene modificaciones no autorizadas en base de datos.
2. **Derivación y Hashing de Contraseñas (Scrypt KDF)**:
   - Se emplea la función criptográfica Scrypt con salt criptográfico de 16 bytes (N=16384, r=8, p=1).
   - La comprobación de credenciales se efectúa mediante comparación segura de tiempo constante (`crypto.timingSafeEqual`) para anular vulnerabilidades de canal lateral (Timing Attacks).
3. **Indexación Ciega (Blind Indexing)**:
   - La búsqueda rápida de documentos de identidad cifrados se realiza a través de un hash ciego determinista HMAC-SHA256 (`hashLookup`), permitiendo indexar columnas en base de datos sin exponer el dato en texto plano.
4. **JSON Web Tokens (JWT)**:
   - Emisión y verificación de tokens de autenticación con firma HMAC-SHA256 (`JWT_SECRET`) y caducidad configurable.
5. **Autenticación Federada Google Identity Services (GIS OAuth 2.0)**:
   - Soporte nativo para One Tap y ventana emergente oficial de Google OAuth 2.0, con flujo de asignación obligatoria de contraseña local previo al cierre de sesión.

---

## 🗺️ Cobertura Geográfica y Logística Departamental

La distribución logística de pedidos se organiza según la ubicación geográfica del cliente calculada mediante la fórmula de **Haversine**:

- **Radio Urbano Villavicencio (9.5 km desde el Centro Histórico)**:
  - Envíos en el mismo día para pedidos radicados antes de las 17:00 horas.
- **Rutas Departamentales del Meta (Cronograma Semanal con Corte a las 00:00)**:
  - **Martes**: Puerto López y San Carlos de Guaroa.
  - **Miércoles**: Mesetas, Vista Hermosa y Lejanías.
  - **Jueves (Ruta 1)**: San Martín, Granada, Fuente de Oro y Puerto Lleras.
  - **Jueves (Ruta 2)**: Castilla La Nueva, Guamal, Cubarral y El Dorado.
  - **Viernes (Ruta 1)**: Puerto Gaitán.
  - **Viernes (Ruta 2)**: Restrepo, Cumaral, Medina y Paratebueno.
  - **Sábado**: Acacías.
  - *Regla de Corte*: Pedidos confirmados antes de las 00:00 del día asignado se despachan en la jornada; órdenes posteriores se programan para el siguiente ciclo semanal.

---

## 👥 Roles de Usuario y Matriz de Acceso

| Rol | Vistas Accesibles | Capacidades Principales |
|---|---|---|
| `cliente` | Tienda, Perfil, Checkout | Explorar catálogo, carrito, agregar hasta 5 direcciones con pin en mapa, tracking en 4 etapas, chat de soporte con fotos. |
| `empleado` | Panel Operativo (`panel.html`) | Cola de bodega, confirmación de órdenes, asignación de conductor, despacho a ruta e historial filtrable. |
| `entregador` | Panel Operativo (`panel.html`) | Barra de progreso diario (reset a las 00:00), mapa interactivo de paradas, apertura en Waze/Google Maps y prueba fotográfica de entrega. |
| `soporte` | Panel Operativo (`panel.html`) | Bandeja de tickets PQRS, chat bidireccional con previsualización de imágenes, resolución de incidencias e historial de pedidos. |
| `admin` | Panel Operativo (`panel.html`) | Dashboard con KPIs y gráficos analíticos, CRUD de catálogo (235 productos), gestión de colaboradores y vinculación de roles. |

---

## 📡 Catálogo de la API REST

Todos los endpoints que devuelven datos retornan JSON estandarizado: `{ ok: boolean, data?: any, message?: string }`.

### Diagnóstico y Salud
- `GET /api/health` - Comprobación de estado del servicio, base de datos y métricas operativas.

### Catálogo Comercial
- `GET /api/carrusel` - Diapositivas publicitarias del carrusel hero.
- `GET /api/categorias` - Líneas de productos disponibles (9 categorías).
- `GET /api/productos` - Catálogo completo de 235 productos con filtros por categoría y búsqueda textual.

### Autenticación y Cuentas
- `POST /api/auth/registro` - Creación de nueva cuenta de cliente cifrada con AES-256-GCM.
- `POST /api/auth/login` - Inicio de sesión con correo y contraseña protegida por Scrypt.
- `POST /api/auth/google` - Autenticación federada con Google Identity Services (GIS OAuth 2.0).
- `GET /api/auth/perfil` - Consulta de datos del perfil autenticado con descifrado en vuelo.
- `PUT /api/auth/perfil` - Actualización de información de contacto y facturación.
- `POST /api/auth/establecer-password` - Asignación o modificación de clave de seguridad.

### Libreta de Direcciones
- `GET /api/direcciones` - Listado de hasta 5 direcciones guardadas por el usuario.
- `POST /api/direcciones` - Adición de nueva ubicación con geocodificación inversa.
- `PUT /api/direcciones/:id` - Modificación de una dirección existente.
- `DELETE /api/direcciones/:id` - Eliminación de una dirección guardada.

### Pedidos del Cliente
- `POST /api/pedidos` - Radicación de orden de compra desde la pasarela de pagos.
- `GET /api/mis-pedidos` - Historial y pedidos activos en progreso del cliente.
- `PATCH /api/mis-pedidos/:id/cancelar` - Anulación anticipada de orden (sólo etapas 1 y 2).

### Centro de Atención PQRS
- `GET /api/mis-tickets` - Tickets de soporte abiertos por el cliente.
- `POST /api/soporte` - Radicación de un nuevo caso con evidencia fotográfica opcional.
- `POST /api/soporte/:id/mensaje` - Envío de mensaje en hilo de conversación de soporte.
- `PATCH /api/mis-tickets/:id/cerrar` - Cierre formal del caso por parte del cliente.

### Operaciones de Personal (Staff)
- `GET /api/staff/pedidos` - Cola consolidada de órdenes para Bodega, Reparto y Administración.
- `PATCH /api/staff/pedidos/:id` - Actualización de estado logístico, conductor y comprobante.
- `GET /api/staff/tickets` - Bandeja de entrada de tickets asistenciales para el equipo de soporte.
- `PATCH /api/staff/tickets/:id` - Resolución y respuesta de tickets de clientes.
- `GET /api/staff/entregadores` - Directorio de repartidores disponibles para asignación de ruta.
- `GET /api/staff/catalogo` - Inventario administrativo de productos.
- `POST /api/staff/catalogo` - Creación de nuevo artículo en el catálogo.
- `PUT /api/staff/catalogo/:id` - Edición de precio, categoría, presentación y estado destacado.
- `DELETE /api/staff/catalogo/:id` - Desactivación o eliminación de artículo.
- `GET /api/staff/usuarios` - Directorio de cuentas y roles de la empresa.
- `POST /api/staff/usuarios/vincular-empleado` - Registro o promoción de colaborador operativo.
- `PATCH /api/staff/usuarios/:id/rol` - Modificación del rol de acceso a la plataforma.
- `PATCH /api/staff/usuarios/:id/toggle` - Activación o suspensión de cuenta.

---

## 🚀 Guía de Instalación y Puesta en Marcha

### Prerrequisitos
- **Node.js**: v18.0.0 o superior (recomendado v20+ o v24 LTS).
- **MySQL Server**: v8.0+ (Local, Docker o servicio en la nube como Aiven, PlanetScale o TiDB Cloud).

### 1. Clonar e Instalar Dependencias
```bash
git clone <url-del-repositorio>
cd Danillanos-BD-Proyecto
npm install
```

### 2. Configurar Variables de Entorno (`.env`)
Crear un archivo `.env` en la raíz del proyecto basado en las siguientes variables:
```env
PORT=3000
NODE_ENV=development

# Conexión a Base de Datos MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=danillanos_db
DB_SSL=false

# Claves Criptográficas
JWT_SECRET=tu_clave_secreta_jwt_de_al_menos_32_caracteres
ENCRYPTION_KEY=tu_clave_secreta_de_cifrado_de_32_caracteres_exactos

# Google OAuth 2.0 (Opcional para Login con Google)
GOOGLE_CLIENT_ID=394071429874-5ev2n04b6j7akvqg0rtaene6461smr10.apps.googleusercontent.com
```

### 3. Inicializar la Base de Datos
Ejecutar el script automatizado para crear la estructura relacional, vistas y cargar los 235 productos:
```bash
npm run db:init
# O directamente:
node run-schema.js
```

### 4. Iniciar el Servidor de Aplicación
```bash
npm start
```
Abrir en el navegador: [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Scripts Disponibles en `package.json`

- `npm start`: Inicia el servidor de producción Express en el puerto configurado.
- `npm run db:init`: Ejecuta el DDL de MySQL (`database/schema.sql`) para inicializar tablas y semillas.
- `npm run build:config`: Sincroniza y compila la configuración del backend hacia `frontend/js/config.js`.
- `npm run generate:schema`: Reconstruye el archivo `database/schema.sql` a partir del catálogo maestro.

---

## 👨‍💻 Directrices para Futuros Desarrolladores

1. **Integridad Documental**: Mantener la convención de bloques JSDoc estandarizados en todos los módulos nuevos de `backend/` y `frontend/`.
2. **Cifrado de Campos Sensibles**: Al agregar nuevos atributos a la entidad usuario que contengan información personal o financiera, deben incorporarse en los helpers `encryptFields` y `decryptFields` de `backend/utils/security.js`.
3. **Persistencia de Contingencia**: Cualquier endpoint nuevo conmutado a la base de datos debe contemplar su correspondiente fallback en `backend/data/fallbackData.js` para asegurar tolerancia a fallos.
4. **Respeto a los Tokens de Diseño**: Al diseñar interfaces adicionales, utilizar siempre las variables CSS nativas (`--brand-red`, `--surface-dark`, `--text-primary`, `--radius-lg`, etc.) declaradas en `frontend/css/styles.css`.
