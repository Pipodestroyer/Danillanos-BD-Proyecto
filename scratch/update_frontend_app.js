const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'frontend', 'js', 'app.js');
let code = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

function replaceExact(oldStr, newStr, name) {
  oldStr = oldStr.replace(/\r\n/g, '\n');
  newStr = newStr.replace(/\r\n/g, '\n');
  if (!code.includes(oldStr)) {
    console.error(`❌ FAILED in app.js: ${name}`);
    process.exit(1);
  }
  code = code.replace(oldStr, newStr);
  console.log(`✅ App.js updated: ${name}`);
}

// 1. Añadir showDeveloperErrorAlert
const oldCloseAppDialog = `  function closeAppDialog() {
    const modal = document.getElementById('danillanosAppDialogModal');
    if (modal) modal.classList.add('hidden');
  }`;

const newShowDevError = `  function closeAppDialog() {
    const modal = document.getElementById('danillanosAppDialogModal');
    if (modal) modal.classList.add('hidden');
  }

  /**
   * Despliega un error crítico mediante alerta nativa emergente (window.alert) y una ventana modal
   * persistente con diagnóstico técnico detallado para el desarrollador.
   *
   * @param {Object} options
   * @param {string} [options.title='Error Crítico del Sistema'] - Título del error.
   * @param {string} [options.userMessage=''] - Instrucción para el usuario final.
   * @param {Object|string} [options.devDetails=null] - Diagnóstico técnico para el desarrollador.
   * @param {string} [options.action=''] - Acción u operación que detonó el error.
   */
  function showDeveloperErrorAlert({ title = 'Error Crítico del Sistema', userMessage = '', devDetails = null, action = '' } = {}) {
    const detailsStr = typeof devDetails === 'object' && devDetails !== null
      ? JSON.stringify(devDetails, null, 2)
      : String(devDetails || 'Sin detalles adicionales');

    const nativeMsg =
      \`🚨 AVISO DEL SISTEMA - ERROR TÉCNICO\\n\` +
      \`--------------------------------------------------\\n\` +
      \`Estimado usuario:\\n\` +
      \`\${userMessage || 'Ha ocurrido un problema de comunicación con la base de datos o el servidor.'}\\n\\n\` +
      \`👉 POR FAVOR MUESTRE ESTE MENSAJE AL DESARROLLADOR O ADMINISTRADOR.\\n\` +
      \`--------------------------------------------------\\n\` +
      \`INFORMACIÓN PARA EL DESARROLLADOR:\\n\` +
      \`• Operación: \${action || 'Operación no especificada'}\\n\` +
      \`• Código: \${typeof devDetails === 'object' && devDetails?.code ? devDetails.code : 'ERROR'}\\n\` +
      \`• Detalle: \${typeof devDetails === 'object' && devDetails?.message ? devDetails.message : detailsStr}\\n\` +
      (typeof devDetails === 'object' && devDetails?.hint ? \`• Sugerencia: \${devDetails.hint}\\n\` : '') +
      \`--------------------------------------------------\`;

    // 1. Pop-up nativo directo
    try {
      window.alert(nativeMsg);
    } catch (_) {}

    // 2. Modal persistente en DOM con opción de copiar diagnóstico
    let modal = document.getElementById('danillanosDeveloperErrorModal');
    if (!modal) {
      const wrap = document.createElement('div');
      wrap.innerHTML = \`
        <div id="danillanosDeveloperErrorModal" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <div style="background:#1e1e24;color:#f3f4f6;max-width:620px;width:100%;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);border:2px solid #ef4444;overflow:hidden;display:flex;flex-direction:column;max-height:90vh;">
            <div style="background:#7f1d1d;padding:1.2rem 1.5rem;display:flex;align-items:center;gap:0.75rem;">
              <span style="font-size:1.8rem;">🚨</span>
              <div style="flex:1;">
                <h3 id="devModalTitle" style="margin:0;font-size:1.15rem;font-weight:800;color:#fff;"></h3>
                <span style="font-size:0.8rem;color:#fecaca;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">Alerta Técnica del Sistema</span>
              </div>
              <button id="devModalCloseX" type="button" style="background:transparent;border:none;color:#fff;font-size:1.5rem;cursor:pointer;padding:0.2rem 0.5rem;border-radius:4px;">&times;</button>
            </div>
            <div style="padding:1.4rem 1.5rem;overflow-y:auto;flex:1;">
              <div style="background:#26262b;border-left:4px solid #ef4444;padding:0.9rem 1rem;border-radius:6px;margin-bottom:1.2rem;">
                <p style="margin:0;font-size:0.95rem;font-weight:700;color:#fca5a5;">Mensaje para el usuario:</p>
                <p id="devModalUserMessage" style="margin:0.4rem 0 0;font-size:0.9rem;line-height:1.45;color:#e5e7eb;"></p>
                <p style="margin:0.5rem 0 0;font-size:0.82rem;font-weight:600;color:#fbbf24;">⚠️ Por favor toma captura de pantalla de este diagnóstico y muéstraselo al desarrollador.</p>
              </div>
              <div>
                <p style="margin:0 0 0.4rem;font-size:0.85rem;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Diagnóstico técnico para el desarrollador:</p>
                <pre id="devModalDetails" style="background:#0d0d11;color:#38bdf8;padding:1rem;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:0.82rem;overflow-x:auto;max-height:220px;border:1px solid #374151;white-space:pre-wrap;word-break:break-word;margin:0;"></pre>
              </div>
            </div>
            <div style="padding:1rem 1.5rem;background:#18181b;border-top:1px solid #27272a;display:flex;gap:0.75rem;justify-content:flex-end;">
              <button id="devModalCopyBtn" type="button" style="background:#374151;color:#fff;border:none;padding:0.6rem 1.1rem;border-radius:8px;font-weight:600;font-size:0.88rem;cursor:pointer;">📋 Copiar Diagnóstico</button>
              <button id="devModalCloseBtn" type="button" style="background:#ef4444;color:#fff;border:none;padding:0.6rem 1.3rem;border-radius:8px;font-weight:700;font-size:0.88rem;cursor:pointer;">Entendido</button>
            </div>
          </div>
        </div>
      \`;
      modal = wrap.firstElementChild;
      document.body.appendChild(modal);

      modal.querySelector('#devModalCloseX')?.addEventListener('click', () => { modal.style.display = 'none'; });
      modal.querySelector('#devModalCloseBtn')?.addEventListener('click', () => { modal.style.display = 'none'; });
      modal.querySelector('#devModalCopyBtn')?.addEventListener('click', (e) => {
        const textToCopy = \`[DIAGNÓSTICO TÉCNICO DANILLANOS]\\nOperación: \${action}\\n\${detailsStr}\`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            e.target.textContent = '✅ ¡Copiado!';
            setTimeout(() => { e.target.textContent = '📋 Copiar Diagnóstico'; }, 2000);
          }).catch(() => {});
        }
      });
    }

    modal.querySelector('#devModalTitle').textContent = title;
    modal.querySelector('#devModalUserMessage').textContent = userMessage;
    modal.querySelector('#devModalDetails').textContent = detailsStr;
    modal.style.display = 'flex';
  }`;

