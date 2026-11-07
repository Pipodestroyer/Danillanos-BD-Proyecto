/**
 * @fileoverview Servicio centralizado de correos transaccionales con Resend y generación de facturas PDF.
 * Provee plantillas HTML alineadas con la identidad visual de Danillanos (#e01a2c, bordes redondeados,
 * sombras suaves) y generación de comprobantes PDF en memoria para:
 * 1. Código de verificación de 6 dígitos al crear cuenta (válido por 10 minutos).
 * 2. Enlace de recuperación de contraseña (válido por 10 minutos).
 * 3. Confirmación de pedido y factura adjunta en PDF con enlace directo al pedido en el perfil.
 * 4. Confirmación de pedido entregado con evidencia fotográfica incrustada.
 *
 * @module backend/utils/mailer
 */

const { Resend } = require('resend');
const PDFDocument = require('pdfkit');

const DEFAULT_BASE_URL = 'https://danillanos.icedlemontea.dev';
const DEFAULT_FROM_EMAIL = 'Danillanos <no-reply@danillanos.icedlemontea.dev>';
const FALLBACK_RESEND_FROM = 'Danillanos <onboarding@resend.dev>';

/**
 * Obtiene una instancia configurada del cliente Resend si existe `RESEND_API_KEY`.
 *
 * @function getResendClient
 * @returns {Resend|null}
 */
function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * Determina la URL base pública de la aplicación a partir de variables de entorno o de la petición HTTP.
 *
 * @function resolveAppBaseUrl
 * @param {import('express').Request} [req] - Petición Express opcional.
 * @returns {string} URL base sin barra diagonal final.
 */
