# 🥩 Danillanos - Tienda de Cárnicos y Congelados

Plataforma web e-commerce moderna para **Danillanos**, diseñada con paleta en tonos negros y grises oscuros y el rojo representativo `#e01a2c`, acompañada de un backend en **Node.js + Express** preparado para conectarse con **MySQL**.

---

## 📁 Estructura del Proyecto

- [`frontend/index.html`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/frontend/index.html): Maquetación semántica del Header, Hero Carrusel de 6 segundos, Productos Más Vendidos, Drawer del Carrito y Modal de Perfil.
- [`frontend/css/styles.css`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/frontend/css/styles.css): Sistema de diseño con variables CSS (`#e01a2c`, tonos oscuros por defecto, modo claro, animaciones de hover, bordes redondeados y resalte gris claro en dropdowns).
- [`frontend/js/config.js`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/frontend/js/config.js): Archivo centralizado para reemplazar fácilmente el logo, datos del usuario y placeholders de imágenes/productos.
- [`frontend/js/app.js`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/frontend/js/app.js): Lógica modular del carrusel, barra de progreso superior de 6 segundos, búsqueda expandible, carrito animado y sincronización con la API MySQL.
- [`backend/server.js`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/backend/server.js): Servidor Express principal.
- [`backend/config/db.js`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/backend/config/db.js): Pool de conexiones MySQL (`mysql2/promise`).
- [`backend/routes/api.js`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/backend/routes/api.js): Endpoints REST (`/api/carrusel`, `/api/productos`, `/api/categorias`, `/api/pedidos`, `/api/health`).
- [`database/schema.sql`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/database/schema.sql): Script SQL completo para crear la base de datos `danillanos_db`, tablas relacionales y datos semilla.

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Vista rápida inmediata (Sin instalar nada)
Puedes abrir directamente [`frontend/index.html`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/frontend/index.html) en cualquier navegador. Funcionará al 100% usando los datos de [`frontend/js/config.js`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/frontend/js/config.js).

### 2. Ejecutar con Backend Node.js + MySQL
1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Inicializa automáticamente la base de datos MySQL con tu `.env` (sea local o en la nube como Aiven Cloud):
   ```bash
   node run-schema.js
   # o también:
   npm run db:init
   ```
   *(Este script lee el `.env`, detecta si se requiere SSL, ejecuta `database/schema.sql`, crea las tablas y carga los datos semilla).*

3. Inicia el servidor:
   ```bash
   npm start
   ```
4. Abre `http://localhost:3000` en tu navegador.

---

## 🎨 Cómo Personalizar Elementos Fácilmente

1. **Cambiar el texto `DANILLANOS` por el Logo en imagen**:
   - Abre [`frontend/js/config.js`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/frontend/js/config.js) y cambia `logoUrl: null` por la ruta de tu logo, por ejemplo: `logoUrl: 'assets/logo-danillanos.png'`.
2. **Cambiar las imágenes y textos del Carrusel o Productos**:
   - Si usas MySQL: edita las tablas `carrusel_promociones` y `productos` en `danillanos_db`.
   - Si usas modo estático: edita los arreglos `carouselSlides` y `products` en [`frontend/js/config.js`](file:///c:/Users/juanf/Documents/Danillanos%20BD%20Proyecto/frontend/js/config.js).