replaceExact(oldCloseAppDialog, newShowDevError, 'add showDeveloperErrorAlert');

// 2. syncCatalogFromServer
const oldSyncCatalog = `  async function syncCatalogFromServer() {
    try {
      const apiBase = (CONFIG && CONFIG.api && CONFIG.api.baseUrl) || '/api';
      const res = await fetch(\`\${apiBase}/productos\`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.apiVersion >= 3) state.serverApiV3 = true;
        if (Array.isArray(data.data) && data.data.length > 0) {
          state.products = data.data.map((p) => evaluateClientProductDiscount(p));
          try {
            localStorage.removeItem('danillanos_catalog_discounts_v1');
          } catch (_) {}
          refreshAllCatalogViewsAndPills();
          return;
        }
      }
    } catch (_) {}`;

const newSyncCatalog = `  async function syncCatalogFromServer() {
    try {
      const apiBase = (CONFIG && CONFIG.api && CONFIG.api.baseUrl) || '/api';
      const res = await fetch(\`\${apiBase}/productos\`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.apiVersion >= 3) state.serverApiV3 = true;
        if (Array.isArray(data.data) && data.data.length > 0) {
          state.products = data.data.map((p) => evaluateClientProductDiscount(p));
          try {
            localStorage.removeItem('danillanos_catalog_discounts_v1');
          } catch (_) {}
          refreshAllCatalogViewsAndPills();
          return;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showDeveloperErrorAlert({
          title: 'Error al Cargar Catálogo desde la Base de Datos',
          userMessage: 'No se pudo sincronizar el catálogo de productos con el servidor MySQL.',
          devDetails: errData.devDetails || { status: res.status, error: errData.error || 'Respuesta HTTP no exitosa' },
          action: 'Carga de Productos (GET /api/productos)'
        });
      }
    } catch (err) {
      console.error('Error al conectar con el servidor:', err);
    }`;

