/**
 * ============================================================================
 * LÓGICA INTEGRAL MULTI-PÁGINA DANILLANOS
 * - index.html  (Tienda + Menú Hamburger + Buscador Móvil Siempre Abierto + Cantidades Masivas)
 * - perfil.html (Registro Completo Encriptado + Mapa Pin Exacto + Línea 4 Pasos + Soporte con Fotos)
 * - pagos.html  (Pasarela de Pagos + Estimado de Entrega al Pagar + Bloqueo sin Sesión)
 * - panel.html  (Panel con Menú Colapsable + Gráficas Pastel/Barras + Ruta Google Maps/Waze + Paradas Colapsables)
 * ============================================================================
 */

(function () {
  'use strict';

  const CONFIG = window.DANILLANOS_CONFIG;
  const CURRENT_PAGE = document.body.getAttribute('data-page') || 'store';

    // Limpieza proactiva de cuentas semilla obsoletas (dejar solo 1 cuenta de administrador)
  try {
    const legacyEmails = [
      'cliente@danillanos.com',
      'empleado@danillanos.com',
      'entregador@danillanos.com',
      'entregador2@danillanos.com',
      'soporte@danillanos.com'
    ];
    const rawStoredU =
      sessionStorage.getItem('danillanos_user') ||
      localStorage.getItem('danillanos_user');
    if (rawStoredU) {
      const uObj = JSON.parse(rawStoredU);
      if (uObj && legacyEmails.includes(uObj.email)) {
        sessionStorage.removeItem('danillanos_token');
        sessionStorage.removeItem('danillanos_user');
        localStorage.removeItem('danillanos_token');
        localStorage.removeItem('danillanos_user');
        localStorage.removeItem('danillanos_users_store');
        localStorage.removeItem('danillanos_tickets_store');
        localStorage.removeItem('danillanos_orders_overrides');
      }
    }
  } catch (_) {}

  const state = {
    theme: localStorage.getItem('danillanos_theme') || 'dark',
    token:
      sessionStorage.getItem('danillanos_token') ||
      localStorage.getItem('danillanos_token') ||
      null,
    user: JSON.parse(
      sessionStorage.getItem('danillanos_user') ||
        localStorage.getItem('danillanos_user') ||
        'null'
    ),
    direcciones: JSON.parse(
      sessionStorage.getItem('danillanos_dirs') ||
        localStorage.getItem('danillanos_dirs') ||
        '[]'
    ),
    selectedAddressId:
      Number(
        sessionStorage.getItem('danillanos_selected_addr_id') ||
          localStorage.getItem('danillanos_selected_addr_id') ||
          '0'
      ) || null,
    cartQuickAddrOpen: false,
    slides: [...CONFIG.carouselSlides],
    products: [...CONFIG.products],
    filteredCategory: 'mas_vendidos',
    visibleProductsLimit: 24,
    searchQuery: '',
    cart: JSON.parse(localStorage.getItem('danillanos_cart') || '[]'),
    selectedPayMethod: 'bancolombia',
    staffOrders: [],
    staffTickets: [],
    activeStaffTab: 'empleado',
    driverPhotosDraft: {},
    driverExpandedOrderIds: null, // Set de IDs de paradas abiertas; por defecto solo la parada #1 actual
    customerExpandedOrderIds: null, // Set de IDs de pedidos del cliente desplegados
    activeProfileTab: 'pedidos',
    customerTickets: [],
    customerExpandedTicketIds: new Set(),
    custChatDrafts: {},
    staffChatDrafts: {},
    expandedStaffTickets: new Set(),
    staffDrivers: [],
    staffUsers: [],
    adminCatalogQuery: '',
    serverApiV3: false,
    staffHistoryExpandedIds: new Set(),
    custCancelOpenId: null,
    checkoutWizardStep: 1,
    invoiceRedirectTimer: null,
    supportCustomerImageDraft: null,
    carousel: {
      currentIndex: 0,
      durationMs: CONFIG.api.carouselIntervalMs || 6000,
      elapsedMs: 0,
      lastFrameTime: null,
      rafId: null
    },
    maps: {
      addressMap: null,
      addressMarker: null,
      driverMap: null,
      driverLayerGroup: null
    }
  };

  // ==========================================================================
  // UTILIDADES GENERALES Y GEOMETRÍA HAVERSINE
  // ==========================================================================
  function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  }

  function showToast() {
    // Notificaciones laterales flotantes desactivadas para no superponerse a la interfaz
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function isInsideVillavicencio(lat, lng) {
    const center = CONFIG.map.villavicencioCenter;
    const radiusKm = (CONFIG.map.villavicencioRadiusMeters || 9500) / 1000;
    return haversineKm(center.lat, center.lng, Number(lat), Number(lng)) <= radiusKm;
  }

  function normalizeRole(roleVal) {
    const r = String(roleVal || '').trim().toLowerCase();
    if (['empleado', 'empleado_general', 'bodega'].includes(r)) return 'empleado';
    if (['entregador', 'repartidor', 'domiciliario'].includes(r)) return 'entregador';
    if (['soporte', 'atencion', 'asistente'].includes(r)) return 'soporte';
    if (['admin', 'administrador'].includes(r)) return 'admin';
    return r || 'cliente';
  }

  function syncCurrentUserRoleFromLocalStore() {
    if (!state.user) return;
    try {
      const raw = localStorage.getItem('danillanos_users_store');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const match = list.find(
            (u) =>
              (u.email &&
                state.user.email &&
                u.email.toLowerCase() === state.user.email.toLowerCase()) ||
              (u.id && state.user.id && Number(u.id) === Number(state.user.id))
          );
          if (match && match.rol) {
            state.user.rol = normalizeRole(match.rol);
          }
        }
      }
    } catch (_) {}
    state.user.rol = normalizeRole(state.user.rol);
  }

  function getAuthHeaders() {
    syncCurrentUserRoleFromLocalStore();
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (state.user && state.user.rol) {
      headers['X-User-Role'] = normalizeRole(state.user.rol);
    }
    return headers;
  }

  function isStaffUser(user = state.user) {
    if (!user) return false;
    const rol = normalizeRole(user.rol);
    return ['empleado', 'entregador', 'soporte', 'admin'].includes(rol);
  }

  function syncSelectedAddressDefault() {
    if (!state.direcciones || state.direcciones.length === 0) {
      state.selectedAddressId = null;
      sessionStorage.removeItem('danillanos_selected_addr_id');
      localStorage.removeItem('danillanos_selected_addr_id');
      return;
    }
    const exists = state.direcciones.some((d) => Number(d.id) === Number(state.selectedAddressId));
    if (!exists) {
      state.selectedAddressId = state.direcciones[0].id;
      sessionStorage.setItem('danillanos_selected_addr_id', String(state.selectedAddressId));
      localStorage.setItem('danillanos_selected_addr_id', String(state.selectedAddressId));
    }
  }

  function setSession(token, user, direcciones = []) {
    const normalizedUser = user ? { ...user, rol: normalizeRole(user.rol) } : null;
    state.token = token;
    state.user = normalizedUser;
    state.direcciones = direcciones || [];
    syncSelectedAddressDefault();

    if (token && normalizedUser) {
      sessionStorage.setItem('danillanos_token', token);
      sessionStorage.setItem('danillanos_user', JSON.stringify(normalizedUser));
      sessionStorage.setItem('danillanos_dirs', JSON.stringify(state.direcciones));
      localStorage.setItem('danillanos_token', token);
      localStorage.setItem('danillanos_user', JSON.stringify(normalizedUser));
      localStorage.setItem('danillanos_dirs', JSON.stringify(state.direcciones));
    } else {
      sessionStorage.removeItem('danillanos_token');
      sessionStorage.removeItem('danillanos_user');
      sessionStorage.removeItem('danillanos_dirs');
      sessionStorage.removeItem('danillanos_selected_addr_id');
      localStorage.removeItem('danillanos_token');
      localStorage.removeItem('danillanos_user');
      localStorage.removeItem('danillanos_dirs');
      localStorage.removeItem('danillanos_selected_addr_id');
    }
    renderSharedHeaderAuthUI();
    renderMobileHamburgerMenuContent();
    renderCartLiveAddressManager();
  }

  // ==========================================================================
  // 1. HEADER COMPARTIDO, MENÚ HAMBURGER MÓVIL, TEMA B&N Y BUSCADOR DOBLE
  // ==========================================================================
  function initSharedHeaderAndTheme() {
    syncSelectedAddressDefault();

    const htmlEl = document.documentElement;
    htmlEl.setAttribute('data-theme', state.theme);

    const brandLink = document.getElementById('brandLink');
    if (brandLink && CONFIG.brand.logoUrl) {
      brandLink.innerHTML = `<img src="${CONFIG.brand.logoUrl}" alt="${CONFIG.brand.name}" class="brand-logo-img" />`;
    }

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        htmlEl.setAttribute('data-theme', state.theme);
        localStorage.setItem('danillanos_theme', state.theme);
        showToast(
          state.theme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado',
          state.theme === 'dark' ? 'dark_mode' : 'light_mode'
        );
      });
    }

    renderSharedHeaderAuthUI();
    initMobileHamburgerDrawer();
    enhanceAllCustomSelects();
    initAutocompleteSearchBar();
    initSharedCartDrawer();
  }

  function initMobileHamburgerDrawer() {
    const openBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('mobileMenuCloseBtn');
    const drawer = document.getElementById('mobileNavDrawer');
    const backdrop = document.getElementById('mobileNavBackdrop');

    function closeMobileMenu() {
      drawer?.classList.remove('is-open');
      backdrop?.classList.remove('is-open');
    }

    openBtn?.addEventListener('click', () => {
      renderMobileHamburgerMenuContent();
      drawer?.classList.add('is-open');
      backdrop?.classList.add('is-open');
    });

    closeBtn?.addEventListener('click', closeMobileMenu);
    backdrop?.addEventListener('click', closeMobileMenu);

    document.getElementById('mobileNavBody')?.addEventListener('click', (e) => {
      const catLink = e.target.closest('[data-mobile-cat]');
      if (catLink && CURRENT_PAGE === 'store') {
        e.preventDefault();
        const slug = catLink.getAttribute('data-mobile-cat');
        setStoreCategoryFilter(slug);
        closeMobileMenu();
        document.getElementById('catalogo-tienda')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      const logoutBtn = e.target.closest('#mobileDrawerLogoutBtn');
      if (logoutBtn) {
        attemptUserLogout(() => {
          setSession(null, null, []);
          closeMobileMenu();
          showToast('Sesión cerrada correctamente', 'logout');
          if (CURRENT_PAGE === 'panel' || CURRENT_PAGE === 'pagos') {
            window.location.href = 'index.html';
          } else if (CURRENT_PAGE === 'perfil') {
            renderPerfilPageAuthState();
          }
        });
        return;
      }

      if (e.target.closest('a')) {
        closeMobileMenu();
      }
    });

    renderMobileHamburgerMenuContent();
  }

  function renderMobileHamburgerMenuContent() {
    const navBody = document.getElementById('mobileNavBody');
    if (!navBody) return;

    const authLinks = !state.user
      ? `
        <div class="mobile-nav-section-title">Cuenta de Cliente</div>
        <a href="perfil.html#cuenta-section" class="mobile-nav-link">
          <span class="material-symbols-rounded">login</span>
          <span>Iniciar Sesión / Crear Cuenta</span>
        </a>
      `
      : `
        <div class="mobile-nav-section-title">Hola, ${state.user.nombre_completo}</div>
        ${
          isStaffUser()
            ? `<a href="panel.html" class="mobile-nav-link">
                 <span class="material-symbols-rounded">dashboard_customize</span>
                 <span>Panel Operativo (${state.user.rol.toUpperCase()})</span>
               </a>`
            : ''
        }
        <a href="perfil.html#cuenta-section" class="mobile-nav-link">
          <span class="material-symbols-rounded">badge</span>
          <span>Mi Perfil Encriptado</span>
        </a>
        <a href="perfil.html#direcciones-mapa-section" class="mobile-nav-link">
          <span class="material-symbols-rounded">pin_drop</span>
          <span>Mis Direcciones (${state.direcciones.length}/5)</span>
        </a>
        <a href="perfil.html#mis-pedidos-section" class="mobile-nav-link">
          <span class="material-symbols-rounded">local_shipping</span>
          <span>Mis Pedidos en Progreso e Historial</span>
        </a>
        <a href="pagos.html" class="mobile-nav-link">
          <span class="material-symbols-rounded">shopping_cart_checkout</span>
          <span>Ir a la Pasarela de Pagos</span>
        </a>
        <button type="button" class="mobile-nav-link" id="mobileDrawerLogoutBtn">
          <span class="material-symbols-rounded">logout</span>
          <span>Cerrar Sesión</span>
        </button>
      `;

    navBody.innerHTML = `
      ${authLinks}
      <div class="mobile-nav-section-title">Navegación Principal</div>
      <a href="index.html" class="mobile-nav-link">
        <span class="material-symbols-rounded">storefront</span>
        <span>Inicio y Promociones</span>
      </a>
      <a href="perfil.html#soporte-cliente" class="mobile-nav-link">
        <span class="material-symbols-rounded">support_agent</span>
        <span>Soporte (Enviar Solicitud / Fotos)</span>
      </a>
      <div class="mobile-nav-section-title">Catálogo por Línea (235 Productos)</div>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="todos">
        <span class="material-symbols-rounded">apps</span>
        <span>Todo el Catálogo (235)</span>
      </a>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="embutidos">
        <span class="material-symbols-rounded">kebab_dining</span>
        <span>Cárnicos y Embutidos</span>
      </a>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="congelados">
        <span class="material-symbols-rounded">ac_unit</span>
        <span>Papas Francesas y Congelados</span>
      </a>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="pulpas">
        <span class="material-symbols-rounded">local_drink</span>
        <span>Pulpas de Fruta y Limonadas</span>
      </a>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="salsas">
        <span class="material-symbols-rounded">soup_kitchen</span>
        <span>Salsas Río Grande, Salsabor y Alimentek</span>
      </a>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="pan">
        <span class="material-symbols-rounded">bakery_dining</span>
        <span>Línea de Panes</span>
      </a>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="adobos">
        <span class="material-symbols-rounded">nutrition</span>
        <span>Adobos, Ají y Sazonadores</span>
      </a>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="desechables">
        <span class="material-symbols-rounded">takeout_dining</span>
        <span>Desechables e Icopores</span>
      </a>
      <a href="index.html#catalogo-tienda" class="mobile-nav-link" data-mobile-cat="secos">
        <span class="material-symbols-rounded">eco</span>
        <span>Don Maní y Dulcería</span>
      </a>
    `;
  }

  // ==========================================================================
  // GESTOR DE NOVEDADES Y PUNTOS ROJOS DE NOTIFICACIÓN MULTIFUNCIÓN
  // ==========================================================================
  const NOTIF_STORAGE_KEY = 'danillanos_seen_notifications_v2';

  function getSeenNotifications() {
    try {
      const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      seenTicketsClient: {},
      seenTicketsStaff: {},
      seenOrderStatuses: {},
      seenEmployeeOrders: [],
      seenDriverOrders: []
    };
  }

  function saveSeenNotifications(seen) {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(seen));
    } catch (_) {}
  }

  function renderStaffNav() {
    if (typeof renderStaffSidebar === 'function') {
      try { renderStaffSidebar(); } catch (_) {}
    }
  }

  function formatTicketStatus(estado) {
    const s = String(estado || '').trim().toLowerCase();
    if (s === 'en_revision') return 'En Revisión';
    if (s === 'en_proceso') return 'En Proceso';
    if (s === 'en_camino') return 'En Ruta';
    if (s === 'resuelto') return 'Resuelto';
    if (s === 'abierto') return 'Abierto';
    if (s === 'pendiente') return 'Pendiente';
    return s.replace(/_/g, ' ').toUpperCase();
  }

  function getTicketStatusClass(estado) {
    const s = String(estado || '').trim().toLowerCase();
    if (s === 'resuelto') return 'status-entregado';
    if (s === 'en_revision' || s === 'en_proceso' || s === 'en_camino') return 'status-en_proceso';
    return 'status-pendiente';
  }

  function markTicketSeenByClient(ticketId, messages) {
    const seen = getSeenNotifications();
    if (!seen.seenTicketsClient) seen.seenTicketsClient = {};
    const msgs = Array.isArray(messages) ? messages : [];
    let maxId = 0;
    msgs.forEach((m) => {
      const mId = Number(m.id || 0);
      if (mId > maxId) maxId = mId;
    });
    seen.seenTicketsClient[ticketId] = maxId || Date.now();
    saveSeenNotifications(seen);
    syncUserNotificationDots();
  }

  function markTicketSeenByStaff(ticketId, messages) {
    const seen = getSeenNotifications();
    if (!seen.seenTicketsStaff) seen.seenTicketsStaff = {};
    const msgs = Array.isArray(messages) ? messages : [];
    let maxId = 0;
    msgs.forEach((m) => {
      const mId = Number(m.id || 0);
      if (mId > maxId) maxId = mId;
    });
    seen.seenTicketsStaff[ticketId] = maxId || Date.now();
    saveSeenNotifications(seen);
    syncUserNotificationDots();
    renderStaffNav();
  }

  function markOrderStatusSeen(orderId, currentStatus) {
    const seen = getSeenNotifications();
    if (!seen.seenOrderStatuses) seen.seenOrderStatuses = {};
    seen.seenOrderStatuses[orderId] = currentStatus || 'visto';
    saveSeenNotifications(seen);
    syncUserNotificationDots();
  }

  function markEmployeeOrderSeen(orderId) {
    const seen = getSeenNotifications();
    if (!Array.isArray(seen.seenEmployeeOrders)) seen.seenEmployeeOrders = [];
    if (!seen.seenEmployeeOrders.includes(Number(orderId))) {
      seen.seenEmployeeOrders.push(Number(orderId));
      saveSeenNotifications(seen);
      syncUserNotificationDots();
      renderStaffNav();
    }
  }

  function markDriverOrderSeen(orderId) {
    const seen = getSeenNotifications();
    if (!Array.isArray(seen.seenDriverOrders)) seen.seenDriverOrders = [];
    if (!seen.seenDriverOrders.includes(Number(orderId))) {
      seen.seenDriverOrders.push(Number(orderId));
      saveSeenNotifications(seen);
      syncUserNotificationDots();
      renderStaffNav();
    }
  }

  function hasTicketUnreadForClient(tk) {
    if (!tk) return false;
    const seen = getSeenNotifications();
    const lastSeen = Number((seen.seenTicketsClient && seen.seenTicketsClient[tk.id]) || 0);
    const msgs = Array.isArray(tk.mensajes) ? tk.mensajes : [];
    return msgs.some((m) => {
      const isStaffMsg = m.rol === 'soporte' || m.rol === 'admin';
      const mId = Number(m.id || 0);
      return isStaffMsg && (!lastSeen || mId > lastSeen);
    });
  }

  function hasTicketUnreadForStaff(tk) {
    if (!tk) return false;
    const seen = getSeenNotifications();
    const lastSeen = Number((seen.seenTicketsStaff && seen.seenTicketsStaff[tk.id]) || 0);
    const msgs = Array.isArray(tk.mensajes) ? tk.mensajes : [];
    return msgs.some((m) => {
      const isClientMsg = m.rol === 'cliente';
      const mId = Number(m.id || 0);
      return isClientMsg && (!lastSeen || mId > lastSeen);
    });
  }

  function hasEmployeeOrderNovelty(ord) {
    if (!ord) return false;
    const seen = getSeenNotifications();
    const seenEmp = Array.isArray(seen.seenEmployeeOrders) ? seen.seenEmployeeOrders : [];
    return ord.estado === 'pendiente' && !seenEmp.includes(Number(ord.id));
  }

  function hasDriverOrderNovelty(ord) {
    if (!ord) return false;
    const seen = getSeenNotifications();
    const seenDrv = Array.isArray(seen.seenDriverOrders) ? seen.seenDriverOrders : [];
    const myId = state.user?.id ? Number(state.user.id) : null;
    const myName = (state.user?.nombre_completo || '').toLowerCase();
    const isAssigned =
      (myId && Number(ord.entregador_id) === myId) ||
      (myName && (ord.entregador_nombre || '').toLowerCase().includes(myName));
    const isActiveRoute = ['en_camino', 'en_proceso'].includes(ord.estado);
    return isAssigned && isActiveRoute && !seenDrv.includes(Number(ord.id));
  }

  function hasCustomerOrderNovelty(ord) {
    if (!ord) return false;
    const seen = getSeenNotifications();
    const seenStatuses = seen.seenOrderStatuses || {};
    const lastSeenState = seenStatuses[ord.id];
    if (!lastSeenState) {
      return true;
    }
    return lastSeenState !== ord.estado;
  }

  function hasUnreadEmployeeOrders() {
    const seen = getSeenNotifications();
    const seenEmp = Array.isArray(seen.seenEmployeeOrders) ? seen.seenEmployeeOrders : [];
    const orders = state.staffOrders || [];
    return orders.some((o) => o.estado === 'pendiente' && !seenEmp.includes(Number(o.id)));
  }

  function hasUnreadDriverOrders() {
    const seen = getSeenNotifications();
    const seenDrv = Array.isArray(seen.seenDriverOrders) ? seen.seenDriverOrders : [];
    const orders = state.staffOrders || [];
    const myId = state.user?.id ? Number(state.user.id) : null;
    const myName = (state.user?.nombre_completo || '').toLowerCase();

    return orders.some((o) => {
      const isAssigned =
        (myId && Number(o.entregador_id) === myId) ||
        (myName && (o.entregador_nombre || '').toLowerCase().includes(myName));
      const isActiveRoute = ['en_camino', 'en_proceso'].includes(o.estado);
      return isAssigned && isActiveRoute && !seenDrv.includes(Number(o.id));
    });
  }

  function hasUnreadStaffTickets() {
    const tickets = state.staffTickets || [];
    return tickets.some((tk) => hasTicketUnreadForStaff(tk));
  }

  function syncUserNotificationDots() {
    const statusDot = document.getElementById('userStatusDot');
    const tabPedidosDot = document.getElementById('tabPedidosDot');
    const tabSoporteDot = document.getElementById('tabSoporteDot');

    if (!state.user) {
      if (statusDot) {
        statusDot.classList.add('hidden');
        statusDot.classList.remove('has-notification-red');
      }
      tabPedidosDot?.classList.add('hidden');
      tabSoporteDot?.classList.add('hidden');
      return;
    }

    const role = normalizeRole(state.user.rol);
    let hasNotification = false;
    let notifTitle = '';

    if (role === 'cliente') {
      const customerOrders = state.customerOrders || [];
      const customerTickets = state.customerTickets || [];

      // Novedades en pedidos (cambio de estado o entrega)
      const orderNovelties = customerOrders.filter((o) => hasCustomerOrderNovelty(o));
      // Mensajes de ticket no leídos
      const ticketNovelties = customerTickets.filter((t) => hasTicketUnreadForClient(t));

      const hasOrdersNotif = orderNovelties.length > 0;
      const hasTicketsNotif = ticketNovelties.length > 0;
      hasNotification = hasOrdersNotif || hasTicketsNotif;

      if (tabPedidosDot) {
        tabPedidosDot.classList.toggle('hidden', !hasOrdersNotif);
      }
      if (tabSoporteDot) {
        tabSoporteDot.classList.toggle('hidden', !hasTicketsNotif);
      }

      if (hasOrdersNotif && hasTicketsNotif) {
        notifTitle = 'Tienes novedades en tus pedidos y respuestas nuevas de soporte';
      } else if (hasOrdersNotif) {
        notifTitle = `Novedad: Tienes ${orderNovelties.length} actualización(es) en tus despachos`;
      } else if (hasTicketsNotif) {
        notifTitle = `Novedad: Tienes ${ticketNovelties.length} respuesta(s) nueva(s) en tus tickets de soporte`;
      }
    } else if (role === 'empleado') {
      const hasPendingNew = hasUnreadEmployeeOrders();
      hasNotification = hasPendingNew;
      if (hasPendingNew) notifTitle = 'Novedad: Hay nuevos pedidos en bodega por confirmar';
    } else if (role === 'entregador') {
      const hasAssigned = hasUnreadDriverOrders();
      hasNotification = hasAssigned;
      if (hasAssigned) notifTitle = 'Novedad: Tienes nuevos pedidos asignados a tu ruta';
    } else if (role === 'soporte') {
      const hasTickets = hasUnreadStaffTickets();
      hasNotification = hasTickets;
      if (hasTickets) notifTitle = 'Novedad: Tienes nuevos mensajes de clientes en tickets de soporte';
    } else if (role === 'admin') {
      const hasPendingNew = hasUnreadEmployeeOrders();
      const hasAssigned = hasUnreadDriverOrders();
      const hasTickets = hasUnreadStaffTickets();
      hasNotification = hasPendingNew || hasAssigned || hasTickets;
      if (hasNotification) notifTitle = 'Novedades operativas en el panel de control';
    }

    if (statusDot) {
      if (hasNotification) {
        statusDot.classList.remove('hidden');
        statusDot.classList.add('has-notification-red');
        statusDot.title = notifTitle;
      } else {
        statusDot.classList.add('hidden');
        statusDot.classList.remove('has-notification-red');
        statusDot.title = '';
      }
    }
  }

  function renderSharedHeaderAuthUI() {
    const avatarBtn = document.getElementById('userAvatarBtn');
    const avatarImg = document.getElementById('userAvatarImg');
    const guestIcon = document.getElementById('guestAvatarIcon');
    const avatarInitial = document.getElementById('userAvatarInitial');
    const statusDot = document.getElementById('userStatusDot');
    const profileMenu = document.getElementById('profileDropdownMenu');

    if (avatarBtn) {
      if (!state.user) {
        avatarBtn.classList.add('is-guest');
        avatarBtn.setAttribute('href', 'perfil.html#cuenta-section');
        avatarBtn.title = 'Modo visitante sin sesión (Ir a Iniciar Sesión)';
        if (guestIcon) guestIcon.classList.remove('hidden');
        if (avatarInitial) avatarInitial.classList.add('hidden');
        if (avatarImg) avatarImg.classList.add('hidden');
        syncUserNotificationDots();
      } else {
        const displayName = (state.user.nombre_completo || state.user.username || 'U').trim();
        const initial = displayName.charAt(0).toUpperCase();
        avatarBtn.classList.remove('is-guest');
        avatarBtn.setAttribute('href', isStaffUser() ? 'panel.html' : 'perfil.html');
        avatarBtn.title = `Cuenta activa: ${state.user.nombre_completo}`;
        if (guestIcon) guestIcon.classList.add('hidden');
        syncUserNotificationDots();

        if (state.user.avatar_url && avatarImg && !state.user.avatar_url.includes('test-avatar-photo')) {
          avatarImg.src = state.user.avatar_url;
          avatarImg.classList.remove('hidden');
          avatarImg.onerror = () => {
            avatarImg.classList.add('hidden');
            if (avatarInitial) {
              avatarInitial.textContent = initial;
              avatarInitial.classList.remove('hidden');
            }
          };
          if (avatarInitial) avatarInitial.classList.add('hidden');
        } else if (avatarInitial) {
          if (avatarImg) avatarImg.classList.add('hidden');
          avatarInitial.textContent = initial;
          avatarInitial.classList.remove('hidden');
        }
      }
    }

    if (profileMenu) {
      // Si NO ha iniciado sesión, el usuario NO puede hacer pedido ni ver direcciones ni pedidos en progreso
      if (!state.user) {
        profileMenu.innerHTML = `
          <div class="dropdown-header-label">Modo Visitante (Sin Sesión)</div>
          <a href="perfil.html#cuenta-section" class="dropdown-item">
            <span class="material-symbols-rounded dropdown-item-icon">login</span>
            <div class="dropdown-item-content">
              <span class="dropdown-item-title">Iniciar Sesión / Crear Cuenta</span>
              <span class="dropdown-item-desc">Requerido para hacer pedidos y ver direcciones</span>
            </div>
          </a>
          <a href="perfil.html#soporte-cliente" class="dropdown-item">
            <span class="material-symbols-rounded dropdown-item-icon">support_agent</span>
            <div class="dropdown-item-content">
              <span class="dropdown-item-title">Centro de Soporte</span>
              <span class="dropdown-item-desc">Consultas y envío de fotos de evidencia</span>
            </div>
          </a>
        `;
      } else {
        const staffLink = isStaffUser()
          ? `
            <a href="panel.html" class="dropdown-item">
              <span class="material-symbols-rounded dropdown-item-icon">dashboard_customize</span>
              <div class="dropdown-item-content">
                <span class="dropdown-item-title">Panel de Control (${state.user.rol.toUpperCase()})</span>
                <span class="dropdown-item-desc">Abrir página de operaciones</span>
              </div>
            </a>
          `
          : '';

        profileMenu.innerHTML = `
          <div class="dropdown-header-label">${state.user.nombre_completo}</div>
          ${staffLink}
          <a href="perfil.html#cuenta-section" class="dropdown-item">
            <span class="material-symbols-rounded dropdown-item-icon">badge</span>
            <div class="dropdown-item-content">
              <span class="dropdown-item-title">Mi Perfil y Cuenta</span>
              <span class="dropdown-item-desc">Información y seguridad de tu cuenta</span>
            </div>
          </a>
          <a href="perfil.html#direcciones-mapa-section" class="dropdown-item">
            <span class="material-symbols-rounded dropdown-item-icon">add_location_alt</span>
            <div class="dropdown-item-content">
              <span class="dropdown-item-title">Mis Direcciones (${state.direcciones.length}/5)</span>
              <span class="dropdown-item-desc">Gestión de direcciones y entregas</span>
            </div>
          </a>
          <a href="perfil.html#mis-pedidos-section" class="dropdown-item">
            <span class="material-symbols-rounded dropdown-item-icon">local_shipping</span>
            <div class="dropdown-item-content">
              <span class="dropdown-item-title">Mis Pedidos en Progreso</span>
              <span class="dropdown-item-desc">Seguimiento de pedidos en tiempo real</span>
            </div>
          </a>
          <button type="button" class="dropdown-item" id="headerLogoutBtn">
            <span class="material-symbols-rounded dropdown-item-icon">logout</span>
            <div class="dropdown-item-content">
              <span class="dropdown-item-title">Cerrar Sesión</span>
              <span class="dropdown-item-desc">Cerrar sesión de forma segura</span>
            </div>
          </button>
        `;

        const logoutBtn = document.getElementById('headerLogoutBtn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', () => {
            attemptUserLogout(() => {
              setSession(null, null, []);
              showToast('Sesión cerrada correctamente', 'logout');
              if (CURRENT_PAGE === 'panel' || CURRENT_PAGE === 'pagos') {
                window.location.href = 'index.html';
              } else if (CURRENT_PAGE === 'perfil') {
                renderPerfilPageAuthState();
              }
            });
          });
        }
      }
    }
  }

  /**
   * Conecta tanto la barra de búsqueda de escritorio (#searchInput) como la barra
   * de celular siempre abierta (#mobileSearchInput) con autocompletado desde 1 letra.
   */
  function initAutocompleteSearchBar() {
    function wireSearchInputPair(inputId, dropdownId, containerId, clearBtnId, submitBtnId) {
      const searchInput = document.getElementById(inputId);
      const dropdown = document.getElementById(dropdownId);
      const searchContainer = containerId ? document.getElementById(containerId) : null;
      const clearBtn = clearBtnId ? document.getElementById(clearBtnId) : null;
      const submitBtn = submitBtnId ? document.getElementById(submitBtnId) : null;

      if (!searchInput || !dropdown) return;

      function renderSuggestions(rawQuery) {
        const q = rawQuery.trim().toLowerCase();
        if (q.length < 1) {
          dropdown.classList.add('hidden');
          dropdown.innerHTML = '';
          return;
        }

        const startsWith = [];
        const contains = [];
        state.products.forEach((p) => {
          const nameLower = p.nombre.toLowerCase();
          const catLower = (p.categoria_nombre || '').toLowerCase();
          if (nameLower.startsWith(q)) startsWith.push(p);
          else if (nameLower.includes(q) || catLower.includes(q)) contains.push(p);
        });

        const matches = [...startsWith, ...contains].slice(0, 7);

        if (matches.length === 0) {
          dropdown.innerHTML = `
            <div class="autocomplete-header">
              <span>Sin coincidencias para "${rawQuery}"</span>
            </div>
          `;
          dropdown.classList.remove('hidden');
          return;
        }

        dropdown.innerHTML = `
          <div class="autocomplete-header">
            <span>Sugerencias (${startsWith.length + contains.length} encontrados)</span>
            <span>Cant. Manual</span>
          </div>
          ${matches
            .map(
              (item) => `
            <div class="autocomplete-item" role="option">
              <div class="autocomplete-item-left" data-autocomplete-select="${item.nombre}">
                <img src="${item.imagen_url}" alt="${item.nombre}" class="autocomplete-thumb" />
                <div class="autocomplete-info">
                  <div class="autocomplete-title">${item.nombre}</div>
                  <div class="autocomplete-meta">${item.categoria_nombre} • <strong>${formatCurrency(item.precio)}</strong></div>
                </div>
              </div>
              <div class="autocomplete-actions">
                <input
                  type="number"
                  min="1"
                  max="99999"
                  value="1"
                  class="autocomplete-qty-input"
                  data-auto-qty-for="${item.id}"
                  title="Escribe cualquier cantidad (ej: 100, 700)"
                />
                <button type="button" class="autocomplete-add-btn" data-autocomplete-add="${item.id}">
                  + Añadir
                </button>
              </div>
            </div>
          `
            )
            .join('')}
        `;
        dropdown.classList.remove('hidden');
      }

      searchInput.addEventListener('search', () => {
        const val = searchInput.value || '';
        state.searchQuery = val;
        if (searchContainer) searchContainer.classList.toggle('has-value', val.trim().length > 0);
        renderSuggestions(val);
        if (CURRENT_PAGE === 'store') renderStoreProducts();
      });

      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        state.searchQuery = val;
        if (searchContainer) searchContainer.classList.toggle('has-value', val.trim().length > 0);
        // Sincronizar ambos inputs si existen
        const otherId = inputId === 'searchInput' ? 'mobileSearchInput' : 'searchInput';
        const otherEl = document.getElementById(otherId);
        if (otherEl && otherEl.value !== val) otherEl.value = val;

        renderSuggestions(val);
        if (CURRENT_PAGE === 'store') renderStoreProducts();
      });

      searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 1) {
          renderSuggestions(searchInput.value);
        }
      });

      clearBtn?.addEventListener('click', () => {
        state.searchQuery = '';
        searchInput.value = '';
        searchContainer?.classList.remove('has-value');
        dropdown.classList.add('hidden');
        if (CURRENT_PAGE === 'store') renderStoreProducts();
      });

      submitBtn?.addEventListener('click', () => {
        const val = searchInput.value.trim();
        dropdown.classList.add('hidden');
        if (CURRENT_PAGE === 'store') {
          state.searchQuery = val;
          renderStoreProducts();
          document.getElementById('catalogo-tienda')?.scrollIntoView({ behavior: 'smooth' });
        } else if (val) {
          window.location.href = `index.html?q=${encodeURIComponent(val)}#catalogo-tienda`;
        }
      });

      dropdown.addEventListener('click', (e) => {
        const addBtn = e.target.closest('[data-autocomplete-add]');
        if (addBtn) {
          const prodId = Number(addBtn.getAttribute('data-autocomplete-add'));
          const row = addBtn.closest('.autocomplete-item');
          const qtyInput = row ? row.querySelector(`[data-auto-qty-for="${prodId}"]`) : null;
          const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1', 10) || 1);
          const product = state.products.find((p) => Number(p.id) === prodId);
          if (product) addToCart(product, qty);
          return;
        }

        const selectLeft = e.target.closest('[data-autocomplete-select]');
        if (selectLeft) {
          const name = selectLeft.getAttribute('data-autocomplete-select');
          searchInput.value = name;
          state.searchQuery = name;
          dropdown.classList.add('hidden');
          if (CURRENT_PAGE === 'store') {
            renderStoreProducts();
            document.getElementById('catalogo-tienda')?.scrollIntoView({ behavior: 'smooth' });
          } else {
            window.location.href = `index.html?q=${encodeURIComponent(name)}#catalogo-tienda`;
          }
        }
      });
    }

    // Conectar buscador Desktop y buscador Móvil siempre abierto
    wireSearchInputPair('searchInput', 'searchAutocompleteDropdown', 'searchContainer', 'searchClearBtn', null);
    wireSearchInputPair('mobileSearchInput', 'mobileSearchAutocompleteDropdown', null, null, 'mobileSearchSubmitBtn');

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchWrapper') && !e.target.closest('#mobileSearchRow')) {
        document.getElementById('searchAutocompleteDropdown')?.classList.add('hidden');
        document.getElementById('mobileSearchAutocompleteDropdown')?.classList.add('hidden');
      }
    });
  }

  // ==========================================================================
  // 2. CARRITO DE COMPRAS + GESTIÓN Y CAMBIO DE DIRECCIONES EN VIVO DESDE EL CARRITO
  // ==========================================================================
  function triggerCartHeaderAnimation() {
    const cartBtn = document.getElementById('cartToggleBtn');
    if (!cartBtn) return;
    cartBtn.classList.remove('is-animating');
    void cartBtn.offsetWidth;
    cartBtn.classList.add('is-animating');
  }

  function addToCart(product, quantityToAdd = 1) {
    const cleanQty = Math.max(1, parseInt(quantityToAdd, 10) || 1);
    const existing = state.cart.find((item) => Number(item.id) === Number(product.id));
    if (existing) {
      existing.cantidad += cleanQty;
    } else {
      state.cart.push({
        id: product.id,
        nombre: product.nombre,
        precio: Number(product.precio),
        presentacion: product.presentacion,
        imagen_url: product.imagen_url,
        cantidad: cleanQty
      });
    }

    saveAndRenderCart();
    triggerCartHeaderAnimation();
    showToast(`Añadido: ${cleanQty} und. de ${product.nombre}`, 'shopping_cart_checkout');
  }

  function setCartItemExactQuantity(productId, newQuantity) {
    const idx = state.cart.findIndex((item) => Number(item.id) === Number(productId));
    if (idx === -1) return;
    const parsed = parseInt(newQuantity, 10);
    if (isNaN(parsed) || parsed <= 0) {
      state.cart.splice(idx, 1);
    } else {
      state.cart[idx].cantidad = Math.min(99999, parsed);
    }
    saveAndRenderCart();
    if (CURRENT_PAGE === 'pagos') renderCheckoutPageItems();
  }

  function getCartTotal() {
    return state.cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  }

  function getCartTotalUnits() {
    return state.cart.reduce((sum, item) => sum + item.cantidad, 0);
  }

  /**
   * Renderiza el selector y gestor de direcciones EN VIVO directamente dentro del Carrito.
   * Nota: Las direcciones aquí NO muestran fecha de entrega; el estimado solo se calcula al pagar.
   */
  function renderCartLiveAddressManager() {
    const box = document.getElementById('cartLiveAddressBox');
    const checkoutBtn = document.getElementById('btnGoToCheckoutPage');
    const checkoutText = document.getElementById('btnCheckoutText');
    if (!box) return;

    if (!state.user) {
      box.innerHTML = `
        <div class="cart-addr-header">
          <span><span class="material-symbols-rounded" style="font-size:0.95rem; vertical-align:middle;">lock</span> Sesión requerida para pedir</span>
        </div>
        <div style="font-size:0.77rem; color:var(--text-secondary);">
          Inicia sesión o crea tu cuenta para gestionar tus direcciones y realizar pedidos.
        </div>
      `;
    enhanceAllCustomSelects(box);
      if (checkoutBtn) checkoutBtn.setAttribute('href', 'perfil.html#cuenta-section');
      if (checkoutText) checkoutText.textContent = 'Iniciar Sesión para Hacer Pedido';
      return;
    }

    if (checkoutBtn) checkoutBtn.setAttribute('href', 'pagos.html');
    if (checkoutText) checkoutText.textContent = 'Continuar a la Página de Pagos';

    syncSelectedAddressDefault();
    const dirs = state.direcciones || [];

    const optionsHtml =
      dirs.length === 0
        ? `<option value="">Sin direcciones guardadas (Añade una aquí)</option>`
        : dirs
            .map(
              (d) =>
                `<option value="${d.id}" ${Number(d.id) === Number(state.selectedAddressId) ? 'selected' : ''}>
                  ${d.etiqueta} (${d.municipio}) — ${d.direccion}
                </option>`
            )
            .join('');

    box.innerHTML = `
      <div class="cart-addr-header">
        <span>📍 Dirección de entrega (${dirs.length}/5)</span>
        <a href="perfil.html#direcciones-mapa-section" style="color:var(--brand-red); font-size:0.73rem;">Abrir Mapa</a>
      </div>
      <div class="cart-addr-actions-row">
        <select class="cart-addr-select" id="cartLiveAddressSelect" aria-label="Cambiar dirección desde el carrito">
          ${optionsHtml}
        </select>
        <button type="button" class="cart-addr-mini-btn" id="btnCartToggleQuickAddr" title="Añadir nueva dirección desde el carrito">
          <span class="material-symbols-rounded" style="font-size:0.95rem;">add_location_alt</span>
          <span>+ Nueva</span>
        </button>
        ${
          dirs.length > 0
            ? `<button type="button" class="cart-addr-mini-btn" id="btnCartDeleteSelectedAddr" title="Eliminar dirección seleccionada">
                 <span class="material-symbols-rounded" style="font-size:0.95rem;">delete</span>
               </button>`
            : ''
        }
      </div>
      ${
        state.cartQuickAddrOpen
          ? `<div class="cart-quick-addr-form" id="cartQuickAddrForm">
               <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                 <input type="text" id="cartQuickLabel" class="cart-quick-input" placeholder="Etiqueta (Casa, Sede)" value="Sede" />
                 <input type="text" id="cartQuickMuni" class="cart-quick-input" placeholder="Municipio" value="Villavicencio" />
               </div>
               <input type="text" id="cartQuickStreet" class="cart-quick-input" placeholder="Dirección exacta (Ej: Calle 15 # 12-91)" />
               <div style="display:flex; justify-content:flex-end; gap:0.4rem;">
                 <button type="button" class="cart-addr-mini-btn" id="btnCartCancelQuickAddr">Cancelar</button>
                 <button type="button" class="cart-addr-mini-btn" id="btnCartSaveQuickAddr" style="background:var(--brand-red); color:#fff; border-color:var(--brand-red);">Guardar</button>
               </div>
             </div>`
          : ''
      }
    `;
  }

  function saveAndRenderCart() {
    localStorage.setItem('danillanos_cart', JSON.stringify(state.cart));
    const totalUnits = getCartTotalUnits();
    const subtotal = getCartTotal();

    const badge = document.getElementById('cartBadge');
    const subtotalEl = document.getElementById('cartSubtotalValue');
    const container = document.getElementById('cartItemsContainer');
    const checkoutBtn = document.getElementById('btnGoToCheckoutPage');
    const checkoutText = document.getElementById('checkoutBtnText');
    const isCartEmpty = !Array.isArray(state.cart) || state.cart.length === 0;

    if (checkoutBtn) {
      if (isCartEmpty) {
        checkoutBtn.classList.add('is-disabled');
        checkoutBtn.setAttribute('aria-disabled', 'true');
        checkoutBtn.removeAttribute('href');
        if (checkoutText) checkoutText.textContent = 'Carrito Vacío';
      } else {
        checkoutBtn.classList.remove('is-disabled');
        checkoutBtn.removeAttribute('aria-disabled');
        if (!state.user) {
          checkoutBtn.setAttribute('href', 'perfil.html#cuenta-section');
          if (checkoutText) checkoutText.textContent = 'Iniciar Sesión para Pagar';
        } else {
          checkoutBtn.setAttribute('href', 'pagos.html');
          if (checkoutText) checkoutText.textContent = 'Continuar a la Página de Pagos';
        }
      }
    }

    if (badge) badge.textContent = String(totalUnits);
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    renderCartLiveAddressManager();
    if (!container) return;

    if (state.cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-msg" style="text-align:center; padding:2rem 1rem; color:var(--text-secondary);">
          <span class="material-symbols-rounded" style="font-size: 3rem;">shopping_cart</span>
          <p style="margin-top:0.5rem;">Tu carrito está vacío. Añade productos desde el catálogo.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.cart
      .map(
        (item) => `
        <div class="cart-item">
          <img src="${item.imagen_url}" alt="${item.nombre}" class="cart-item-img" />
          <div class="cart-item-info">
            <div class="cart-item-name">${item.nombre}</div>
            <div class="cart-item-price">${formatCurrency(item.precio)} c/u • Subtotal: ${formatCurrency(item.precio * item.cantidad)}</div>
            <div class="cart-item-qty">
              <button type="button" class="qty-btn" data-cart-step-id="${item.id}" data-cart-delta="-1">-</button>
              <input
                type="number"
                min="1"
                max="99999"
                value="${item.cantidad}"
                class="cart-direct-qty-input"
                data-cart-direct-id="${item.id}"
                aria-label="Cantidad manual"
              />
              <button type="button" class="qty-btn" data-cart-step-id="${item.id}" data-cart-delta="1">+</button>
            </div>
          </div>
        </div>
      `
      )
      .join('');
  }

  function initSharedCartDrawer() {
    saveAndRenderCart();
    const toggleBtn = document.getElementById('cartToggleBtn');
    const closeBtn = document.getElementById('cartCloseBtn');
    const backdrop = document.getElementById('cartBackdrop');
    const drawer = document.getElementById('cartDrawer');
    const container = document.getElementById('cartItemsContainer');
    const liveAddrBox = document.getElementById('cartLiveAddressBox');
    const checkoutBtn = document.getElementById('btnGoToCheckoutPage');

    if (toggleBtn && drawer && backdrop) {
      toggleBtn.addEventListener('click', () => {
        renderCartLiveAddressManager();
        drawer.classList.add('is-open');
        backdrop.classList.add('is-open');
      });
    }
    if (closeBtn && drawer && backdrop) {
      closeBtn.addEventListener('click', () => {
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-open');
      });
      backdrop.addEventListener('click', () => {
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-open');
      });
    }

    checkoutBtn?.addEventListener('click', (e) => {
      if (!state.user) {
        e.preventDefault();
        showToast('Debes iniciar sesión o crear tu cuenta para realizar un pedido', 'lock');
        window.location.href = 'perfil.html#cuenta-section';
      }
    });

    if (liveAddrBox) {
      liveAddrBox.addEventListener('change', (e) => {
        if (e.target.id === 'cartLiveAddressSelect') {
          state.selectedAddressId = Number(e.target.value);
          sessionStorage.setItem('danillanos_selected_addr_id', String(state.selectedAddressId));
          const chosen = state.direcciones.find((d) => Number(d.id) === Number(state.selectedAddressId));
          if (chosen) {
            showToast(`Dirección activa cambiada a: ${chosen.etiqueta}`, 'pin_drop');
            if (CURRENT_PAGE === 'pagos') {
              const idx = state.direcciones.findIndex((d) => Number(d.id) === Number(chosen.id));
              if (idx !== -1) applySavedAddressToCheckout(idx);
            }
          }
        }
      });

      liveAddrBox.addEventListener('click', async (e) => {
        if (e.target.closest('#btnCartToggleQuickAddr')) {
          if (state.direcciones.length >= 5) {
            showToast('Máximo 5 direcciones por cuenta alcanzado', 'warning');
            return;
          }
          state.cartQuickAddrOpen = !state.cartQuickAddrOpen;
          renderCartLiveAddressManager();
          return;
        }

        if (e.target.closest('#btnCartCancelQuickAddr')) {
          state.cartQuickAddrOpen = false;
          renderCartLiveAddressManager();
          return;
        }

        if (e.target.closest('#btnCartSaveQuickAddr')) {
          const etiqueta = document.getElementById('cartQuickLabel')?.value.trim() || 'Principal';
          const municipio = document.getElementById('cartQuickMuni')?.value.trim() || 'Villavicencio';
          const direccion = document.getElementById('cartQuickStreet')?.value.trim();
          if (!direccion) {
            showToast('Escribe la dirección para guardarla', 'warning');
            return;
          }
          const muniMatch = CONFIG.map.municipiosMeta.find(
            (m) => m.nombre.toLowerCase() === municipio.toLowerCase()
          );
          const lat = muniMatch ? muniMatch.lat : CONFIG.map.villavicencioCenter.lat;
          const lng = muniMatch ? muniMatch.lng : CONFIG.map.villavicencioCenter.lng;

          const res = await fetch(`${CONFIG.api.baseUrl}/direcciones`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ etiqueta, municipio, direccion, barrio_referencia: '', lat, lng })
          });
          const data = await res.json();
          if (data.ok) {
            state.direcciones = data.direcciones;
            const newest = state.direcciones[state.direcciones.length - 1];
            if (newest) {
              state.selectedAddressId = newest.id;
              sessionStorage.setItem('danillanos_selected_addr_id', String(newest.id));
            }
            sessionStorage.setItem('danillanos_dirs', JSON.stringify(state.direcciones));
            state.cartQuickAddrOpen = false;
            renderCartLiveAddressManager();
            renderSharedHeaderAuthUI();
            if (CURRENT_PAGE === 'perfil') renderSavedAddressesList();
            if (CURRENT_PAGE === 'pagos') populateCheckoutSavedAddressesDropdown();
            showToast('Dirección añadida y seleccionada en tu carrito', 'check_circle');
          } else {
            showToast(data.message || 'No se pudo guardar la dirección', 'error');
          }
          return;
        }

        if (e.target.closest('#btnCartDeleteSelectedAddr')) {
          if (!state.selectedAddressId) return;
          const res = await fetch(`${CONFIG.api.baseUrl}/direcciones/${state.selectedAddressId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.ok) {
            state.direcciones = data.direcciones;
            sessionStorage.setItem('danillanos_dirs', JSON.stringify(state.direcciones));
            syncSelectedAddressDefault();
            renderCartLiveAddressManager();
            renderSharedHeaderAuthUI();
            if (CURRENT_PAGE === 'perfil') renderSavedAddressesList();
            if (CURRENT_PAGE === 'pagos') populateCheckoutSavedAddressesDropdown();
            showToast('Dirección eliminada desde el carrito', 'delete');
          }
        }
      });
    }

    if (container) {
      container.addEventListener('click', (e) => {
        const stepBtn = e.target.closest('[data-cart-step-id]');
        if (!stepBtn) return;
        const id = Number(stepBtn.getAttribute('data-cart-step-id'));
        const delta = Number(stepBtn.getAttribute('data-cart-delta'));
        const current = state.cart.find((c) => Number(c.id) === id);
        if (current) setCartItemExactQuantity(id, current.cantidad + delta);
      });

      container.addEventListener('change', (e) => {
        const directInput = e.target.closest('[data-cart-direct-id]');
        if (!directInput) return;
        const id = Number(directInput.getAttribute('data-cart-direct-id'));
        setCartItemExactQuantity(id, directInput.value);
      });
    }
  }

  // ==========================================================================
  // 3. GEOCODIFICACIÓN INVERSA AUTOMÁTICA EN EL MAPA
  //    (Las direcciones en Perfil NO muestran estimado; el estimado se muestra SOLO al pagar en pagos.html)
  // ==========================================================================
  const VILLAVICENCIO_BARRIOS = [
    { nombre: 'Barrio Siete de Agosto', lat: 4.1392, lng: -73.6351, via: 'Av. 40 # 26C' },
    { nombre: 'Avenida Los Maracos', lat: 4.1365, lng: -73.6215, via: 'Calle 15 # 12' },
    { nombre: 'Barrio Barzal Alto', lat: 4.1468, lng: -73.6412, via: 'Calle 35 # 41' },
    { nombre: 'Barrio La Grama', lat: 4.1562, lng: -73.6385, via: 'Calle 44 # 30' },
    { nombre: 'Barrio Caudal', lat: 4.1605, lng: -73.6430, via: 'Carrera 33 # 48' },
    { nombre: 'Ciudad Porfía', lat: 4.0985, lng: -73.6682, via: 'Calle 51 Sur # 43' },
    { nombre: 'Barrio Esperanza', lat: 4.1310, lng: -73.6390, via: 'Carrera 38 # 15' },
    { nombre: 'Barrio Montecarlo', lat: 4.1155, lng: -73.6520, via: 'Calle 25 Sur # 40' },
    { nombre: 'Vía Catama', lat: 4.1290, lng: -73.5980, via: 'Troncal del Llano Km 2' }
  ];

  // ============================================================================
  // CRONOGRAMA OFICIAL DE RUTAS DEPARTAMENTALES DEL META Y VILLAVICENCIO
  // - Martes: Pto Lopez y San Carlos
  // - Miércoles: Mesetas - Vista Hermosa - Lejanías
  // - Jueves: 
  //     Ruta 1: San Martín - Granada - Fuente de Oro - Pto Lleras
  //     Ruta 2: Castilla - Guamal - Cubarral - El Dorado
  // - Viernes:
  //     Ruta 1: Pto Gaitán
  //     Ruta 2: Restrepo - Cumaral - Medina - Paratebueno
  // - Sábado: Acacías
  // Regla: Cualquier pedido antes de las 00:00 horas del día respectivo se entrega en su fecha;
  //        pasadas las 00:00, se reprograma para el siguiente ciclo semanal.
  // ============================================================================
  const DELIVERY_ROUTES = [
    {
      diaSemana: 2, // Martes
      diaNombre: 'Martes',
      rutaNombre: 'Ruta Puerto López y San Carlos',
      municipios: ['puerto lópez', 'puerto lopez', 'pto lopez', 'pto. lopez', 'san carlos de guaroa', 'san carlos']
    },
    {
      diaSemana: 3, // Miércoles
      diaNombre: 'Miércoles',
      rutaNombre: 'Ruta Mesetas - Vista Hermosa - Lejanías',
      municipios: ['mesetas', 'vista hermosa', 'lejanías', 'lejanias']
    },
    {
      diaSemana: 4, // Jueves
      diaNombre: 'Jueves',
      rutaNombre: 'Ruta 1: San Martín - Granada - Fuente de Oro - Puerto Lleras',
      municipios: ['san martín', 'san martin', 'granada', 'fuente de oro', 'fue de oro', 'puerto lleras', 'pto lleras', 'pto. lleras']
    },
    {
      diaSemana: 4, // Jueves
      diaNombre: 'Jueves',
      rutaNombre: 'Ruta 2: Castilla - Guamal - Cubarral - El Dorado',
      municipios: ['castilla la nueva', 'castilla', 'guamal', 'cubarral', 'el dorado']
    },
    {
      diaSemana: 5, // Viernes
      diaNombre: 'Viernes',
      rutaNombre: 'Ruta 1: Puerto Gaitán',
      municipios: ['puerto gaitán', 'puerto gaitan', 'pto gaitán', 'pto gaitan', 'pto. gaitan']
    },
    {
      diaSemana: 5, // Viernes
      diaNombre: 'Viernes',
      rutaNombre: 'Ruta 2: Restrepo - Cumaral - Medina - Paratebueno',
      municipios: ['restrepo', 'cumaral', 'medina', 'paratebueno', 'párate bueno', 'parate bueno']
    },
    {
      diaSemana: 6, // Sábado
      diaNombre: 'Sábado',
      rutaNombre: 'Ruta Acacías',
      municipios: ['acacías', 'acacias']
    }
  ];

  function findRouteForMunicipio(muniName) {
    if (!muniName) return null;
    const clean = muniName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (clean.includes('villavicencio')) {
      return { esVillavicencio: true, diaNombre: 'Mismo día', rutaNombre: 'Radio Urbano Villavicencio' };
    }

    for (const r of DELIVERY_ROUTES) {
      for (const m of r.municipios) {
        const cleanM = m
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
        if (clean.includes(cleanM) || cleanM.includes(clean)) {
          return r;
        }
      }
    }
    return null;
  }

  function calculateEstimatedDelivery(muniName, orderDate = new Date()) {
    const route = findRouteForMunicipio(muniName);
    const now = new Date(orderDate);

    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    if (!route || route.esVillavicencio) {
      const hour = now.getHours();
      const day = now.getDay();
      if (day !== 0 && hour < 17) {
        return {
          texto: 'Envío el mismo día (Villavicencio)',
          fechaEntrega: new Date(now),
          ruta: 'Radio Urbano Villavicencio',
          diaNombre: 'Hoy'
        };
      } else {
        const nextDay = new Date(now);
        const add = day === 6 ? 2 : 1;
        nextDay.setDate(nextDay.getDate() + add);
        nextDay.setHours(10, 0, 0, 0);
        const diaNom = dias[nextDay.getDay()];
        const diaNum = nextDay.getDate();
        const mesNom = meses[nextDay.getMonth()];
        return {
          texto: `Llega el ${diaNom}, ${diaNum} de ${mesNom} (Villavicencio)`,
          fechaEntrega: nextDay,
          ruta: 'Radio Urbano Villavicencio',
          diaNombre: diaNom
        };
      }
    }

    // Regla de corte: Pedido hecho antes de las 00:00 del día de ruta -> se entrega ese día.
    // Pasadas las 00:00 -> se programa para el día correspondiente de la próxima semana.
    const currentDayOfWeek = now.getDay();
    const targetDayOfWeek = route.diaSemana;

    let daysToAdd = targetDayOfWeek - currentDayOfWeek;
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }

    const deliveryDate = new Date(now);
    deliveryDate.setDate(deliveryDate.getDate() + daysToAdd);
    deliveryDate.setHours(9, 0, 0, 0);

    const diaNom = dias[deliveryDate.getDay()];
    const diaNum = deliveryDate.getDate();
    const mesNom = meses[deliveryDate.getMonth()];

    const texto = `Llega el ${diaNom}, ${diaNum} de ${mesNom} (${route.rutaNombre})`;

    return {
      texto,
      fechaEntrega: deliveryDate,
      ruta: route.rutaNombre,
      diaNombre: diaNom,
      diaNum,
      mesNom
    };
  }

  function isDeliveredToday(order) {
    if (order.estado !== 'entregado') return false;
    const dStr = order.fecha_entrega || order.actualizado_en || order.creado_en;
    if (!dStr) return false;
    const delivDate = new Date(dStr);
    if (isNaN(delivDate.getTime())) return false;
    const now = new Date();
    return (
      delivDate.getFullYear() === now.getFullYear() &&
      delivDate.getMonth() === now.getMonth() &&
      delivDate.getDate() === now.getDate()
    );
  }

  function updateZoneBannerUI(lat, lng, resolvedMuni = '') {
    const insideVcio = isInsideVillavicencio(lat, lng);
    const zoneIndicator = document.getElementById('zoneLiveIndicator');
    const zoneIcon = document.getElementById('zoneLiveIcon');
    const zoneTitle = document.getElementById('zoneLiveTitle');
    const zoneSubtitle = document.getElementById('zoneLiveSubtitle');
    const etaSummary = document.getElementById('checkoutEtaSummaryText');

    if (!zoneIndicator) return;

    const deliveryInfo = calculateEstimatedDelivery(resolvedMuni || (insideVcio ? 'Villavicencio' : 'Acacías'), new Date());

    if (CURRENT_PAGE === 'pagos') {
      // AL MOMENTO DE PAGAR: aquí se calcula y presenta el Estimado de Entrega según ruta y corte de las 00:00
      if (insideVcio) {
        zoneIndicator.className = 'zone-live-indicator is-villavicencio';
        if (zoneIcon) zoneIcon.textContent = 'bolt';
        if (zoneTitle) zoneTitle.textContent = `Estimado de Entrega al Pagar: ${deliveryInfo.texto}`;
        if (zoneSubtitle) zoneSubtitle.textContent = 'Dirección dentro del radio urbano de Villavicencio';
        if (etaSummary) etaSummary.textContent = deliveryInfo.texto;
      } else {
        zoneIndicator.className = 'zone-live-indicator is-meta-outside';
        if (zoneIcon) zoneIcon.textContent = 'event_available';
        if (zoneTitle) zoneTitle.textContent = `Estimado de Entrega al Pagar: ${deliveryInfo.texto}`;
        if (zoneSubtitle) zoneSubtitle.textContent = `Ruta departamental del Meta (${deliveryInfo.ruta || resolvedMuni})`;
        if (etaSummary) etaSummary.textContent = deliveryInfo.texto;
      }
    } else {
      // EN PERFIL / GESTIÓN DE DIRECCIONES
      if (insideVcio) {
        zoneIndicator.className = 'zone-live-indicator is-villavicencio';
        if (zoneIcon) zoneIcon.textContent = 'location_on';
        if (zoneTitle) zoneTitle.textContent = 'Ubicación dentro del Radio Urbano de Villavicencio';
        if (zoneSubtitle) zoneSubtitle.textContent = 'El estimado de entrega se confirmará automáticamente al momento de pagar.';
      } else {
        zoneIndicator.className = 'zone-live-indicator is-meta-outside';
        if (zoneIcon) zoneIcon.textContent = 'map';
        if (zoneTitle) zoneTitle.textContent = `Ubicación en ${resolvedMuni || 'Municipio del Meta'} (Departamento del Meta)`;
        if (zoneSubtitle) zoneSubtitle.textContent = `Ruta programada de entrega: ${deliveryInfo.diaNombre} (${deliveryInfo.ruta})`;
      }
    }
  }

  async function reverseGeocodeAndAutofill(lat, lng, municipioOverride = null) {
    const latInput = document.getElementById('addrLat');
    const lngInput = document.getElementById('addrLng');
    const streetInput = document.getElementById('addrStreet');
    const refInput = document.getElementById('addrRef');
    const muniInput = document.getElementById('addrMunicipio');
    const coordsDisplay = document.getElementById('coordsDisplayText');

    const cleanLat = Number(lat).toFixed(6);
    const cleanLng = Number(lng).toFixed(6);

    if (latInput) latInput.value = cleanLat;
    if (lngInput) lngInput.value = cleanLng;
    if (coordsDisplay) coordsDisplay.textContent = `${cleanLat}, ${cleanLng}`;

    const insideVcio = isInsideVillavicencio(lat, lng);

    let nearestBarrio = VILLAVICENCIO_BARRIOS[0];
    let minBarrioDist = Infinity;
    VILLAVICENCIO_BARRIOS.forEach((b) => {
      const d = haversineKm(lat, lng, b.lat, b.lng);
      if (d < minBarrioDist) {
        minBarrioDist = d;
        nearestBarrio = b;
      }
    });

    const houseNum = Math.max(1, Math.round((Math.abs(lat * 10000) % 85) + 10));
    let resolvedMuni = insideVcio ? 'Villavicencio' : municipioOverride || 'Acacías';
    if (!insideVcio && !municipioOverride) {
      let minMuniDist = Infinity;
      CONFIG.map.municipiosMeta.forEach((m) => {
        const d = haversineKm(lat, lng, m.lat, m.lng);
        if (d < minMuniDist) {
          minMuniDist = d;
          resolvedMuni = m.nombre;
        }
      });
    }

    updateZoneBannerUI(lat, lng, resolvedMuni);

    if (muniInput) muniInput.value = resolvedMuni;
    if (streetInput) {
      streetInput.value = insideVcio
        ? `${nearestBarrio.via} - ${houseNum} (${nearestBarrio.nombre})`
        : `Calle Principal # ${houseNum} - 15 Centro (${resolvedMuni})`;
    }
    if (refInput && !refInput.value) {
      refInput.value = insideVcio
        ? `${nearestBarrio.nombre} (Pin exacto en mapa)`
        : `Zona urbana ${resolvedMuni}, Meta`;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${cleanLat}&lon=${cleanLng}&accept-language=es`
      );
      if (response.ok) {
        const geo = await response.json();
        if (geo && geo.address) {
          const road = geo.address.road || geo.address.pedestrian || geo.address.residential;
          const suburb = geo.address.suburb || geo.address.neighbourhood || geo.address.quarter;
          const city = geo.address.city || geo.address.town || geo.address.village || geo.address.county;
          const number = geo.address.house_number ? ` # ${geo.address.house_number}` : ` - ${houseNum}`;

          if (road && streetInput) {
            streetInput.value = `${road}${number}${suburb ? `, ${suburb}` : ''}`;
          }
          if (suburb && refInput) {
            refInput.value = `${suburb} (Pin puesto en el mapa)`;
          }
          if (city && muniInput && !insideVcio) {
            muniInput.value = city;
            updateZoneBannerUI(lat, lng, city);
          }
        }
      }
    } catch (_) {
      // Ya autorellenado con nomenclatura local instantánea
    }
  }


  function createBrandRedPinIcon(labelText = '★') {
    if (typeof L === 'undefined') return undefined;
    return L.divIcon({
      className: 'danillanos-red-pin-icon',
      html: `
        <div class="danillanos-red-pin-marker">
          <span class="danillanos-red-pin-pulse"></span>
          <span class="danillanos-red-pin-inner">${labelText}</span>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -36]
    });
  }

  function createHqPinIcon() {
    if (typeof L === 'undefined') return undefined;
    return L.divIcon({
      className: 'danillanos-red-pin-icon',
      html: `<div class="danillanos-hq-pin-marker" title="Sede Principal Danillanos">🥩</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  }

  function setupInteractiveCoverageMap(containerId) {
    const mapEl = document.getElementById(containerId);
    if (!mapEl || typeof L === 'undefined') return;
    if (state.maps.addressMap) {
      setTimeout(() => state.maps.addressMap.invalidateSize(), 150);
      return;
    }

    const center = CONFIG.map.villavicencioCenter;
    const map = L.map(containerId).setView([center.lat, center.lng], 13);

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google Maps • Danillanos Meta'
    }).addTo(map);

    L.circle([center.lat, center.lng], {
      color: '#e01a2c',
      fillColor: '#e01a2c',
      fillOpacity: 0.11,
      weight: 2,
      radius: CONFIG.map.villavicencioRadiusMeters || 9500
    })
      .addTo(map)
      .bindPopup('<strong>Radio Urbano Villavicencio</strong>');

    const hq = CONFIG.map.sedeDanillanos;
    L.marker([hq.lat, hq.lng], { icon: createHqPinIcon() })
      .addTo(map)
      .bindPopup(`<strong>🥩 ${hq.nombre}</strong><br>Centro de Despacho`);

    const userPin = L.marker([center.lat, center.lng], {
      draggable: true,
      icon: createBrandRedPinIcon('★')
    })
      .addTo(map)
      .bindPopup('<strong>📍 Tu Pin Rojo Danillanos</strong><br>Así mismo lo verá el entregador')
      .openPopup();

    userPin.on('dragend', () => {
      const pos = userPin.getLatLng();
      reverseGeocodeAndAutofill(pos.lat, pos.lng);
      showToast('Pin actualizado y dirección autorellenada', 'pin_drop');
    });

    map.on('click', (e) => {
      userPin.setLatLng(e.latlng).openPopup();
      reverseGeocodeAndAutofill(e.latlng.lat, e.latlng.lng);
      showToast('Pin colocado en tu ubicación y dirección autorellenada', 'pin_drop');
    });

    state.maps.addressMap = map;
    state.maps.addressMarker = userPin;

    const muniBar = document.getElementById('metaMunicipalitiesBar');
    if (muniBar) {
      muniBar.innerHTML = '';
      CONFIG.map.municipiosMeta.forEach((muni) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `muni-btn ${muni.nombre === 'Villavicencio' ? 'active' : ''}`;
        btn.textContent = muni.nombre;
        btn.addEventListener('click', () => {
          muniBar.querySelectorAll('.muni-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          map.setView([muni.lat, muni.lng], muni.es_villavicencio ? 13 : 12);
          userPin.setLatLng([muni.lat, muni.lng]).openPopup();
          reverseGeocodeAndAutofill(muni.lat, muni.lng, muni.nombre);
        });
        muniBar.appendChild(btn);
      });
    }

    reverseGeocodeAndAutofill(center.lat, center.lng, 'Villavicencio');
    setTimeout(() => map.invalidateSize(), 240);
  }

  // ==========================================================================
  // 4. PÁGINA TIENDA PRINCIPAL (index.html)
  // ==========================================================================
  function initStorePage() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('q')) {
      state.searchQuery = params.get('q');
      const searchInput = document.getElementById('searchInput');
      const mobileInput = document.getElementById('mobileSearchInput');
      const searchContainer = document.getElementById('searchContainer');
      if (searchInput) searchInput.value = state.searchQuery;
      if (mobileInput) mobileInput.value = state.searchQuery;
      if (searchContainer) searchContainer.classList.add('has-value');
    }

    initHeroCarousel();
    renderStoreProducts();

    const categoryPills = document.getElementById('categoryPills');
    if (categoryPills) {
      categoryPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.category-pill');
        if (!pill) return;
        setStoreCategoryFilter(pill.getAttribute('data-category'));
      });
    }

    document.querySelectorAll('[data-filter-category]').forEach((link) => {
      link.addEventListener('click', () => {
        const cat = link.getAttribute('data-filter-category');
        if (CURRENT_PAGE === 'store') setStoreCategoryFilter(cat);
      });
    });

    const btnLoadMore = document.getElementById('btnLoadMore');
    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', () => {
        state.visibleProductsLimit += 48;
        renderStoreProducts();
      });
    }

    const btnResetSearch = document.getElementById('btnResetSearch');
    if (btnResetSearch) {
      btnResetSearch.addEventListener('click', () => {
        state.searchQuery = '';
        const searchInput = document.getElementById('searchInput');
        const mobileInput = document.getElementById('mobileSearchInput');
        if (searchInput) searchInput.value = '';
        if (mobileInput) mobileInput.value = '';
        document.getElementById('searchContainer')?.classList.remove('has-value');
        setStoreCategoryFilter('todos');
      });
    }

    const productsGrid = document.getElementById('productsGrid');
    if (productsGrid) {
      productsGrid.addEventListener('click', (e) => {
        const stepBtn = e.target.closest('[data-card-qty-step]');
        if (stepBtn) {
          const prodId = stepBtn.getAttribute('data-card-qty-step');
          const delta = Number(stepBtn.getAttribute('data-delta'));
          const input = document.getElementById(`cardQtyInput_${prodId}`);
          if (input) {
            const currentVal = parseInt(input.value, 10) || 1;
            input.value = String(Math.max(1, currentVal + delta));
          }
          return;
        }

        const addBtn = e.target.closest('[data-add-product-id]');
        if (addBtn) {
          const prodId = Number(addBtn.getAttribute('data-add-product-id'));
          const input = document.getElementById(`cardQtyInput_${prodId}`);
          const qty = Math.max(1, parseInt(input ? input.value : '1', 10) || 1);
          const product = state.products.find((p) => Number(p.id) === prodId);
          if (product) addToCart(product, qty);
        }
      });
    }
  }

  function initHeroCarousel() {
    const track = document.getElementById('carouselTrack');
    const dots = document.getElementById('carouselDots');
    const progressBar = document.getElementById('carouselProgressBar');
    const prevBtn = document.getElementById('carouselPrevBtn');
    const nextBtn = document.getElementById('carouselNextBtn');
    if (!track || !dots || !progressBar) return;

    function renderSlides() {
      track.innerHTML = '';
      dots.innerHTML = '';

      state.slides.forEach((slide, index) => {
        const slideEl = document.createElement('article');
        slideEl.className = `carousel-slide ${index === state.carousel.currentIndex ? 'is-active' : ''}`;
        const buttonIcon = slide.tipo_accion === 'buy_now' ? 'local_mall' : 'add_shopping_cart';

        slideEl.innerHTML = `
          <img src="${slide.imagen_url}" alt="${slide.titulo}" class="carousel-slide-img" />
          <div class="carousel-slide-overlay">
            <div class="slide-caption-left">
              <span class="slide-badge">
                <span class="material-symbols-rounded" style="font-size: 0.95rem;">verified</span>
                ${slide.subtitulo}
              </span>
              <h2 class="slide-title">${slide.titulo}</h2>
              <p class="slide-description">${slide.descripcion}</p>
              ${
                slide.precio_destacado
                  ? `<div class="slide-price-tag">
                       <span class="slide-price-label">Desde</span>
                       <span class="slide-price-value">${formatCurrency(slide.precio_destacado)}</span>
                     </div>`
                  : ''
              }
            </div>
            <div class="slide-action-right">
              <button
                type="button"
                class="slide-cta-btn"
                data-slide-product-id="${slide.producto_id || 1}"
                data-slide-action="${slide.tipo_accion || 'add_to_cart'}"
              >
                <span>${slide.texto_boton || 'Añadir al carrito'}</span>
                <span class="material-symbols-rounded">${buttonIcon}</span>
              </button>
            </div>
          </div>
        `;
        track.appendChild(slideEl);

        const dotBtn = document.createElement('button');
        dotBtn.type = 'button';
        dotBtn.className = `carousel-dot ${index === state.carousel.currentIndex ? 'is-active' : ''}`;
        dotBtn.addEventListener('click', () => goToSlide(index));
        dots.appendChild(dotBtn);
      });
    }

    function updateTransform() {
      track.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
      track.style.transform = `translate3d(-${state.carousel.currentIndex * 100}%, 0, 0)`;
      track.querySelectorAll('.carousel-slide').forEach((n, i) =>
        n.classList.toggle('is-active', i === state.carousel.currentIndex)
      );
      dots.querySelectorAll('.carousel-dot').forEach((d, i) =>
        d.classList.toggle('is-active', i === state.carousel.currentIndex)
      );
    }

    function goToSlide(idx) {
      const total = state.slides.length;
      if (!total) return;
      state.carousel.currentIndex = (idx + total) % total;
      state.carousel.elapsedMs = 0;
      progressBar.style.width = '0%';
      updateTransform();
    }

    function tick(ts) {
      if (!state.carousel.lastFrameTime) state.carousel.lastFrameTime = ts;
      const delta = ts - state.carousel.lastFrameTime;
      state.carousel.lastFrameTime = ts;

      if (!state.carousel.isPaused) {
        state.carousel.elapsedMs += delta;
        const pct = Math.min((state.carousel.elapsedMs / state.carousel.durationMs) * 100, 100);
        progressBar.style.width = `${pct}%`;

        if (state.carousel.elapsedMs >= state.carousel.durationMs) {
          goToSlide(state.carousel.currentIndex + 1);
        }
      }
      state.carousel.rafId = requestAnimationFrame(tick);
    }

    renderSlides();
    prevBtn?.addEventListener('click', () => goToSlide(state.carousel.currentIndex - 1));
    nextBtn?.addEventListener('click', () => goToSlide(state.carousel.currentIndex + 1));

    // =========================================================================
    // Deslizamiento con el dedo en móvil (Swipe táctil fluido izquierda/derecha)
    // =========================================================================
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;
    let isHorizontalSwipe = false;
    let wasDragging = false;

    const carouselEl = document.getElementById('heroCarousel') || track;

    carouselEl.addEventListener(
      'touchstart',
      (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
        isHorizontalSwipe = false;
        wasDragging = false;
        state.carousel.isPaused = true;
      },
      { passive: true }
    );

    carouselEl.addEventListener(
      'touchmove',
      (e) => {
        if (!isSwiping || !e.touches || e.touches.length !== 1) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartX;
        const diffY = currentY - touchStartY;

        if (!isHorizontalSwipe) {
          // Si el desplazamiento es predominantemente vertical, permitir scroll natural de la página
          if (Math.abs(diffY) > Math.abs(diffX)) {
            isSwiping = false;
            state.carousel.isPaused = false;
            return;
          }
          if (Math.abs(diffX) > 8) {
            isHorizontalSwipe = true;
            wasDragging = true;
          }
        }

        if (isHorizontalSwipe) {
          if (e.cancelable) e.preventDefault();
          track.style.transition = 'none';
          const baseOffset = -state.carousel.currentIndex * 100;
          track.style.transform = `translate3d(calc(${baseOffset}% + ${diffX}px), 0, 0)`;
        }
      },
      { passive: false }
    );

    function endTouchSwipe(e) {
      if (!isSwiping && !isHorizontalSwipe) return;
      isSwiping = false;
      state.carousel.isPaused = false;
      state.carousel.lastFrameTime = performance.now();
      track.style.transition = 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)';

      if (isHorizontalSwipe && e.changedTouches && e.changedTouches.length > 0) {
        const finalX = e.changedTouches[0].clientX;
        const diffX = finalX - touchStartX;
        const threshold = 38; // 38px de umbral para cambiar de diapositiva

        if (diffX < -threshold) {
          // Deslizó hacia la izquierda -> avanzar a la siguiente
          goToSlide(state.carousel.currentIndex + 1);
        } else if (diffX > threshold) {
          // Deslizó hacia la derecha -> regresar a la anterior
          goToSlide(state.carousel.currentIndex - 1);
        } else {
          // Umbral no alcanzado -> volver a centrar suavemente la diapositiva actual
          updateTransform();
        }
      } else {
        updateTransform();
      }

      // Reiniciar wasDragging después de que el evento click termine de evaluarse
      setTimeout(() => {
        wasDragging = false;
      }, 120);
    }

    carouselEl.addEventListener('touchend', endTouchSwipe, { passive: true });
    carouselEl.addEventListener('touchcancel', endTouchSwipe, { passive: true });

    track.addEventListener('click', (e) => {
      if (wasDragging) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const btn = e.target.closest('.slide-cta-btn');
      if (!btn) return;
      const prodId = Number(btn.getAttribute('data-slide-product-id'));
      const action = btn.getAttribute('data-slide-action');
      const product = state.products.find((p) => Number(p.id) === prodId) || state.products[0];
      if (product) {
        addToCart(product, 1);
        if (action === 'buy_now') {
          window.location.href = state.user ? 'pagos.html' : 'perfil.html#cuenta-section';
        }
      }
    });

    state.carousel.rafId = requestAnimationFrame(tick);
  }

  function setStoreCategoryFilter(catSlug) {
    state.filteredCategory = catSlug;
    state.visibleProductsLimit = catSlug === 'todos' ? 36 : 40;
    document.querySelectorAll('#categoryPills .category-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-category') === catSlug);
    });
    renderStoreProducts();
  }

  function renderStoreProducts() {
    const grid = document.getElementById('productsGrid');
    const banner = document.getElementById('searchStatusBanner');
    const statusText = document.getElementById('searchStatusText');
    const loadMoreBox = document.getElementById('loadMoreContainer');
    const btnLoadMore = document.getElementById('btnLoadMore');
    if (!grid) return;

    const q = state.searchQuery.trim().toLowerCase();
    const filtered = state.products.filter((product) => {
      let matchesCat = true;
      if (q === '') {
        if (state.filteredCategory === 'mas_vendidos') matchesCat = Boolean(product.es_mas_vendido);
        else if (state.filteredCategory !== 'todos') matchesCat = product.categoria_slug === state.filteredCategory;
      } else if (state.filteredCategory !== 'todos' && state.filteredCategory !== 'mas_vendidos') {
        matchesCat = product.categoria_slug === state.filteredCategory;
      }

      const matchesSearch =
        q === '' ||
        product.nombre.toLowerCase().includes(q) ||
        (product.categoria_nombre && product.categoria_nombre.toLowerCase().includes(q)) ||
        (product.codigo_sku && product.codigo_sku.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });

    if (banner && statusText) {
      if (q !== '') {
        banner.classList.remove('hidden');
        statusText.textContent = `Mostrando resultados para "${state.searchQuery}" (${filtered.length} encontrados)`;
      } else {
        banner.classList.add('hidden');
      }
    }

    const visible = filtered.slice(0, state.visibleProductsLimit);
    grid.innerHTML = visible
      .map(
        (product) => `
        <article class="product-card">
          <div class="product-image-wrap">
            <img src="${product.imagen_url}" alt="${product.nombre}" class="product-image" loading="lazy" />
            ${product.etiqueta ? `<span class="product-tag-badge">${product.etiqueta}</span>` : ''}
            <span class="product-temp-badge">
              <span class="material-symbols-rounded">ac_unit</span>
              <span>${product.temperatura_conservacion || 'Fresco'}</span>
            </span>
          </div>
          <div class="product-body">
            <div class="product-meta-top">
              <span>${product.categoria_nombre || 'Danillanos'}</span>
              <span>${product.codigo_sku || ''}</span>
            </div>
            <h3 class="product-title">${product.nombre}</h3>
            <p class="product-desc">${product.presentacion} — ${product.descripcion}</p>
            <div class="product-footer">
              <div class="product-footer-top">
                <span style="font-size:0.75rem; color:var(--text-muted);">Precio unitario</span>
                <div>
                  ${
                    product.precio_anterior
                      ? `<span class="product-price-old">${formatCurrency(product.precio_anterior)}</span>`
                      : ''
                  }
                  <span class="product-price-current">${formatCurrency(product.precio)}</span>
                </div>
              </div>
              <div class="product-bulk-row">
                <div class="bulk-qty-box" title="Ingresa cualquier cantidad manualmente (ej. 100, 700)">
                  <button type="button" class="bulk-step-btn" data-card-qty-step="${product.id}" data-delta="-1">-</button>
                  <input
                    type="number"
                    min="1"
                    max="99999"
                    value="1"
                    class="bulk-qty-input"
                    id="cardQtyInput_${product.id}"
                    aria-label="Cantidad de unidades"
                  />
                  <button type="button" class="bulk-step-btn" data-card-qty-step="${product.id}" data-delta="1">+</button>
                </div>
                <button type="button" class="btn-add-product" data-add-product-id="${product.id}">
                  <span class="material-symbols-rounded">add_shopping_cart</span>
                  <span>Añadir</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      `
      )
      .join('');

    if (loadMoreBox && btnLoadMore) {
      if (filtered.length > state.visibleProductsLimit) {
        loadMoreBox.classList.remove('hidden');
        btnLoadMore.querySelector('span').textContent = `Mostrar más productos (${visible.length} de ${filtered.length})`;
      } else {
        loadMoreBox.classList.add('hidden');
      }
    }
  }

  // ==========================================================================
  // 5. PÁGINA AMPLIA DE PERFIL, MAPA, LÍNEA DE 4 ETAPAS, CANCELACIÓN ANTES DE ENVÍO, HISTORIAL Y SOPORTE CON FILTROS (perfil.html)
  // ==========================================================================

  // Almacenamiento local sincronizado para garantizar CERO errores 404 incluso si el servidor Node no se ha reiniciado
  const DEFAULT_STAFF_USERS = [
    {
      id: 1,
      username: 'Administrador Danillanos',
      nombre_completo: 'Administrador General Danillanos',
      empresa: 'Danillanos Cárnicos y Congelados S.A.S.',
      tipo_documento: 'NIT',
      numero_documento: '900000000-1',
      email: 'admin@danillanos.com',
      telefono: '3109998877',
      rol: 'admin',
      activo: true
    }
  ];

  function getLocalUsersStore() {
    try {
      const raw = localStorage.getItem('danillanos_users_store');
      if (raw) {
        const parsed = JSON.parse(raw);
        const hasLegacySeeds =
          Array.isArray(parsed) &&
          parsed.some(
            (u) =>
              u.email === 'cliente@danillanos.com' ||
              u.email === 'empleado@danillanos.com' ||
              u.email === 'entregador@danillanos.com' ||
              u.email === 'soporte@danillanos.com'
          );
        if (!hasLegacySeeds && Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    localStorage.setItem('danillanos_users_store', JSON.stringify(DEFAULT_STAFF_USERS));
    return [...DEFAULT_STAFF_USERS];
  }

  function saveLocalUsersStore(list) {
    localStorage.setItem('danillanos_users_store', JSON.stringify(list));
  }

  function getOrderOverridesMap() {
    try {
      return JSON.parse(localStorage.getItem('danillanos_orders_overrides') || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveOrderOverride(orderId, patch) {
    const map = getOrderOverridesMap();
    map[orderId] = { ...(map[orderId] || {}), ...patch };
    localStorage.setItem('danillanos_orders_overrides', JSON.stringify(map));
  }

  function applyOrderOverrides(orders = []) {
    const map = getOrderOverridesMap();
    return orders.map((ord) => {
      const ov = map[ord.id];
      if (!ov) return ord;
      return { ...ord, ...ov };
    });
  }

  const DEFAULT_STAFF_ORDERS = [];

  function getLocalCreatedOrders() {
    try {
      const raw = localStorage.getItem('danillanos_local_orders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  }

  function saveLocalCreatedOrder(orderObj) {
    const list = getLocalCreatedOrders();
    if (!list.some((o) => Number(o.id) === Number(orderObj.id))) {
      list.unshift(orderObj);
      localStorage.setItem('danillanos_local_orders', JSON.stringify(list));
    }
  }

  function getFallbackStaffOrders() {
    const map = new Map();
    DEFAULT_STAFF_ORDERS.forEach((o) => map.set(Number(o.id), { ...o }));
    getLocalCreatedOrders().forEach((o) => map.set(Number(o.id), { ...o }));
    const combined = Array.from(map.values()).sort((a, b) => Number(b.id) - Number(a.id));
    return applyOrderOverrides(combined);
  }

  function getLocalTicketsStore() {
    try {
      const raw = localStorage.getItem('danillanos_tickets_store');
      if (raw) {
        const parsed = JSON.parse(raw);
        const hasLegacyTicket =
          Array.isArray(parsed) &&
          parsed.some(
            (t) =>
              (t.asunto && t.asunto.includes('Acacías')) ||
              (Array.isArray(t.mensajes) && t.mensajes.some((m) => m.autor && m.autor.includes('Carlos')))
          );
        if (!hasLegacyTicket && Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    localStorage.setItem('danillanos_tickets_store', JSON.stringify([]));
    return [];
  }

  function saveLocalTicketsStore(list) {
    localStorage.setItem('danillanos_tickets_store', JSON.stringify(list));
  }

  function mergeTicketsWithLocal(serverTickets = []) {
    const localList = getLocalTicketsStore();
    const map = new Map();
    serverTickets.forEach((t) => {
      const msgs = Array.isArray(t.mensajes) && t.mensajes.length > 0
        ? t.mensajes
        : [
            {
              id: 1,
              autor: 'Cliente',
              rol: 'cliente',
              texto: t.descripcion || t.asunto,
              fecha: t.creado_en || new Date().toISOString()
            },
            ...(t.respuesta_soporte
              ? [
                  {
                    id: 2,
                    autor: 'Soporte Danillanos',
                    rol: 'soporte',
                    texto: t.respuesta_soporte,
                    fecha: new Date().toISOString()
                  }
                ]
              : [])
          ];
      map.set(Number(t.id), { ...t, mensajes: msgs });
    });
    localList.forEach((lt) => {
      const existing = map.get(Number(lt.id));
      if (!existing) {
        map.set(Number(lt.id), lt);
      } else {
        const useMsgs = (lt.mensajes || []).length >= (existing.mensajes || []).length ? lt.mensajes : existing.mensajes;
        map.set(Number(lt.id), {
          ...existing,
          ...lt,
          estado: lt.estado || existing.estado,
          mensajes: useMsgs
        });
      }
    });
    const merged = Array.from(map.values()).sort((a, b) => Number(b.id) - Number(a.id));
    saveLocalTicketsStore(merged);
    return merged;
  }

  function getInvoiceCode(orderId) {
    return `FAC-DN-${String(orderId || 1).padStart(5, '0')}`;
  }

  /**
   * Genera el HTML de la Factura emulada en Papel Térmico de punto de venta (POS)
   * con textura de papel gris y bordes dentados (sawtooth / zigzag arriba y abajo),
   * unificada para todas las representaciones de facturas (Historial, Modal y Checkout).
   */
  function buildThermalPaperReceiptHtml(ord) {
    if (!ord) return '';
    const orderId = ord.id || ord.pedido_id || 101;
    const invCode = getInvoiceCode(orderId);
    const dateStr = ord.creado_en
      ? new Date(ord.creado_en).toLocaleString('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      : new Date().toLocaleString('es-CO');
    const items = ord.items || [];
    const cufeHash = `CUFE-${(orderId * 894311 + 512349).toString(16).toUpperCase()}-DN2026-${(Number(ord.total) || 9999).toString(16).toUpperCase()}`;

    const statusLabelMap = {
      pendiente: 'RECIBIDO EN TIENDA',
      en_proceso: 'ACEPTADO EN BODEGA',
      en_camino: 'EN RUTA DE REPARTO',
      entregado: 'ENTREGADO Y VERIFICADO',
      cancelado: ord.reembolso_estado === 'reembolsado' ? 'CANCELADO (REEMBOLSADO)' : 'CANCELADO'
    };
    const estadoTexto = statusLabelMap[ord.estado] || (ord.estado ? String(ord.estado).toUpperCase() : 'RECIBIDO EN TIENDA');

    // Dientes de sierra SVG (triángulos exactos de 0 a 100)
    const topTeeth =
      '0,8 1.25,0 2.5,8 3.75,0 5,8 6.25,0 7.5,8 8.75,0 10,8 11.25,0 12.5,8 13.75,0 15,8 16.25,0 17.5,8 18.75,0 20,8 21.25,0 22.5,8 23.75,0 25,8 26.25,0 27.5,8 28.75,0 30,8 31.25,0 32.5,8 33.75,0 35,8 36.25,0 37.5,8 38.75,0 40,8 41.25,0 42.5,8 43.75,0 45,8 46.25,0 47.5,8 48.75,0 50,8 51.25,0 52.5,8 53.75,0 55,8 56.25,0 57.5,8 58.75,0 60,8 61.25,0 62.5,8 63.75,0 65,8 66.25,0 67.5,8 68.75,0 70,8 71.25,0 72.5,8 73.75,0 75,8 76.25,0 77.5,8 78.75,0 80,8 81.25,0 82.5,8 83.75,0 85,8 86.25,0 87.5,8 88.75,0 90,8 91.25,0 92.5,8 93.75,0 95,8 96.25,0 97.5,8 98.75,0 100,8';
    const bottomTeeth =
      '0,0 1.25,8 2.5,0 3.75,8 5,0 6.25,8 7.5,0 8.75,8 10,0 11.25,8 12.5,0 13.75,8 15,0 16.25,8 17.5,0 18.75,8 20,0 21.25,8 22.5,0 23.75,8 25,0 26.25,8 27.5,0 28.75,8 30,0 31.25,8 32.5,0 33.75,8 35,0 36.25,8 37.5,0 38.75,8 40,0 41.25,8 42.5,0 43.75,8 45,0 46.25,8 47.5,0 48.75,8 50,0 51.25,8 52.5,0 53.75,8 55,0 56.25,8 57.5,0 58.75,8 60,0 61.25,8 62.5,0 63.75,8 65,0 66.25,8 67.5,0 68.75,8 70,0 71.25,8 72.5,0 73.75,8 75,0 76.25,8 77.5,0 78.75,8 80,0 81.25,8 82.5,0 83.75,8 85,0 86.25,8 87.5,0 88.75,8 90,0 91.25,8 92.5,0 93.75,8 95,0 96.25,8 97.5,0 98.75,8 100,0';

    const clienteNombre = ord.nombre_recibe || (state.user ? state.user.nombre_completo : 'Consumidor Final');
    const docNumero = state.user && state.user.numero_documento
      ? `${state.user.tipo_documento || 'CC'} ${state.user.numero_documento}`
      : '222222222222 (Consumidor Final)';
    const dirTexto = ord.direccion_entrega
      ? `${ord.direccion_entrega} (${ord.municipio || 'Villavicencio'})`
      : `Entrega en Sede / Domicilio Registrado (${ord.municipio || 'Villavicencio'})`;

    return `
      <div class="emulated-thermal-receipt" aria-label="Factura electrónica papel térmico">
        <div class="thermal-sawtooth top" aria-hidden="true">
          <svg viewBox="0 0 100 8" preserveAspectRatio="none"><polygon points="${topTeeth}" /></svg>
        </div>
        <div class="thermal-receipt-body">
          <div class="thermal-header-center">
            <div class="thermal-store-name">DANILLANOS S.A.S.</div>
            <div class="thermal-store-sub">DISTRIBUIDORA AGROPECUARIA & CÁRNICOS DEL META</div>
            <div class="thermal-store-sub">NIT: 900.842.190-4 • IVA RÉGIMEN SIMPLE</div>
            <div class="thermal-store-sub">Cra 32 # 24-18, Villavicencio - Meta</div>
            <div class="thermal-store-sub">PBX: (608) 662-4411 • WhatsApp: 310 234 5678</div>
          </div>

          <div class="thermal-divider-dashed">--------------------------------------------------------</div>

          <div class="thermal-meta-row">
            <div class="thermal-meta-col">
              <div><strong>FACTURA:</strong> ${invCode}</div>
              <div><strong>PEDIDO:</strong> #${orderId}</div>
              <div><strong>FECHA:</strong> ${dateStr}</div>
            </div>
            <div class="thermal-meta-col thermal-text-right">
              <div><strong>MEDIO PAGO:</strong> ${(ord.metodo_pago || 'efectivo').toUpperCase()}</div>
              <div><strong>ESTADO:</strong> ${estadoTexto}</div>
              <div><strong>REF:</strong> ${ord.referencia_pago || ('DN-' + orderId)}</div>
            </div>
          </div>

          <div class="thermal-divider-dashed">--------------------------------------------------------</div>

          <div class="thermal-customer-box">
            <div><strong>ADQUIRENTE:</strong> ${clienteNombre}</div>
            <div><strong>DOCUMENTO / NIT:</strong> ${docNumero}</div>
            <div><strong>DIRECCIÓN DE ENTREGA:</strong> ${dirTexto}</div>
            ${ord.telefono_cliente ? `<div><strong>TELÉFONO:</strong> ${ord.telefono_cliente}</div>` : ''}
            ${ord.entregador_nombre ? `<div><strong>ENTREGADOR RESPONSABLE:</strong> ${ord.entregador_nombre}</div>` : ''}
          </div>

          <div class="thermal-divider-dashed">--------------------------------------------------------</div>

          <div class="thermal-items-header">
            <span class="col-cant">CANT</span>
            <span class="col-desc">DESCRIPCIÓN DEL ARTÍCULO</span>
            <span class="col-unit">VR.UNIT</span>
            <span class="col-total">TOTAL</span>
          </div>
          <div class="thermal-divider-dotted">........................................................</div>

          <div class="thermal-items-list">
            ${items
              .map((it) => {
                const qty = Number(it.cantidad || 1);
                const unit = Number(it.precio_unitario ?? it.precio ?? 0);
                const sub = Number(it.subtotal ?? qty * unit);
                const name = (it.nombre_producto || it.nombre || 'Producto').toUpperCase();
                return `
                  <div class="thermal-item-row">
                    <span class="col-cant">${qty}x</span>
                    <span class="col-desc">${name}</span>
                    <span class="col-unit">${formatCurrency(unit)}</span>
                    <span class="col-total">${formatCurrency(sub)}</span>
                  </div>
                `;
              })
              .join('')}
          </div>

          <div class="thermal-divider-dashed">--------------------------------------------------------</div>

          <div class="thermal-totals-table">
            <div class="thermal-total-line">
              <span>SUBTOTAL PRODUCTOS:</span>
              <strong>${formatCurrency(ord.total)}</strong>
            </div>
            <div class="thermal-total-line">
              <span>IVA (19% / EXENTO LEY AGRO):</span>
              <span>$0</span>
            </div>
            <div class="thermal-total-line thermal-big-total">
              <span>TOTAL FACTURADO:</span>
              <strong>${formatCurrency(ord.total)}</strong>
            </div>
          </div>

          <div class="thermal-divider-dashed">--------------------------------------------------------</div>

          <div class="thermal-barcode-box">
            <div class="thermal-simulated-barcode" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="thermal-cufe-code">${cufeHash}</div>
            <div class="thermal-resolution-text">
              RESOLUCIÓN DIAN ELECTRÓNICA N° 18764000123 DE 2026-01-15<br/>
              RANGO AUTORIZADO: FAC-DN-000001 HASTA FAC-DN-999999<br/>
              ¡GRACIAS POR SU COMPRA EN DANILLANOS!
            </div>
          </div>
        </div>
        <div class="thermal-sawtooth bottom" aria-hidden="true">
          <svg viewBox="0 0 100 8" preserveAspectRatio="none"><polygon points="${bottomTeeth}" /></svg>
        </div>
      </div>
    `;
  }

  function buildInvoiceHtmlForOrder(ord) {
    return buildThermalPaperReceiptHtml(ord);
  }

  function openInvoiceModalByOrder(ord) {
    if (!ord) return;
    const backdrop = document.getElementById('invoiceModalBackdrop');
    const content = document.getElementById('invoiceModalContent');
    if (!backdrop || !content) return;
    content.innerHTML = buildInvoiceHtmlForOrder(ord);
    backdrop.classList.remove('hidden');
  }

    function closeModalWithAnimation(backdrop) {
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    backdrop.classList.add('is-closing');
    setTimeout(() => {
      backdrop.classList.remove('is-closing');
      backdrop.classList.add('hidden');
    }, 220);
  }

  function initSharedInvoiceModalEvents() {
    const backdrop = document.getElementById('invoiceModalBackdrop');
    const closeBtn = document.getElementById('btnCloseInvoiceModal');
    if (!backdrop) return;
    closeBtn?.addEventListener('click', () => closeModalWithAnimation(backdrop));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModalWithAnimation(backdrop);
    });
  }

  let customerTabSliderInitialized = false;

  function updateCustomerTabSlider(immediate = false) {
    const tabsBar = document.getElementById('customerProfileTabsBar');
    const slider = document.getElementById('customerTabSlider');
    if (!tabsBar || !slider || tabsBar.classList.contains('hidden')) return;

    const activeBtn = tabsBar.querySelector('.customer-tab-btn.active');
    if (!activeBtn) {
      slider.style.opacity = '0';
      return;
    }

    const barRect = tabsBar.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    if (btnRect.width === 0 || btnRect.height === 0) return;

    const left = btnRect.left - barRect.left;
    const top = btnRect.top - barRect.top;

    if (!customerTabSliderInitialized || immediate === true) {
      slider.style.transition = 'none';
      slider.style.opacity = '1';
      slider.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      slider.style.width = `${btnRect.width}px`;
      slider.style.height = `${btnRect.height}px`;
      void slider.offsetHeight;
      slider.style.transition = '';
      customerTabSliderInitialized = true;
      return;
    }

    slider.style.opacity = '1';
    slider.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    slider.style.width = `${btnRect.width}px`;
    slider.style.height = `${btnRect.height}px`;
  }

  function switchCustomerProfileTab(tabName) {
    state.activeProfileTab = tabName || 'pedidos';

    document.querySelectorAll('[data-profile-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-profile-tab') === state.activeProfileTab);
    });

    document.querySelectorAll('[data-profile-window]').forEach((sec) => {
      const isMatch = sec.getAttribute('data-profile-window') === state.activeProfileTab;
      sec.classList.toggle('hidden', !state.user || !isMatch);
    });

    if (state.activeProfileTab === 'direcciones' && state.user) {
      setupInteractiveCoverageMap('addressMapCanvas');
      setTimeout(() => state.maps.addressMap?.invalidateSize(), 200);
    }

    if (state.activeProfileTab === 'soporte' && state.user) {
      loadCustomerSupportTickets();
    }

    requestAnimationFrame(updateCustomerTabSlider);
    setTimeout(updateCustomerTabSlider, 50);
  }

  function syncProfileTabFromHash() {
    const h = window.location.hash;
    if (h === '#direcciones-mapa-section' || h === '#mi-cuenta' || h === '#cuenta-section') switchCustomerProfileTab('direcciones');
    else if (h === '#historial-compras-section') switchCustomerProfileTab('historial');
    else if (h === '#soporte-cliente') switchCustomerProfileTab('soporte');
    else if (h === '#mis-pedidos-section') switchCustomerProfileTab('pedidos');
  }

  // ==========================================================================
  // GESTION DE CONTRASENA Y POP-UP CUSTOMIZADO PARA ASIGNAR / CAMBIAR PASSWORD
  // ==========================================================================
  let currentPasswordModalCallback = null;
  let currentPasswordModalRequiredForLogout = false;

  function isGoogleUserWithoutPassword(user = state.user) {
    if (!user) return false;
    const isGoogle = Boolean(
      user.is_google_account ||
      (user.avatar_url && user.avatar_url.includes('googleusercontent.com'))
    );
    const hasPass = Boolean(user.has_password);
    return isGoogle && !hasPass;
  }

  function attemptUserLogout(onSuccess) {
    if (isGoogleUserWithoutPassword(state.user)) {
      openPasswordModal({
        isRequiredForLogout: true,
        onPasswordSet: () => {
          showToast('Contraseña asignada. Cerrando sesión...', 'success');
          if (typeof onSuccess === 'function') {
            setTimeout(() => {
              onSuccess();
            }, 700);
          }
        }
      });
      return false;
    }

    if (typeof onSuccess === 'function') {
      onSuccess();
    }
    return true;
  }

  function ensureAccountPasswordModalInDOM() {
    if (document.getElementById('accountPasswordModal')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
    <div class="modal-backdrop hidden" id="accountPasswordModal" role="dialog" aria-modal="true" aria-labelledby="pwdModalTitle">
      <div class="modal-card password-modal-dialog" style="max-width: 490px; width: 100%; padding: 1.85rem 2rem; border-radius: 28px !important; overflow: hidden;">
        <div class="modal-header" style="margin-bottom: 1.25rem;">
          <div class="modal-title-wrap">
            <span class="material-symbols-rounded modal-title-icon" id="pwdModalIcon" style="font-size: 2rem; color: var(--brand-red);">lock</span>
            <div>
              <h3 class="modal-title" id="pwdModalTitle">Cambiar Contraseña</h3>
              <p class="modal-subtitle" id="pwdModalSubtitle">
                Actualiza tu clave de acceso para mayor seguridad.
              </p>
            </div>
          </div>
          <button type="button" class="icon-close-btn" id="btnClosePasswordModal" aria-label="Cerrar ventana">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <div id="pwdModalRequiredNotice" class="hidden" style="background: rgba(224, 26, 44, 0.08); border: 1px solid rgba(224, 26, 44, 0.3); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.15rem; display: flex; align-items: flex-start; gap: 0.65rem;">
          <span class="material-symbols-rounded" style="color: var(--brand-red); font-size: 1.35rem; flex-shrink: 0; margin-top: 2px;">shield_lock</span>
          <div style="font-size: 0.82rem; line-height: 1.45; color: var(--text-primary);">
            <strong style="color: var(--brand-red); display: block; margin-bottom: 2px;">Crea una contraseña antes de salir</strong>
            Como ingresaste con tu cuenta de Google, debes asignar una contraseña personal a tu cuenta antes de cerrar sesión para que siempre puedas acceder a ella directamente.
          </div>
        </div>

        <form id="accountPasswordForm" class="modal-form" novalidate>
          <div class="form-group" id="pwdCurrentGroup">
            <label for="pwdModalActual" style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 5px;">
              Contraseña Actual *
            </label>
            <div style="position: relative;">
              <input
                type="password"
                id="pwdModalActual"
                class="modal-input"
                placeholder="Ingresa tu contraseña actual"
                autocomplete="current-password"
                style="width: 100%; padding-right: 2.75rem; box-sizing: border-box;"
              />
              <button
                type="button"
                class="pwd-toggle-visibility-btn"
                data-target="pwdModalActual"
                style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; display: flex; align-items: center;"
                aria-label="Ver u ocultar contraseña"
              >
                <span class="material-symbols-rounded" style="font-size: 1.25rem;">visibility</span>
              </button>
            </div>
          </div>

          <div class="form-group" id="pwdNewGroup">
            <label for="pwdModalNueva" style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 5px;">
              Nueva Contraseña * (Mínimo 6 caracteres)
            </label>
            <div style="position: relative;">
              <input
                type="password"
                id="pwdModalNueva"
                class="modal-input"
                placeholder="Define tu nueva contraseña"
                minlength="6"
                autocomplete="new-password"
                required
                style="width: 100%; padding-right: 2.75rem; box-sizing: border-box;"
              />
              <button
                type="button"
                class="pwd-toggle-visibility-btn"
                data-target="pwdModalNueva"
                style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; display: flex; align-items: center;"
                aria-label="Ver u ocultar contraseña"
              >
                <span class="material-symbols-rounded" style="font-size: 1.25rem;">visibility</span>
              </button>
            </div>
          </div>

          <div class="form-group" id="pwdConfirmGroup">
            <label for="pwdModalConfirmar" style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 5px;">
              Confirmar Nueva Contraseña *
            </label>
            <div style="position: relative;">
              <input
                type="password"
                id="pwdModalConfirmar"
                class="modal-input"
                placeholder="Repite la nueva contraseña"
                minlength="6"
                autocomplete="new-password"
                required
                style="width: 100%; padding-right: 2.75rem; box-sizing: border-box;"
              />
              <button
                type="button"
                class="pwd-toggle-visibility-btn"
                data-target="pwdModalConfirmar"
                style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; display: flex; align-items: center;"
                aria-label="Ver u ocultar contraseña"
              >
                <span class="material-symbols-rounded" style="font-size: 1.25rem;">visibility</span>
              </button>
            </div>
          </div>

          <div id="pwdModalFeedback" class="hidden" style="margin-top: 0.4rem; font-size: 0.82rem; padding: 0.65rem 0.85rem; border-radius: var(--radius-md);"></div>

          <div class="modal-actions-row" style="margin-top: 1.25rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="btn-secondary" id="btnCancelPasswordModal" style="padding: 0.65rem 1.2rem; font-size: 0.88rem;">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" id="btnSubmitPasswordModal" style="padding: 0.65rem 1.35rem; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 0.5rem;">
              <span class="material-symbols-rounded" style="font-size: 1.15rem;">save</span>
              <span id="btnSubmitPasswordText">Guardar Contraseña</span>
            </button>
          </div>
        </form>
      </div>
    </div>`;
    const el = wrapper.firstElementChild;
    if (el) {
      document.body.appendChild(el);
    }
  }

  function openPasswordModal({ isRequiredForLogout = false, onPasswordSet = null } = {}) {
    ensureAccountPasswordModalInDOM();
    initAccountPasswordModal();

    currentPasswordModalCallback = onPasswordSet;
    currentPasswordModalRequiredForLogout = isRequiredForLogout;

    const modal = document.getElementById('accountPasswordModal');
    if (!modal) return;

    const titleEl = document.getElementById('pwdModalTitle');
    const subtitleEl = document.getElementById('pwdModalSubtitle');
    const iconEl = document.getElementById('pwdModalIcon');
    const noticeEl = document.getElementById('pwdModalRequiredNotice');
    const currentGroup = document.getElementById('pwdCurrentGroup');
    const submitTextEl = document.getElementById('btnSubmitPasswordText');
    const cancelBtn = document.getElementById('btnCancelPasswordModal');
    const feedbackEl = document.getElementById('pwdModalFeedback');
    const form = document.getElementById('accountPasswordForm');

    if (form) form.reset();
    if (feedbackEl) {
      feedbackEl.className = 'hidden';
      feedbackEl.textContent = '';
    }

    modal.querySelectorAll('input[type="text"]').forEach((inp) => {
      if (inp.id && inp.id.startsWith('pwdModal')) inp.type = 'password';
    });
    modal.querySelectorAll('.pwd-toggle-visibility-btn .material-symbols-rounded').forEach((icon) => {
      icon.textContent = 'visibility';
    });

    const hasPass = Boolean(state.user && state.user.has_password);

    if (isRequiredForLogout) {
      if (titleEl) titleEl.textContent = 'Asignar Contraseña a tu Cuenta';
      if (subtitleEl) subtitleEl.textContent = 'Crea una contraseña antes de salir para que puedas acceder siempre.';
      if (iconEl) iconEl.textContent = 'shield_lock';
      if (noticeEl) noticeEl.classList.remove('hidden');
      if (currentGroup) currentGroup.classList.add('hidden');
      if (submitTextEl) submitTextEl.textContent = 'Guardar y Cerrar Sesión';
      if (cancelBtn) cancelBtn.textContent = 'Permanecer Conectado';
    } else if (!hasPass) {
      if (titleEl) titleEl.textContent = 'Crear Contraseña Personal';
      if (subtitleEl) subtitleEl.textContent = 'Asigna una contraseña para acceder directamente con tu correo electrónico.';
      if (iconEl) iconEl.textContent = 'lock_open';
      if (noticeEl) noticeEl.classList.add('hidden');
      if (currentGroup) currentGroup.classList.add('hidden');
      if (submitTextEl) submitTextEl.textContent = 'Asignar Contraseña';
      if (cancelBtn) cancelBtn.textContent = 'Cancelar';
    } else {
      if (titleEl) titleEl.textContent = 'Cambiar Contraseña';
      if (subtitleEl) subtitleEl.textContent = 'Ingresa tu contraseña actual y define tu nueva contraseña segura.';
      if (iconEl) iconEl.textContent = 'lock';
      if (noticeEl) noticeEl.classList.add('hidden');
      if (currentGroup) currentGroup.classList.remove('hidden');
      if (submitTextEl) submitTextEl.textContent = 'Actualizar Contraseña';
      if (cancelBtn) cancelBtn.textContent = 'Cancelar';
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
      const firstInput = isRequiredForLogout || !hasPass
        ? document.getElementById('pwdModalNueva')
        : document.getElementById('pwdModalActual');
      firstInput?.focus();
    }, 100);
  }

  function closePasswordModal() {
    const modal = document.getElementById('accountPasswordModal');
    if (!modal) return;
    modal.classList.add('hidden');
    currentPasswordModalCallback = null;
    currentPasswordModalRequiredForLogout = false;
  }

  async function handlePasswordFormSubmit(e) {
    e.preventDefault();
    const feedbackEl = document.getElementById('pwdModalFeedback');
    const submitBtn = document.getElementById('btnSubmitPasswordModal');
    const actualInp = document.getElementById('pwdModalActual');
    const nuevaInp = document.getElementById('pwdModalNueva');
    const confirmInp = document.getElementById('pwdModalConfirmar');

    const passwordActual = actualInp ? actualInp.value : '';
    const nuevaPassword = nuevaInp ? nuevaInp.value.trim() : '';
    const confirmPassword = confirmInp ? confirmInp.value.trim() : '';

    const hasPass = Boolean(state.user && state.user.has_password);

    function showError(msg) {
      if (!feedbackEl) return;
      feedbackEl.textContent = msg;
      feedbackEl.className = '';
      feedbackEl.style.backgroundColor = 'rgba(224, 26, 44, 0.1)';
      feedbackEl.style.color = 'var(--brand-red)';
      feedbackEl.style.border = '1px solid rgba(224, 26, 44, 0.3)';
      feedbackEl.classList.remove('hidden');
    }

    function showSuccess(msg) {
      if (!feedbackEl) return;
      feedbackEl.textContent = msg;
      feedbackEl.className = '';
      feedbackEl.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      feedbackEl.style.color = '#10b981';
      feedbackEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      feedbackEl.classList.remove('hidden');
    }

    if (hasPass && !currentPasswordModalRequiredForLogout && !passwordActual) {
      showError('Por favor ingresa tu contraseña actual.');
      actualInp?.focus();
      return;
    }

    if (!nuevaPassword || nuevaPassword.length < 6) {
      showError('La nueva contraseña debe tener al menos 6 caracteres.');
      nuevaInp?.focus();
      return;
    }

    if (nuevaPassword !== confirmPassword) {
      showError('Las contraseñas no coinciden. Verifica e intenta nuevamente.');
      confirmInp?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';
    }

    try {
      const apiBase = (CONFIG && CONFIG.api && CONFIG.api.baseUrl) || '/api';
      const res = await fetch(`${apiBase}/auth/cambiar-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          password_actual: passwordActual,
          nueva_password: nuevaPassword
        })
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        showError(data.error || data.message || 'No se pudo actualizar la contraseña.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }
        return;
      }

      if (state.user) {
        state.user.has_password = true;
        if (data.user) {
          state.user = { ...state.user, ...data.user, has_password: true };
        }
        localStorage.setItem('danillanos_user', JSON.stringify(state.user));
        sessionStorage.setItem('danillanos_user', JSON.stringify(state.user));
      }

      showSuccess(data.message || '¡Contraseña establecida exitosamente!');

      setTimeout(() => {
        const callback = currentPasswordModalCallback;
        closePasswordModal();
        if (CURRENT_PAGE === 'perfil') {
          renderPerfilPageAuthState();
        }
        if (typeof callback === 'function') {
          callback();
        }
      }, 700);

    } catch (err) {
      showError('Error de red al procesar la solicitud. Verifica tu conexión.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
    }
  }

  function initAccountPasswordModal() {
    const modal = document.getElementById('accountPasswordModal');
    if (!modal || modal._pwdInitialized) return;
    modal._pwdInitialized = true;

    document.getElementById('btnClosePasswordModal')?.addEventListener('click', closePasswordModal);
    document.getElementById('btnCancelPasswordModal')?.addEventListener('click', closePasswordModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closePasswordModal();
      }
    });

    modal.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.pwd-toggle-visibility-btn');
      if (!toggleBtn) return;
      const targetId = toggleBtn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const icon = toggleBtn.querySelector('.material-symbols-rounded');
      if (!input || !icon) return;

      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    });

    document.getElementById('accountPasswordForm')?.addEventListener('submit', handlePasswordFormSubmit);
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#btnOpenPasswordModal')) {
      openPasswordModal({ isRequiredForLogout: false });
    }
  });

  async function refreshCurrentUserSession() {
    if (!state.token) return;
    try {
      const apiBase = (CONFIG && CONFIG.api && CONFIG.api.baseUrl) || '/api';
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated && data.user) {
        state.user = {
          ...state.user,
          ...data.user,
          email: (data.user.email && !data.user.email.endsWith('@danillanos.com'))
            ? data.user.email
            : (state.user.email || data.user.email),
          avatar_url: (data.user.avatar_url && !data.user.avatar_url.includes('test-avatar-photo'))
            ? data.user.avatar_url
            : (state.user.avatar_url || data.user.avatar_url),
          rol: normalizeRole(data.user.rol),
          has_password: (data.user.has_password !== undefined)
            ? data.user.has_password
            : Boolean(state.user.has_password)
        };
        if (Array.isArray(data.direcciones)) {
          state.direcciones = data.direcciones;
        }
        localStorage.setItem('danillanos_user', JSON.stringify(state.user));
        sessionStorage.setItem('danillanos_user', JSON.stringify(state.user));
        syncSelectedAddressDefault();
        renderSharedHeaderAuthUI();
        if (CURRENT_PAGE === 'perfil') {
          renderPerfilPageAuthState();
        }
        if (CURRENT_PAGE === 'perfil') {
          const securityCard = document.getElementById('securitySummaryCard');
          if (securityCard) {
            const hasPass = Boolean(state.user.has_password);
            const iconEl = document.getElementById('securityCardIcon');
            const statusTextEl = document.getElementById('securityCardStatusText');
            const btnTextEl = document.getElementById('btnOpenPasswordModalText');
            if (iconEl && statusTextEl && btnTextEl) {
              if (hasPass) {
                iconEl.textContent = 'lock';
                statusTextEl.textContent = 'Tu cuenta está protegida con contraseña personal.';
                btnTextEl.textContent = 'Cambiar Contraseña';
              } else {
                iconEl.textContent = 'lock_open';
                statusTextEl.textContent = 'Iniciaste con Google. Asigna una contraseña para acceder directamente.';
                btnTextEl.textContent = 'Asignar Contraseña';
              }
            }
          }
        }
      }
    } catch (_) {}
  }

  function initPerfilPage() {
    initSharedInvoiceModalEvents();
    initAccountPasswordModal();
    renderPerfilPageAuthState();
    window.addEventListener('hashchange', syncProfileTabFromHash);
    window.addEventListener('resize', () => updateCustomerTabSlider(true));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(updateCustomerTabSlider, 60));
    }

    document.getElementById('customerProfileTabsBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-profile-tab]');
      if (!btn) return;
      switchCustomerProfileTab(btn.getAttribute('data-profile-tab'));
    });

    document.querySelectorAll('[data-open-profile-tab]').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (!state.user) return;
        e.preventDefault();
        switchCustomerProfileTab(link.getAttribute('data-open-profile-tab'));
      });
    });

    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabRegisterBtn = document.getElementById('tabRegisterBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const wideAuthCard = document.getElementById('wideAuthCard');
    const authTabsBar = document.getElementById('authTabsBar');
    const authFormsViewport = document.getElementById('authFormsViewport');
    const loginFormPanel = document.getElementById('loginFormPanel');
    const registerFormPanel = document.getElementById('registerFormPanel');

    function syncAuthViewportHeight(mode) {
      if (!authFormsViewport) return;
      const targetPanel = mode === 'register' ? registerFormPanel : loginFormPanel;
      if (!targetPanel) return;
      requestAnimationFrame(() => {
        const h = targetPanel.scrollHeight;
        if (h > 0) {
          authFormsViewport.style.height = `${h}px`;
        }
      });
    }

    function setAuthSlideMode(mode) {
      const isRegister = mode === 'register';
      tabLoginBtn?.classList.toggle('active', !isRegister);
      tabRegisterBtn?.classList.toggle('active', isRegister);
      wideAuthCard?.classList.toggle('is-register-mode', isRegister);
      authTabsBar?.classList.toggle('is-register-mode', isRegister);
      loginFormPanel?.classList.toggle('is-active', !isRegister);
      registerFormPanel?.classList.toggle('is-active', isRegister);
      // Fallback para estructuras sin carril deslizante
      if (!authFormsViewport) {
        loginForm?.classList.toggle('hidden', isRegister);
        registerForm?.classList.toggle('hidden', !isRegister);
      } else {
        loginForm?.classList.remove('hidden');
        registerForm?.classList.remove('hidden');
        syncAuthViewportHeight(mode);
      }
    }

    tabLoginBtn?.addEventListener('click', () => setAuthSlideMode('login'));
    tabRegisterBtn?.addEventListener('click', () => setAuthSlideMode('register'));
    setAuthSlideMode('login');
    window.addEventListener('resize', () => {
      const isReg = wideAuthCard?.classList.contains('is-register-mode');
      syncAuthViewportHeight(isReg ? 'register' : 'login');
    });

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      // Verificar si la cuenta fue desactivada o cambió de rol por el Administrador
      const localUsers = getLocalUsersStore();
      const localMatch = localUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (localMatch && localMatch.activo === false) {
        alert('Esta cuenta se encuentra desactivada por el Administrador.');
        return;
      }

      try {
        const res = await fetch(`${CONFIG.api.baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          alert(data.message || 'Credenciales incorrectas.');
          return;
        }
        const finalUser = localMatch
          ? { ...data.user, rol: normalizeRole(localMatch.rol) }
          : { ...data.user, rol: normalizeRole(data.user.rol) };
        setSession(data.token, finalUser, data.direcciones);
        if (isStaffUser(finalUser)) {
          window.location.href = 'panel.html';
          return;
        }
        renderPerfilPageAuthState();
      } catch (err) {
        // Respaldo local en caso de que el servidor Node no esté activo al probar en móvil
        if (localMatch) {
          const fallbackUser = {
            ...localMatch,
            rol: normalizeRole(localMatch.rol)
          };
          setSession(`local_token_${fallbackUser.id}_${Date.now()}`, fallbackUser, []);
          if (isStaffUser(fallbackUser)) {
            window.location.href = 'panel.html';
            return;
          }
          renderPerfilPageAuthState();
          return;
        }
        alert('No se pudo iniciar sesión.');
      }
    });

    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombres = document.getElementById('regNombres')?.value.trim() || '';
      const apellidos = document.getElementById('regApellidos')?.value.trim() || '';
      const empresa = document.getElementById('regEmpresa')?.value.trim() || '';
      const tipo_documento = document.getElementById('regTipoDoc')?.value || 'CC';
      const numero_documento = document.getElementById('regNumDoc')?.value.trim() || '';
      const telefono = document.getElementById('regPhone')?.value.trim() || '';
      const email = document.getElementById('regEmail')?.value.trim() || '';
      const password = document.getElementById('regPassword')?.value || '';

      try {
        const res = await fetch(`${CONFIG.api.baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombres,
            apellidos,
            empresa,
            tipo_documento,
            numero_documento,
            nombre_completo: `${nombres} ${apellidos}`.trim(),
            username: empresa || `${nombres} ${apellidos}`.trim(),
            email,
            telefono,
            password
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          alert(data.message || 'Error al registrar usuario');
          return;
        }
        const usersList = getLocalUsersStore();
        if (!usersList.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          usersList.push({ ...data.user, activo: true });
          saveLocalUsersStore(usersList);
        }
        setSession(data.token, data.user, data.direcciones);
        renderPerfilPageAuthState();
      } catch (err) {
        alert('Error al crear la cuenta.');
      }
    });

    // ========================================================================
    // INTEGRACIÓN NATIVA GOOGLE IDENTITY SERVICES (GIS OAUTH 2.0)
    // Client ID oficial de Danillanos para login y registro inmediato
    // ========================================================================
    const GOOGLE_CLIENT_ID =
      CONFIG.auth?.googleClientId ||
      '394071429874-5ev2n04b6j7akvqg0rtaene6461smr10.apps.googleusercontent.com';

    let googleTokenClient = null;

    async function handleGoogleLoginSuccess(googlePayload) {
      try {
        const res = await fetch(`${CONFIG.api.baseUrl}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googlePayload)
        });
        const data = await res.json();
        if (data.ok) {
          const usersList = getLocalUsersStore();
          if (data.user && !usersList.some((u) => u.email.toLowerCase() === data.user.email.toLowerCase())) {
            usersList.push({ ...data.user, activo: true });
            saveLocalUsersStore(usersList);
          }
          setSession(data.token, data.user, data.direcciones);
          renderPerfilPageAuthState();
        } else {
          alert(data.message || 'Error al autenticar con Google');
        }
      } catch (err) {
        alert('Error al conectar con el servidor.');
      }
    }

    function initGoogleIdentityClient() {
      if (typeof window.google === 'undefined') return;

      // 1. Inicializar receptor de credenciales / One Tap
      if (window.google.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response) => {
              if (response && response.credential) {
                handleGoogleLoginSuccess({ credential: response.credential });
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true
          });
        } catch (_) {}
      }

      // 2. Inicializar cliente de token OAuth 2.0 (ventana emergente oficial de Google)
      if (window.google.accounts?.oauth2) {
        try {
          googleTokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile openid',
            callback: async (tokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                try {
                  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                  });
                  const profile = await userInfoRes.json();
                  if (profile && profile.email) {
                    handleGoogleLoginSuccess({
                      email: profile.email,
                      nombre_completo: profile.name || profile.given_name,
                      google_id: profile.sub,
                      avatar_url: profile.picture,
                      access_token: tokenResponse.access_token
                    });
                  }
                } catch (_) {
                  alert('No se pudo obtener la información de tu perfil de Google.');
                }
              }
            }
          });
        } catch (_) {}
      }
    }

    if (typeof window.google !== 'undefined') {
      initGoogleIdentityClient();
    } else {
      window.addEventListener('load', initGoogleIdentityClient);
    }

    document.getElementById('btnGoogleAuth')?.addEventListener('click', () => {
      // 1. Flujo primario: Ventana emergente oficial de Google OAuth 2.0
      if (googleTokenClient) {
        googleTokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      }

      // 2. Flujo secundario: Google One Tap si ya cargó id
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            fallbackManualGooglePrompt();
          }
        });
        return;
      }

      // 3. Flujo de contingencia si un bloqueador de anuncios o falta de internet impide cargar el SDK de Google
      fallbackManualGooglePrompt();
    });

    async function fallbackManualGooglePrompt() {
      const googleEmail = prompt(
        'Acceso con Google:\nIngresa tu correo de Gmail:',
        'cliente.danillanos@gmail.com'
      );
      if (!googleEmail) return;
      const cleanName = googleEmail.split('@')[0].replace(/[._]/g, ' ');
      handleGoogleLoginSuccess({
        email: googleEmail,
        nombre_completo: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        google_id: `google_${Date.now()}`
      });
    }

    document.querySelectorAll('[data-demo-email]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const email = chip.getAttribute('data-demo-email');
        tabLoginBtn?.click();
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = 'Danillanos2026*';
        loginForm?.requestSubmit();
      });
    });

    document.getElementById('btnLogoutProfile')?.addEventListener('click', () => {
      attemptUserLogout(() => {
        setSession(null, null, []);
        renderPerfilPageAuthState();
      });
    });

    const addAddressForm = document.getElementById('addAddressForm');
    addAddressForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.user) return;
      if (state.direcciones.length >= 5) return;

      const payload = {
        etiqueta: document.getElementById('addrLabel').value.trim(),
        municipio: document.getElementById('addrMunicipio').value.trim(),
        direccion: document.getElementById('addrStreet').value.trim(),
        barrio_referencia: document.getElementById('addrRef').value.trim(),
        lat: Number(document.getElementById('addrLat').value),
        lng: Number(document.getElementById('addrLng').value)
      };

      const res = await fetch(`${CONFIG.api.baseUrl}/direcciones`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        state.direcciones = data.direcciones;
        sessionStorage.setItem('danillanos_dirs', JSON.stringify(state.direcciones));
        syncSelectedAddressDefault();
        renderSavedAddressesList();
        renderCartLiveAddressManager();
        renderSharedHeaderAuthUI();
      }
    });

    document.getElementById('savedAddressesList')?.addEventListener('click', async (e) => {
      const selectBtn = e.target.closest('[data-select-addr-id]');
      if (selectBtn) {
        state.selectedAddressId = Number(selectBtn.getAttribute('data-select-addr-id'));
        sessionStorage.setItem('danillanos_selected_addr_id', String(state.selectedAddressId));
        renderSavedAddressesList();
        renderCartLiveAddressManager();
        return;
      }

      const delBtn = e.target.closest('[data-delete-addr-id]');
      if (!delBtn) return;
      const id = Number(delBtn.getAttribute('data-delete-addr-id'));
      const res = await fetch(`${CONFIG.api.baseUrl}/direcciones/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.ok) {
        state.direcciones = data.direcciones;
        sessionStorage.setItem('danillanos_dirs', JSON.stringify(state.direcciones));
        syncSelectedAddressDefault();
        renderSavedAddressesList();
        renderCartLiveAddressManager();
        renderSharedHeaderAuthUI();
      }
    });

    // ========================================================================
    // MODAL Y FORMULARIO DE EDICIÓN DE PERFIL COMERCIAL Y DATOS DEL TITULAR
    // ========================================================================
    const editProfileBackdrop = document.getElementById('editProfileModalBackdrop');
    const editProfileForm = document.getElementById('editProfileForm');
    const btnCloseEditProfile = document.getElementById('btnCloseEditProfileModal');
    const btnCancelEditProfile = document.getElementById('btnCancelEditProfile');

    function openEditProfileModal() {
      if (!state.user || !editProfileBackdrop) return;
      const nomInput = document.getElementById('editProfileNombre');
      const empInput = document.getElementById('editProfileEmpresa');
      const tipoInput = document.getElementById('editProfileTipoDoc');
      const numInput = document.getElementById('editProfileNumDoc');
      const telInput = document.getElementById('editProfileTelefono');

      if (nomInput) nomInput.value = state.user.nombre_completo || '';
      if (empInput) empInput.value = state.user.empresa || '';
      if (tipoInput) tipoInput.value = state.user.tipo_documento || 'CC';
      if (numInput) numInput.value = state.user.numero_documento || '';
      if (telInput) telInput.value = state.user.telefono || '';
      editProfileBackdrop.classList.remove('hidden');
    }

    function closeEditProfileModal() {
      if (editProfileBackdrop) editProfileBackdrop.classList.add('hidden');
    }

    btnCloseEditProfile?.addEventListener('click', closeEditProfileModal);
    btnCancelEditProfile?.addEventListener('click', closeEditProfileModal);
    editProfileBackdrop?.addEventListener('click', (e) => {
      if (e.target === editProfileBackdrop) closeEditProfileModal();
    });

    function toggleAddAddressSection(forceOpen = null) {
      const ws = document.getElementById('addressRegistrationWorkspace');
      const btnText = document.getElementById('toggleAddAddressBtnText');
      const btn = document.getElementById('btnToggleAddAddressSection');
      if (!ws) return;

      const shouldOpen = forceOpen !== null ? forceOpen : ws.classList.contains('hidden');
      if (shouldOpen) {
        ws.classList.remove('hidden');
        if (btnText) btnText.textContent = 'Cerrar Registro';
        if (btn) btn.classList.add('is-active');
        setupInteractiveCoverageMap('addressMapCanvas');
        setTimeout(() => {
          state.maps.addressMap?.invalidateSize();
          ws.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      } else {
        ws.classList.add('hidden');
        if (btnText) btnText.textContent = 'Añadir Dirección';
        if (btn) btn.classList.remove('is-active');
      }
    }

    function setProfileEditingState(isEditing) {
      const pencilBtn = document.getElementById('btnToggleProfileEdit');
      const pencilIcon = document.getElementById('btnToggleProfileEditIcon');
      const cancelBtn = document.getElementById('btnCancelProfileEdit');
      const staticGrid = document.getElementById('companyStaticGrid');
      const editForm = document.getElementById('inlineProfileForm');

      if (!pencilBtn || !staticGrid || !editForm) return;

      if (isEditing) {
        pencilBtn.classList.add('is-editing');
        pencilBtn.setAttribute('title', 'Guardar Cambios');
        if (pencilIcon) pencilIcon.textContent = 'save';
        staticGrid.classList.add('hidden');
        editForm.classList.remove('hidden');
        if (cancelBtn) cancelBtn.classList.remove('hidden');
        const firstInput = document.getElementById('inlineProfileNombre');
        if (firstInput) firstInput.focus();
      } else {
        pencilBtn.classList.remove('is-editing');
        pencilBtn.setAttribute('title', 'Editar información comercial');
        if (pencilIcon) pencilIcon.textContent = 'edit';
        editForm.classList.add('hidden');
        staticGrid.classList.remove('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');
      }
    }

    function cancelInlineProfileChanges() {
      if (!state.user) return;
      const nomInput = document.getElementById('inlineProfileNombre');
      const empInput = document.getElementById('inlineProfileEmpresa');
      const tipoInput = document.getElementById('inlineProfileTipoDoc');
      const numInput = document.getElementById('inlineProfileNumDoc');
      const telInput = document.getElementById('inlineProfileTelefono');

      if (nomInput) nomInput.value = state.user.nombre_completo || state.user.username || '';
      if (empInput) empInput.value = state.user.empresa || '';
      if (tipoInput) tipoInput.value = state.user.tipo_documento || 'CC';
      if (numInput) numInput.value = state.user.numero_documento || '';
      if (telInput) telInput.value = state.user.telefono || '';

      const msgEl = document.getElementById('inlineProfileSaveMsg');
      if (msgEl) msgEl.style.display = 'none';

      setProfileEditingState(false);
    }

    async function saveInlineProfileChanges() {
      if (!state.user) return;
      const nomInput = document.getElementById('inlineProfileNombre');
      const empInput = document.getElementById('inlineProfileEmpresa');
      const tipoInput = document.getElementById('inlineProfileTipoDoc');
      const numInput = document.getElementById('inlineProfileNumDoc');
      const telInput = document.getElementById('inlineProfileTelefono');
      const msgEl = document.getElementById('inlineProfileSaveMsg');
      const saveBtn = document.getElementById('btnToggleProfileEdit');

      const payload = {
        nombre_completo: nomInput ? nomInput.value.trim() : state.user.nombre_completo,
        empresa: empInput ? empInput.value.trim() : '',
        tipo_documento: tipoInput ? tipoInput.value : 'CC',
        numero_documento: numInput ? numInput.value.trim() : '',
        telefono: telInput ? telInput.value.trim() : '',
        email: state.user.email || undefined,
        avatar_url: state.user.avatar_url || undefined
      };

      if (!payload.nombre_completo) {
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.color = '#ef4444';
          msgEl.textContent = '❌ El nombre del titular es requerido.';
        }
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.7';
      }

      try {
        const res = await fetch(`${CONFIG.api.baseUrl}/auth/perfil`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok && data.user) {
          state.user = {
            ...state.user,
            ...data.user,
            email: (data.user.email && !data.user.email.endsWith('@danillanos.com'))
              ? data.user.email
              : (state.user.email || data.user.email),
            avatar_url: (data.user.avatar_url && !data.user.avatar_url.includes('test-avatar-photo'))
              ? data.user.avatar_url
              : (state.user.avatar_url || data.user.avatar_url),
            telefono: payload.telefono || data.user.telefono || '',
            has_password: (data.user.has_password !== undefined)
              ? data.user.has_password
              : Boolean(state.user.has_password)
          };
        } else {
          state.user = { ...state.user, ...payload };
        }
      } catch (_) {
        state.user = { ...state.user, ...payload };
      }

      localStorage.setItem('danillanos_user', JSON.stringify(state.user));
      sessionStorage.setItem('danillanos_user', JSON.stringify(state.user));

      const usersList = getLocalUsersStore();
      const idx = usersList.findIndex((u) => Number(u.id) === Number(state.user.id));
      if (idx !== -1) {
        usersList[idx] = { ...usersList[idx], ...state.user };
        saveLocalUsersStore(usersList);
      }

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
      }

      const loggedName = document.getElementById('loggedUserName');
      if (loggedName) loggedName.textContent = state.user.nombre_completo;
      const loggedEmailEl = document.getElementById('loggedUserEmail');
      if (loggedEmailEl) loggedEmailEl.textContent = `${state.user.email || 'Sin correo'} • ${state.user.telefono || 'Sin teléfono'}`;
      const extraEl = document.getElementById('loggedUserExtra');
      if (extraEl) {
        const docPart = state.user.numero_documento ? `${state.user.tipo_documento || 'CC'}: ${state.user.numero_documento}` : '';
        const empPart = state.user.empresa ? ` • Empresa: ${state.user.empresa}` : '';
        extraEl.textContent = `${docPart}${empPart}`;
      }
      renderSharedHeaderAuthUI();
      renderPerfilPageAuthState();
      setProfileEditingState(false);

      // Update static bold elements
      const sNom = document.getElementById('staticProfileNombre');
      if (sNom) sNom.textContent = state.user.nombre_completo || state.user.username || 'No registrado';
      const sEmp = document.getElementById('staticProfileEmpresa');
      if (sEmp) sEmp.textContent = state.user.empresa || 'Cuenta Personal / Hogar';
      const sDoc = document.getElementById('staticProfileDocumento');
      if (sDoc) sDoc.textContent = state.user.numero_documento ? `${state.user.tipo_documento || 'CC'}: ${state.user.numero_documento}` : 'No registrado';
      const sTel = document.getElementById('staticProfileTelefono');
      if (sTel) sTel.textContent = state.user.telefono || 'No registrado';

      // Feedback message in inlineProfileSaveMsg
      const saveFeedbackEl = document.getElementById('inlineProfileSaveMsg') || document.getElementById('companyEditFeedback');
      if (saveFeedbackEl) {
        saveFeedbackEl.style.display = 'block';
        saveFeedbackEl.style.color = '#16a34a';
        saveFeedbackEl.textContent = '✔ Datos comerciales y de cuenta guardados correctamente.';
        setTimeout(() => {
          if (saveFeedbackEl) saveFeedbackEl.style.display = 'none';
        }, 4000);
      }
    }

    document.getElementById('companySummaryCard')?.addEventListener('click', (e) => {
      const pencilBtn = e.target.closest('#btnToggleProfileEdit');
      if (pencilBtn) {
        if (pencilBtn.classList.contains('is-editing')) {
          saveInlineProfileChanges();
        } else {
          setProfileEditingState(true);
        }
      } else if (e.target.closest('#btnCancelProfileEdit')) {
        cancelInlineProfileChanges();
      } else if (e.target.closest('#btnToggleAddAddressSection')) {
        toggleAddAddressSection();
      }
    });

    document.getElementById('companySummaryCard')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.closest('#inlineProfileForm input')) {
        e.preventDefault();
        saveInlineProfileChanges();
      }
    });

    document.getElementById('btnCloseAddressWorkspace')?.addEventListener('click', () => {
      toggleAddAddressSection(false);
    });

    // Eventos de filtrado en Historial de Compras del Cliente
    ['custHistorySearchInput', 'custHistoryStatusFilter', 'custHistoryZoneFilter', 'custHistoryPayFilter'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
        renderCustomerOrdersViews();
      });
    });

    // Eventos de filtrado de pedidos/facturas en formulario de Soporte y filtro de tickets
    document.getElementById('supOrderFilterInput')?.addEventListener('input', (e) => {
      populateCustomerSupportOrderSelect(e.target.value);
    });

    ['custTicketSearchInput', 'custTicketStatusFilter'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
        renderCustomerSupportTicketsList();
      });
    });

    // Adjuntar Imagen en Soporte
    const supImageInput = document.getElementById('supImageInput');
    const supPreviewWrap = document.getElementById('supImagePreviewWrap');
    const supPreviewImg = document.getElementById('supImagePreview');
    const btnSimulateSupImage = document.getElementById('btnSimulateSupImage');
    const btnClearSupImage = document.getElementById('btnClearSupImage');

    function setSupportCustomerPhoto(dataUrl) {
      state.supportCustomerImageDraft = dataUrl;
      if (dataUrl && supPreviewImg && supPreviewWrap) {
        supPreviewImg.src = dataUrl;
        supPreviewWrap.classList.remove('hidden');
        btnClearSupImage?.classList.remove('hidden');
      } else {
        if (supPreviewImg) supPreviewImg.src = '';
        supPreviewWrap?.classList.add('hidden');
        btnClearSupImage?.classList.add('hidden');
        if (supImageInput) supImageInput.value = '';
      }
    }

    supImageInput?.addEventListener('change', () => {
      if (!supImageInput.files || !supImageInput.files[0]) return;
      const reader = new FileReader();
      reader.onload = () => setSupportCustomerPhoto(reader.result);
      reader.readAsDataURL(supImageInput.files[0]);
    });

    btnSimulateSupImage?.addEventListener('click', () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><rect width="480" height="300" fill="#141821"/><rect x="20" y="20" width="440" height="260" rx="16" fill="#1f2533" stroke="#f59e0b" stroke-width="3"/><text x="240" y="105" fill="#ffffff" font-family="sans-serif" font-size="19" font-weight="bold" text-anchor="middle">EVIDENCIA DEL CLIENTE</text><text x="240" y="145" fill="#fbbf24" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Consulta de Lote / Producto</text><text x="240" y="185" fill="#cbd5e1" font-family="sans-serif" font-size="13" text-anchor="middle">${new Date().toLocaleString('es-CO')}</text></svg>`;
      setSupportCustomerPhoto('data:image/svg+xml;utf8,' + encodeURIComponent(svg));
    });

    btnClearSupImage?.addEventListener('click', () => setSupportCustomerPhoto(null));

    // Desplegable de Nuevo Ticket en Ventana de Soporte (con botón en la esquina superior derecha y padding generoso)
    const btnToggleNewTicket = document.getElementById('btnToggleNewTicket');
    const formWrapper = document.getElementById('customerSupportFormWrapper');
    const btnCloseNewTicket = document.getElementById('btnCloseNewTicketBtn');
    const btnCancelNewTicket = document.getElementById('btnCancelNewTicket');
    const toggleIcon = document.getElementById('btnToggleNewTicketIcon');
    const toggleText = document.getElementById('btnToggleNewTicketText');

    function toggleNewTicketMenu(forceOpen) {
      if (!formWrapper) return;
      const willOpen =
        typeof forceOpen === 'boolean'
          ? forceOpen
          : formWrapper.classList.contains('hidden');
      if (willOpen) {
        formWrapper.classList.remove('hidden');
        if (btnToggleNewTicket) btnToggleNewTicket.setAttribute('aria-expanded', 'true');
        if (toggleIcon) toggleIcon.textContent = 'close';
        if (toggleText) toggleText.textContent = 'Ocultar Formulario';
        document.getElementById('supSubject')?.focus();
      } else {
        formWrapper.classList.add('hidden');
        if (btnToggleNewTicket) btnToggleNewTicket.setAttribute('aria-expanded', 'false');
        if (toggleIcon) toggleIcon.textContent = 'add';
        if (toggleText) toggleText.textContent = 'Nuevo Ticket';
      }
    }

    btnToggleNewTicket?.addEventListener('click', () => toggleNewTicketMenu());
    btnCloseNewTicket?.addEventListener('click', () => toggleNewTicketMenu(false));
    btnCancelNewTicket?.addEventListener('click', () => toggleNewTicketMenu(false));

    document.getElementById('customerSupportForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pedido_id = document.getElementById('supOrderId').value || null;
      const asunto = document.getElementById('supSubject').value.trim();
      const descripcion = document.getElementById('supDesc').value.trim();

      const res = await fetch(`${CONFIG.api.baseUrl}/soporte/crear`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          pedido_id,
          asunto,
          descripcion,
          imagen_cliente_url: state.supportCustomerImageDraft || null
        })
      });
      const data = await res.json();
      if (data.ok) {
        const localTickets = getLocalTicketsStore();
        const newTkId = data.ticket_id || localTickets.length + 10;
        const createdTicket = data.ticket || {
          id: newTkId,
          pedido_id: pedido_id ? Number(pedido_id) : null,
          usuario_id: state.user?.id || 1,
          asunto,
          descripcion,
          imagen_cliente_url: state.supportCustomerImageDraft || null,
          estado: 'abierto',
          mensajes: [
            {
              id: Date.now(),
              autor: state.user?.nombre_completo || 'Cliente',
              rol: 'cliente',
              texto: descripcion,
              fecha: new Date().toISOString()
            }
          ],
          creado_en: new Date().toISOString()
        };
        localTickets.unshift(createdTicket);
        saveLocalTicketsStore(localTickets);
        markTicketSeenByClient(newTkId, createdTicket.mensajes);
        e.target.reset();
        setSupportCustomerPhoto(null);
        populateCustomerSupportOrderSelect('');
        toggleNewTicketMenu(false);
        loadCustomerSupportTickets();
        alert('Tu ticket de soporte ha sido abierto exitosamente.');
      }
    });
  }

  function renderPerfilPageAuthState() {
    const guestBox = document.getElementById('guestAuthContainer');
    const loggedBanner = document.getElementById('loggedProfileBanner');
    const tabsBar = document.getElementById('customerProfileTabsBar');
    const navDirs = document.getElementById('navMisDirecciones');
    const navOrds = document.getElementById('navMisPedidos');
    const navSoporte = document.getElementById('navSoporteTab');

    if (!guestBox || !loggedBanner) return;

    if (!state.user) {
      guestBox.classList.remove('hidden');
      loggedBanner.classList.add('hidden');
      tabsBar?.classList.add('hidden');
      navDirs?.classList.add('hidden');
      navOrds?.classList.add('hidden');
      navSoporte?.classList.add('hidden');
      document.querySelectorAll('[data-profile-window]').forEach((sec) => sec.classList.add('hidden'));
    } else {
      guestBox.classList.add('hidden');
      loggedBanner.classList.remove('hidden');
      tabsBar?.classList.remove('hidden');
      navDirs?.classList.remove('hidden');
      navOrds?.classList.remove('hidden');
      navSoporte?.classList.remove('hidden');

      const avatarLarge = document.getElementById('loggedAvatarLarge');
      if (avatarLarge) {
        if (state.user.avatar_url && !state.user.avatar_url.includes('test-avatar-photo')) {
          avatarLarge.innerHTML = `<img src="${state.user.avatar_url}" alt="${state.user.nombre_completo || 'Usuario'}" class="logged-avatar-img" referrerpolicy="no-referrer" onerror="this.onerror=null; this.parentElement.textContent='${(state.user.nombre_completo || 'U').charAt(0).toUpperCase()}'; this.parentElement.classList.remove('has-photo');" />`;
          avatarLarge.classList.add('has-photo');
        } else {
          avatarLarge.textContent = (state.user.nombre_completo || 'U').charAt(0).toUpperCase();
          avatarLarge.classList.remove('has-photo');
        }
      }
      document.getElementById('loggedUserName').textContent = state.user.nombre_completo;
      document.getElementById('loggedUserEmail').textContent = `${state.user.email} • ${state.user.telefono || 'Sin teléfono'}`;

      const extraEl = document.getElementById('loggedUserExtra');
      if (extraEl) {
        const docPart = state.user.numero_documento
          ? `${state.user.tipo_documento || 'CC'}: ${state.user.numero_documento}`
          : '';
        const empPart = state.user.empresa ? ` • Empresa: ${state.user.empresa}` : '';
        extraEl.textContent = `${docPart}${empPart}`;
      }

      const companyCard = document.getElementById('companySummaryCard');
      if (companyCard) {
        companyCard.innerHTML = `
          <div class="company-card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.45rem;">
            <div class="company-card-header-left" style="display:flex; align-items:center; gap:0.65rem;">
              <div>
                <strong style="font-size:1.1rem; display:block; font-weight:800;">Información Comercial y Facturación</strong>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
              <button type="button" class="btn-secondary" id="btnToggleAddAddressSection" style="padding:0.58rem 1.25rem; font-size:0.86rem; display:inline-flex; align-items:center; gap:0.45rem;">
                <span class="material-symbols-rounded" style="font-size:1.15rem;">add_location_alt</span>
                <span id="toggleAddAddressBtnText">Añadir Dirección</span>
              </button>
              <button type="button" class="btn-profile-pencil-round" id="btnToggleProfileEdit" title="Editar información comercial" aria-label="Editar o Guardar datos comerciales">
                <span class="material-symbols-rounded" id="btnToggleProfileEditIcon" style="font-size:1.2rem;">edit</span>
                <span class="btn-pencil-label">Guardar Cambios</span>
              </button>
              <button type="button" class="btn-profile-cancel-edit hidden" id="btnCancelProfileEdit" title="Cancelar edición" aria-label="Cancelar edición">
                <span class="material-symbols-rounded" style="font-size:1.15rem;">close</span>
              </button>
            </div>
          </div>

          <div id="companyStaticGrid" class="company-inline-edit-grid" style="margin-top:0.35rem;">
            <div style="background:var(--bg-elevated); padding:0.75rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-strong);">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Titular de la Cuenta</span>
              <strong id="staticProfileNombre" style="font-size:0.96rem; color:var(--text-primary); font-weight:800; display:block; word-break:break-word;">
                ${state.user.nombre_completo || state.user.username || 'No registrado'}
              </strong>
            </div>
            <div style="background:var(--bg-elevated); padding:0.75rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-strong);">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Empresa / Negocio</span>
              <strong id="staticProfileEmpresa" style="font-size:0.96rem; color:var(--text-primary); font-weight:800; display:block; word-break:break-word;">
                ${state.user.empresa || 'Cuenta Personal / Hogar'}
              </strong>
            </div>
            <div style="background:var(--bg-elevated); padding:0.75rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-strong);">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Documento de Identificación</span>
              <strong id="staticProfileDocumento" style="font-size:0.96rem; color:var(--text-primary); font-weight:800; display:block; word-break:break-word;">
                ${state.user.numero_documento ? `${state.user.tipo_documento || 'CC'}: ${state.user.numero_documento}` : 'No registrado'}
              </strong>
            </div>
            <div style="background:var(--bg-elevated); padding:0.75rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-strong);">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Contacto Principal</span>
              <strong id="staticProfileTelefono" style="font-size:0.96rem; color:var(--text-primary); font-weight:800; display:block; word-break:break-word;">
                ${state.user.telefono || 'No registrado'}
              </strong>
            </div>
          </div>

          <form id="inlineProfileForm" class="company-inline-edit-grid hidden" onsubmit="return false;" style="margin-top:0.35rem;">
            <div class="form-group" style="margin:0;">
              <label for="inlineProfileNombre" style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">
                Titular de la Cuenta / Nombre *
              </label>
              <input
                type="text"
                id="inlineProfileNombre"
                class="modal-input"
                value="${state.user.nombre_completo || state.user.username || ''}"
                placeholder="Nombre completo del titular"
                required
              />
            </div>
            <div class="form-group" style="margin:0;">
              <label for="inlineProfileEmpresa" style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">
                Empresa / Negocio (Opcional)
              </label>
              <input
                type="text"
                id="inlineProfileEmpresa"
                class="modal-input"
                value="${state.user.empresa || ''}"
                placeholder="Ej: Restaurante El Asador S.A.S."
              />
            </div>
            <div class="form-group" style="margin:0;">
              <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">
                Documento de Identificación
              </label>
              <div style="display:grid; grid-template-columns: 110px 1fr; gap:0.45rem;">
                <select id="inlineProfileTipoDoc" class="modal-input" style="height:44px; padding:0 0.5rem; cursor:pointer;">
                  <option value="CC" ${state.user.tipo_documento === 'CC' ? 'selected' : ''}>CC</option>
                  <option value="NIT" ${state.user.tipo_documento === 'NIT' ? 'selected' : ''}>NIT</option>
                  <option value="CE" ${state.user.tipo_documento === 'CE' ? 'selected' : ''}>CE</option>
                  <option value="PP" ${state.user.tipo_documento === 'PP' ? 'selected' : ''}>Pasaporte</option>
                </select>
                <input
                  type="text"
                  id="inlineProfileNumDoc"
                  class="modal-input"
                  value="${state.user.numero_documento || ''}"
                  placeholder="Número de identificación"
                />
              </div>
            </div>
            <div class="form-group" style="margin:0;">
              <label for="inlineProfileTelefono" style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">
                Contacto Principal (Celular) *
              </label>
              <input
                type="tel"
                id="inlineProfileTelefono"
                class="modal-input"
                value="${state.user.telefono || ''}"
                placeholder="Ej: 3101112233"
                required
              />
            </div>
          </form>
          <div id="inlineProfileSaveMsg" style="display:none; margin-top:0.85rem; font-size:0.85rem; font-weight:700;"></div>
        `;
        enhanceAllCustomSelects(companyCard);
      }

      const securityCard = document.getElementById('securitySummaryCard');
      if (securityCard) {
        const hasPass = Boolean(state.user && state.user.has_password);
        const iconEl = document.getElementById('securityCardIcon');
        const statusTextEl = document.getElementById('securityCardStatusText');
        const btnTextEl = document.getElementById('btnOpenPasswordModalText');
        if (iconEl && statusTextEl && btnTextEl) {
          if (hasPass) {
            iconEl.textContent = 'lock';
            statusTextEl.textContent = 'Tu cuenta está protegida con contraseña personal.';
            btnTextEl.textContent = 'Cambiar Contraseña';
          } else {
            iconEl.textContent = 'lock_open';
            statusTextEl.textContent = 'Iniciaste con Google. Asigna una contraseña para acceder directamente.';
            btnTextEl.textContent = 'Asignar Contraseña';
          }
        }
      }

      const staffBtn = document.getElementById('btnGoToStaffPanel');
      if (staffBtn) {
        staffBtn.classList.toggle('hidden', !isStaffUser());
      }

      syncProfileTabFromHash();
      switchCustomerProfileTab(state.activeProfileTab || 'pedidos');
      renderSavedAddressesList();
      loadCustomerOrdersList();
      loadCustomerSupportTickets();
      syncUserNotificationDots();
    }
  }

  function renderSavedAddressesList() {
    const listEl = document.getElementById('savedAddressesList');
    const badge = document.getElementById('addressCountBadge');
    const countText = document.getElementById('savedAddressesCountText');
    const dirs = state.direcciones || [];

    if (badge) badge.textContent = `${dirs.length}/5`;
    if (countText) countText.textContent = `${dirs.length} de 5`;
    if (!listEl || !state.user) return;

    if (dirs.length === 0) {
      listEl.innerHTML = `<div class="detail-box"><p>Aún no has registrado direcciones. Selecciona tu ubicación en el mapa para guardar la primera.</p></div>`;
      return;
    }

    listEl.innerHTML = dirs
      .map((d) => {
        const isSelected = Number(d.id) === Number(state.selectedAddressId);
        return `
          <div class="saved-addr-item" style="${isSelected ? 'border-color:var(--brand-red);' : ''}">
            <div>
              <strong>${d.etiqueta} — ${d.municipio}, ${d.departamento || 'Meta'}</strong>
              ${isSelected ? `<span style="margin-left:0.4rem; font-size:0.7rem; color:var(--brand-red); font-weight:800;">(PREDETERMINADA)</span>` : ''}
              <div class="saved-addr-meta">${d.direccion} ${d.barrio_referencia ? `(${d.barrio_referencia})` : ''}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              ${
                !isSelected
                  ? `<button type="button" class="cart-addr-mini-btn" data-select-addr-id="${d.id}">Elegir</button>`
                  : ''
              }
              <button type="button" class="icon-close-btn" data-delete-addr-id="${d.id}" title="Eliminar dirección">
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function populateCustomerSupportOrderSelect(filterText = '', preselectOrderId = null) {
    const selectEl = document.getElementById('supOrderId');
    if (!selectEl) return;

    const currentVal = preselectOrderId !== null ? String(preselectOrderId) : selectEl.value;
    const orders = state.customerOrders || [];
    const q = (filterText || '').trim().toLowerCase();

    const filtered = orders.filter((ord) => {
      if (!q) return true;
      const inv = getInvoiceCode(ord.id).toLowerCase();
      const itemsText = (ord.items || []).map((i) => i.nombre_producto || '').join(' ').toLowerCase();
      return (
        String(ord.id).includes(q) ||
        inv.includes(q) ||
        (ord.municipio || '').toLowerCase().includes(q) ||
        (ord.direccion_entrega || '').toLowerCase().includes(q) ||
        String(ord.total).includes(q) ||
        itemsText.includes(q)
      );
    });

    selectEl.innerHTML =
      `<option value="">Consulta general (Sin pedido específico)</option>` +
      filtered
        .map(
          (ord) =>
            `<option value="${ord.id}" ${String(ord.id) === currentVal ? 'selected' : ''}>
              Pedido #${ord.id} • ${getInvoiceCode(ord.id)} — ${formatCurrency(ord.total)} (${ord.municipio} • ${ord.estado.toUpperCase()})
            </option>`
        )
        .join('');
  }

  async function loadCustomerOrdersList() {
    const activeContainer = document.getElementById('myOrdersListContainer');
    if (!activeContainer || !state.user) return;

    try {
      const res = await fetch(`${CONFIG.api.baseUrl}/mis-pedidos`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.apiVersion >= 3) state.serverApiV3 = true;

      const rawOrders = data.data || [];
      state.customerOrders = applyOrderOverrides(rawOrders);

      if (Array.isArray(data.tickets)) {
        state.customerTickets = mergeTicketsWithLocal(data.tickets);
        renderCustomerSupportTicketsList();
        const tkBadge = document.getElementById('tabTicketsCount');
        if (tkBadge) tkBadge.textContent = String(state.customerTickets.length);
        syncUserNotificationDots();
      }

      populateCustomerSupportOrderSelect(
        document.getElementById('supOrderFilterInput')?.value || ''
      );
      renderCustomerOrdersViews();
    } catch (err) {
      activeContainer.innerHTML = `<div class="surface-card"><p>No se pudieron cargar los pedidos.</p></div>`;
    }
  }

  function matchesOrderFilters(ord, { query = '', status = 'todos', zone = 'todas', pay = 'todos' }) {
    const q = (query || '').trim().toLowerCase();
    if (q) {
      const inv = getInvoiceCode(ord.id).toLowerCase();
      const itemsStr = (ord.items || []).map((i) => i.nombre_producto || '').join(' ').toLowerCase();
      const hay = [
        `#${ord.id}`,
        String(ord.id),
        inv,
        ord.nombre_recibe || '',
        ord.telefono_cliente || '',
        ord.direccion_entrega || '',
        ord.municipio || '',
        ord.metodo_pago || '',
        ord.entregador_nombre || '',
        ord.razon_cancelacion || '',
        itemsStr
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (status && status !== 'todos') {
      if (status === 'activos') {
        if (!['pendiente', 'en_proceso', 'en_camino'].includes(ord.estado)) return false;
      } else if (ord.estado !== status) {
        return false;
      }
    }

    if (zone && zone !== 'todas') {
      const isVcio = Boolean(ord.es_villavicencio) || (ord.municipio || '').toLowerCase() === 'villavicencio';
      if (zone === 'villavicencio' && !isVcio) return false;
      if (zone === 'meta' && isVcio) return false;
    }

    if (pay && pay !== 'todos') {
      if (pay === 'electronico') {
        if (!['pse', 'nequi', 'bancolombia', 'tarjeta'].includes(ord.metodo_pago)) return false;
      } else if (pay === 'reembolsado') {
        if (ord.reembolso_estado !== 'reembolsado') return false;
      } else if (ord.metodo_pago !== pay) {
        return false;
      }
    }

    return true;
  }

  function renderCustomerOrdersViews() {
    const activeContainer = document.getElementById('myOrdersListContainer');
    const historyContainer = document.getElementById('myOrderHistoryContainer');
    if (!activeContainer || !state.user) return;

    const orders = state.customerOrders || [];
    const activeOrders = orders.filter((o) => ['pendiente', 'en_proceso', 'en_camino'].includes(o.estado));
    const historyOrdersAll = orders.filter((o) => ['entregado', 'cancelado'].includes(o.estado));

    const activeTabCount = document.getElementById('tabActiveOrdersCount');
    const historyTabCount = document.getElementById('tabHistoryOrdersCount');
    if (activeTabCount) activeTabCount.textContent = String(activeOrders.length);
    if (historyTabCount) historyTabCount.textContent = String(historyOrdersAll.length);

    if (state.customerExpandedOrderIds === null) {
      state.customerExpandedOrderIds = new Set();
      // Solo abrimos el primer pedido si es un pedido ACTIVO en curso. En historial van todos colapsados por defecto.
      if (activeOrders.length > 0) state.customerExpandedOrderIds.add(activeOrders[0].id);
    }

    const histQuery = document.getElementById('custHistorySearchInput')?.value || '';
    const histStatus = document.getElementById('custHistoryStatusFilter')?.value || 'todos';
    const histZone = document.getElementById('custHistoryZoneFilter')?.value || 'todas';
    const histPay = document.getElementById('custHistoryPayFilter')?.value || 'todos';

    const filteredHistory = historyOrdersAll.filter((ord) =>
      matchesOrderFilters(ord, { query: histQuery, status: histStatus, zone: histZone, pay: histPay })
    );

    const histMetaEl = document.getElementById('custHistoryResultsMeta');
    if (histMetaEl) {
      const sumFiltered = filteredHistory
        .filter((o) => o.estado !== 'cancelado')
        .reduce((acc, o) => acc + Number(o.total || 0), 0);
      histMetaEl.textContent = `Mostrando ${filteredHistory.length} de ${historyOrdersAll.length} registros • Total compras entregadas en filtro: ${formatCurrency(sumFiltered)}`;
    }

    const stageMeta = {
      pendiente: { step: 1, pct: 25, linePct: 0, icon: 'storefront', badge: 'Etapa 1/4 • Recibido en Tienda' },
      en_proceso: { step: 2, pct: 50, linePct: 33.3, icon: 'warehouse', badge: 'Etapa 2/4 • En Bodega' },
      en_camino: { step: 3, pct: 75, linePct: 66.6, icon: 'local_shipping', badge: 'Etapa 3/4 • En Reparto' },
      entregado: { step: 4, pct: 100, linePct: 100, icon: 'check_circle', badge: 'Etapa 4/4 • Entregado' },
      cancelado: { step: 0, pct: 0, linePct: 0, icon: 'cancel', badge: 'Cancelado' }
    };

    const buildOrderAccordionList = (list, emptyMessage, isActiveSection = false) => {
      if (list.length === 0) {
        return `<div class="surface-card"><p>${emptyMessage}</p></div>`;
      }
      return `
        <div class="customer-orders-accordion-list">
          ${list
            .map((ord) => {
              const isCancelled = ord.estado === 'cancelado';
              const canCustomerCancel = ord.estado === 'pendiente' || ord.estado === 'en_proceso';
              const meta = stageMeta[ord.estado] || stageMeta.pendiente;
              const isExpanded = state.customerExpandedOrderIds.has(ord.id);
              const isCancelBoxOpen = Number(state.custCancelOpenId) === Number(ord.id);
              const invCode = getInvoiceCode(ord.id);

              const getStepClass = (stepNum) => {
                if (ord.estado === 'entregado') return 'is-done';
                if (stepNum < meta.step) return 'is-done';
                if (stepNum === meta.step) return 'is-current';
                return '';
              };

              return `
                <article class="customer-order-accordion ${isExpanded ? 'is-expanded' : ''}" data-order-card-id="${ord.id}">
                  <button
                    type="button"
                    class="customer-order-header"
                    data-toggle-cust-order="${ord.id}"
                    aria-expanded="${isExpanded ? 'true' : 'false'}"
                  >
                    <div class="customer-order-header-left">
                      <div class="customer-order-title-row">
                        <span class="order-id-badge">Pedido #${ord.id} — ${formatCurrency(ord.total)}</span>
                        <span class="invoice-number-badge-inline">
                          <span class="material-symbols-rounded" style="font-size:0.9rem;">receipt_long</span>
                          ${invCode}
                        </span>
                        <span style="font-size:0.76rem; color:var(--text-muted);">
                          ${(ord.items || []).length} productos • ${ord.municipio}
                        </span>
                      </div>
                      <div class="customer-order-meta-line">
                        Recibe: <strong>${ord.nombre_recibe}</strong> • ${ord.direccion_entrega} • <strong>${ord.tiempo_entrega_estimado}</strong>
                      </div>
                    </div>

                    <div class="customer-order-direct-stage">
                      <div class="direct-stage-info-box">
                        ${
                          !isActiveSection && !isCancelled
                            ? `<span class="history-delivery-date">
                                 <span class="material-symbols-rounded" style="font-size:0.95rem;">event_available</span>
                                 <span>${ord.creado_en ? new Date(ord.creado_en).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Finalizado'}</span>
                               </span>`
                            : `<span class="direct-stage-badge ${isCancelled ? 'is-cancelled' : ''}">
                                 ${!isCancelled && hasCustomerOrderNovelty(ord) ? `<span class="order-live-pulse-dot" id="orderPulseDot_${ord.id}" title="Novedad en tu despacho"></span>` : ''}
                                 <span class="material-symbols-rounded" style="font-size:1.05rem;">${meta.icon}</span>
                                 <span>${meta.badge}</span>
                               </span>
                               ${
                                 !isCancelled
                                   ? `<div class="direct-stage-mini-bar-bg">
                                        <div class="direct-stage-mini-bar-fill" style="width:${meta.pct}%;"></div>
                                      </div>`
                                   : ''
                               }`
                        }
                      </div>
                      <span class="customer-order-chevron">
                        <span class="material-symbols-rounded">expand_more</span>
                      </span>
                    </div>
                  </button>

                  <div class="customer-order-body">
                    <div class="customer-order-body-content">
                      ${
                        isCancelled
                          ? `<div class="detail-box" style="margin-top:0.85rem; border:1px solid rgba(239,68,68,0.4); color:#fca5a5;">
                               <strong>Motivo de cancelación:</strong> ${ord.razon_cancelacion || 'Cancelado'}
                               ${
                                 ord.reembolso_estado === 'reembolsado'
                                   ? `<div style="margin-top:4px; color:#4ade80; font-weight:700;">
                                        ✔ Reembolso electrónico aplicado (${ord.metodo_pago.toUpperCase()})
                                      </div>`
                                   : ''
                               }
                             </div>`
                          : `<div class="order-timeline-4steps" aria-label="Progreso del pedido">
                               <div class="order-timeline-line-bg">
                                 <div class="order-timeline-line-fill" style="width:${meta.linePct}%;"></div>
                               </div>

                               <div class="timeline-point ${getStepClass(1)}">
                                 <div class="timeline-icon-circle">
                                   <span class="material-symbols-rounded">storefront</span>
                                 </div>
                                 <span class="timeline-label-title">1. Recibido</span>
                                 <span class="timeline-label-sub">En tienda</span>
                               </div>

                               <div class="timeline-point ${getStepClass(2)}">
                                 <div class="timeline-icon-circle">
                                   <span class="material-symbols-rounded">warehouse</span>
                                 </div>
                                 <span class="timeline-label-title">2. En Proceso</span>
                                 <span class="timeline-label-sub">En bodega</span>
                               </div>

                               <div class="timeline-point ${getStepClass(3)}">
                                 <div class="timeline-icon-circle">
                                   <span class="material-symbols-rounded">local_shipping</span>
                                 </div>
                                 <span class="timeline-label-title">3. En Reparto</span>
                                 <span class="timeline-label-sub">En camino</span>
                               </div>

                               <div class="timeline-point ${getStepClass(4)}">
                                 <div class="timeline-icon-circle">
                                   <span class="material-symbols-rounded">check_circle</span>
                                 </div>
                                 <span class="timeline-label-title">4. Entregado</span>
                                 <span class="timeline-label-sub">Finalizado</span>
                               </div>
                             </div>`
                      }

                      ${!isActiveSection && !isCancelled ? buildThermalPaperReceiptHtml(ord) : ''}

                      <div class="order-items-chips" style="margin-top: 0.75rem;">
                        ${(ord.items || [])
                          .map((i) => `<span class="order-item-chip">${i.cantidad}x ${i.nombre_producto}</span>`)
                          .join('')}
                      </div>

                      <!-- Barra de acciones del pedido: Ver Factura, Contactar a Soporte y Cancelar (si aún no está en envío) -->
                      <div class="customer-order-actions-bar">
                        <div style="font-size:0.79rem; color:var(--text-secondary);">
                          ${
                            isActiveSection
                              ? canCustomerCancel
                                ? '✔ Aún no ha salido a reparto: puedes cancelar el pedido sin costo.'
                                : '🚚 El pedido ya se encuentra en ruta de envío con nuestro entregador.'
                              : `Comprobante electrónico: <strong>${invCode}</strong> • Pago: ${(ord.metodo_pago || 'efectivo').toUpperCase()}`
                          }
                        </div>
                        <div class="customer-order-actions-btns">
                          ${
                            isActiveSection
                              ? `<button type="button" class="btn-secondary" data-view-cust-invoice="${ord.id}">
                                   <span class="material-symbols-rounded">receipt_long</span>
                                   <span>Ver Factura</span>
                                 </button>`
                              : ''
                          }
                          <button type="button" class="btn-secondary" data-cust-contact-support="${ord.id}">
                            <span class="material-symbols-rounded">support_agent</span>
                            <span>Contactar a Soporte</span>
                          </button>
                          ${
                            isActiveSection && canCustomerCancel
                              ? `<button type="button" class="btn-cancel-order" data-cust-toggle-cancel="${ord.id}">
                                   <span class="material-symbols-rounded">cancel</span>
                                   <span>Cancelar Pedido</span>
                                 </button>`
                              : ''
                          }
                        </div>
                      </div>

                      ${
                        isActiveSection && canCustomerCancel && isCancelBoxOpen
                          ? `<div class="cust-inline-cancel-box">
                               <strong>¿Confirmas cancelar el Pedido #${ord.id}?</strong>
                               <span style="font-size:0.8rem; color:var(--text-secondary);">
                                 Indica brevemente el motivo de cancelación (se aplicará reembolso automático si pagaste por medio electrónico):
                               </span>
                               <input
                                 type="text"
                                 id="custCancelReasonInput_${ord.id}"
                                 class="modal-input"
                                 value="Cancelado por el cliente antes de salir a envío"
                               />
                               <div style="display:flex; justify-content:flex-end; gap:0.6rem;">
                                 <button type="button" class="btn-secondary" data-cust-abort-cancel="${ord.id}">Volver</button>
                                 <button type="button" class="btn-cancel-order" style="background:#dc2626; color:#fff;" data-cust-confirm-cancel="${ord.id}">
                                   <span class="material-symbols-rounded">check</span>
                                   <span>Confirmar Cancelación</span>
                                 </button>
                               </div>
                             </div>`
                          : ''
                      }
                    </div>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `;
    };

    activeContainer.innerHTML = buildOrderAccordionList(
      activeOrders,
      'No tienes pedidos activos en curso en este momento.',
      true
    );
    if (historyContainer) {
      historyContainer.innerHTML = buildOrderAccordionList(
        filteredHistory,
        'No se encontraron compras ni facturas con los filtros seleccionados.',
        false
      );
    }

    const handleOrderContainerClick = async (e) => {
      const viewInvBtn = e.target.closest('[data-view-cust-invoice]');
      if (viewInvBtn) {
        const id = Number(viewInvBtn.getAttribute('data-view-cust-invoice'));
        const ord = (state.customerOrders || []).find((o) => Number(o.id) === id);
        if (ord) openInvoiceModalByOrder(ord);
        return;
      }

      const supportBtn = e.target.closest('[data-cust-contact-support]');
      if (supportBtn) {
        const id = Number(supportBtn.getAttribute('data-cust-contact-support'));
        switchCustomerProfileTab('soporte');
        populateCustomerSupportOrderSelect('', id);
        const subj = document.getElementById('supSubject');
        if (subj) subj.value = `Consulta sobre Pedido #${id} (${getInvoiceCode(id)})`;
        document.getElementById('supDesc')?.focus();
        return;
      }

      const toggleCancelBtn = e.target.closest('[data-cust-toggle-cancel]');
      if (toggleCancelBtn) {
        const id = Number(toggleCancelBtn.getAttribute('data-cust-toggle-cancel'));
        state.custCancelOpenId = state.custCancelOpenId === id ? null : id;
        renderCustomerOrdersViews();
        return;
      }

      const abortCancelBtn = e.target.closest('[data-cust-abort-cancel]');
      if (abortCancelBtn) {
        state.custCancelOpenId = null;
        renderCustomerOrdersViews();
        return;
      }

      const confirmCancelBtn = e.target.closest('[data-cust-confirm-cancel]');
      if (confirmCancelBtn) {
        const id = Number(confirmCancelBtn.getAttribute('data-cust-confirm-cancel'));
        const ord = (state.customerOrders || []).find((o) => Number(o.id) === id);
        if (!ord || !['pendiente', 'en_proceso'].includes(ord.estado)) return;

        const reasonInput = document.getElementById(`custCancelReasonInput_${id}`);
        const reason = (reasonInput?.value || 'Cancelado por el cliente antes del envío').trim();
        const requiresRefund = ['tarjeta', 'pse', 'nequi', 'bancolombia'].includes(ord.metodo_pago);
        const reembolso_estado = requiresRefund ? 'reembolsado' : 'no_aplica';

        saveOrderOverride(id, {
          estado: 'cancelado',
          razon_cancelacion: reason,
          reembolso_estado
        });

        if (state.serverApiV3) {
          try {
            await fetch(`${CONFIG.api.baseUrl}/pedidos/${id}/cancelar`, {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({ razon_cancelacion: reason })
            });
          } catch (_) {}
        }

        state.custCancelOpenId = null;
        state.customerOrders = applyOrderOverrides(state.customerOrders);
        populateCustomerSupportOrderSelect(document.getElementById('supOrderFilterInput')?.value || '');
        renderCustomerOrdersViews();
        return;
      }

      const headerBtn = e.target.closest('[data-toggle-cust-order]');
      if (headerBtn) {
        const ordId = Number(headerBtn.getAttribute('data-toggle-cust-order'));
        const card = headerBtn.closest('.customer-order-accordion');
        if (card) {
          const wasExpanded = card.classList.contains('is-expanded');

          // Solo se permite tener 1 pedido desplegado a la vez (cerrar todos los demás en curso e historial)
          document.querySelectorAll('.customer-order-accordion.is-expanded').forEach((otherCard) => {
            otherCard.classList.remove('is-expanded');
            const otherBtn = otherCard.querySelector('[data-toggle-cust-order]');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          });
          state.customerExpandedOrderIds.clear();

          if (!wasExpanded) {
            card.classList.add('is-expanded');
            headerBtn.setAttribute('aria-expanded', 'true');
            state.customerExpandedOrderIds.add(ordId);

            // Desactivar el punto de notificación integrado al expandir el envío
            const targetOrd = (state.customerOrders || []).find((o) => Number(o.id) === ordId);
            if (targetOrd) {
              markOrderStatusSeen(ordId, targetOrd.estado);
              const dot = card.querySelector('.order-live-pulse-dot');
              if (dot) dot.remove();
            }
          }
        }
        return;
      }
    };

    activeContainer.onclick = handleOrderContainerClick;
    if (historyContainer) historyContainer.onclick = handleOrderContainerClick;
    syncUserNotificationDots();
  }

  /**
   * Ventana 4 del Cliente: Mis Tickets Abiertos y MiniChat con Soporte (Cero 404s)
   */
    async function closeTicketAsCustomer(ticketId) {
    const tkId = Number(ticketId);
    const localList = getLocalTicketsStore();
    const targetTk = localList.find((t) => Number(t.id) === tkId);
    if (targetTk) {
      targetTk.estado = 'resuelto';
      if (!Array.isArray(targetTk.mensajes)) targetTk.mensajes = [];
      targetTk.mensajes.push({
        id: Date.now(),
        autor: `${state.user?.nombre_completo || 'Cliente'} (Cliente)`,
        rol: 'cliente',
        texto: 'El cliente ha finalizado y cerrado este ticket de soporte.',
        fecha: new Date().toISOString()
      });
      saveLocalTicketsStore(localList);
      markTicketSeenByClient(tkId, targetTk.mensajes);
    }

    if (state.serverApiV3) {
      try {
        await fetch(`${CONFIG.api.baseUrl}/mis-tickets/${tkId}/cerrar`, {
          method: 'PATCH',
          headers: getAuthHeaders()
        });
      } catch (_) {}
    }

    await loadCustomerSupportTickets();
    syncUserNotificationDots();
    alert('Has cerrado el ticket correctamente.');
  }

async function loadCustomerSupportTickets() {
    const container = document.getElementById('customerTicketsListContainer');
    const badge = document.getElementById('tabTicketsCount');
    if (!container || !state.user) return;

    // 1. Cargar inmediatamente desde almacenamiento local para que la vista nunca quede vacía
    const localTickets = getLocalTicketsStore().filter(
      (t) => !t.usuario_id || Number(t.usuario_id) === Number(state.user.id) || Number(state.user.id) === 1
    );
    if (!state.customerTickets || state.customerTickets.length === 0) {
      state.customerTickets = localTickets;
    }
    if (badge) badge.textContent = String(state.customerTickets.length);
    renderCustomerSupportTicketsList();

    // 2. Sincronizar de inmediato con el backend sin depender de clics manuales en filtros
    try {
      const res = await fetch(`${CONFIG.api.baseUrl}/mis-tickets`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const serverTickets = Array.isArray(data.data)
          ? data.data
          : (Array.isArray(data.tickets) ? data.tickets : []);
        if (serverTickets.length > 0) {
          state.customerTickets = mergeTicketsWithLocal(serverTickets);
          if (badge) badge.textContent = String(state.customerTickets.length);
          renderCustomerSupportTicketsList();
          syncUserNotificationDots();
        }
      }
    } catch (_) {}
  }

  function renderCustomerSupportTicketsList() {
    const container = document.getElementById('customerTicketsListContainer');
    const badge = document.getElementById('tabTicketsCount');
    if (!container || !state.user) return;

    if ((!state.customerTickets || state.customerTickets.length === 0) && typeof getLocalTicketsStore === 'function') {
      state.customerTickets = getLocalTicketsStore().filter(
        (t) => !t.usuario_id || Number(t.usuario_id) === Number(state.user.id) || Number(state.user.id) === 1
      );
    }

    const allTickets = state.customerTickets || [];
    if (badge) badge.textContent = String(allTickets.length);

    if (!state.customerExpandedTicketIds) {
      state.customerExpandedTicketIds = new Set();
      if (allTickets.length > 0) {
        state.customerExpandedTicketIds.add(Number(allTickets[0].id));
      }
    }

    const q = (document.getElementById('custTicketSearchInput')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('custTicketStatusFilter')?.value || 'todos';

    const filtered = allTickets.filter((tk) => {
      if (statusFilter === 'activos' && tk.estado === 'resuelto') return false;
      if (statusFilter === 'resuelto' && tk.estado !== 'resuelto') return false;
      if (!q) return true;
      const msgsText = (tk.mensajes || []).map((m) => m.texto).join(' ').toLowerCase();
      return (
        String(tk.id).includes(q) ||
        String(tk.pedido_id || '').includes(q) ||
        (tk.asunto || '').toLowerCase().includes(q) ||
        msgsText.includes(q)
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="detail-box"><p>No hay tickets que coincidan con el filtro actual.</p></div>`;
      return;
    }

    container.innerHTML = filtered
      .map((tk) => {
        const isExpanded = state.customerExpandedTicketIds.has(Number(tk.id));
        const msgs = tk.mensajes || [];
        const hasUnread = hasTicketUnreadForClient(tk);
        const draftPhoto = state.custChatDrafts && state.custChatDrafts[tk.id];

        return `
          <article class="ticket-minichat-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}" id="custTicketCard_${tk.id}" data-cust-ticket-card="${tk.id}">
            <div
              class="ticket-minichat-header clickable-header"
              data-toggle-cust-ticket="${tk.id}"
              role="button"
              tabindex="0"
              title="Haz clic para ${isExpanded ? 'colapsar' : 'desplegar'} este chat"
            >
              <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                <button
                  type="button"
                  class="btn-ticket-expand"
                  data-toggle-cust-ticket="${tk.id}"
                  aria-label="${isExpanded ? 'Colapsar chat' : 'Desplegar chat'}"
                >
                  <span class="material-symbols-rounded">${isExpanded ? 'expand_less' : 'expand_more'}</span>
                </button>
                ${hasUnread ? '<span class="ticket-unread-dot" title="Mensaje nuevo de Soporte sin leer"></span>' : ''}
                <strong>Ticket #${tk.id}: ${tk.asunto}</strong>
                ${
                  tk.pedido_id
                    ? `<span class="invoice-number-badge-inline" style="margin-left:0.4rem;">Pedido #${tk.pedido_id} • ${getInvoiceCode(tk.pedido_id)}</span>`
                    : ''
                }
              </div>
              <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                <span class="order-status-pill ${getTicketStatusClass(tk.estado)}">${formatTicketStatus(tk.estado)}</span>
                ${
                  tk.estado !== 'resuelto'
                    ? `<button type="button" class="btn-secondary btn-sm" data-cust-resolve-ticket="${tk.id}" title="Cerrar y marcar como resuelto este ticket">
                         <span class="material-symbols-rounded" style="font-size:0.95rem;">check_circle</span>
                         <span>Cerrar Ticket</span>
                       </button>`
                    : ''
                }
              </div>
            </div>

            <div class="ticket-collapsible-body ${isExpanded ? '' : 'hidden'}" id="custTicketBody_${tk.id}" style="margin-top:0.85rem;">
              ${
                tk.imagen_cliente_url
                  ? `<div class="detail-box" style="margin-bottom:0.75rem;">
                       <span class="detail-box-label">Fotografía de Solicitud Inicial</span>
                       <img src="${tk.imagen_cliente_url}" alt="Adjunto ticket #${tk.id}" class="delivery-photo-preview" style="max-height:120px; margin-top:0.35rem;" />
                     </div>`
                  : ''
              }

              <div class="minichat-messages-box" id="custChatBox_${tk.id}">
                ${msgs
                  .map(
                    (m) => `
                  <div class="minichat-bubble is-${m.rol === 'soporte' ? 'soporte' : 'cliente'}">
                    <div class="minichat-bubble-meta">${m.autor}</div>
                    ${m.texto ? `<div>${m.texto}</div>` : ''}
                    ${
                      m.imagen_url
                        ? `<div class="chat-bubble-attachment">
                             <img src="${m.imagen_url}" alt="Foto adjunta" class="chat-bubble-image" onclick="window.open(this.src)" title="Ver imagen en tamaño completo" />
                           </div>`
                        : ''
                    }
                  </div>
                `
                  )
                  .join('')}
              </div>

              ${
                tk.estado !== 'resuelto'
                  ? `<div class="minichat-input-box-wrapper" style="margin-top:0.85rem;">
                       <div class="chat-draft-preview-strip ${draftPhoto ? '' : 'hidden'}" id="custChatDraftStrip_${tk.id}">
                         <div class="chat-draft-preview-box">
                           <img src="${draftPhoto || ''}" id="custChatDraftImg_${tk.id}" alt="Foto adjunta" />
                           <button type="button" class="chat-draft-remove-btn" data-remove-cust-draft="${tk.id}" title="Quitar fotografía">
                             <span class="material-symbols-rounded">close</span>
                           </button>
                         </div>
                         <span class="chat-draft-hint">Fotografía lista para enviar con tu mensaje</span>
                       </div>

                       <div class="minichat-input-row">
                         <label class="chat-attach-btn" title="Adjuntar imagen o foto">
                           <span class="material-symbols-rounded">add_photo_alternate</span>
                           <input type="file" accept="image/*" class="hidden" data-cust-attach-input="${tk.id}" />
                         </label>
                         <input
                           type="text"
                           class="modal-input"
                           id="custChatInput_${tk.id}"
                           placeholder="Escribe un mensaje para Soporte..."
                         />
                         <button type="button" class="chat-send-btn" data-send-cust-chat="${tk.id}" title="Enviar mensaje">
                           <span class="material-symbols-rounded">send</span>
                         </button>
                       </div>
                     </div>`
                  : `<div class="detail-box" style="padding:0.55rem 0.85rem; font-size:0.83rem; color:var(--text-muted); text-align:center; margin-top:0.85rem;">
                       <span>Este ticket fue cerrado y resuelto. Si necesitas asistencia sobre un nuevo caso, puedes abrir un nuevo ticket arriba.</span>
                     </div>`
              }
            </div>
          </article>
        `;
      })
      .join('');

    container.onchange = (e) => {
      const fileInput = e.target.closest('[data-cust-attach-input]');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const tkId = Number(fileInput.getAttribute('data-cust-attach-input'));
        const reader = new FileReader();
        reader.onload = () => {
          state.custChatDrafts = state.custChatDrafts || {};
          state.custChatDrafts[tkId] = reader.result;
          const strip = document.getElementById(`custChatDraftStrip_${tkId}`);
          const img = document.getElementById(`custChatDraftImg_${tkId}`);
          if (strip && img) {
            img.src = reader.result;
            strip.classList.remove('hidden');
          }
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
    };

    container.onclick = async (e) => {
      // Alternar colapso del chat en vivo por parte del usuario
      const toggleBtn = e.target.closest('[data-toggle-cust-ticket]');
      if (toggleBtn && !e.target.closest('[data-cust-resolve-ticket]')) {
        const id = Number(toggleBtn.getAttribute('data-toggle-cust-ticket'));
        if (!state.customerExpandedTicketIds) state.customerExpandedTicketIds = new Set();
        if (state.customerExpandedTicketIds.has(id)) {
          state.customerExpandedTicketIds.delete(id);
        } else {
          state.customerExpandedTicketIds.add(id);
          const tkObj = (state.customerTickets || []).find((t) => Number(t.id) === id);
          if (tkObj) markTicketSeenByClient(id, tkObj.mensajes);
        }
        renderCustomerSupportTicketsList();
        return;
      }

      // Quitar foto adjunta en borrador
      const removeDraftBtn = e.target.closest('[data-remove-cust-draft]');
      if (removeDraftBtn) {
        const tkId = Number(removeDraftBtn.getAttribute('data-remove-cust-draft'));
        if (state.custChatDrafts) delete state.custChatDrafts[tkId];
        const strip = document.getElementById(`custChatDraftStrip_${tkId}`);
        if (strip) strip.classList.add('hidden');
        return;
      }

      // Si el cliente interactúa con el ticket, marcamos como visto para quitar el punto rojo
      const cardEl = e.target.closest('[data-cust-ticket-card]');
      if (cardEl) {
        const cardTkId = Number(cardEl.getAttribute('data-cust-ticket-card'));
        const tkObj = (state.customerTickets || []).find((t) => Number(t.id) === cardTkId);
        if (tkObj && hasTicketUnreadForClient(tkObj)) {
          markTicketSeenByClient(cardTkId, tkObj.mensajes);
          const dot = cardEl.querySelector('.ticket-unread-dot');
          dot?.remove();
        }
      }

      // Cerrar ticket por parte del cliente
      const resolveBtn = e.target.closest('[data-cust-resolve-ticket]');
      if (resolveBtn) {
        const tkId = Number(resolveBtn.getAttribute('data-cust-resolve-ticket'));
        if (confirm('¿Estás seguro de que deseas cerrar y dar por resuelto este ticket de soporte?')) {
          await closeTicketAsCustomer(tkId);
        }
        return;
      }

      // Enviar mensaje en el chat con texto y/o foto
      const sendBtn = e.target.closest('[data-send-cust-chat]');
      if (!sendBtn) return;
      const tkId = Number(sendBtn.getAttribute('data-send-cust-chat'));
      const inp = document.getElementById(`custChatInput_${tkId}`);
      const textMsg = inp ? inp.value.trim() : '';
      const draftPhoto = state.custChatDrafts && state.custChatDrafts[tkId];
      if (!textMsg && !draftPhoto) return;

      const localList = getLocalTicketsStore();
      const targetTk = localList.find((t) => Number(t.id) === tkId);
      if (targetTk) {
        if (!Array.isArray(targetTk.mensajes)) targetTk.mensajes = [];
        targetTk.mensajes.push({
          id: Date.now(),
          autor: state.user?.nombre_completo || 'Cliente',
          rol: 'cliente',
          texto: textMsg,
          imagen_url: draftPhoto || null,
          fecha: new Date().toISOString()
        });
        saveLocalTicketsStore(localList);
        markTicketSeenByClient(tkId, targetTk.mensajes);
      }
      if (state.custChatDrafts) delete state.custChatDrafts[tkId];
      if (inp) inp.value = '';

      if (state.serverApiV3) {
        try {
          await fetch(`${CONFIG.api.baseUrl}/soporte/${tkId}/mensaje`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ texto: textMsg, imagen_url: draftPhoto || null })
          });
        } catch (_) {}
      }

      loadCustomerSupportTickets();
    };

    syncUserNotificationDots();
  }

  // ==========================================================================
  // 6. PASARELA DE PAGOS EN 3 PASOS ANIMADOS (DERECHA A IZQUIERDA) + FACTURA VISUAL + RETORNO EN 10S (pagos.html)
  // ==========================================================================
  function populateCheckoutSavedAddressesDropdown() {
    const addrSelect = document.getElementById('checkoutAddressSelect');
    if (!addrSelect) return;

    addrSelect.innerHTML = '';

    // Listamos primero las direcciones guardadas del usuario
    state.direcciones.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `📍 ${d.etiqueta} (${d.municipio}) — ${d.direccion}`;
      addrSelect.appendChild(opt);
    });

    // Opción para desplegar el mapa interactivo si desea buscar o marcar nueva ubicación
    const mapOpt = document.createElement('option');
    mapOpt.value = 'map_pin';
    mapOpt.textContent = `🗺️ Marcar o buscar nueva ubicación en el mapa interactivo`;
    addrSelect.appendChild(mapOpt);

    if (state.direcciones.length > 0) {
      const selectedIdx = state.direcciones.findIndex(
        (d) => Number(d.id) === Number(state.selectedAddressId)
      );
      const useIdx = selectedIdx !== -1 ? selectedIdx : 0;
      addrSelect.value = String(useIdx);
      applySavedAddressToCheckout(useIdx);
    } else {
      addrSelect.value = 'map_pin';
      toggleCheckoutMapVisibility(true);
    }
  }

  function goToCheckoutStep(stepNum) {
    state.checkoutWizardStep = stepNum;
    const track = document.getElementById('checkoutWizardTrack');
    const lineFill = document.getElementById('checkoutWizardLineFill');

    if (track) {
      const offsetPct = (stepNum - 1) * 25;
      track.style.transform = `translate3d(-${offsetPct}%, 0, 0)`;
    }

    if (lineFill) {
      const fillPct = stepNum === 1 ? 0 : stepNum === 2 ? 50 : 100;
      lineFill.style.width = `${fillPct}%`;
    }

    [1, 2, 3].forEach((n) => {
      const node = document.getElementById(`wizardNode${n}`);
      if (!node) return;
      node.classList.remove('is-current', 'is-done');
      if (stepNum === 4 || n < stepNum) {
        node.classList.add('is-done');
      } else if (n === stepNum) {
        node.classList.add('is-current');
      }
    });

    const muni = document.getElementById('addrMunicipio')?.value.trim() || 'Villavicencio';
    const street = document.getElementById('addrStreet')?.value.trim() || 'Dirección en mapa';
    const recipient = document.getElementById('checkoutRecipientName')?.value.trim() || state.user?.nombre_completo || 'Cliente';
    const lat = Number(document.getElementById('addrLat')?.value || 4.142);
    const lng = Number(document.getElementById('addrLng')?.value || -73.6266);
    const insideVcio = isInsideVillavicencio(lat, lng);
    const deliveryInfo = calculateEstimatedDelivery(insideVcio ? 'Villavicencio' : muni, new Date());
    const etaText = deliveryInfo.texto;

    const step2AddrPill = document.getElementById('wizardStep2AddressSummary');
    if (step2AddrPill) {
      step2AddrPill.innerHTML = `
        <div>
          <strong>📍 Entrega a: ${recipient}</strong> — ${street} (${muni})
          <div style="font-size:0.76rem; color:var(--text-secondary);">Estimado confirmado: <strong style="color:#22c55e;">${etaText}</strong></div>
        </div>
        <button type="button" class="cart-addr-mini-btn" id="btnQuickEditStep1">Cambiar dirección</button>
      `;
      document.getElementById('btnQuickEditStep1')?.addEventListener('click', () => goToCheckoutStep(1));
    }

    const step2Eta = document.getElementById('checkoutStep2EtaText');
    if (step2Eta) step2Eta.textContent = etaText;

    const step3Addr = document.getElementById('checkoutStep3AddressText');
    if (step3Addr) step3Addr.textContent = `${street} (${muni})`;

    const step3Eta = document.getElementById('checkoutEtaSummaryText');
    if (step3Eta) step3Eta.textContent = etaText;

    if (stepNum === 1) {
      setTimeout(() => state.maps.addressMap?.invalidateSize(), 240);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderVisualInvoiceCard(orderData, payload, itemsList, totalAmount) {
    const invoiceEl = document.getElementById('danillanosVisualInvoice');
    if (!invoiceEl) return;

    invoiceEl.innerHTML = buildInvoiceHtmlForOrder({
      id: orderData.pedido_id || 101,
      nombre_recibe: payload.nombre_recibe,
      telefono_cliente: payload.telefono_cliente,
      direccion_entrega: payload.direccion_entrega,
      municipio: payload.municipio,
      tiempo_entrega_estimado: orderData.tiempo_entrega_estimado,
      metodo_pago: payload.metodo_pago,
      total: totalAmount,
      estado: 'pendiente',
      items: itemsList.map((i) => ({
        nombre_producto: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio,
        subtotal: i.precio * i.cantidad
      }))
    });
  }

  function initPagosPage() {
    // Si no hay productos en el carrito, 404 a la página de pagos
    if (!Array.isArray(state.cart) || state.cart.length === 0) {
      window.location.replace('404.html');
      return;
    }
    const guestBlockCard = document.getElementById('checkoutGuestBlockCard');
    const checkoutForm = document.getElementById('checkoutGatewayForm');

    if (!state.user) {
      guestBlockCard?.classList.remove('hidden');
      checkoutForm?.classList.add('hidden');
      return;
    }

    guestBlockCard?.classList.add('hidden');
    checkoutForm?.classList.remove('hidden');

    setupInteractiveCoverageMap('addressMapCanvas');
    renderCheckoutPageItems();
    renderPaymentVisualBox(state.selectedPayMethod);

    const nameInput = document.getElementById('checkoutRecipientName');
    const phoneInput = document.getElementById('checkoutRecipientPhone');
    if (nameInput) nameInput.value = state.user.nombre_completo || state.user.username || '';
    if (phoneInput) phoneInput.value = state.user.telefono || '3114567890';

    populateCheckoutSavedAddressesDropdown();
    goToCheckoutStep(1);

    document.getElementById('btnWizardToStep2')?.addEventListener('click', () => {
      const recName = document.getElementById('checkoutRecipientName')?.value.trim();
      const recPhone = document.getElementById('checkoutRecipientPhone')?.value.trim();
      const street = document.getElementById('addrStreet')?.value.trim();
      if (!recName || !recPhone || !street) {
        alert('Completa el nombre de quien recibe, teléfono y dirección en el mapa.');
        return;
      }
      renderCheckoutPageItems();
      goToCheckoutStep(2);
    });

    document.getElementById('btnWizardBackToStep1')?.addEventListener('click', () => {
      goToCheckoutStep(1);
    });

    document.getElementById('btnWizardToStep3')?.addEventListener('click', () => {
      if (state.cart.length === 0) {
        alert('Tu carrito está vacío. Agrega productos antes de continuar al pago.');
        return;
      }
      goToCheckoutStep(3);
    });

    document.getElementById('btnWizardBackToStep2')?.addEventListener('click', () => {
      goToCheckoutStep(2);
    });

    document.querySelectorAll('[data-wizard-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.checkoutWizardStep === 4) return;
        const target = Number(btn.getAttribute('data-wizard-goto'));
        if (target < state.checkoutWizardStep) {
          goToCheckoutStep(target);
        } else if (target === 2) {
          document.getElementById('btnWizardToStep2')?.click();
        } else if (target === 3 && state.checkoutWizardStep === 2) {
          document.getElementById('btnWizardToStep3')?.click();
        }
      });
    });

    const addrSelect = document.getElementById('checkoutAddressSelect');
    addrSelect?.addEventListener('change', (e) => {
      if (e.target.value === 'map_pin') {
        toggleCheckoutMapVisibility(true);
      } else {
        const idx = Number(e.target.value);
        const dir = state.direcciones[idx];
        if (dir) {
          state.selectedAddressId = dir.id;
          sessionStorage.setItem('danillanos_selected_addr_id', String(dir.id));
          renderCartLiveAddressManager();
        }
        applySavedAddressToCheckout(idx);
      }
    });

    document.getElementById('paymentMethodsGrid')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-pay-method]');
      if (!card) return;
      renderPaymentVisualBox(card.getAttribute('data-pay-method'));
    });

    checkoutForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.user) {
        window.location.href = 'perfil.html#cuenta-section';
        return;
      }
      if (state.cart.length === 0) {
        return;
      }

      const itemsSnapshot = state.cart.map((item) => ({ ...item }));
      const totalSnapshot = getCartTotal();

      const payload = {
        nombre_recibe: document.getElementById('checkoutRecipientName').value.trim(),
        telefono_cliente: document.getElementById('checkoutRecipientPhone').value.trim(),
        direccion_entrega: document.getElementById('addrStreet').value.trim(),
        municipio: document.getElementById('addrMunicipio').value.trim(),
        lat: Number(document.getElementById('addrLat').value),
        lng: Number(document.getElementById('addrLng').value),
        metodo_pago: state.selectedPayMethod,
        observaciones_cliente: document.getElementById('checkoutObservations').value.trim(),
        items: state.cart
      };

      const res = await fetch(`${CONFIG.api.baseUrl}/pedidos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        state.cart = [];
        saveAndRenderCart();

        renderVisualInvoiceCard(data, payload, itemsSnapshot, totalSnapshot);
        goToCheckoutStep(4);

        const checkCircle = document.getElementById('animatedCheckmarkCircle');
        if (checkCircle) {
          checkCircle.classList.remove('is-animating');
          void checkCircle.offsetWidth;
          checkCircle.classList.add('is-animating');
        }

        let secondsLeft = 10;
        const secEl = document.getElementById('invoiceCountdownSeconds');
        const barEl = document.getElementById('invoiceCountdownBar');
        if (secEl) secEl.textContent = String(secondsLeft);
        if (barEl) barEl.style.width = '100%';

        if (state.invoiceRedirectTimer) clearInterval(state.invoiceRedirectTimer);
        state.invoiceRedirectTimer = setInterval(() => {
          secondsLeft -= 1;
          if (secEl) secEl.textContent = String(Math.max(0, secondsLeft));
          if (barEl) barEl.style.width = `${Math.max(0, (secondsLeft / 10) * 100)}%`;
          if (secondsLeft <= 0) {
            clearInterval(state.invoiceRedirectTimer);
            window.location.href = 'perfil.html#mis-pedidos-section';
          }
        }, 1000);
      }
    });
  }

  function toggleCheckoutMapVisibility(showMap) {
    const mapCollapsible = document.getElementById('checkoutMapCollapsible');
    const muniInput = document.getElementById('addrMunicipio');
    const streetInput = document.getElementById('addrStreet');
    const refInput = document.getElementById('addrRef');

    if (!mapCollapsible) return;

    if (showMap) {
      mapCollapsible.classList.remove('is-collapsed');
      if (muniInput) {
        muniInput.readOnly = false;
        muniInput.classList.remove('is-locked-field');
      }
      if (streetInput) {
        streetInput.readOnly = false;
        streetInput.classList.remove('is-locked-field');
      }
      if (refInput) {
        refInput.readOnly = false;
        refInput.classList.remove('is-locked-field');
      }
      setTimeout(() => {
        state.maps.addressMap?.invalidateSize();
      }, 380);
    } else {
      mapCollapsible.classList.add('is-collapsed');
      if (muniInput) {
        muniInput.readOnly = true;
        muniInput.classList.add('is-locked-field');
      }
      if (streetInput) {
        streetInput.readOnly = true;
        streetInput.classList.add('is-locked-field');
      }
      if (refInput) {
        refInput.readOnly = true;
        refInput.classList.add('is-locked-field');
      }
    }
  }

  function applySavedAddressToCheckout(idx) {
    const dir = state.direcciones[idx];
    if (!dir) return;

    const muniInput = document.getElementById('addrMunicipio');
    const streetInput = document.getElementById('addrStreet');
    const refInput = document.getElementById('addrRef');

    if (muniInput) {
      muniInput.value = dir.municipio;
      muniInput.readOnly = true;
      muniInput.classList.add('is-locked-field');
    }
    if (streetInput) {
      streetInput.value = dir.direccion;
      streetInput.readOnly = true;
      streetInput.classList.add('is-locked-field');
    }
    if (refInput) {
      refInput.value = dir.barrio_referencia || '';
      refInput.readOnly = true;
      refInput.classList.add('is-locked-field');
    }

    const latEl = document.getElementById('addrLat');
    const lngEl = document.getElementById('addrLng');
    if (latEl) latEl.value = dir.lat;
    if (lngEl) lngEl.value = dir.lng;

    updateZoneBannerUI(dir.lat, dir.lng, dir.municipio);

    if (state.maps.addressMap && state.maps.addressMarker) {
      state.maps.addressMap.setView([dir.lat, dir.lng], 14);
      state.maps.addressMarker.setLatLng([dir.lat, dir.lng]).openPopup();
    }

    // Al seleccionar una dirección guardada conocida, ocultamos el mapa animado para ahorrar espacio
    toggleCheckoutMapVisibility(false);
  }

  function renderCheckoutPageItems() {
    const listEl = document.getElementById('checkoutItemsListContainer');
    const countText = document.getElementById('checkoutItemsCountText');
    const totalEl = document.getElementById('checkoutTotalAmount');
    const step2TotalEl = document.getElementById('checkoutStep2TotalAmount');

    const totalFormatted = formatCurrency(getCartTotal());
    if (countText) countText.textContent = `${getCartTotalUnits()} unidades (${state.cart.length} ref.)`;
    if (totalEl) totalEl.textContent = totalFormatted;
    if (step2TotalEl) step2TotalEl.textContent = totalFormatted;
    if (!listEl) return;

    if (state.cart.length === 0) {
      listEl.innerHTML = `
        <div class="detail-box" style="text-align:center; padding:2rem;">
          <p>No tienes productos en el carrito.</p>
          <a href="index.html" class="btn-primary" style="margin-top:0.85rem;">Ir al Catálogo</a>
        </div>
      `;
      return;
    }

    listEl.innerHTML = state.cart
      .map(
        (item) => `
        <div class="checkout-item-row">
          <div class="checkout-item-left">
            <img src="${item.imagen_url}" alt="${item.nombre}" class="checkout-item-img" />
            <div>
              <strong>${item.nombre}</strong>
              <div style="font-size:0.8rem; color:var(--text-secondary);">
                Precio unitario: ${formatCurrency(item.precio)} • Subtotal: <strong>${formatCurrency(item.precio * item.cantidad)}</strong>
              </div>
            </div>
          </div>
          <div class="bulk-qty-box">
            <button type="button" class="bulk-step-btn" data-chk-step="${item.id}" data-delta="-1">-</button>
            <input
              type="number"
              min="1"
              max="99999"
              value="${item.cantidad}"
              class="bulk-qty-input"
              data-chk-input="${item.id}"
            />
            <button type="button" class="bulk-step-btn" data-chk-step="${item.id}" data-delta="1">+</button>
          </div>
        </div>
      `
      )
      .join('');

    listEl.onclick = (e) => {
      const btn = e.target.closest('[data-chk-step]');
      if (!btn) return;
      const id = Number(btn.getAttribute('data-chk-step'));
      const delta = Number(btn.getAttribute('data-delta'));
      const item = state.cart.find((c) => Number(c.id) === id);
      if (item) setCartItemExactQuantity(id, item.cantidad + delta);
    };

    listEl.onchange = (e) => {
      const inp = e.target.closest('[data-chk-input]');
      if (!inp) return;
      const id = Number(inp.getAttribute('data-chk-input'));
      setCartItemExactQuantity(id, inp.value);
    };
  }

  function renderPaymentVisualBox(method) {
    state.selectedPayMethod = method || 'bancolombia';
    document.querySelectorAll('#paymentMethodsGrid .payment-method-card').forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-pay-method') === state.selectedPayMethod);
    });

    const box = document.getElementById('paymentVisualBox');
    if (!box) return;

    if (state.selectedPayMethod === 'bancolombia') {
      box.innerHTML = `
        <div class="modal-form">
          <div class="pay-method-brand-header">
            <img src="img/bancolombia.webp" alt="Bancolombia" class="pay-modal-brand-logo bco-brand" />
            <div>
              <strong>Transferencia Bancaria Bancolombia / Código QR</strong>
              <div class="pay-method-brand-sub">Cuenta Corriente Empresarial Danillanos S.A.S.</div>
            </div>
          </div>
          <div class="detail-box pay-banking-detail">
            <div>
              <span class="detail-box-label">Convenio Recaudo Empresarial</span>
              <strong style="font-size:1.05rem; letter-spacing:0.02em;">Cuenta de Ahorros N° 364-000918-21</strong>
              <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:3px;">
                Beneficiario: <strong>Danillanos S.A.S.</strong> • NIT 901.452.889-1
              </div>
            </div>
            <div class="qr-code-box">
              <span class="material-symbols-rounded" style="font-size:2.2rem;">qr_code_2</span>
              <span style="font-size:0.62rem; font-weight:700; text-transform:uppercase;">Código QR</span>
            </div>
          </div>
          <p class="pay-instruction-note">
            <span class="material-symbols-rounded">info</span>
            <span>Al confirmar su pedido, se emitirá su factura electrónica con el código de referencia para validar su transferencia.</span>
          </p>
        </div>
      `;
    } else if (state.selectedPayMethod === 'nequi') {
      box.innerHTML = `
        <div class="modal-form">
          <div class="pay-method-brand-header">
            <img src="img/nequi.png" alt="Nequi" class="pay-modal-brand-logo nequi-brand" />
            <div>
              <strong>Pago Rápido Nequi</strong>
              <div class="pay-method-brand-sub">Transferencia directa entre cuentas o notificación de cobro</div>
            </div>
          </div>
          <div class="form-group">
            <label for="nequiPhoneInput">Número de Celular Nequi del Comprador *</label>
            <input type="tel" id="nequiPhoneInput" class="modal-input" value="${state.user?.telefono || ''}" placeholder="Ej: 310 123 4567" required />
          </div>
          <div class="detail-box" style="margin-top:0.25rem;">
            <span class="detail-box-label">Línea de Recaudo Oficial Nequi</span>
            <strong>311 456 7890</strong> • Danillanos Cárnicos y Congelados
          </div>
          <p class="pay-instruction-note">
            <span class="material-symbols-rounded">notifications_active</span>
            <span>Abra su app Nequi y confirme la solicitud enviada por Danillanos para autorizar la transacción.</span>
          </p>
        </div>
      `;
    } else if (state.selectedPayMethod === 'tarjeta') {
      box.innerHTML = `
        <div class="modal-form">
          <div class="pay-method-brand-header">
            <span class="pay-logo pay-logo-card"><span class="material-symbols-rounded">credit_card</span></span>
            <div>
              <strong>Tarjeta de Crédito o Débito</strong>
              <div class="pay-method-brand-sub">Transacción cifrada bajo protocolos de seguridad bancaria</div>
            </div>
          </div>
          <div class="form-group">
            <label>Número de Tarjeta *</label>
            <input type="text" class="modal-input" value="•••• •••• •••• 4410" placeholder="•••• •••• •••• ••••" />
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Fecha de Vencimiento *</label>
              <input type="text" class="modal-input" value="08/29" placeholder="MM/AA" />
            </div>
            <div class="form-group">
              <label>Código de Seguridad (CVV) *</label>
              <input type="password" class="modal-input" value="842" maxlength="4" placeholder="•••" />
            </div>
          </div>
          <div class="form-group">
            <label>Titular de la Tarjeta *</label>
            <input type="text" class="modal-input" value="${state.user?.nombre_completo || 'Titular de la tarjeta'}" />
          </div>
        </div>
      `;
    } else {
      box.innerHTML = `
        <div class="modal-form">
          <div class="pay-method-brand-header">
            <span class="pay-logo pay-logo-cash"><span class="material-symbols-rounded">payments</span></span>
            <div>
              <strong>Pago Contraentrega en Efectivo</strong>
              <div class="pay-method-brand-sub">Cancele directamente al recibir su pedido en su domicilio o negocio</div>
            </div>
          </div>
          <div class="form-group">
            <label>¿Con cuánto cancelará? (Para alistar cambio)</label>
            <input type="text" class="modal-input" value="Pago exacto al recibir" placeholder="Ej: Pago exacto / Billete de $100.000" />
          </div>
          <p class="pay-instruction-note">
            <span class="material-symbols-rounded">verified</span>
            <span>El personal de reparto le entregará su producto debidamente refrigerado junto con su factura electrónica de venta.</span>
          </p>
        </div>
      `;
    }
  }

  // ==========================================================================
  // 7. PÁGINA DEDICADA DEL PANEL DE CONTROL (panel.html) + HISTORIALES CON FILTROS PARA TODOS LOS ROLES
  // ==========================================================================
  // Chequeo reactivo para resetear la barra de progreso de entregadores automáticamente a las 00:00
  let lastCheckedDay = new Date().getDate();
  setInterval(() => {
    const curDay = new Date().getDate();
    if (curDay !== lastCheckedDay) {
      lastCheckedDay = curDay;
      if (CURRENT_PAGE === 'panel' && state.activeStaffTab === 'entregador') {
        renderEntregadorPanel();
      }
    }
  }, 15000);

  function initPanelPage() {
    syncCurrentUserRoleFromLocalStore();
    if (!isStaffUser()) {
      window.location.replace('404.html');
      return;
    }

    initSharedInvoiceModalEvents();

    const defaultTabByRole = {
      admin: 'admin',
      empleado: 'empleado',
      entregador: 'entregador',
      soporte: 'soporte'
    };
    state.activeStaffTab = defaultTabByRole[normalizeRole(state.user.rol)] || 'empleado';

    const staffLayout = document.getElementById('staffLayout');
    const staffSidebar = document.getElementById('staffSidebar');
    const staffProfileCard = document.getElementById('staffProfileCard');
    staffProfileCard?.addEventListener('click', () => {
      if (!staffSidebar) return;
      if (window.innerWidth <= 1080) {
        const expanded = staffSidebar.classList.toggle('is-expanded');
        staffProfileCard.setAttribute('aria-expanded', String(expanded));
      } else {
        const collapsedDesktop = staffSidebar.classList.toggle('is-collapsed-desktop');
        staffLayout?.classList.toggle('is-desktop-expanded', collapsedDesktop);
        staffSidebar.classList.toggle('is-expanded', !collapsedDesktop);
        staffProfileCard.setAttribute('aria-expanded', String(!collapsedDesktop));
        if (state.activeStaffTab === 'entregador') {
          setTimeout(() => state.maps.driverMap?.invalidateSize(), 310);
        }
      }
    });

    renderStaffSidebar();
    loadStaffDataAndRender();
    initAdminCatalogEvents();
    initStaffFilterEvents();

    document.getElementById('staffNavList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-staff-tab]');
      if (!btn) return;
      state.activeStaffTab = btn.getAttribute('data-staff-tab');
      if (window.innerWidth <= 1080) {
        staffSidebar?.classList.remove('is-expanded');
        staffProfileCard?.setAttribute('aria-expanded', 'false');
      }
      renderStaffSidebar();
      renderActiveStaffTab();
      if (state.activeStaffTab === 'soporte' && (!state.staffTickets || state.staffTickets.length === 0)) {
        loadStaffDataAndRender();
      }
    });

    document.getElementById('btnStaffLogout')?.addEventListener('click', () => {
      setSession(null, null, []);
      window.location.href = 'index.html';
    });

    ['btnAdminRefresh', 'btnEmpleadoRefresh', 'btnEntregadorRefresh', 'btnSoporteRefresh'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', loadStaffDataAndRender);
    });

    // Botón para expandir o colapsar todos los tickets del Asistente
    document.getElementById('btnToggleAllAssistantTickets')?.addEventListener('click', () => {
      if (!state.expandedStaffTickets) state.expandedStaffTickets = new Set();
      const allTkIds = (state.staffTickets || []).map((t) => Number(t.id));
      if (state.expandedStaffTickets.size >= allTkIds.length && allTkIds.length > 0) {
        state.expandedStaffTickets.clear();
      } else {
        allTkIds.forEach((id) => {
          state.expandedStaffTickets.add(id);
          const tkObj = (state.staffTickets || []).find((t) => Number(t.id) === id);
          if (tkObj) markTicketSeenByStaff(id, tkObj.mensajes);
        });
      }
      renderSoportePanel();
    });

    const workspace = document.getElementById('staffWorkspace');
    workspace?.addEventListener('click', async (e) => {
      // Alternar colapso de ticket para Asistente de Soporte
      const toggleTicketEl = e.target.closest('[data-toggle-staff-ticket]');
      if (toggleTicketEl && !e.target.closest('[data-staff-view-invoice]')) {
        const id = Number(toggleTicketEl.getAttribute('data-toggle-staff-ticket'));
        if (!state.expandedStaffTickets) state.expandedStaffTickets = new Set();
        if (state.expandedStaffTickets.has(id)) {
          state.expandedStaffTickets.delete(id);
        } else {
          state.expandedStaffTickets.add(id);
          const tkObj = (state.staffTickets || []).find((t) => Number(t.id) === id);
          if (tkObj) markTicketSeenByStaff(id, tkObj.mensajes);
        }
        renderSoportePanel();
        return;
      }
      // Abrir factura electrónica desde cualquier tarjeta del panel
      const viewInvBtn = e.target.closest('[data-staff-view-invoice]');
      if (viewInvBtn) {
        const ordId = Number(viewInvBtn.getAttribute('data-staff-view-invoice'));
        const ord = state.staffOrders.find((o) => Number(o.id) === ordId);
        if (ord) openInvoiceModalByOrder(ord);
        return;
      }

      // Expandir / contraer acordeón de historial en cualquier rol (máximo 1 abierto a la vez)
      const toggleHistHeader = e.target.closest('[data-toggle-staff-hist]');
      if (toggleHistHeader && !e.target.closest('[data-staff-view-invoice]') && !e.target.closest('[data-emp-cancel]')) {
        const ordId = Number(toggleHistHeader.getAttribute('data-toggle-staff-hist'));
        if (state.staffHistoryExpandedIds.has(ordId)) {
          state.staffHistoryExpandedIds.delete(ordId);
        } else {
          state.staffHistoryExpandedIds.clear();
          state.staffHistoryExpandedIds.add(ordId);
        }
        renderActiveStaffTab();
        return;
      }

      // Expandir / colapsar paradas verticales del entregador (estilo Rappi, máximo 1 abierta a la vez)
      const toggleStopHeader = e.target.closest('[data-toggle-driver-stop]');
      if (toggleStopHeader && !e.target.closest('a') && !e.target.closest('button:not([data-toggle-driver-stop])')) {
        const ordId = Number(toggleStopHeader.getAttribute('data-toggle-driver-stop'));
        if (!state.driverExpandedOrderIds) state.driverExpandedOrderIds = new Set();
        if (state.driverExpandedOrderIds.has(ordId)) {
          state.driverExpandedOrderIds.delete(ordId);
        } else {
          state.driverExpandedOrderIds.clear();
          state.driverExpandedOrderIds.add(ordId);
        }
        markDriverOrderSeen(ordId);
        renderEntregadorPanel();
        return;
      }

      // Confirmar pedido en Bodega (con asignación de entregador)
      const clickedOrderCard = e.target.closest('[data-emp-order-id]');
      if (clickedOrderCard) {
        const orderIdToMark = Number(clickedOrderCard.getAttribute('data-emp-order-id'));
        if (orderIdToMark) {
          const dot = clickedOrderCard.querySelector('.ticket-unread-dot');
          if (dot) {
            dot.classList.add('is-read');
            setTimeout(() => dot.remove(), 250);
          }
          markEmployeeOrderSeen(orderIdToMark);
        }
      }

      const confirmBtn = e.target.closest('[data-emp-confirm]');
      if (confirmBtn) {
        const id = Number(confirmBtn.getAttribute('data-emp-confirm'));
        markEmployeeOrderSeen(id);
        const driverSelect = document.getElementById(`assignDriverSelect_${id}`);
        const entregador_id = driverSelect && driverSelect.value ? Number(driverSelect.value) : null;
        const driverText = driverSelect?.options[driverSelect.selectedIndex]?.text || 'Diego Alejandro Vargas';
        saveOrderOverride(id, {
          estado: 'en_proceso',
          entregador_id,
          entregador_nombre: driverText
        });
        try {
          await fetch(`${CONFIG.api.baseUrl}/staff/pedidos/${id}/confirmar`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ entregador_id })
          });
        } catch (_) {}
        loadStaffDataAndRender();
        return;
      }

      // Despachar a Reparto (con asignación de entregador)
      const dispatchBtn = e.target.closest('[data-emp-dispatch]');
      if (dispatchBtn) {
        const id = Number(dispatchBtn.getAttribute('data-emp-dispatch'));
        markEmployeeOrderSeen(id);
        const driverSelect = document.getElementById(`assignDriverSelect_${id}`);
        const entregador_id = driverSelect && driverSelect.value ? Number(driverSelect.value) : null;
        const driverText = driverSelect?.options[driverSelect.selectedIndex]?.text || 'Diego Alejandro Vargas';
        saveOrderOverride(id, {
          estado: 'en_camino',
          entregador_id,
          entregador_nombre: driverText
        });
        try {
          await fetch(`${CONFIG.api.baseUrl}/staff/pedidos/${id}/en-reparto`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ entregador_id })
          });
        } catch (_) {}
        loadStaffDataAndRender();
        return;
      }

      // Cancelar pedido desde el personal
      const cancelBtn = e.target.closest('[data-emp-cancel]');
      if (cancelBtn) {
        const id = Number(cancelBtn.getAttribute('data-emp-cancel'));
        const razon = prompt(`Cancelar Pedido #${id}:\nIndica el motivo de la cancelación:`, 'Cancelado en validación operativa');
        if (!razon || !razon.trim()) return;
        saveOrderOverride(id, {
          estado: 'cancelado',
          razon_cancelacion: razon.trim()
        });
        try {
          await fetch(`${CONFIG.api.baseUrl}/staff/pedidos/${id}/cancelar`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ razon_cancelacion: razon.trim() })
          });
        } catch (_) {}
        loadStaffDataAndRender();
        return;
      }

      // Simular foto de entrega del repartidor
      const simPhotoBtn = e.target.closest('[data-driver-simulate-photo]');
      if (simPhotoBtn) {
        const id = Number(simPhotoBtn.getAttribute('data-driver-simulate-photo'));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#10131a"/><rect x="20" y="20" width="440" height="280" rx="18" fill="#191e2b" stroke="#22c55e" stroke-width="3"/><text x="240" y="115" fill="#ffffff" font-family="sans-serif" font-size="21" font-weight="bold" text-anchor="middle">ENTREGA PEDIDO #${id}</text><text x="240" y="155" fill="#cbd5e1" font-family="sans-serif" font-size="14" text-anchor="middle">${new Date().toLocaleString('es-CO')}</text><text x="240" y="195" fill="#4ade80" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">✔ Entregado Conforme</text></svg>`;
        state.driverPhotosDraft[id] = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        renderEntregadorPanel();
        return;
      }

      // Finalizar entrega con foto
      const completeBtn = e.target.closest('[data-driver-complete]');
      if (completeBtn) {
        const id = Number(completeBtn.getAttribute('data-driver-complete'));
        const photo = state.driverPhotosDraft[id];
        if (!photo) {
          return;
        }
        const noteInput = document.getElementById(`driverNoteInput_${id}`);
        const noteVal = noteInput ? noteInput.value : 'Entrega verificada.';
        saveOrderOverride(id, {
          estado: 'entregado',
          foto_entrega_url: photo,
          observaciones_entregador: noteVal,
          fecha_entrega: new Date().toISOString()
        });
        try {
          await fetch(`${CONFIG.api.baseUrl}/staff/pedidos/${id}/entregar`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              foto_entrega_url: photo,
              observaciones_entregador: noteVal
            })
          });
        } catch (_) {}
        delete state.driverPhotosDraft[id];
        state.driverExpandedOrderIds = null;
        loadStaffDataAndRender();
        return;
      }

      // Quitar foto adjunta en borrador para staff
      const removeStaffDraftBtn = e.target.closest('[data-remove-staff-draft]');
      if (removeStaffDraftBtn) {
        const id = Number(removeStaffDraftBtn.getAttribute('data-remove-staff-draft'));
        if (state.staffChatDrafts) delete state.staffChatDrafts[id];
        const strip = document.getElementById(`staffChatDraftStrip_${id}`);
        if (strip) strip.classList.add('hidden');
        return;
      }

      // Enviar mensaje en el MiniChat de Soporte (Cero 404s)
      const sendSupportChatBtn = e.target.closest('[data-staff-send-chat]');
      if (sendSupportChatBtn) {
        const id = Number(sendSupportChatBtn.getAttribute('data-staff-send-chat'));
        const chatInput = document.getElementById(`staffTicketChatInput_${id}`);
        const msgText = chatInput ? chatInput.value.trim() : '';
        const draftPhoto = state.staffChatDrafts && state.staffChatDrafts[id];
        if (!msgText && !draftPhoto) return;

        const localList = getLocalTicketsStore();
        const tk = localList.find((t) => Number(t.id) === id);
        if (tk) {
          if (!Array.isArray(tk.mensajes)) tk.mensajes = [];
          tk.mensajes.push({
            id: Date.now(),
            autor: `${state.user?.nombre_completo || 'Soporte'} (Soporte)`,
            rol: 'soporte',
            texto: msgText,
            imagen_url: draftPhoto || null,
            fecha: new Date().toISOString()
          });
          tk.respuesta_soporte = msgText || 'Foto adjunta por Soporte';
          if (tk.estado === 'abierto') tk.estado = 'en_revision';
          saveLocalTicketsStore(localList);
          markTicketSeenByStaff(id, tk.mensajes);
        }
        if (state.staffChatDrafts) delete state.staffChatDrafts[id];
        if (chatInput) chatInput.value = '';

        if (state.serverApiV3) {
          try {
            await fetch(`${CONFIG.api.baseUrl}/soporte/${id}/mensaje`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ texto: msgText, imagen_url: draftPhoto || null })
            });
          } catch (_) {}
        } else {
          try {
            await fetch(`${CONFIG.api.baseUrl}/staff/tickets/${id}`, {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({ respuesta_soporte: msgText, estado: 'en_revision' })
            });
          } catch (_) {}
        }
        loadStaffDataAndRender();
        return;
      }

      // Marcar ticket como resuelto
      const resolveBtn = e.target.closest('[data-resolve-ticket]');
      if (resolveBtn) {
        const id = Number(resolveBtn.getAttribute('data-resolve-ticket'));
        const chatInput = document.getElementById(`staffTicketChatInput_${id}`);
        const msgText = chatInput && chatInput.value.trim() ? chatInput.value.trim() : null;

        const localList = getLocalTicketsStore();
        const tk = localList.find((t) => Number(t.id) === id);
        if (tk) {
          if (msgText) {
            if (!Array.isArray(tk.mensajes)) tk.mensajes = [];
            tk.mensajes.push({
              id: Date.now(),
              autor: `${state.user?.nombre_completo || 'Soporte'} (Soporte)`,
              rol: 'soporte',
              texto: msgText,
              fecha: new Date().toISOString()
            });
            tk.respuesta_soporte = msgText;
          }
          tk.estado = 'resuelto';
          saveLocalTicketsStore(localList);
          markTicketSeenByStaff(id, tk.mensajes);
        }

        const res = await fetch(`${CONFIG.api.baseUrl}/staff/tickets/${id}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            respuesta_soporte: msgText || 'Caso resuelto por Soporte Danillanos.',
            estado: 'resuelto'
          })
        });
        const data = await res.json();
        if (data.ok) loadStaffDataAndRender();
        return;
      }

      // Admin: Editar producto del catálogo
      const editProdBtn = e.target.closest('[data-admin-edit-prod]');
      if (editProdBtn) {
        const prodId = Number(editProdBtn.getAttribute('data-admin-edit-prod'));
        const prod = state.products.find((p) => Number(p.id) === prodId);
        if (prod) openAdminProductForm(prod);
        return;
      }

      // Admin: Eliminar producto del catálogo (Cero 404s)
      const delProdBtn = e.target.closest('[data-admin-del-prod]');
      if (delProdBtn) {
        const prodId = Number(delProdBtn.getAttribute('data-admin-del-prod'));
        const prod = state.products.find((p) => Number(p.id) === prodId);
        if (!confirm(`¿Eliminar "${prod?.nombre || prodId}" del catálogo?`)) return;

        state.products = state.products.filter((p) => Number(p.id) !== prodId);
        if (state.serverApiV3) {
          try {
            await fetch(`${CONFIG.api.baseUrl}/staff/catalogo/${prodId}`, {
              method: 'DELETE',
              headers: getAuthHeaders()
            });
          } catch (_) {}
        }
        renderAdminCatalogoPanel();
        return;
      }

      // Admin: Activar / Desactivar cuenta de empleado o usuario (Cero 404s)
      const toggleUserBtn = e.target.closest('[data-admin-toggle-user]');
      if (toggleUserBtn) {
        const userId = Number(toggleUserBtn.getAttribute('data-admin-toggle-user'));
        const nextActive = toggleUserBtn.getAttribute('data-next-active') === '1';

        const usersList = getLocalUsersStore();
        const targetUser = usersList.find((u) => Number(u.id) === userId);
        if (targetUser) {
          targetUser.activo = nextActive;
          saveLocalUsersStore(usersList);
        }

        if (state.serverApiV3) {
          try {
            await fetch(`${CONFIG.api.baseUrl}/staff/usuarios/${userId}`, {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({ activo: nextActive })
            });
          } catch (_) {}
        }
        loadAdminUsersAndRender();
        return;
      }
    });

    workspace?.addEventListener('change', async (e) => {
      const staffChatFileInput = e.target.closest('[data-staff-attach-input]');
      if (staffChatFileInput && staffChatFileInput.files && staffChatFileInput.files[0]) {
        const tkId = Number(staffChatFileInput.getAttribute('data-staff-attach-input'));
        const reader = new FileReader();
        reader.onload = () => {
          state.staffChatDrafts = state.staffChatDrafts || {};
          state.staffChatDrafts[tkId] = reader.result;
          const strip = document.getElementById(`staffChatDraftStrip_${tkId}`);
          const img = document.getElementById(`staffChatDraftImg_${tkId}`);
          if (strip && img) {
            img.src = reader.result;
            strip.classList.remove('hidden');
          }
        };
        reader.readAsDataURL(staffChatFileInput.files[0]);
        return;
      }

      const fileInput = e.target.closest('[data-driver-photo-input]');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const orderId = Number(fileInput.getAttribute('data-driver-photo-input'));
        const reader = new FileReader();
        reader.onload = () => {
          state.driverPhotosDraft[orderId] = reader.result;
          renderEntregadorPanel();
        };
        reader.readAsDataURL(fileInput.files[0]);
        return;
      }

      // Admin: Cambiar rol de empleado / usuario (Cero 404s)
      const roleSelect = e.target.closest('[data-admin-role-select]');
      if (roleSelect) {
        const userId = Number(roleSelect.getAttribute('data-admin-role-select'));
        const newRole = roleSelect.value;

        const usersList = getLocalUsersStore();
        const targetUser = usersList.find((u) => Number(u.id) === userId);
        if (targetUser) {
          targetUser.rol = newRole;
          saveLocalUsersStore(usersList);
        }

        if (state.serverApiV3) {
          try {
            await fetch(`${CONFIG.api.baseUrl}/staff/usuarios/${userId}`, {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({ rol: newRole })
            });
          } catch (_) {}
        }
        loadAdminUsersAndRender();
      }
    });
  }

  function initStaffFilterEvents() {
    const bindFilters = (ids, renderFn) => {
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', renderFn);
      });
    };

    bindFilters(
      ['adminOrderSearchInput', 'adminOrderStatusFilter', 'adminOrderZoneFilter', 'adminOrderPayFilter'],
      renderAdminDashboard
    );
    bindFilters(
      [
        'empActiveSearchInput',
        'empActiveZoneFilter',
        'empHistorySearchInput',
        'empHistoryStatusFilter',
        'empHistoryZoneFilter',
        'empHistoryPayFilter'
      ],
      renderEmpleadoPanel
    );
    bindFilters(
      ['driverHistorySearchInput', 'driverHistoryZoneFilter', 'driverHistoryPayFilter'],
      renderEntregadorHistorySection
    );
    bindFilters(
      [
        'soporteTicketSearchInput',
        'soporteTicketStatusFilter',
        'soporteOrderSearchInput',
        'soporteOrderStatusFilter',
        'soporteOrderZoneFilter',
        'soporteOrderPayFilter'
      ],
      renderSoportePanel
    );
  }

  function renderStaffSidebar() {
    if (!state.user) return;
    const roleNames = {
      empleado: 'EMPLEADO GENERAL',
      entregador: 'ENTREGADOR',
      soporte: 'SOPORTE',
      admin: 'ADMINISTRADOR'
    };

    document.getElementById('staffAvatarInitial').textContent = (
      state.user.nombre_completo || 'D'
    )
      .charAt(0)
      .toUpperCase();
    document.getElementById('staffRoleBadge').textContent =
      roleNames[state.user.rol] || state.user.rol.toUpperCase();
    document.getElementById('staffFullName').textContent = state.user.nombre_completo;
    document.getElementById('staffEmailText').textContent = state.user.email;

    const options = [];
    if (state.user.rol === 'admin') {
      options.push(
        { id: 'admin', icon: 'monitoring', label: 'Resumen e Historial' },
        { id: 'catalogo', icon: 'inventory_2', label: 'Gestionar Catálogo' },
        { id: 'usuarios', icon: 'manage_accounts', label: 'Empleados y Roles' },
        { id: 'empleado', icon: 'fact_check', label: 'Bodega e Historial' },
        { id: 'entregador', icon: 'route', label: 'Ruta e Historial Entregas' },
        { id: 'soporte', icon: 'support_agent', label: 'Soporte y Facturas' }
      );
    } else if (state.user.rol === 'empleado') {
      options.push({ id: 'empleado', icon: 'fact_check', label: 'Bodega e Historial' });
    } else if (state.user.rol === 'entregador') {
      options.push({ id: 'entregador', icon: 'route', label: 'Ruta e Historial Entregas' });
    } else if (state.user.rol === 'soporte') {
      options.push({ id: 'soporte', icon: 'support_agent', label: 'Tickets y Facturas' });
    }

    document.getElementById('staffNavList').innerHTML = options
      .map(
        (opt) => {
          let dotHtml = '';
          if (opt.id === 'empleado' && hasUnreadEmployeeOrders()) {
            dotHtml = '<span class="notification-red-dot" title="Nuevos pedidos en bodega por confirmar"></span>';
          } else if (opt.id === 'entregador' && hasUnreadDriverOrders()) {
            dotHtml = '<span class="notification-red-dot" title="Nuevos pedidos asignados a tu ruta"></span>';
          } else if (opt.id === 'soporte' && hasUnreadStaffTickets()) {
            dotHtml = '<span class="notification-red-dot" title="Nuevos mensajes de clientes en soporte"></span>';
          }

          return `
            <button
              type="button"
              class="staff-nav-option ${state.activeStaffTab === opt.id ? 'active' : ''}"
              data-staff-tab="${opt.id}"
            >
              <span class="material-symbols-rounded">${opt.icon}</span>
              <span>${opt.label}</span>
              ${dotHtml}
            </button>
          `;
        }
      )
      .join('');
  }

  async function loadStaffDataAndRender() {
    const activeLocalDrivers = getLocalUsersStore().filter(
      (u) => normalizeRole(u.rol) === 'entregador' && u.activo !== false
    );

    try {
      const res = await fetch(`${CONFIG.api.baseUrl}/staff/pedidos`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        // Si el usuario ya fue verificado como personal (ej. rol cambiado a empleado por el Admin),
        // cargar datos de respaldo sin redirigir a 404.html
        state.staffOrders = getFallbackStaffOrders();
        state.staffTickets = getLocalTicketsStore();
        state.staffDrivers = activeLocalDrivers;
        renderActiveStaffTab();
        return;
      }

      const data = await res.json();
      if (data.apiVersion >= 3) state.serverApiV3 = true;

      const serverOrders = Array.isArray(data.pedidos) && data.pedidos.length > 0
        ? data.pedidos
        : getFallbackStaffOrders();
      state.staffOrders = applyOrderOverrides(serverOrders);
      state.staffTickets = mergeTicketsWithLocal(data.tickets || []);

      state.staffDrivers =
        Array.isArray(data.entregadores) && data.entregadores.length > 0
          ? data.entregadores
          : activeLocalDrivers;

      if (Array.isArray(data.usuarios) && data.usuarios.length > 0) {
        const localUsers = getLocalUsersStore();
        const mergedUsers = data.usuarios.map((su) => {
          const lu = localUsers.find((u) => Number(u.id) === Number(su.id));
          return lu ? { ...su, rol: normalizeRole(lu.rol), activo: lu.activo } : su;
        });
        saveLocalUsersStore(mergedUsers);
      }

      renderActiveStaffTab();
    } catch (_) {
      state.staffOrders = getFallbackStaffOrders();
      state.staffTickets = getLocalTicketsStore();
      state.staffDrivers = activeLocalDrivers;
      renderActiveStaffTab();
    }
  }

  function renderActiveStaffTab() {
    document.getElementById('panelViewAdmin')?.classList.toggle('hidden', state.activeStaffTab !== 'admin');
    document.getElementById('panelViewCatalogo')?.classList.toggle('hidden', state.activeStaffTab !== 'catalogo');
    document.getElementById('panelViewUsuarios')?.classList.toggle('hidden', state.activeStaffTab !== 'usuarios');
    document.getElementById('panelViewEmpleado')?.classList.toggle('hidden', state.activeStaffTab !== 'empleado');
    document.getElementById('panelViewEntregador')?.classList.toggle('hidden', state.activeStaffTab !== 'entregador');
    document.getElementById('panelViewSoporte')?.classList.toggle('hidden', state.activeStaffTab !== 'soporte');

    if (state.activeStaffTab === 'admin') renderAdminDashboard();
    else if (state.activeStaffTab === 'catalogo') renderAdminCatalogoPanel();
    else if (state.activeStaffTab === 'usuarios') loadAdminUsersAndRender();
    else if (state.activeStaffTab === 'empleado') renderEmpleadoPanel();
    else if (state.activeStaffTab === 'entregador') renderEntregadorPanel();
    else if (state.activeStaffTab === 'soporte') renderSoportePanel();
  }

  /**
   * Renderizador compartido de Historial de Pedidos y Facturas Colapsable para Admin, Empleado, Entregador y Soporte
   */
  /**
   * Renderizador compartido de Historial de Pedidos y Facturas Colapsable para Admin, Empleado, Entregador y Soporte
   */
  function renderCollapsibleStaffOrdersList(list, containerId, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `<div class="detail-box"><p>${emptyMessage}</p></div>`;
      return;
    }

    const stageLabels = {
      pendiente: { icon: 'pending_actions', text: 'Por Confirmar', pill: 'status-pendiente' },
      en_proceso: { icon: 'warehouse', text: 'En Proceso', pill: 'status-en_proceso' },
      en_camino: { icon: 'local_shipping', text: 'En Ruta de Reparto', pill: 'status-en_camino' },
      entregado: { icon: 'verified', text: 'Entregado', pill: 'status-entregado' },
      cancelado: { icon: 'cancel', text: 'Cancelado', pill: 'status-cancelado' }
    };

    container.innerHTML = list
      .map((ord) => {
        const isExpanded = state.staffHistoryExpandedIds.has(ord.id);
        const st = stageLabels[ord.estado] || stageLabels.pendiente;
        const invCode = getInvoiceCode(ord.id);
        const pagoDesc = (ord.metodo_pago || 'efectivo').toUpperCase();
        const entregaSub = ord.tiempo_entrega_estimado || 'Envío el mismo día';

        return `
          <article class="customer-order-accordion ${isExpanded ? 'is-expanded' : ''}">
            <button
              type="button"
              class="customer-order-header"
              data-toggle-staff-hist="${ord.id}"
              aria-expanded="${isExpanded ? 'true' : 'false'}"
            >
              <div class="customer-order-header-left">
                <div class="customer-order-title-row" style="align-items:center; gap:0.65rem;">
                  <span class="order-id-badge" style="font-size:0.92rem; font-weight:800;">#${ord.id}</span>
                  <span style="font-size:0.9rem; font-weight:800; color:var(--text-primary);">${formatCurrency(ord.total)}</span>
                  <span class="invoice-number-badge-inline">
                    <span class="material-symbols-rounded" style="font-size:0.9rem;">receipt_long</span>
                    ${invCode}
                  </span>
                </div>
                <div class="customer-order-meta-line" style="margin-top:0.35rem; font-size:0.83rem; color:var(--text-secondary);">
                  <span>${pagoDesc}</span>
                  <span>•</span>
                  <span>${entregaSub}</span>
                </div>
              </div>

              <div class="customer-order-direct-stage" style="display:flex; align-items:center; gap:0.75rem;">
                <span class="order-status-pill ${st.pill}">${ord.estado === 'pendiente' && hasEmployeeOrderNovelty(ord) ? '<span class="ticket-unread-dot" title="Nuevo pedido por confirmar"></span>' : ''}<span>${st.text}</span></span>
                <span class="customer-order-chevron">
                  <span class="material-symbols-rounded">expand_more</span>
                </span>
              </div>
            </button>

            <div class="customer-order-body">
              <div class="customer-order-body-content" style="padding:1.25rem 1.65rem 1.65rem;">
                <div class="staff-order-details-grid">
                  <div class="detail-box">
                    <span class="detail-box-label">Destinatario</span>
                    <strong style="font-size:0.95rem; color:var(--text-primary);">${ord.nombre_recibe}</strong>
                    <span class="detail-box-sub">${ord.telefono_cliente || 'Sin teléfono'}</span>
                  </div>

                  <div class="detail-box">
                    <span class="detail-box-label">Dirección de Entrega</span>
                    <strong style="font-size:0.95rem; color:var(--text-primary);">${ord.direccion_entrega}</strong>
                    <span class="detail-box-sub">${ord.barrio ? ord.barrio + ' • ' : ''}${ord.municipio || 'Villavicencio'}</span>
                  </div>

                  <div class="detail-box">
                    <span class="detail-box-label">${ord.notas_entrega || ord.instrucciones_entrega ? 'Nota del Cliente' : 'Facturación y Pago'}</span>
                    ${
                      ord.notas_entrega || ord.instrucciones_entrega
                        ? `<strong style="font-size:0.9rem; color:var(--text-primary);">${ord.notas_entrega || ord.instrucciones_entrega}</strong>
                           <span class="detail-box-sub">${invCode} • ${pagoDesc}</span>`
                        : `<strong style="font-size:0.92rem; color:var(--text-primary);">${invCode} • ${pagoDesc}</strong>
                           <span class="detail-box-sub">Total factura: ${formatCurrency(ord.total)}${ord.reembolso_estado === 'reembolsado' ? ' (Reembolsado)' : ''}</span>`
                    }
                  </div>
                </div>

                ${
                  ord.entregador_nombre
                    ? `<div class="detail-box" style="margin-top:1rem;">
                         <span class="detail-box-label">Repartidor Responsable</span>
                         <strong style="font-size:0.92rem; color:var(--text-primary);">${ord.entregador_nombre}</strong>
                       </div>`
                    : ''
                }

                ${
                  ord.razon_cancelacion
                    ? `<div class="detail-box" style="margin-top:1rem; border:1px solid rgba(239,68,68,0.4); background:rgba(239,68,68,0.06);">
                         <span class="detail-box-label" style="color:#ef4444;">Motivo de Cancelación</span>
                         <strong style="color:#ef4444; font-size:0.92rem;">${ord.razon_cancelacion}</strong>
                       </div>`
                    : ''
                }

                ${
                  ord.foto_entrega_url
                    ? `<div class="detail-box" style="margin-top:1rem;">
                         <span class="detail-box-label">Evidencia Fotográfica de Entrega (${ord.observaciones_entregador || 'Verificado'})</span>
                         <img src="${ord.foto_entrega_url}" alt="Entrega #${ord.id}" class="delivery-photo-preview" style="margin-top:0.5rem; border-radius:12px; max-height:220px; object-fit:cover;" />
                       </div>`
                    : ''
                }

                <div class="order-items-chips" style="margin-top:1.15rem; gap:0.65rem;">
                  ${(ord.items || [])
                    .map((i) => `<span class="order-item-chip" style="padding:0.42rem 0.85rem; font-size:0.82rem;">${i.cantidad}x ${i.nombre_producto}</span>`)
                    .join('')}
                </div>

                <div class="customer-order-actions-bar" style="margin-top:1.25rem; padding-top:1rem; border-top:1px solid var(--border-subtle);">
                  <span style="font-size:0.82rem; color:var(--text-secondary);">
                    Entrega estimada: <strong>${ord.tiempo_entrega_estimado || 'Ruta programada'}</strong>
                  </span>
                  <div class="customer-order-actions-btns">
                    <button type="button" class="btn-secondary" data-staff-view-invoice="${ord.id}">
                      <span class="material-symbols-rounded">receipt_long</span>
                      <span>Ver Factura Gráfica</span>
                    </button>
                    ${
                      ord.estado !== 'entregado' && ord.estado !== 'cancelado'
                        ? `<button type="button" class="btn-cancel-order" data-emp-cancel="${ord.id}">
                             <span class="material-symbols-rounded">cancel</span>
                             <span>Cancelar Pedido</span>
                           </button>`
                        : ''
                    }
                  </div>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // ==========================================================================
  // SUB-PANELES EXCLUSIVOS DE ADMINISTRADOR: CATÁLOGO (CRUD) Y EMPLEADOS/ROLES
  // ==========================================================================
  function initAdminCatalogEvents() {
    const catSelect = document.getElementById('admProdCategoria');
    if (catSelect && CONFIG.categories) {
      catSelect.innerHTML = CONFIG.categories
        .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
        .join('');
    }

        function openAdminEmployeeForm() {
      const card = document.getElementById('adminEmployeeFormCard');
      if (!card) return;
      card.classList.remove('hidden');
      card.classList.remove('is-closing');
      document.getElementById('adminNewEmpEmail')?.focus();
    }

    function closeAdminEmployeeForm() {
      const card = document.getElementById('adminEmployeeFormCard');
      if (!card || card.classList.contains('hidden')) return;
      card.classList.add('is-closing');
      setTimeout(() => {
        card.classList.remove('is-closing');
        card.classList.add('hidden');
      }, 220);
    }

    document.getElementById('btnOpenNewEmployeeForm')?.addEventListener('click', openAdminEmployeeForm);
    document.getElementById('btnCloseEmployeeForm')?.addEventListener('click', closeAdminEmployeeForm);
    document.getElementById('btnCancelEmployeeForm')?.addEventListener('click', closeAdminEmployeeForm);

    document.getElementById('btnOpenNewProductForm')?.addEventListener('click', () => {
      openAdminProductForm(null);
    });
    document.getElementById('btnCloseCatalogForm')?.addEventListener('click', () => {
      document.getElementById('adminCatalogFormCard')?.classList.add('hidden');
    });
    document.getElementById('btnCancelCatalogForm')?.addEventListener('click', () => {
      document.getElementById('adminCatalogFormCard')?.classList.add('hidden');
    });

    document.getElementById('adminCatalogSearchInput')?.addEventListener('input', (e) => {
      state.adminCatalogQuery = e.target.value;
      renderAdminCatalogoPanel();
    });

    document.getElementById('adminProductForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prodId = document.getElementById('admProdId').value;
      const catId = Number(document.getElementById('admProdCategoria').value) || 1;
      const catObj = (CONFIG.categories || []).find((c) => Number(c.id) === catId) || {
        id: 1,
        slug: 'embutidos',
        nombre: 'Cárnicos y Embutidos'
      };

      const payload = {
        nombre: document.getElementById('admProdNombre').value.trim().toUpperCase(),
        categoria_id: catObj.id,
        categoria_slug: catObj.slug,
        categoria_nombre: catObj.nombre,
        precio: Number(document.getElementById('admProdPrecio').value) || 0,
        presentacion: document.getElementById('admProdPresentacion').value.trim() || 'Unidad',
        temperatura_conservacion: document.getElementById('admProdTemp').value,
        etiqueta: document.getElementById('admProdEtiqueta').value.trim() || null,
        imagen_url:
          document.getElementById('admProdImagen').value.trim() ||
          'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
        descripcion: document.getElementById('admProdDesc').value.trim() || 'Calidad garantizada Danillanos.'
      };

      const isEdit = Boolean(prodId);
      if (isEdit) {
        const idx = state.products.findIndex((p) => Number(p.id) === Number(prodId));
        if (idx !== -1) state.products[idx] = { ...state.products[idx], ...payload };
      } else {
        const nextId = state.products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
        state.products.unshift({
          id: nextId,
          codigo_sku: `DAN-ADM-${Date.now().toString().slice(-4)}`,
          ...payload
        });
      }

      if (state.serverApiV3) {
        const url = isEdit
          ? `${CONFIG.api.baseUrl}/staff/catalogo/${prodId}`
          : `${CONFIG.api.baseUrl}/staff/catalogo`;
        try {
          await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
          });
        } catch (_) {}
      }

      document.getElementById('adminCatalogFormCard')?.classList.add('hidden');
      renderAdminCatalogoPanel();
    });

    // Formulario de Administrador para Vincular Correo Electrónico como Empleado
    const newEmpForm = document.getElementById('adminNewEmployeeForm');
    const newEmpMsg = document.getElementById('adminNewEmpMsg');
    newEmpForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('adminNewEmpEmail');
      const nameInput = document.getElementById('adminNewEmpName');
      const roleSelect = document.getElementById('adminNewEmpRole');
      const submitBtn = document.getElementById('btnAdminAddEmployee');

      const email = (emailInput?.value || '').trim().toLowerCase();
      const nombre = (nameInput?.value || '').trim();
      const rol = roleSelect?.value || 'empleado';

      if (!email || !email.includes('@')) {
        if (newEmpMsg) {
          newEmpMsg.style.display = 'block';
          newEmpMsg.style.color = '#ef4444';
          newEmpMsg.textContent = '❌ Por favor ingresa un correo electrónico válido.';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
      }

      const usersList = getLocalUsersStore();
      const existingUser = usersList.find((u) => (u.email || '').toLowerCase() === email);
      if (existingUser) {
        existingUser.rol = rol;
        existingUser.activo = true;
        if (nombre) existingUser.nombre_completo = nombre;
      } else {
        const nextId = usersList.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1;
        usersList.unshift({
          id: nextId,
          email,
          nombre_completo: nombre || email.split('@')[0],
          rol,
          activo: true,
          telefono: 'N/A',
          empresa: 'Danillanos'
        });
      }
      saveLocalUsersStore(usersList);

      if (state.serverApiV3) {
        try {
          await fetch(`${CONFIG.api.baseUrl}/staff/usuarios`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              email,
              nombre_completo: nombre,
              rol
            })
          });
        } catch (_) {}
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }

      if (newEmpMsg) {
        newEmpMsg.style.display = 'block';
        newEmpMsg.style.color = '#16a34a';
        newEmpMsg.textContent = `✔ Empleado (${email}) vinculado exitosamente con rol ${rol.toUpperCase()}.`;
        setTimeout(() => {
          if (newEmpMsg) newEmpMsg.style.display = 'none';
        }, 4500);
      }

      newEmpForm.reset();
      loadAdminUsersAndRender();
    });
  }

  function openAdminProductForm(prod = null) {
    const card = document.getElementById('adminCatalogFormCard');
    const title = document.getElementById('adminCatalogFormTitle');
    const submitText = document.getElementById('admProdSubmitText');
    if (!card) return;

    card.classList.remove('hidden');
    if (prod) {
      title.textContent = `Editar Producto #${prod.id}`;
      submitText.textContent = 'Guardar Cambios';
      document.getElementById('admProdId').value = prod.id;
      document.getElementById('admProdNombre').value = prod.nombre || '';
      document.getElementById('admProdCategoria').value = prod.categoria_id || 1;
      document.getElementById('admProdPrecio').value = prod.precio || 0;
      document.getElementById('admProdPresentacion').value = prod.presentacion || 'Unidad';
      document.getElementById('admProdTemp').value = prod.temperatura_conservacion || 'Congelado -18°C';
      document.getElementById('admProdEtiqueta').value = prod.etiqueta || '';
      document.getElementById('admProdImagen').value = prod.imagen_url || '';
      document.getElementById('admProdDesc').value = prod.descripcion || '';
    } else {
      title.textContent = 'Crear Nuevo Producto';
      submitText.textContent = 'Crear Producto';
      document.getElementById('adminProductForm')?.reset();
      document.getElementById('admProdId').value = '';
    }
  }

  function renderAdminCatalogoPanel() {
    const listEl = document.getElementById('adminCatalogListContainer');
    const badge = document.getElementById('adminCatalogTotalBadge');
    if (badge) badge.textContent = String(state.products.length);
    if (!listEl) return;

    const q = (state.adminCatalogQuery || '').trim().toLowerCase();
    const filtered = state.products.filter(
      (p) =>
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(q)) ||
        (p.codigo_sku && p.codigo_sku.toLowerCase().includes(q))
    );

    listEl.innerHTML = filtered
      .slice(0, 60)
      .map(
        (p) => `
        <div class="admin-catalog-row">
          <div class="admin-catalog-row-left">
            <img src="${p.imagen_url}" alt="${p.nombre}" class="admin-catalog-thumb" loading="lazy" />
            <div>
              <strong>${p.nombre}</strong>
              <div style="font-size:0.78rem; color:var(--text-secondary);">
                ${p.categoria_nombre || 'Danillanos'} • ${p.presentacion} • <strong>${formatCurrency(p.precio)}</strong>
              </div>
            </div>
          </div>
          <div class="admin-catalog-actions">
            <button type="button" class="btn-secondary" data-admin-edit-prod="${p.id}" style="padding:0.45rem 0.85rem; font-size:0.78rem;">
              <span class="material-symbols-rounded" style="font-size:1rem;">edit</span>
              <span>Editar</span>
            </button>
            <button type="button" class="btn-cancel-order" data-admin-del-prod="${p.id}" style="padding:0.45rem 0.85rem; font-size:0.78rem;">
              <span class="material-symbols-rounded" style="font-size:1rem;">delete</span>
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      `
      )
      .join('');
  }

  async function loadAdminUsersAndRender() {
    const container = document.getElementById('adminUsersListContainer');
    if (!container) return;

    if (state.serverApiV3) {
      try {
        const res = await fetch(`${CONFIG.api.baseUrl}/staff/usuarios`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.data) && data.data.length > 0) {
            saveLocalUsersStore(data.data);
          }
        }
      } catch (_) {}
    }

    const users = getLocalUsersStore();
    state.staffUsers = users;

    const rolesList = [
      { value: 'cliente', label: 'Cliente' },
      { value: 'empleado', label: 'Empleado General' },
      { value: 'entregador', label: 'Entregador' },
      { value: 'soporte', label: 'Soporte' },
      { value: 'admin', label: 'Administrador' }
    ];

    container.innerHTML = users
      .map((u) => {
        const isActive = u.activo !== false;
        return `
          <div class="admin-user-card">
            <div>
              <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
                <strong>${u.nombre_completo}</strong>
                <span class="order-status-pill ${isActive ? 'status-entregado' : 'status-cancelado'}">
                  ${isActive ? 'ACTIVO' : 'DESACTIVADO'}
                </span>
              </div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                ${u.email} • Tel: ${u.telefono || 'N/A'} • ${u.empresa || 'Danillanos'}
              </div>
            </div>

            <div class="admin-user-controls">
              <select class="driver-assign-select" data-admin-role-select="${u.id}" aria-label="Rol de usuario">
                ${rolesList
                  .map(
                    (r) =>
                      `<option value="${r.value}" ${u.rol === r.value ? 'selected' : ''}>${r.label}</option>`
                  )
                  .join('')}
              </select>
              <button
                type="button"
                class="${isActive ? 'btn-cancel-order' : 'btn-confirm-order'}"
                data-admin-toggle-user="${u.id}"
                data-next-active="${isActive ? '0' : '1'}"
                style="padding:0.5rem 0.95rem; font-size:0.78rem;"
              >
                <span class="material-symbols-rounded" style="font-size:1rem;">${isActive ? 'person_off' : 'person_check'}</span>
                <span>${isActive ? 'Desactivar Cuenta' : 'Activar Cuenta'}</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    enhanceAllCustomSelects(container);
  }

  function renderAdminDashboard() {
    const orders = state.staffOrders;
    const valid = orders.filter((o) => o.estado !== 'cancelado');
    const totalVendido = valid.reduce((s, o) => s + Number(o.total), 0);
    const porAceptar = orders.filter((o) => o.estado === 'pendiente').length;
    const enProgreso = orders.filter((o) => o.estado === 'en_proceso' || o.estado === 'en_camino').length;
    const entregados = orders.filter((o) => o.estado === 'entregado').length;

    document.getElementById('adminKpiGrid').innerHTML = `
      <div class="kpi-card">
        <div class="kpi-card-top"><span>Total Vendido</span><span class="material-symbols-rounded">payments</span></div>
        <div class="kpi-value">${formatCurrency(totalVendido)}</div>
        <div class="kpi-sub">${valid.length} pedidos efectivos</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top"><span>Por Aceptar</span><span class="material-symbols-rounded">pending_actions</span></div>
        <div class="kpi-value">${porAceptar}</div>
        <div class="kpi-sub">Pendientes</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top"><span>En Bodega / Reparto</span><span class="material-symbols-rounded">local_shipping</span></div>
        <div class="kpi-value">${enProgreso}</div>
        <div class="kpi-sub">En preparación o ruta</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top"><span>Entregados</span><span class="material-symbols-rounded">verified</span></div>
        <div class="kpi-value">${entregados}</div>
        <div class="kpi-sub">Verificados</div>
      </div>
    `;

    const lineStats = [
      { label: 'Cárnicos y Costillas', amount: Math.round(totalVendido * 0.44) },
      { label: 'Papas y Congelados', amount: Math.round(totalVendido * 0.28) },
      { label: 'Salsas y Adobos', amount: Math.round(totalVendido * 0.18) },
      { label: 'Icopores y Panes', amount: Math.round(totalVendido * 0.10) }
    ];
    const maxLineAmount = Math.max(...lineStats.map((l) => l.amount), 1);

    document.getElementById('adminCategoryChart').innerHTML = lineStats
      .map((r, idx) => {
        const heightPx = Math.max(24, Math.round((r.amount / maxLineAmount) * 145));
        return `
          <div class="vbar-col ${idx === 0 ? 'is-top-line' : ''}">
            <span class="vbar-value">${formatCurrency(r.amount)}</span>
            <div class="vbar-pillar" style="height:${heightPx}px;"></div>
            <span class="vbar-label">${r.label}</span>
          </div>
        `;
      })
      .join('');

    const palette = [
      { key: 'efectivo', label: 'Efectivo', color: '#94a3b8' },
      { key: 'pse', label: 'PSE', color: '#64748b' },
      { key: 'tarjeta', label: 'Tarjeta', color: '#e01a2c' },
      { key: 'nequi', label: 'Nequi', color: '#cbd5e1' },
      { key: 'bancolombia', label: 'Bancolombia', color: '#475569' }
    ];

    const paymentSlices = palette.map((m) => {
      const sum = valid.filter((o) => o.metodo_pago === m.key).reduce((a, o) => a + Number(o.total), 0);
      const pct = totalVendido > 0 ? Math.round((sum / totalVendido) * 100) : 20;
      return { ...m, sum, pct };
    });

    let accDeg = 0;
    const gradientStops = paymentSlices
      .map((s) => {
        const spanDeg = (s.pct / 100) * 360;
        const start = accDeg;
        const end = accDeg + spanDeg;
        accDeg = end;
        return `${s.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
      })
      .join(', ');

    document.getElementById('adminPaymentChart').innerHTML = `
      <div class="pie-donut-figure" style="background: conic-gradient(${gradientStops || '#64748b 0deg 360deg'});">
        <div class="pie-donut-hole">
          <span>Total</span>
          <strong>${formatCurrency(totalVendido)}</strong>
        </div>
      </div>
      <div class="pie-legend-list">
        ${paymentSlices
          .map(
            (s) => `
          <div class="pie-legend-item">
            <div class="pie-legend-left">
              <span class="pie-swatch" style="background:${s.color};"></span>
              <span>${s.label}</span>
            </div>
            <div class="pie-legend-right">
              <span>${s.pct}%</span>
              <strong>${formatCurrency(s.sum)}</strong>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Renderizar Historial General de Pedidos y Facturas del Administrador con Filtros
    const admQuery = document.getElementById('adminOrderSearchInput')?.value || '';
    const admStatus = document.getElementById('adminOrderStatusFilter')?.value || 'todos';
    const admZone = document.getElementById('adminOrderZoneFilter')?.value || 'todas';
    const admPay = document.getElementById('adminOrderPayFilter')?.value || 'todos';

    const filteredAdminOrders = orders.filter((ord) =>
      matchesOrderFilters(ord, { query: admQuery, status: admStatus, zone: admZone, pay: admPay })
    );

    const summaryBadge = document.getElementById('adminOrdersSummaryBadge');
    if (summaryBadge) {
      const sumFiltered = filteredAdminOrders
        .filter((o) => o.estado !== 'cancelado')
        .reduce((acc, o) => acc + Number(o.total || 0), 0);
      summaryBadge.textContent = `${filteredAdminOrders.length} de ${orders.length} pedidos • Total efectivo filtrado: ${formatCurrency(sumFiltered)}`;
    }

    renderCollapsibleStaffOrdersList(
      filteredAdminOrders,
      'adminOrdersHistoryContainer',
      'No hay pedidos ni facturas que coincidan con los filtros seleccionados.'
    );
  }

  /**
   * Panel Empleado General:
   * 1. Cola activa por confirmar / despachar (con buscador y filtro de zona)
   * 2. Historial de Pedidos Aceptados y Facturas (con buscador y filtros por estado, zona y medio de pago)
   */
  function renderEmpleadoPanel() {
    const activeQuery = document.getElementById('empActiveSearchInput')?.value || '';
    const activeZone = document.getElementById('empActiveZoneFilter')?.value || 'todas';

    const activeQueue = state.staffOrders.filter(
      (o) =>
        (o.estado === 'pendiente' || o.estado === 'en_proceso') &&
        matchesOrderFilters(o, { query: activeQuery, status: 'todos', zone: activeZone, pay: 'todos' })
    );

    const container = document.getElementById('empleadoOrdersContainer');
    if (container) {
      if (activeQueue.length === 0) {
        container.innerHTML = `<div class="detail-box"><p>No hay pedidos pendientes en la cola de bodega con el filtro actual.</p></div>`;
      } else {
        const statusBadgeText = {
          pendiente: 'Por Confirmar',
          en_proceso: 'Aceptado en Bodega'
        };

        const drivers =
          state.staffDrivers.length > 0
            ? state.staffDrivers
            : [
                { id: 3, nombre_completo: 'Diego Alejandro Vargas (Entregador)' },
                { id: 6, nombre_completo: 'Andrés Felipe Castro (Ruta Norte)' }
              ];

        container.innerHTML = activeQueue
          .map(
            (ord) => `
            <article class="staff-order-card" data-emp-order-id="${ord.id}">
              <div class="staff-order-top">
                <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
                  <span class="order-id-badge">Pedido #${ord.id} — ${formatCurrency(ord.total)}</span>
                  <span class="invoice-number-badge-inline">${getInvoiceCode(ord.id)}</span>
                  <span style="font-size:0.8rem; color:var(--text-secondary);">
                    ${ord.metodo_pago.toUpperCase()} • ${ord.tiempo_entrega_estimado}
                  </span>
                </div>
                <span class="order-status-pill status-${ord.estado}">${ord.estado === 'pendiente' && hasEmployeeOrderNovelty(ord) ? '<span class="ticket-unread-dot" title="Nuevo pedido pendiente por confirmar"></span>' : ''}<span>${statusBadgeText[ord.estado] || ord.estado}</span></span>
              </div>

              <div class="staff-order-details-grid">
                <div class="detail-box">
                  <span class="detail-box-label">Destinatario</span>
                  <strong>${ord.nombre_recibe}</strong> • ${ord.telefono_cliente}
                </div>
                <div class="detail-box">
                  <span class="detail-box-label">Dirección de Entrega</span>
                  <strong>${ord.direccion_entrega}</strong> (${ord.municipio})
                </div>
                ${
                  ord.observaciones_cliente
                    ? `<div class="detail-box">
                         <span class="detail-box-label">Nota del Cliente</span>
                         <span>${ord.observaciones_cliente}</span>
                       </div>`
                    : ''
                }
              </div>

              <div class="order-items-chips">
                ${(ord.items || [])
                  .map((i) => `<span class="order-item-chip">${i.cantidad}x ${i.nombre_producto}</span>`)
                  .join('')}
              </div>

              <div class="driver-assign-bar">
                <span class="material-symbols-rounded" style="color:var(--brand-red);">two_wheeler</span>
                <label for="assignDriverSelect_${ord.id}" style="font-size:0.82rem; font-weight:700;">Asignar Enviador:</label>
                <select id="assignDriverSelect_${ord.id}" class="driver-assign-select">
                  ${drivers
                    .map(
                      (d) =>
                        `<option value="${d.id}" ${Number(ord.entregador_id) === Number(d.id) ? 'selected' : ''}>${d.nombre_completo}</option>`
                    )
                    .join('')}
                </select>
                ${
                  ord.entregador_nombre
                    ? `<span style="font-size:0.78rem; color:var(--text-secondary);">Asignado: <strong>${ord.entregador_nombre}</strong></span>`
                    : ''
                }
              </div>

              <div class="staff-order-actions">
                <button type="button" class="btn-secondary" data-staff-view-invoice="${ord.id}">
                  <span class="material-symbols-rounded">receipt_long</span>
                  <span>Ver Factura</span>
                </button>
                ${
                  ord.estado === 'pendiente'
                    ? `<button type="button" class="btn-confirm-order" data-emp-confirm="${ord.id}">
                         <span class="material-symbols-rounded">check_circle</span>
                         <span>Confirmar y Asignar Enviador</span>
                       </button>`
                    : ''
                }
                ${
                  ord.estado === 'en_proceso'
                    ? `<button type="button" class="btn-confirm-order" style="background:#16a34a;" data-emp-dispatch="${ord.id}">
                         <span class="material-symbols-rounded">local_shipping</span>
                         <span>Despachar a Ruta</span>
                       </button>`
                    : ''
                }
                <button type="button" class="btn-cancel-order" data-emp-cancel="${ord.id}">
                  <span class="material-symbols-rounded">cancel</span>
                  <span>Cancelar</span>
                </button>
              </div>
            </article>
          `
          )
          .join('');
      }
    }

    // Historial de Pedidos Aceptados y Gestionados por Empleado
    const empAcceptedAll = state.staffOrders.filter((o) =>
      ['en_proceso', 'en_camino', 'entregado', 'cancelado'].includes(o.estado)
    );
    const empHistQuery = document.getElementById('empHistorySearchInput')?.value || '';
    const empHistStatus = document.getElementById('empHistoryStatusFilter')?.value || 'todos';
    const empHistZone = document.getElementById('empHistoryZoneFilter')?.value || 'todas';
    const empHistPay = document.getElementById('empHistoryPayFilter')?.value || 'todos';

    const filteredEmpHist = empAcceptedAll.filter((ord) =>
      matchesOrderFilters(ord, {
        query: empHistQuery,
        status: empHistStatus,
        zone: empHistZone,
        pay: empHistPay
      })
    );

    const empHistBadge = document.getElementById('empHistorySummaryBadge');
    if (empHistBadge) {
      empHistBadge.textContent = `Mostrando ${filteredEmpHist.length} de ${empAcceptedAll.length} pedidos gestionados`;
    }

    renderCollapsibleStaffOrdersList(
      filteredEmpHist,
      'empleadoHistoryOrdersContainer',
      'No se encontraron pedidos aceptados con los filtros seleccionados.'
    );
  }

  /**
   * Panel Entregador:
   * 1. Barra superior: Progreso (X de Y completados)
   * 2. Mapa limpio + Botón Google Maps
   * 3. Puntos verticales conectados (o | o | o)
   * 4. Historial de Pedidos Entregados con filtros y buscador
   */
  function renderEntregadorPanel() {
    const allDriverOrders = state.staffOrders.filter((o) => o.estado !== 'cancelado');
    // Reset a las 00:00 horas: solo se cuentan las entregas realizadas el día de hoy
    const completedTodayCount = allDriverOrders.filter(isDeliveredToday).length;
    const active = state.staffOrders.filter(
      (o) => o.estado === 'en_camino' || o.estado === 'en_proceso' || o.estado === 'pendiente'
    );
    const totalDailyOrders = completedTodayCount + active.length;
    const progressPct = totalDailyOrders > 0 ? Math.round((completedTodayCount / totalDailyOrders) * 100) : 0;

    const progressCard = document.getElementById('driverRappiProgressCard');
    if (progressCard) {
      progressCard.innerHTML = `
        <div class="driver-rappi-progress-top">
          <span>Progreso de Entregas Hoy</span>
          <span>${completedTodayCount} de ${totalDailyOrders} completados</span>
        </div>
        <div class="driver-rappi-bar-bg">
          <div class="driver-rappi-bar-fill" style="width:${progressPct}%;"></div>
        </div>
      `;
    }

    const hq = CONFIG.map.sedeDanillanos;
    const remaining = [...active];
    const orderedStops = [];
    let curr = { lat: hq.lat, lng: hq.lng };

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      remaining.forEach((o, i) => {
        const d = haversineKm(curr.lat, curr.lng, o.lat, o.lng);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      const next = remaining.splice(bestIdx, 1)[0];
      orderedStops.push({
        ...next,
        legDistanceKm: Number(bestDist.toFixed(2)),
        stopNumber: orderedStops.length + 1
      });
      curr = { lat: next.lat, lng: next.lng };
    }

    if (state.driverExpandedOrderIds === null) {
      state.driverExpandedOrderIds = new Set();
      if (orderedStops.length > 0) {
        state.driverExpandedOrderIds.add(orderedStops[0].id);
      }
    }

    const navToolbar = document.getElementById('driverExternalNavToolbar');
    if (navToolbar) {
      if (orderedStops.length === 0) {
        navToolbar.innerHTML = `<span>Ruta completada. No tienes entregas pendientes en camino.</span>`;
      } else {
        const firstStop = orderedStops[0];
        const lastStop = orderedStops[orderedStops.length - 1];
        const intermediateStops = orderedStops.slice(0, -1);
        const waypointsParam =
          intermediateStops.length > 0
            ? `&waypoints=${encodeURIComponent(intermediateStops.map((s) => `${s.lat},${s.lng}`).join('|'))}`
            : '';

        const googleMapsMultiStopUrl = `https://www.google.com/maps/dir/?api=1&origin=${hq.lat},${hq.lng}&destination=${lastStop.lat},${lastStop.lng}${waypointsParam}&travelmode=driving`;
        const wazeCurrentStopUrl = `https://waze.com/ul?ll=${firstStop.lat},${firstStop.lng}&navigate=yes`;

        navToolbar.innerHTML = `
          <span style="font-size:0.86rem; font-weight:700;">${orderedStops.length} paradas en ruta</span>
          <div class="driver-external-btns">
            <a href="${googleMapsMultiStopUrl}" target="_blank" rel="noopener noreferrer" class="btn-gmaps-official">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle fill="#ffffff" cx="12" cy="9" r="3"/>
              </svg>
              <span>Abrir Ruta en Google Maps</span>
            </a>
            <a href="${wazeCurrentStopUrl}" target="_blank" rel="noopener noreferrer" class="btn-gmaps-official">
              <span class="material-symbols-rounded" style="font-size:1.1rem; color:#38bdf8;">navigation</span>
              <span>Waze</span>
            </a>
          </div>
        `;
      }
    }

    if (!state.maps.driverMap) {
      const dMap = L.map('driverMapContainer').setView([hq.lat, hq.lng], 13);
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      }).addTo(dMap);
      state.maps.driverMap = dMap;
      state.maps.driverLayerGroup = L.layerGroup().addTo(dMap);
    }

    const lg = state.maps.driverLayerGroup;
    lg.clearLayers();

    L.marker([hq.lat, hq.lng], { icon: createHqPinIcon() })
      .addTo(lg)
      .bindPopup(`<strong>🥩 Sede Danillanos</strong>`);

    const polyPoints = [[hq.lat, hq.lng]];
    orderedStops.forEach((stop) => {
      polyPoints.push([stop.lat, stop.lng]);
      L.marker([stop.lat, stop.lng], { icon: createBrandRedPinIcon(stop.stopNumber) })
        .addTo(lg)
        .bindPopup(`<strong>Parada #${stop.stopNumber}: ${stop.nombre_recibe}</strong><br>${stop.direccion_entrega}`);
    });

    if (polyPoints.length > 1) {
      L.polyline(polyPoints, { color: '#e01a2c', weight: 4, dashArray: '8, 6' }).addTo(lg);
      state.maps.driverMap.fitBounds(polyPoints, { padding: [30, 30] });
    }
    setTimeout(() => state.maps.driverMap.invalidateSize(), 200);

    document.getElementById('entregadorOrdersContainer').innerHTML = orderedStops
      .map((ord, idx) => {
        const isCurrentActiveStop = idx === 0;
        const isOpen = state.driverExpandedOrderIds && state.driverExpandedOrderIds.has(ord.id);
        const draftPhoto = state.driverPhotosDraft[ord.id] || null;
        const singleGmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${ord.lat},${ord.lng}&travelmode=driving`;

        return `
          <div class="driver-vstop-item ${isCurrentActiveStop ? 'is-active-stop' : ''} ${isOpen ? 'is-open' : ''}">
            <div class="driver-vstop-rail">
              <span class="driver-vstop-dot"></span>
              <span class="driver-vstop-line"></span>
            </div>

            <article class="driver-vstop-card">
              <button
                type="button"
                class="driver-vstop-header"
                data-toggle-driver-stop="${ord.id}"
                aria-expanded="${isOpen ? 'true' : 'false'}"
              >
                <div>
                  <div class="driver-vstop-title">
                    ${hasDriverOrderNovelty(ord) ? '<span class="ticket-unread-dot" title="Nuevo pedido asignado a tu ruta" style="margin-right:6px;"></span>' : ''}Parada ${ord.stopNumber} • Pedido #${ord.id} (${getInvoiceCode(ord.id)}) — ${ord.nombre_recibe}
                  </div>
                  <div class="driver-vstop-sub">
                    ${ord.direccion_entrega} (${ord.municipio}) • ${ord.telefono_cliente}
                  </div>
                </div>
                <span class="driver-vstop-price">${formatCurrency(ord.total)}</span>
              </button>

              <div class="driver-vstop-body">
                ${
                  ord.observaciones_cliente
                    ? `<div style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.65rem;">
                         <strong>Nota:</strong> ${ord.observaciones_cliente}
                       </div>`
                    : ''
                }

                <div class="order-items-chips" style="margin-bottom:0.75rem;">
                  ${(ord.items || [])
                    .map((i) => `<span class="order-item-chip">${i.cantidad}x ${i.nombre_producto}</span>`)
                    .join('')}
                </div>

                <div class="driver-delivery-box">
                  <div class="photo-upload-controls">
                    <label class="file-label-btn">
                      <span class="material-symbols-rounded">photo_camera</span>
                      <span>Tomar Foto</span>
                      <input type="file" accept="image/*" capture="environment" class="hidden" data-driver-photo-input="${ord.id}" />
                    </label>
                    <button type="button" class="btn-secondary" data-driver-simulate-photo="${ord.id}">
                      <span class="material-symbols-rounded">add_a_photo</span>
                      <span>Foto Instantánea</span>
                    </button>
                    <a href="${singleGmapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary">
                      <span class="material-symbols-rounded">location_on</span>
                      <span>Maps</span>
                    </a>
                    <button type="button" class="btn-secondary" data-staff-view-invoice="${ord.id}">
                      <span class="material-symbols-rounded">receipt_long</span>
                      <span>Factura</span>
                    </button>
                  </div>
                  ${draftPhoto ? `<img src="${draftPhoto}" alt="Foto de entrega" class="delivery-photo-preview" />` : ''}
                  <input
                    type="text"
                    class="modal-input"
                    id="driverNoteInput_${ord.id}"
                    placeholder="Observación de entrega (opcional)..."
                    value="${ord.observaciones_entregador || ''}"
                  />
                </div>

                <div class="staff-order-actions" style="margin-top:0.75rem;">
                  <button type="button" class="btn-cancel-order" data-emp-cancel="${ord.id}">Cancelar</button>
                  <button type="button" class="btn-confirm-order ${draftPhoto ? '' : 'is-disabled-no-photo'}" data-driver-complete="${ord.id}" ${draftPhoto ? '' : 'disabled aria-disabled="true"'} title="${draftPhoto ? 'Confirmar entrega y finalizar parada' : 'Toma o adjunta una fotografía para habilitar la confirmación'}">
                    <span class="material-symbols-rounded">task_alt</span>
                    <span>Confirmar Entrega</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        `;
      })
      .join('');

    renderEntregadorHistorySection();
  }

  function renderEntregadorHistorySection() {
    const deliveredOrders = state.staffOrders.filter((o) => o.estado === 'entregado');
    const drvQuery = document.getElementById('driverHistorySearchInput')?.value || '';
    const drvZone = document.getElementById('driverHistoryZoneFilter')?.value || 'todas';
    const drvPay = document.getElementById('driverHistoryPayFilter')?.value || 'todos';

    const filteredDelivered = deliveredOrders.filter((ord) =>
      matchesOrderFilters(ord, { query: drvQuery, status: 'entregado', zone: drvZone, pay: drvPay })
    );

    const badge = document.getElementById('driverHistorySummaryBadge');
    if (badge) {
      const sumDelivered = filteredDelivered.reduce((acc, o) => acc + Number(o.total || 0), 0);
      badge.textContent = `${filteredDelivered.length} de ${deliveredOrders.length} entregas completadas • Total entregado: ${formatCurrency(sumDelivered)}`;
    }

    renderCollapsibleStaffOrdersList(
      filteredDelivered,
      'entregadorHistoryContainer',
      'No se encontraron pedidos entregados con los filtros seleccionados.'
    );
  }

  /**
   * Panel Soporte:
   * 1. Tickets de Clientes y MiniChat con Buscador y Filtro de Estado
   * 2. Historial y Buscador Filtrable de Pedidos, Facturas, Entregas y Reembolsos
   */
  function renderSoportePanel() {
    if ((!state.staffTickets || state.staffTickets.length === 0) && typeof getLocalTicketsStore === 'function') {
      state.staffTickets = getLocalTicketsStore();
    }
    const tkQuery = (document.getElementById('soporteTicketSearchInput')?.value || '').trim().toLowerCase();
    const tkStatus = document.getElementById('soporteTicketStatusFilter')?.value || 'todos';

    const filteredTickets = (state.staffTickets || []).filter((tk) => {
      if (tkStatus === 'activos' && tk.estado === 'resuelto') return false;
      if (tkStatus === 'resuelto' && tk.estado !== 'resuelto') return false;
      if (!tkQuery) return true;
      const msgsStr = (tk.mensajes || []).map((m) => `${m.autor} ${m.texto}`).join(' ').toLowerCase();
      return (
        String(tk.id).includes(tkQuery) ||
        String(tk.pedido_id || '').includes(tkQuery) ||
        (tk.asunto || '').toLowerCase().includes(tkQuery) ||
        msgsStr.includes(tkQuery)
      );
    });

    const tkBadge = document.getElementById('soporteTicketsSummaryBadge');
    if (tkBadge) {
      tkBadge.textContent = `Mostrando ${filteredTickets.length} de ${state.staffTickets.length} tickets`;
    }

    if (!state.expandedStaffTickets) state.expandedStaffTickets = new Set();

    document.getElementById('soporteTicketsContainer').innerHTML =
      filteredTickets.length === 0
        ? `<div class="detail-box"><p>No hay tickets que coincidan con el filtro seleccionado.</p></div>`
        : filteredTickets
            .map((tk) => {
              const isExpanded = state.expandedStaffTickets.has(Number(tk.id));
              const msgs = tk.mensajes || [];
              const hasUnread = hasTicketUnreadForStaff(tk);

              const draftPhoto = state.staffChatDrafts && state.staffChatDrafts[tk.id];
              return `
                <article class="ticket-minichat-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}" id="staffTicketCard_${tk.id}">
                  <div
                    class="ticket-minichat-header clickable-header"
                    data-toggle-staff-ticket="${tk.id}"
                    role="button"
                    tabindex="0"
                    title="Haz clic para ${isExpanded ? 'colapsar' : 'desplegar'} el ticket"
                  >
                    <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                      <button
                        type="button"
                        class="btn-ticket-expand"
                        data-toggle-staff-ticket="${tk.id}"
                        aria-label="${isExpanded ? 'Colapsar ticket' : 'Desplegar ticket'}"
                      >
                        <span class="material-symbols-rounded">${isExpanded ? 'expand_less' : 'expand_more'}</span>
                      </button>
                      ${hasUnread ? '<span class="ticket-unread-dot" title="Nuevo mensaje del cliente sin leer"></span>' : ''}
                      <strong>Ticket #${tk.id}: ${tk.asunto}</strong>
                      ${
                        tk.pedido_id
                          ? `<button type="button" class="invoice-number-badge-inline" data-staff-view-invoice="${tk.pedido_id}" title="Ver factura del Pedido #${tk.pedido_id}">
                               <span class="material-symbols-rounded" style="font-size:0.9rem;">receipt_long</span>
                               Pedido #${tk.pedido_id} • ${getInvoiceCode(tk.pedido_id)}
                             </button>`
                          : ''
                      }
                    </div>
                    <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                      <span class="order-status-pill ${getTicketStatusClass(tk.estado)}">${formatTicketStatus(tk.estado)}</span>
                    </div>
                  </div>

                  <div class="ticket-collapsible-body ${isExpanded ? '' : 'hidden'}" id="staffTicketBody_${tk.id}" style="margin-top:0.85rem;">
                    ${
                      tk.imagen_cliente_url
                        ? `<div class="detail-box" style="margin-bottom:0.75rem;">
                             <span class="detail-box-label">Fotografía de Solicitud Inicial</span>
                             <img src="${tk.imagen_cliente_url}" alt="Adjunto ticket #${tk.id}" class="delivery-photo-preview" style="margin-top:0.35rem; max-height:140px;" />
                           </div>`
                        : ''
                    }

                    <div class="minichat-messages-box">
                      ${msgs
                        .map(
                          (m) => `
                        <div class="minichat-bubble is-${m.rol === 'soporte' ? 'soporte' : 'cliente'}">
                          <div class="minichat-bubble-meta">${m.autor}</div>
                          ${m.texto ? `<div>${m.texto}</div>` : ''}
                          ${
                            m.imagen_url
                              ? `<div class="chat-bubble-attachment">
                                   <img src="${m.imagen_url}" alt="Foto adjunta" class="chat-bubble-image" onclick="window.open(this.src)" title="Ver imagen en tamaño completo" />
                                 </div>`
                              : ''
                          }
                        </div>
                      `
                        )
                        .join('')}
                    </div>

                    <div class="minichat-input-box-wrapper" style="margin-top:0.85rem;">
                      <div class="chat-draft-preview-strip ${draftPhoto ? '' : 'hidden'}" id="staffChatDraftStrip_${tk.id}">
                        <div class="chat-draft-preview-box">
                          <img src="${draftPhoto || ''}" id="staffChatDraftImg_${tk.id}" alt="Foto adjunta" />
                          <button type="button" class="chat-draft-remove-btn" data-remove-staff-draft="${tk.id}" title="Quitar imagen">
                            <span class="material-symbols-rounded">close</span>
                          </button>
                        </div>
                        <span class="chat-draft-hint">Fotografía adjunta para el cliente</span>
                      </div>

                      <div class="minichat-input-row">
                        <label class="chat-attach-btn" title="Adjuntar imagen o foto">
                          <span class="material-symbols-rounded">add_photo_alternate</span>
                          <input type="file" accept="image/*" class="hidden" data-staff-attach-input="${tk.id}" />
                        </label>
                        <input
                          type="text"
                          class="modal-input"
                          id="staffTicketChatInput_${tk.id}"
                          placeholder="Escribe una respuesta en el chat para el cliente..."
                        />
                        <button type="button" class="chat-send-btn" data-staff-send-chat="${tk.id}" title="Enviar mensaje">
                          <span class="material-symbols-rounded">send</span>
                        </button>
                        ${
                          tk.estado !== 'resuelto'
                            ? `<button type="button" class="btn-confirm-order" data-resolve-ticket="${tk.id}">
                                 <span class="material-symbols-rounded">check_circle</span>
                                 <span>Resolver</span>
                               </button>`
                            : ''
                        }
                      </div>
                    </div>
                  </div>
                </article>
              `;
            })
            .join('');

    // 2. Historial y Filtro de Pedidos, Facturas, Entregas y Reembolsos para Soporte
    const supOrdQuery = document.getElementById('soporteOrderSearchInput')?.value || '';
    const supOrdStatus = document.getElementById('soporteOrderStatusFilter')?.value || 'todos';
    const supOrdZone = document.getElementById('soporteOrderZoneFilter')?.value || 'todas';
    const supOrdPay = document.getElementById('soporteOrderPayFilter')?.value || 'todos';

    const filteredSupportOrders = state.staffOrders.filter((ord) =>
      matchesOrderFilters(ord, {
        query: supOrdQuery,
        status: supOrdStatus,
        zone: supOrdZone,
        pay: supOrdPay
      })
    );

    const supOrdBadge = document.getElementById('soporteOrdersSummaryBadge');
    if (supOrdBadge) {
      supOrdBadge.textContent = `Mostrando ${filteredSupportOrders.length} de ${state.staffOrders.length} pedidos y facturas`;
    }

    renderCollapsibleStaffOrdersList(
      filteredSupportOrders,
      'soporteFilteredOrdersContainer',
      'No hay pedidos ni facturas que coincidan con la búsqueda en Soporte.'
    );
  }

  // ==========================================================================
  // INICIALIZACIÓN SEGÚN LA PÁGINA ACTUAL
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initSharedHeaderAndTheme();
    refreshCurrentUserSession();

    if (CURRENT_PAGE === 'store') initStorePage();
    else if (CURRENT_PAGE === 'perfil') initPerfilPage();
    else if (CURRENT_PAGE === 'pagos') initPagosPage();
    else if (CURRENT_PAGE === 'panel') initPanelPage();
  });
})();


  // ==========================================================================
  // COMPONENTE DE DROPDOWNS PERSONALIZADOS FLUIDOS (NO NATIVOS)
  // ==========================================================================
  function enhanceCustomSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customized === 'true') {
      if (selectEl && typeof selectEl._syncCustomSelect === 'function') {
        selectEl._syncCustomSelect();
      }
      return;
    }

    if (!selectEl.parentNode) return;

    selectEl.dataset.customized = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    if (selectEl.id) wrapper.dataset.customSelectFor = selectEl.id;
    if (selectEl.classList.contains('driver-assign-select')) {
      wrapper.classList.add('custom-select-pill');
    }

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'custom-select-label';

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'material-symbols-rounded custom-select-arrow';
    arrowSpan.textContent = 'expand_more';

    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowSpan);
    wrapper.appendChild(trigger);

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'listbox');
    wrapper.appendChild(menu);

    function syncOptionsFromSelect() {
      menu.innerHTML = '';
      const opts = Array.from(selectEl.options || []);
      const selIdx = selectEl.selectedIndex >= 0 ? selectEl.selectedIndex : 0;
      const currentOpt = opts[selIdx] || opts[0];
      labelSpan.textContent = currentOpt ? currentOpt.text : (selectEl.getAttribute('placeholder') || 'Seleccionar...');

      opts.forEach((opt, idx) => {
        const item = document.createElement('div');
        item.className = 'custom-select-option';
        item.setAttribute('role', 'option');
        item.dataset.value = opt.value;
        if (idx === selIdx || opt.selected) {
          item.classList.add('is-selected');
          item.setAttribute('aria-selected', 'true');
        }

        const textSpan = document.createElement('span');
        textSpan.className = 'custom-select-option-text';
        textSpan.textContent = opt.text;
        item.appendChild(textSpan);

        const checkSpan = document.createElement('span');
        checkSpan.className = 'material-symbols-rounded custom-select-check';
        checkSpan.textContent = 'check';
        item.appendChild(checkSpan);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectEl.value = opt.value;
          selectEl.selectedIndex = idx;
          labelSpan.textContent = opt.text;
          menu.querySelectorAll('.custom-select-option').forEach((o) => o.classList.remove('is-selected'));
          item.classList.add('is-selected');
          closeDropdown();
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          selectEl.dispatchEvent(new Event('input', { bubbles: true }));
        });

        menu.appendChild(item);
      });

      if (selectEl.disabled) {
        trigger.disabled = true;
        wrapper.classList.add('is-disabled');
      } else {
        trigger.disabled = false;
        wrapper.classList.remove('is-disabled');
      }
    }

    selectEl._syncCustomSelect = syncOptionsFromSelect;

    function openDropdown() {
      document.querySelectorAll('.custom-select-wrapper.is-open').forEach((w) => {
        if (w !== wrapper) {
          w.classList.remove('is-open');
          const trig = w.querySelector('.custom-select-trigger');
          if (trig) trig.setAttribute('aria-expanded', 'false');
        }
      });
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }

    function closeDropdown() {
      wrapper.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (wrapper.classList.contains('is-open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    selectEl.addEventListener('change', () => {
      const currentOpt = selectEl.options[selectEl.selectedIndex];
      if (currentOpt) {
        labelSpan.textContent = currentOpt.text;
        menu.querySelectorAll('.custom-select-option').forEach((o) => {
          o.classList.toggle('is-selected', o.dataset.value === selectEl.value);
        });
      }
    });

    try {
      const observer = new MutationObserver(() => {
        syncOptionsFromSelect();
      });
      observer.observe(selectEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    } catch (_) {}

    syncOptionsFromSelect();
  }

  
  // Auto-Enhancement para selects generados dinámicamente
  try {
    const autoSelectObserver = new MutationObserver((mutations) => {
      let hasNewSelect = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) {
              if (n.tagName === 'SELECT' && n.dataset.customized !== 'true') {
                hasNewSelect = true;
                break;
              }
              if (n.querySelector && n.querySelector('select:not([data-customized="true"])')) {
                hasNewSelect = true;
                break;
              }
            }
          }
        }
        if (hasNewSelect) break;
      }
      if (hasNewSelect) {
        enhanceAllCustomSelects(document.body);
      }
    });
    autoSelectObserver.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  function enhanceAllCustomSelects(root = document) {
    if (!root) return;
    const selects = root.querySelectorAll('select:not([data-customized="true"])');
    selects.forEach((s) => enhanceCustomSelect(s));
    const customized = root.querySelectorAll('select[data-customized="true"]');
    customized.forEach((s) => {
      if (typeof s._syncCustomSelect === 'function') s._syncCustomSelect();
    });
  }

  // Cierre global de dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
      document.querySelectorAll('.custom-select-wrapper.is-open').forEach((w) => {
        w.classList.remove('is-open');
        const trig = w.querySelector('.custom-select-trigger');
        if (trig) trig.setAttribute('aria-expanded', 'false');
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.custom-select-wrapper.is-open').forEach((w) => {
        w.classList.remove('is-open');
        const trig = w.querySelector('.custom-select-trigger');
        if (trig) trig.setAttribute('aria-expanded', 'false');
      });
    }
  });


  // ==========================================================================
  // ENVIADO DE MENSAJES CON ENTER EN COMPUTADOR
  // ==========================================================================
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.target && e.target.id && e.target.id.startsWith('staffTicketChatInput_')) {
        e.preventDefault();
        const tkId = e.target.id.replace('staffTicketChatInput_', '');
        const btn = document.querySelector(`[data-staff-send-chat="${tkId}"]`);
        if (btn) btn.click();
      } else if (e.target && e.target.id && e.target.id.startsWith('custChatInput_')) {
        e.preventDefault();
        const tkId = e.target.id.replace('custChatInput_', '');
        const btn = document.querySelector(`[data-send-cust-chat="${tkId}"]`);
        if (btn) btn.click();
      }
    }
  });