function resolveAppBaseUrl(req) {
  const envUrl = (process.env.PUBLIC_URL || process.env.APP_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  if (req && typeof req.get === 'function') {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = req.get('host');
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }
  return DEFAULT_BASE_URL;
}

/**
 * Formatea valores numéricos como moneda pesos colombianos (COP).
 *
 * @function formatCop
 * @param {number|string} value
 * @returns {string}
 */
function formatCop(value) {
  const num = Math.round(Number(value) || 0);
  return `$ ${num.toLocaleString('es-CO')}`;
}

/**
 * Genera el código consecutivo de factura electrónica interna `FAC-DN-000XX`.
 *
 * @function getInvoiceCode
 * @param {number|string} orderId
 * @returns {string}
 */
function getInvoiceCode(orderId) {
  return `FAC-DN-${String(Number(orderId) || 1).padStart(5, '0')}`;
}

/**
 * Escapa caracteres HTML especiales para prevenir inyección en plantillas de correo.
 *
 * @function escapeHtml
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Construye la estructura HTML envolvente con el lenguaje de diseño de Danillanos
 * (encabezado corporativo, acento rojo #e01a2c, tarjetas redondeadas de 22px y sombras suaves).
 *
 * @function buildDanillanosEmailLayout
 * @param {object} params
 * @param {string} params.badgeText - Texto de la píldora superior.
 * @param {string} params.title - Título principal del correo.
 * @param {string} params.subtitle - Subtítulo o saludo introductorio.
 * @param {string} params.bodyHtml - Contenido central en HTML.
 * @param {string} [params.ctaText] - Texto del botón de acción principal.
 * @param {string} [params.ctaUrl] - Enlace del botón de acción principal.
 * @param {string} [params.footerNote] - Nota aclaratoria inferior.
 * @returns {string} Documento HTML completo listo para enviar.
 */
function buildDanillanosEmailLayout({
  badgeText,
  title,
  subtitle,
  bodyHtml,
  ctaText,
  ctaUrl,
  footerNote
}) {
  const ctaBlock =
    ctaText && ctaUrl
      ? `
        <div style="text-align: center; margin: 28px 0 10px;">
          <a href="${escapeHtml(ctaUrl)}"
             target="_blank"
             rel="noopener noreferrer"
             style="display: inline-block; background: linear-gradient(135deg, #e01a2c 0%, #b91222 100%); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 32px; border-radius: 999px; box-shadow: 0 10px 24px rgba(224, 26, 44, 0.28); letter-spacing: 0.01em;">
            ${escapeHtml(ctaText)}
          </a>
        </div>
      `
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} | Danillanos</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f8; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f5f8; padding: 32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);">
          <!-- Barra superior de acento rojo Danillanos -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #e01a2c 0%, #ff3b4e 50%, #b91222 100%);"></td>
          </tr>

          <!-- Cabecera de marca -->
          <tr>
            <td style="padding: 28px 32px 18px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <div style="font-size: 24px; font-weight: 900; letter-spacing: 0.08em; color: #0f172a; line-height: 1.1;">
                DANILLANOS<span style="color: #e01a2c;">.</span>
              </div>
              <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.22em; color: #64748b; margin-top: 4px;">
                DISTRIBUIMOS CALIDAD • VILLAVICENCIO Y META
              </div>
            </td>
          </tr>

          <!-- Cuerpo principal -->
          <tr>
            <td style="padding: 30px 32px 26px;">
              <div style="text-align: center; margin-bottom: 18px;">
                <span style="display: inline-block; background-color: rgba(224, 26, 44, 0.1); color: #e01a2c; border: 1px solid rgba(224, 26, 44, 0.24); font-size: 11px; font-weight: 800; letter-spacing: 0.1em; padding: 5px 14px; border-radius: 999px; text-transform: uppercase;">
                  ${escapeHtml(badgeText)}
                </span>
              </div>

              <h1 style="margin: 0 0 10px; font-size: 22px; font-weight: 800; color: #0f172a; text-align: center; line-height: 1.3;">
                ${escapeHtml(title)}
              </h1>

              <p style="margin: 0 0 22px; font-size: 14.5px; color: #475569; text-align: center; line-height: 1.6;">
                ${subtitle}
              </p>

              ${bodyHtml}

              ${ctaBlock}

              ${
                footerNote
                  ? `<p style="margin: 22px 0 0; font-size: 12.5px; color: #64748b; text-align: center; line-height: 1.55;">
                       ${footerNote}
                     </p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Pie institucional -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; font-weight: 700; color: #334155;">
                Danillanos Cárnicos, Congelados e Insumos S.A.S. • NIT 901.452.889-1
              </p>
              <p style="margin: 4px 0 0; font-size: 11.5px; color: #64748b;">
                Av. Los Maracos, Villavicencio — Meta, Colombia
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envía un correo a través de Resend con reintento automático en el remitente de pruebas
 * (`onboarding@resend.dev`) si el dominio personalizado aún no ha completado verificación DNS.
 *
 * @async
 * @function sendViaResend
 * @param {object} payload - Opciones de envío (`to`, `subject`, `html`, `attachments`).
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendViaResend(payload) {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[Mailer] RESEND_API_KEY no configurada en el entorno. Correo omitido:', payload.subject);
    return { sent: false, error: 'RESEND_API_KEY no configurada en el servidor.' };
  }

  const configuredFrom = (process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim();
  const recipient = Array.isArray(payload.to) ? payload.to : [String(payload.to).trim()];

  try {
    const { data, error } = await resend.emails.send({
      from: configuredFrom,
      to: recipient,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments || undefined
    });

    if (!error && data && data.id) {
      return { sent: true, id: data.id };
    }

    // Si falla por dominio aún no verificado en Resend, reintentar con onboarding@resend.dev
    if (error && configuredFrom !== FALLBACK_RESEND_FROM) {
      console.warn(`[Mailer] Reintentando con ${FALLBACK_RESEND_FROM} (${error.message || 'dominio no verificado'})`);
      const retry = await resend.emails.send({
        from: FALLBACK_RESEND_FROM,
        to: recipient,
        subject: payload.subject,
        html: payload.html,
        attachments: payload.attachments || undefined
      });
      if (!retry.error && retry.data && retry.data.id) {
        return { sent: true, id: retry.data.id };
      }
      console.error('[Mailer] Error al enviar correo con Resend:', retry.error);
      return { sent: false, error: retry.error?.message || error.message || 'No fue posible enviar el correo.' };
    }

    console.error('[Mailer] Error al enviar correo con Resend:', error);
    return { sent: false, error: error?.message || 'No fue posible enviar el correo.' };
  } catch (err) {
    console.error('[Mailer] Excepción al enviar correo con Resend:', err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * 1. Envía el código único de 6 dígitos para verificar la titularidad del correo al crear una cuenta.
 *
 * @async
 * @function sendRegistrationVerificationEmail
 * @param {object} params
 * @param {string} params.to - Correo electrónico del usuario.
 * @param {string} params.nombre - Nombre del usuario.
 * @param {string} params.codigo - Código único de 6 dígitos.
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendRegistrationVerificationEmail({ to, nombre, codigo }) {
  const digits = String(codigo || '').trim().split('');
  const digitsBoxesHtml = digits
    .map(
      (d) => `
        <span style="display: inline-block; width: 44px; height: 54px; line-height: 54px; margin: 0 4px; background-color: #fff1f2; border: 2px solid #e01a2c; border-radius: 14px; font-size: 24px; font-weight: 900; color: #e01a2c; text-align: center; box-shadow: 0 4px 12px rgba(224, 26, 44, 0.12);">
          ${escapeHtml(d)}
        </span>
      `
    )
    .join('');

  const bodyHtml = `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px 16px; text-align: center; margin: 12px 0 18px;">
      <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 14px;">
        Tu código de verificación de 6 dígitos
      </div>
      <div style="white-space: nowrap;">
        ${digitsBoxesHtml}
      </div>
      <div style="margin-top: 16px; font-size: 12.5px; font-weight: 700; color: #e01a2c;">
        ⏱ Válido únicamente durante los próximos 10 minutos
      </div>
    </div>
  `;

  const html = buildDanillanosEmailLayout({
    badgeText: 'Verificación de Seguridad',
    title: 'Confirma tu correo electrónico',
    subtitle: `Hola <strong>${escapeHtml(nombre || 'Cliente')}</strong>, ingresa el siguiente código de seguridad en la ventana de registro de Danillanos para activar tu cuenta.`,
    bodyHtml,
    footerNote:
      'Este código es de un solo uso y expirará en 10 minutos. Si no solicitaste crear una cuenta en Danillanos, puedes ignorar este mensaje de forma segura.'
  });

  return sendViaResend({
    to,
    subject: `${codigo} es tu código de verificación de Danillanos`,
    html
  });
}

/**
 * 2. Envía el correo con el enlace seguro para restablecer la contraseña (válido por 10 minutos).
 *
 * @async
 * @function sendPasswordResetEmail
 * @param {object} params
 * @param {string} params.to - Correo electrónico del usuario.
 * @param {string} params.nombre - Nombre del usuario.
 * @param {string} params.resetUrl - Enlace directo con token criptográfico.
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendPasswordResetEmail({ to, nombre, resetUrl }) {
  const bodyHtml = `
    <div style="background-color: #fff1f2; border: 1px solid rgba(224, 26, 44, 0.25); border-radius: 18px; padding: 18px 20px; text-align: center; margin-bottom: 8px;">
      <div style="font-size: 13.5px; color: #881337; font-weight: 700; line-height: 1.5;">
        Recibimos una solicitud para cambiar la contraseña de tu cuenta asociada a <strong>${escapeHtml(to)}</strong>.
      </div>
      <div style="font-size: 12px; color: #e01a2c; font-weight: 800; margin-top: 8px;">
        ⏱ Por seguridad, este enlace caduca exactamente en 10 minutos.
      </div>
    </div>
  `;

  const html = buildDanillanosEmailLayout({
    badgeText: 'Recuperación de Contraseña',
    title: 'Restablece tu contraseña en Danillanos',
    subtitle: `Hola <strong>${escapeHtml(nombre || 'Cliente')}</strong>, haz clic en el botón inferior para elegir una nueva contraseña segura.`,
    bodyHtml,
    ctaText: 'Restablecer mi Contraseña',
    ctaUrl: resetUrl,
    footerNote: `Si el botón no se abre automáticamente, copia y pega este enlace en tu navegador:<br/><a href="${escapeHtml(resetUrl)}" style="color: #e01a2c; word-break: break-all;">${escapeHtml(resetUrl)}</a>`
  });

  return sendViaResend({
    to,
    subject: 'Recuperación de contraseña — Danillanos',
    html
  });
}

/**
 * Genera en memoria un archivo PDF con el diseño oficial de la factura electrónica interna de Danillanos.
 *
 * @function generateInvoicePdfBuffer
 * @param {object} order - Objeto con los datos del pedido e ítems.
 * @returns {Promise<Buffer>} Buffer del archivo PDF generado.
 */
function generateInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 45 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const invCode = getInvoiceCode(order.id);
      const fechaStr = new Date(order.creado_en || Date.now()).toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      // Encabezado rojo corporativo
      doc.roundedRect(45, 40, 505, 78, 14).fill('#e01a2c');
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('DANILLANOS', 65, 56);
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor('#ffe4e6')
        .text('DISTRIBUIMOS CALIDAD • CÁRNICOS, CONGELADOS E INSUMOS S.A.S.', 65, 82)
        .text('NIT: 901.452.889-1 • Av. Los Maracos, Villavicencio - Meta', 65, 96);

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(invCode, 370, 58, { width: 160, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor('#ffe4e6')
        .text(`Pedido #${order.id}`, 370, 77, { width: 160, align: 'right' })
        .text(fechaStr, 370, 92, { width: 160, align: 'right' });

      // Bloque de información del cliente y entrega
      doc.roundedRect(45, 134, 505, 94, 12).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10.5).text('DATOS DE ENTREGA Y FACTURACIÓN', 62, 148);

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#475569').text('Destinatario:', 62, 168);
      doc.font('Helvetica').fillColor('#0f172a').text(String(order.nombre_recibe || 'Cliente Danillanos'), 135, 168);

      doc.font('Helvetica-Bold').fillColor('#475569').text('Teléfono:', 62, 185);
      doc.font('Helvetica').fillColor('#0f172a').text(String(order.telefono_cliente || 'N/A'), 135, 185);

      doc.font('Helvetica-Bold').fillColor('#475569').text('Dirección:', 62, 202);
      doc
        .font('Helvetica')
        .fillColor('#0f172a')
        .text(`${order.direccion_entrega || 'Villavicencio'} (${order.municipio || 'Villavicencio'})`, 135, 202, {
          width: 205
        });

      doc.font('Helvetica-Bold').fillColor('#475569').text('Método de Pago:', 350, 168);
      doc.font('Helvetica').fillColor('#0f172a').text(String(order.metodo_pago || 'Efectivo').toUpperCase(), 440, 168);

      doc.font('Helvetica-Bold').fillColor('#475569').text('Referencia:', 350, 185);
      doc.font('Helvetica').fillColor('#0f172a').text(String(order.referencia_pago || invCode), 440, 185);

      doc.font('Helvetica-Bold').fillColor('#475569').text('Llegada Estimada:', 350, 202);
      doc
        .font('Helvetica-Bold')
        .fillColor('#e01a2c')
        .text(String(order.tiempo_entrega_estimado || 'Mismo día'), 440, 202, { width: 100 });

      // Cabecera de tabla de productos
      let y = 248;
      doc.roundedRect(45, y, 505, 26, 8).fill('#0f172a');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9.5);
      doc.text('CANT.', 58, y + 8, { width: 45 });
      doc.text('DESCRIPCIÓN DEL PRODUCTO', 110, y + 8, { width: 235 });
      doc.text('V. UNITARIO', 350, y + 8, { width: 85, align: 'right' });
      doc.text('SUBTOTAL', 445, y + 8, { width: 90, align: 'right' });

      y += 34;
      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((item, idx) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        const qty = Number(item.cantidad) || 1;
        const unit = Number(item.precio_unitario ?? item.precio ?? 0);
        const sub = Number(item.subtotal ?? unit * qty);
        const name = String(item.nombre_producto || item.nombre || 'Producto Danillanos');

        if (idx % 2 === 1) {
          doc.roundedRect(45, y - 4, 505, 24, 5).fill('#f8fafc');
        }
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9.5).text(`${qty}x`, 58, y + 2, { width: 45 });
        doc.font('Helvetica').fillColor('#1e293b').text(name, 110, y + 2, { width: 235 });
        doc.fillColor('#475569').text(formatCop(unit), 350, y + 2, { width: 85, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatCop(sub), 445, y + 2, { width: 90, align: 'right' });
        y += 24;
      });

      // Línea divisoria y caja de Total
      y += 12;
      doc.moveTo(45, y).lineTo(550, y).strokeColor('#e2e8f0').stroke();
      y += 14;

      doc.roundedRect(320, y, 230, 42, 10).fill('#fff1f2');
      doc
        .fillColor('#881337')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('TOTAL FACTURA:', 335, y + 14);
      doc
        .fillColor('#e01a2c')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(formatCop(order.total), 430, y + 12, { width: 105, align: 'right' });

      y += 66;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text(
          'Gracias por tu compra en Danillanos. Conservamos estricta cadena de frío desde nuestra planta en Av. Los Maracos hasta la puerta de tu negocio u hogar.',
          45,
          y,
          { width: 505, align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 3. Envía el correo de confirmación de pedido y factura electrónica adjunta en PDF,
 * detallando qué productos pidió, cuándo le llegan y un botón con enlace directo al pedido en su perfil.
 *
 * @async
 * @function sendOrderConfirmationEmail
 * @param {object} params
 * @param {string} params.to - Correo del cliente.
 * @param {object} params.order - Datos del pedido (`id`, `total`, `tiempo_entrega_estimado`, `direccion_entrega`, `municipio`, `metodo_pago`, `items`, etc.).
 * @param {string} [params.baseUrl] - URL base de la plataforma.
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendOrderConfirmationEmail({ to, order, baseUrl = DEFAULT_BASE_URL }) {
  const invCode = getInvoiceCode(order.id);
  const directOrderUrl = `${baseUrl.replace(/\/+$/, '')}/perfil?pedido=${encodeURIComponent(order.id)}#mis-pedidos-section`;
  const items = Array.isArray(order.items) ? order.items : [];

  const itemsRowsHtml = items
    .map((item) => {
      const qty = Number(item.cantidad) || 1;
      const unit = Number(item.precio_unitario ?? item.precio ?? 0);
      const sub = Number(item.subtotal ?? unit * qty);
      const prodName = item.nombre_producto || item.nombre || 'Producto Danillanos';
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; font-weight: 800; color: #e01a2c; width: 42px;">
            ${qty}x
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; font-weight: 600; color: #1e293b;">
            ${escapeHtml(prodName)}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; font-weight: 800; color: #0f172a; text-align: right; white-space: nowrap;">
            ${escapeHtml(formatCop(sub))}
          </td>
        </tr>
      `;
    })
    .join('');

  const bodyHtml = `
    <!-- Tarjeta destacada de llegada estimada y factura -->
    <div style="background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border: 1px solid rgba(224, 26, 44, 0.25); border-radius: 18px; padding: 18px 20px; margin-bottom: 20px;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #e01a2c;">
        🚚 Tiempo estimado de llegada
      </div>
      <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px;">
        ${escapeHtml(order.tiempo_entrega_estimado || 'Entrega programada el mismo día')}
      </div>
      <div style="font-size: 13px; color: #475569; margin-top: 6px;">
        <strong>Dirección:</strong> ${escapeHtml(order.direccion_entrega || '')} (${escapeHtml(order.municipio || 'Villavicencio')})<br/>
        <strong>Recibe:</strong> ${escapeHtml(order.nombre_recibe || 'Cliente')} • <strong>Factura:</strong> ${escapeHtml(invCode)}
      </div>
    </div>

    <!-- Tabla de productos solicitados -->
    <div style="border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; margin-bottom: 18px;">
      <div style="background-color: #0f172a; color: #ffffff; padding: 11px 16px; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;">
        Resumen de Productos Solicitados
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff;">
        ${itemsRowsHtml}
        <tr>
          <td colspan="2" style="padding: 14px 12px; font-size: 14px; font-weight: 800; color: #0f172a; text-align: right;">
            Total Pagado / Facturado (${escapeHtml(String(order.metodo_pago || 'efectivo').toUpperCase())}):
          </td>
          <td style="padding: 14px 12px; font-size: 16px; font-weight: 900; color: #e01a2c; text-align: right; white-space: nowrap;">
            ${escapeHtml(formatCop(order.total))}
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 12px 16px; text-align: center; font-size: 12.5px; color: #334155;">
      📎 <strong>Factura PDF adjunta:</strong> Hemos adjuntado tu factura oficial <strong>${escapeHtml(invCode)}.pdf</strong> a este correo para tu contabilidad.
    </div>
  `;

  const html = buildDanillanosEmailLayout({
    badgeText: `Pedido #${order.id} Confirmado • ${invCode}`,
    title: '¡Hemos recibido tu pedido!',
    subtitle: `Hola <strong>${escapeHtml(order.nombre_recibe || 'Cliente')}</strong>, tu pedido ya está en manos de nuestro equipo y adjuntamos tu factura en formato PDF.`,
    bodyHtml,
    ctaText: `Ver Pedido #${order.id} en Tiempo Real`,
    ctaUrl: directOrderUrl,
    footerNote:
      'Al pulsar el botón se abrirá tu perfil directamente en la pestaña de Pedidos en Curso con el detalle de tu orden desplegado.'
  });

  let attachments = [];
  try {
    const pdfBuffer = await generateInvoicePdfBuffer(order);
    attachments = [
      {
        filename: `Factura-${invCode}.pdf`,
        content: pdfBuffer
      }
    ];
  } catch (pdfErr) {
    console.error('[Mailer] Error generando PDF de factura:', pdfErr.message);
  }

  return sendViaResend({
    to,
    subject: `Confirmación de Pedido #${order.id} y Factura ${invCode} — Danillanos`,
    html,
    attachments
  });
}

/**
 * 4. Envía el correo de notificación cuando el pedido ha sido entregado junto con la fotografía de evidencia.
 *
 * @async
 * @function sendOrderDeliveredEmail
 * @param {object} params
 * @param {string} params.to - Correo del cliente.
 * @param {object} params.order - Datos del pedido entregado (`id`, `nombre_recibe`, `direccion_entrega`, `total`, `foto_entrega_url`, `observaciones_entregador`).
 * @param {string} [params.baseUrl] - URL base de la plataforma.
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendOrderDeliveredEmail({ to, order, baseUrl = DEFAULT_BASE_URL }) {
  const invCode = getInvoiceCode(order.id);
  const directHistoryUrl = `${baseUrl.replace(/\/+$/, '')}/perfil?pedido=${encodeURIComponent(order.id)}#historial-compras-section`;
  const rawPhoto = String(order.foto_entrega_url || '').trim();

  let photoImgSrc = '';
  const attachments = [];

  if (rawPhoto.startsWith('data:image/')) {
    const match = rawPhoto.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      attachments.push({
        filename: `evidencia-entrega-pedido-${order.id}.${ext}`,
        content: Buffer.from(base64Data, 'base64'),
        contentType: mimeType,
        contentId: 'evidencia-entrega-danillanos'
      });
      photoImgSrc = 'cid:evidencia-entrega-danillanos';
    }
  } else if (/^https?:\/\//i.test(rawPhoto)) {
    photoImgSrc = rawPhoto;
  }

  const photoSectionHtml = photoImgSrc
    ? `
      <div style="margin: 18px 0; text-align: center;">
        <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px;">
          📸 Registro Fotográfico de tu Entrega
        </div>
        <div style="border-radius: 20px; overflow: hidden; border: 2px solid rgba(224, 26, 44, 0.25); box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1); display: inline-block; max-width: 100%;">
          <img src="${escapeHtml(photoImgSrc)}" alt="Evidencia de entrega Pedido #${escapeHtml(order.id)}" style="display: block; width: 100%; max-width: 460px; height: auto; object-fit: cover;" />
        </div>
      </div>
    `
    : '';

  const bodyHtml = `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px 20px; margin-bottom: 16px;">
      <div style="font-size: 13.5px; color: #1e293b; line-height: 1.65;">
        <strong>Pedido:</strong> #${escapeHtml(order.id)} (${escapeHtml(invCode)})<br/>
        <strong>Recibido en:</strong> ${escapeHtml(order.direccion_entrega || 'Dirección registrada')} (${escapeHtml(order.municipio || 'Villavicencio')})<br/>
        <strong>Total:</strong> <span style="color: #e01a2c; font-weight: 800;">${escapeHtml(formatCop(order.total))}</span>
        ${
          order.observaciones_entregador
            ? `<br/><strong>Nota del entregador:</strong> ${escapeHtml(order.observaciones_entregador)}`
            : ''
        }
      </div>
    </div>
    ${photoSectionHtml}
  `;

  const html = buildDanillanosEmailLayout({
    badgeText: `Pedido #${order.id} Entregado`,
    title: '¡Tu pedido fue entregado con éxito!',
    subtitle: `Hola <strong>${escapeHtml(order.nombre_recibe || 'Cliente')}</strong>, nuestro repartidor ha finalizado la entrega de tu pedido. Aquí tienes el comprobante fotográfico.`,
    bodyHtml,
    ctaText: 'Ver Pedido en mi Historial',
    ctaUrl: directHistoryUrl,
    footerNote:
      'Gracias por confiar en Danillanos. Si tienes alguna inquietud sobre tu entrega, puedes abrir un ticket de soporte desde tu perfil.'
  });

  return sendViaResend({
    to,
    subject: `¡Tu pedido #${order.id} fue entregado! — Danillanos`,
    html,
    attachments: attachments.length > 0 ? attachments : undefined
  });
}

module.exports = {
  resolveAppBaseUrl,
  generateInvoicePdfBuffer,
  sendRegistrationVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendOrderDeliveredEmail
};