replaceExact(oldSyncCatalog, newSyncCatalog, 'syncCatalogFromServer');

// 3. loginForm
const oldLoginForm = `    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAuthInlineFeedback('login', '');
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      // Comprobación de estado activo y actualización de rol operacional asignado por Administración
      const localUsers = getLocalUsersStore();
      const localMatch = localUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (localMatch && localMatch.activo === false) {
        showAuthInlineFeedback('login', 'Esta cuenta se encuentra desactivada por el Administrador.', 'error');
        return;
      }

      try {
        const res = await fetch(\`\${CONFIG.api.baseUrl}/auth/login\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showAuthInlineFeedback('login', data.message || 'Credenciales incorrectas.', 'error');
          return;
        }
        const finalUser = localMatch
          ? { ...data.user, rol: normalizeRole(localMatch.rol) }
          : { ...data.user, rol: normalizeRole(data.user.rol) };
        setSession(data.token, finalUser, data.direcciones);
        if (isStaffUser(finalUser)) {
          window.location.href = '/panel';
          return;
        }
        renderPerfilPageAuthState();
      } catch (err) {
        // Contingencia local autónoma en caso de interrupción en la conectividad del servidor
        if (localMatch) {
          const fallbackUser = {
            ...localMatch,
            rol: normalizeRole(localMatch.rol)
          };
          setSession(\`local_token_\${fallbackUser.id}_\${Date.now()}\`, fallbackUser, []);
          if (isStaffUser(fallbackUser)) {
            window.location.href = '/panel';
            return;
          }
          renderPerfilPageAuthState();
          return;
        }
        showAuthInlineFeedback('login', 'No se pudo iniciar sesión. Verifica tu conexión e inténtalo nuevamente.', 'error');
      }
    });`;

const newLoginForm = `    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAuthInlineFeedback('login', '');
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      try {
        const res = await fetch(\`\${CONFIG.api.baseUrl}/auth/login\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (data.devDetails || res.status === 503 || res.status >= 500) {
            showDeveloperErrorAlert({
              title: 'Error de Servidor / Base de Datos en Inicio de Sesión',
              userMessage: 'Ocurrió un error en el servidor o la base de datos MySQL al procesar tu inicio de sesión.',
              devDetails: data.devDetails || { status: res.status, error: data.error || data.message },
              action: 'Inicio de Sesión (POST /api/auth/login)'
            });
          }
          showAuthInlineFeedback('login', data.message || data.error || 'Credenciales incorrectas.', 'error');
          return;
        }
        setSession(data.token, data.user, data.direcciones);
        if (isStaffUser(data.user)) {
          window.location.href = '/panel';
          return;
        }
        renderPerfilPageAuthState();
      } catch (err) {
        showDeveloperErrorAlert({
          title: 'Error de Conectividad con el Servidor',
          userMessage: 'No se pudo conectar con el servidor backend de Danillanos.',
          devDetails: { message: err.message, endpoint: \`\${CONFIG.api.baseUrl}/auth/login\` },
          action: 'Inicio de Sesión (POST /api/auth/login)'
        });
        showAuthInlineFeedback('login', 'No se pudo conectar con el servidor. Muestra este error al desarrollador.', 'error');
      }
    });`;

replaceExact(oldLoginForm, newLoginForm, 'loginForm submit');

// 4. registerForm
const oldRegisterForm = `    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAuthInlineFeedback('register', '');
      const nombres = document.getElementById('regNombres')?.value.trim() || '';
      const apellidos = document.getElementById('regApellidos')?.value.trim() || '';
      const empresa = document.getElementById('regEmpresa')?.value.trim() || '';
      const tipo_documento = document.getElementById('regTipoDoc')?.value || 'CC';
      const numero_documento = document.getElementById('regNumDoc')?.value.trim() || '';
      const telefono = document.getElementById('regPhone')?.value.trim() || '';
      const email = document.getElementById('regEmail')?.value.trim() || '';
      const password = document.getElementById('regPassword')?.value || '';

      try {
        const res = await fetch(\`\${CONFIG.api.baseUrl}/auth/register\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombres,
            apellidos,
            empresa,
            tipo_documento,
            numero_documento,
            nombre_completo: \`\${nombres} \${apellidos}\`.trim(),
            username: empresa || \`\${nombres} \${apellidos}\`.trim(),
            email,
            telefono,
            password
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showAuthInlineFeedback('register', data.message || 'Error al registrar usuario', 'error');
          return;
        }
        const usersList = getLocalUsersStore();
        if (data.user && data.user.rol !== 'cliente' && !usersList.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          usersList.push({ ...data.user, activo: true });
          saveLocalUsersStore(usersList);
        }
        setSession(data.token, data.user, data.direcciones);
        renderPerfilPageAuthState();
      } catch (err) {
        showAuthInlineFeedback('register', 'Error al crear la cuenta. Por favor verifica los datos ingresados.', 'error');
      }
    });`;

const newRegisterForm = `    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAuthInlineFeedback('register', '');
      const nombres = document.getElementById('regNombres')?.value.trim() || '';
      const apellidos = document.getElementById('regApellidos')?.value.trim() || '';
      const empresa = document.getElementById('regEmpresa')?.value.trim() || '';
      const tipo_documento = document.getElementById('regTipoDoc')?.value || 'CC';
      const numero_documento = document.getElementById('regNumDoc')?.value.trim() || '';
      const telefono = document.getElementById('regPhone')?.value.trim() || '';
      const email = document.getElementById('regEmail')?.value.trim() || '';
      const password = document.getElementById('regPassword')?.value || '';

      try {
        const res = await fetch(\`\${CONFIG.api.baseUrl}/auth/register\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombres,
            apellidos,
            empresa,
            tipo_documento,
            numero_documento,
            nombre_completo: \`\${nombres} \${apellidos}\`.trim(),
            username: empresa || \`\${nombres} \${apellidos}\`.trim(),
            email,
            telefono,
            password
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (data.devDetails || res.status === 503 || res.status >= 500) {
            showDeveloperErrorAlert({
              title: 'Error de Servidor / Base de Datos al Registrar Usuario',
              userMessage: 'No fue posible registrar tu cuenta en la base de datos MySQL.',
              devDetails: data.devDetails || { status: res.status, error: data.error || data.message },
              action: 'Registro de Usuario (POST /api/auth/register)'
            });
          }
          showAuthInlineFeedback('register', data.message || data.error || 'Error al registrar usuario', 'error');
          return;
        }
        setSession(data.token, data.user, data.direcciones);
        renderPerfilPageAuthState();
      } catch (err) {
        showDeveloperErrorAlert({
          title: 'Error de Red / Servidor No Disponible al Registrarse',
          userMessage: 'No se pudo conectar con el servidor backend para registrar tu cuenta.',
          devDetails: { message: err.message, endpoint: \`\${CONFIG.api.baseUrl}/auth/register\` },
          action: 'Registro de Usuario (POST /api/auth/register)'
        });
        showAuthInlineFeedback('register', 'Error de conexión con el servidor. Muestra este error al desarrollador.', 'error');
      }
    });`;

replaceExact(oldRegisterForm, newRegisterForm, 'registerForm submit');

// 5. handleGoogleLoginSuccess
const oldGoogleLogin = `        const res = await fetch(\`\${CONFIG.api.baseUrl}/auth/google\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googlePayload)
        });
        const data = await res.json();
        if (data.ok) {
          const usersList = getLocalUsersStore();
          if (data.user && data.user.rol !== 'cliente' && !usersList.some((u) => u.email.toLowerCase() === data.user.email.toLowerCase())) {
            usersList.push({ ...data.user, activo: true });
            saveLocalUsersStore(usersList);
          }
          setSession(data.token, data.user, data.direcciones);
          renderPerfilPageAuthState();
        } else {
          showAuthInlineFeedback('login', data.message || 'Error al autenticar con Google', 'error');
        }
      } catch (err) {
        showAuthInlineFeedback('login', 'Error al conectar con el servidor para iniciar con Google.', 'error');
      }`;

const newGoogleLogin = `        const res = await fetch(\`\${CONFIG.api.baseUrl}/auth/google\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googlePayload)
        });
        const data = await res.json();
        if (data.ok) {
          setSession(data.token, data.user, data.direcciones);
          renderPerfilPageAuthState();
        } else {
          if (data.devDetails || res.status === 503 || res.status >= 500) {
            showDeveloperErrorAlert({
              title: 'Error de Base de Datos en Autenticación con Google',
              userMessage: 'No se pudo completar el inicio de sesión con Google por un problema en la base de datos.',
              devDetails: data.devDetails || { status: res.status, error: data.error || data.message },
              action: 'Autenticación Google OAuth (POST /api/auth/google)'
            });
          }
          showAuthInlineFeedback('login', data.message || data.error || 'Error al autenticar con Google', 'error');
        }
      } catch (err) {
        showDeveloperErrorAlert({
          title: 'Error de Servidor al Iniciar con Google',
          userMessage: 'No se pudo comunicar con el servidor para validar las credenciales de Google.',
          devDetails: { message: err.message, endpoint: \`\${CONFIG.api.baseUrl}/auth/google\` },
          action: 'Autenticación Google OAuth'
        });
        showAuthInlineFeedback('login', 'Error al conectar con el servidor para iniciar con Google.', 'error');
      }`;

replaceExact(oldGoogleLogin, newGoogleLogin, 'handleGoogleLoginSuccess');

// 6. Checkout POST /pedidos
const oldCheckoutOrder = `      const res = await fetch(\`\${CONFIG.api.baseUrl}/pedidos\`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        // Actualizar unidades vendidas en memoria/respaldo si algún ítem tenía descuento por unidades
        itemsSnapshot.forEach((it) => {
          const pIdx = state.products.findIndex((p) => Number(p.id) === Number(it.id));
          if (pIdx !== -1 && state.products[pIdx].descuento_activo && state.products[pIdx].descuento_tipo === 'unidades') {
            const pObj = { ...state.products[pIdx] };
            const newSold = (Number(pObj.descuento_unidades_vendidas) || 0) + (Number(it.cantidad) || 0);
            pObj.descuento_unidades_vendidas = newSold;
            if (pObj.descuento_unidades_limite && newSold >= Number(pObj.descuento_unidades_limite)) {
              pObj.descuento_porcentaje = 0;
              pObj.descuento_tipo = 'manual';
              saveLocalProductDiscountOverride(pObj.id, null);
            } else {
              saveLocalProductDiscountOverride(pObj.id, pObj);
            }
            state.products[pIdx] = evaluateClientProductDiscount(pObj);
          }
        });

        state.cart = [];
        saveAndRenderCart();
        syncCatalogFromServer();

        const finalInvoiceTotal =
          data.total !== undefined && data.total !== null ? Number(data.total) : totalSnapshot;
        renderVisualInvoiceCard(data, payload, itemsSnapshot, finalInvoiceTotal);
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
          if (barEl) barEl.style.width = \`\${Math.max(0, (secondsLeft / 10) * 100)}%\`;
          if (secondsLeft <= 0) {
            clearInterval(state.invoiceRedirectTimer);
            window.location.href = '/perfil#mis-pedidos-section';
          }
        }, 1000);
      }
    });`;

const newCheckoutOrder = `      try {
        const res = await fetch(\`\${CONFIG.api.baseUrl}/pedidos\`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          itemsSnapshot.forEach((it) => {
            const pIdx = state.products.findIndex((p) => Number(p.id) === Number(it.id));
            if (pIdx !== -1 && state.products[pIdx].descuento_activo && state.products[pIdx].descuento_tipo === 'unidades') {
              const pObj = { ...state.products[pIdx] };
              const newSold = (Number(pObj.descuento_unidades_vendidas) || 0) + (Number(it.cantidad) || 0);
              pObj.descuento_unidades_vendidas = newSold;
              if (pObj.descuento_unidades_limite && newSold >= Number(pObj.descuento_unidades_limite)) {
                pObj.descuento_porcentaje = 0;
                pObj.descuento_tipo = 'manual';
                saveLocalProductDiscountOverride(pObj.id, null);
              } else {
                saveLocalProductDiscountOverride(pObj.id, pObj);
              }
              state.products[pIdx] = evaluateClientProductDiscount(pObj);
            }
          });

          state.cart = [];
          saveAndRenderCart();
          syncCatalogFromServer();

          const finalInvoiceTotal =
            data.total !== undefined && data.total !== null ? Number(data.total) : totalSnapshot;
          renderVisualInvoiceCard(data, payload, itemsSnapshot, finalInvoiceTotal);
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
            if (barEl) barEl.style.width = \`\${Math.max(0, (secondsLeft / 10) * 100)}%\`;
            if (secondsLeft <= 0) {
              clearInterval(state.invoiceRedirectTimer);
              window.location.href = '/perfil#mis-pedidos-section';
            }
          }, 1000);
        } else {
          showDeveloperErrorAlert({
            title: 'Error de Servidor al Procesar Pedido',
            userMessage: 'No se pudo registrar la orden en la base de datos MySQL.',
            devDetails: data.devDetails || { status: res.status, error: data.error || data.message || 'Error en transacción' },
            action: 'Creación de Pedido (POST /api/pedidos)'
          });
        }
      } catch (err) {
        showDeveloperErrorAlert({
          title: 'Error de Conexión al Procesar Pedido',
          userMessage: 'No se pudo comunicar con el servidor para registrar la orden de compra.',
          devDetails: { message: err.message, endpoint: \`\${CONFIG.api.baseUrl}/pedidos\` },
          action: 'Creación de Pedido (POST /api/pedidos)'
        });
      }
    });`;

replaceExact(oldCheckoutOrder, newCheckoutOrder, 'checkout POST /pedidos');

fs.writeFileSync(filePath, code, 'utf8');
console.log('🎉 Archivo frontend/js/app.js actualizado exitosamente.');
