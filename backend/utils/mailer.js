/**
 * @fileoverview Servicio centralizado de correos transaccionales con Resend y generación de facturas PDF.
 * Diseño limpio, plano, blanco y amigable consistente con la interfaz de Danillanos.
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
  return `$${num.toLocaleString('es-CO')}`;
}

/**
 * Escapa caracteres especiales HTML para prevenir inyección en plantillas de correo.
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
 * Genera en memoria un archivo PDF limpio y minimalista con la factura electrónica del pedido.
 *
 * @function generateInvoicePdfBuffer
 * @param {object} order - Datos completos del pedido e ítems.
 * @returns {Promise<Buffer>} Buffer con el documento PDF generado.
 */
function generateInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: {
          Title: `Factura Danillanos #${order.id}`,
          Author: 'Danillanos Cárnicos, Congelados e Insumos'
        }
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const invoiceCode = `FAC-DN-${String(order.id).padStart(5, '0')}`;
      const fechaStr = new Date(order.creado_en || Date.now()).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      // Encabezado limpio sobre fondo blanco
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('DANILLANOS', 48, 48, { continued: true })
        .fillColor('#e01a2c')
        .text('.', { continued: false });

      doc
        .fillColor('#6b7280')
        .font('Helvetica')
        .fontSize(9)
        .text('DISTRIBUIMOS CALIDAD • NIT 900.842.190-4', 48, 72)
        .text('Vía Corredor Ecológico • Villavicencio, Meta', 48, 85);

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(`Factura ${invoiceCode}`, 340, 48, { width: 207, align: 'right' });

      doc
        .fillColor('#6b7280')
        .font('Helvetica')
        .fontSize(9)
        .text(`Pedido #${order.id}`, 340, 66, { width: 207, align: 'right' })
        .text(fechaStr, 340, 80, { width: 207, align: 'right' });

      // Línea divisoria sutil
      doc
        .moveTo(48, 110)
        .lineTo(547, 110)
        .lineWidth(1)
        .strokeColor('#e5e7eb')
        .stroke();

      // Bloque de información del cliente y entrega
      const infoTop = 126;
      doc.roundedRect(48, infoTop, 499, 78, 10).fillAndStroke('#f8fafc', '#e5e7eb');

      doc
        .fillColor('#6b7280')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('CLIENTE / DESTINATARIO', 64, infoTop + 14)
        .text('DETALLES DE ENTREGA Y PAGO', 310, infoTop + 14);

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(String(order.nombre_recibe || 'Cliente Danillanos'), 64, infoTop + 28, { width: 225 });

      doc
        .fillColor('#4b5563')
        .font('Helvetica')
        .fontSize(9)
        .text(`Tel: ${order.telefono_cliente || 'N/A'}`, 64, infoTop + 44)
        .text(`${order.direccion_entrega || ''} (${order.municipio || 'Villavicencio'})`, 64, infoTop + 58, {
          width: 230
        });

      const metodoLabel = String(order.metodo_pago || 'bancolombia').toUpperCase();
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(`${order.tiempo_entrega_estimado || 'Envío programado'}`, 310, infoTop + 28, { width: 220 });

      doc
        .fillColor('#4b5563')
        .font('Helvetica')
        .fontSize(9)
        .text(`Método de pago: ${metodoLabel}`, 310, infoTop + 44)
        .text(`Referencia: ${order.referencia_pago || 'N/A'}`, 310, infoTop + 58);

      // Tabla de productos
      let y = infoTop + 98;
      doc.roundedRect(48, y, 499, 26, 6).fill('#f1f5f9');
      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text('PRODUCTO', 62, y + 8)
        .text('CANT.', 330, y + 8, { width: 45, align: 'center' })
        .text('PRECIO UNIT.', 385, y + 8, { width: 70, align: 'right' })
        .text('SUBTOTAL', 465, y + 8, { width: 70, align: 'right' });

      y += 32;
      const items = Array.isArray(order.items) ? order.items : [];

      items.forEach((item) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        const nombreProd = String(item.nombre_producto || item.nombre || 'Producto Danillanos');
        const cant = Number(item.cantidad) || 1;
        const unit = Number(item.precio_unitario ?? item.precio) || 0;
        const sub = Number(item.subtotal) || unit * cant;

        doc
          .fillColor('#111827')
          .font('Helvetica')
          .fontSize(9.5)
          .text(nombreProd, 62, y + 4, { width: 260 })
          .text(String(cant), 330, y + 4, { width: 45, align: 'center' })
          .fillColor('#4b5563')
          .text(formatCop(unit), 385, y + 4, { width: 70, align: 'right' })
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .text(formatCop(sub), 465, y + 4, { width: 70, align: 'right' });

        y += 24;
        doc
          .moveTo(48, y)
          .lineTo(547, y)
          .lineWidth(0.5)
          .strokeColor('#f1f5f9')
          .stroke();
        y += 4;
      });

      // Caja de Total
      y += 12;
      doc.roundedRect(335, y, 212, 38, 8).fillAndStroke('#f8fafc', '#e5e7eb');
      doc
        .fillColor('#4b5563')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('TOTAL', 350, y + 13)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(formatCop(order.total), 410, y + 11, { width: 125, align: 'right' });

      // Pie de página
      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          'Gracias por tu compra en Danillanos. Conserva este comprobante para cualquier consulta.',
          48,
          760,
          { width: 499, align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Construye la estructura HTML base de todos los correos de Danillanos:
 * Diseño limpio, plano, blanco y directo, consistente con la interfaz del sitio web.
 *
 * @function buildDanillanosEmailLayout
 * @param {object} options
 * @param {string} options.title - Título principal del correo.
 * @param {string} options.subtitle - Subtítulo o saludo directo.
 * @param {string} options.bodyHtml - Contenido central del correo.
 * @param {string} [options.ctaText] - Texto del botón de acción principal.
 * @param {string} [options.ctaUrl] - Enlace del botón de acción principal.
 * @param {string} [options.footerNote] - Nota aclaratoria inferior.
 * @returns {string} Documento HTML completo listo para envío.
 */
function buildDanillanosEmailLayout({ title, subtitle, bodyHtml, ctaText, ctaUrl, footerNote }) {
  const ctaBlock =
    ctaText && ctaUrl
      ? `
        <div style="text-align: center; margin: 24px 0 8px;">
          <a href="${escapeHtml(ctaUrl)}"
             target="_blank"
             style="display: inline-block; background-color: #e01a2c; color: #ffffff; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 28px; border-radius: 999px;">
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
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e5e7eb;">
          
          <!-- Encabezado limpio y plano idéntico a la barra superior de la página -->
          <tr>
            <td style="padding: 24px 32px 18px; border-bottom: 1px solid #f1f5f9; text-align: left;">
              <div style="font-size: 19px; font-weight: 900; letter-spacing: 0.04em; color: #111827;">
                DANILLANOS<span style="color: #e01a2c;">.</span>
              </div>
              <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.12em; color: #9ca3af; text-transform: uppercase; margin-top: 2px;">
                Distribuimos Calidad
              </div>
            </td>
          </tr>

          <!-- Cuerpo principal -->
          <tr>
            <td style="padding: 28px 32px 24px;">
              <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #111827; line-height: 1.3;">
                ${escapeHtml(title)}
              </h1>
              <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280; line-height: 1.55;">
                ${escapeHtml(subtitle)}
              </p>

              ${bodyHtml}

              ${ctaBlock}

              ${
                footerNote
                  ? `<p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af; line-height: 1.5; text-align: center;">
                       ${escapeHtml(footerNote)}
                     </p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Pie de página limpio -->
          <tr>
            <td style="background-color: #fafafa; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 11.5px; color: #9ca3af;">
                Danillanos S.A.S. • Vía Corredor Ecológico, Villavicencio — Meta
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
      return { sent: false, error: retry.error?.message || error.message || 'Error al enviar correo con Resend.' };
    }

    return { sent: false, error: error?.message || 'No se pudo enviar el correo.' };
  } catch (err) {
    console.error('[Mailer] Excepción al enviar correo con Resend:', err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * 1. Envía el código de verificación de 6 dígitos (válido por 10 minutos) al crear una cuenta.
 *
 * @async
 * @function sendRegistrationVerificationEmail
 * @param {object} params
 * @param {string} params.to - Correo del usuario.
 * @param {string} params.nombre - Nombre del usuario.
 * @param {string} params.codigo - Código único de 6 dígitos.
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendRegistrationVerificationEmail({ to, nombre, codigo }) {
  const bodyHtml = `
    <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; text-align: center; margin: 8px 0 16px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 8px;">
        Código de verificación
      </div>
      <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #111827; font-family: 'Inter', monospace;">
        ${escapeHtml(codigo)}
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
        Válido por 10 minutos
      </div>
    </div>
  `;

  const html = buildDanillanosEmailLayout({
    title: 'Verifica tu correo electrónico',
    subtitle: `Hola ${nombre || 'Cliente'}, ingresa este código de 6 dígitos en la página para completar la creación de tu cuenta.`,
    bodyHtml,
    footerNote: 'Si no solicitaste crear una cuenta en Danillanos, puedes ignorar este mensaje.'
  });

  return sendViaResend({
    to,
    subject: `${codigo} es tu código de verificación de Danillanos`,
    html
  });
}

/**
 * 2. Envía el enlace para restablecer la contraseña (válido por máximo 10 minutos).
 *
 * @async
 * @function sendPasswordResetEmail
 * @param {object} params
 * @param {string} params.to - Correo del usuario.
 * @param {string} params.nombre - Nombre del usuario.
 * @param {string} params.resetUrl - URL directa con el token de recuperación.
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendPasswordResetEmail({ to, nombre, resetUrl }) {
  const bodyHtml = `
    <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px 18px; margin-bottom: 8px;">
      <p style="margin: 0; font-size: 13.5px; color: #4b5563; line-height: 1.55;">
        Haz clic en el botón de abajo para elegir una nueva contraseña. Por seguridad, este enlace es válido únicamente por <strong>10 minutos</strong>.
      </p>
    </div>
  `;

  const html = buildDanillanosEmailLayout({
    title: 'Restablecer tu contraseña',
    subtitle: `Hola ${nombre || 'Cliente'}, recibimos una solicitud para cambiar la contraseña de tu cuenta en Danillanos.`,
    bodyHtml,
    ctaText: 'Cambiar mi contraseña',
    ctaUrl: resetUrl,
    footerNote: 'Si no solicitaste este cambio, tu contraseña actual seguirá siendo la misma.'
  });

  return sendViaResend({
    to,
    subject: 'Restablecer tu contraseña — Danillanos',
    html
  });
}

/**
 * 3. Envía confirmación de pedido con resumen de productos, fecha estimada de llegada,
 *    factura PDF adjunta y botón directo que abre el pedido en la página de perfil.
 *
 * @async
 * @function sendOrderConfirmationEmail
 * @param {object} params
 * @param {string} params.to - Correo del cliente.
 * @param {object} params.order - Objeto con los datos del pedido e ítems.
 * @param {string} params.baseUrl - URL base pública de la tienda.
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendOrderConfirmationEmail({ to, order, baseUrl }) {
  const cleanBase = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const deepLinkUrl = `${cleanBase}/perfil?pedido=${encodeURIComponent(order.id)}#mis-pedidos-section`;
  const invoiceCode = `FAC-DN-${String(order.id).padStart(5, '0')}`;
  const items = Array.isArray(order.items) ? order.items : [];

  const itemsRowsHtml = items
    .map((it) => {
      const nombre = escapeHtml(it.nombre_producto || it.nombre || 'Producto');
      const cant = Number(it.cantidad) || 1;
      const sub = Number(it.subtotal) || (Number(it.precio_unitario ?? it.precio) || 0) * cant;
      return `
        <tr>
          <td style="padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #111827;">
            ${nombre}
          </td>
          <td style="padding: 9px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #6b7280; text-align: center;">
            x${cant}
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #111827; font-weight: 700; text-align: right;">
            ${formatCop(sub)}
          </td>
        </tr>
      `;
    })
    .join('');

  const bodyHtml = `
    <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px 18px; margin-bottom: 16px;">
      <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
        Tiempo estimado de entrega
      </div>
      <div style="font-size: 15px; font-weight: 800; color: #111827; margin-bottom: 8px;">
        ${escapeHtml(order.tiempo_entrega_estimado || 'Envío programado')}
      </div>
      <div style="font-size: 13px; color: #4b5563;">
        <strong>Dirección:</strong> ${escapeHtml(order.direccion_entrega || '')} (${escapeHtml(order.municipio || 'Villavicencio')})
      </div>
    </div>

    <div style="border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; margin-bottom: 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: #6b7280; text-align: left; text-transform: uppercase;">Producto</th>
            <th style="padding: 9px 8px; font-size: 11px; font-weight: 700; color: #6b7280; text-align: center; text-transform: uppercase;">Cant.</th>
            <th style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: #6b7280; text-align: right; text-transform: uppercase;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8fafc;">
            <td colspan="2" style="padding: 11px 12px; font-size: 13px; font-weight: 700; color: #4b5563;">
              Total (${escapeHtml(invoiceCode)})
            </td>
            <td style="padding: 11px 12px; font-size: 15px; font-weight: 800; color: #111827; text-align: right;">
              ${formatCop(order.total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  let pdfBuffer = null;
  try {
    pdfBuffer = await generateInvoicePdfBuffer(order);
  } catch (pdfErr) {
    console.error('[Mailer] Error al generar PDF de factura:', pdfErr.message);
  }

  const attachments = pdfBuffer
    ? [
        {
          filename: `Factura-${invoiceCode}.pdf`,
          content: pdfBuffer
        }
      ]
    : undefined;

  const html = buildDanillanosEmailLayout({
    title: `Pedido #${order.id} confirmado`,
    subtitle: `Hola ${order.nombre_recibe || 'Cliente'}, recibimos tu pedido y adjuntamos tu factura en PDF (${invoiceCode}).`,
    bodyHtml,
    ctaText: 'Ver seguimiento de mi pedido',
    ctaUrl: deepLinkUrl,
    footerNote: 'El botón abrirá tu perfil directamente en la pestaña de este pedido.'
  });

  return sendViaResend({
    to,
    subject: `Pedido #${order.id} confirmado — Factura ${invoiceCode}`,
    html,
    attachments
  });
}

/**
 * 4. Envía correo notificando que el pedido fue entregado junto con la foto de evidencia de entrega.
 *
 * @async
 * @function sendOrderDeliveredEmail
 * @param {object} params
 * @param {string} params.to - Correo del cliente.
 * @param {object} params.order - Datos del pedido incluyendo `foto_entrega_url`.
 * @param {string} params.baseUrl - URL base pública de la tienda.
 * @returns {Promise<{sent: boolean, id?: string, error?: string}>}
 */
async function sendOrderDeliveredEmail({ to, order, baseUrl }) {
  const cleanBase = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const deepLinkUrl = `${cleanBase}/perfil?pedido=${encodeURIComponent(order.id)}#historial-compras-section`;
  const rawPhoto = String(order.foto_entrega_url || '').trim();

  let photoHtml = '';
  const attachments = [];

  const dataUriMatch = rawPhoto.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUriMatch) {
    const mimeType = dataUriMatch[1];
    const base64Data = dataUriMatch[2];
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const cidName = `entrega-pedido-${order.id}@danillanos`;

    attachments.push({
      filename: `entrega-pedido-${order.id}.${ext}`,
      content: Buffer.from(base64Data, 'base64'),
      contentType: mimeType,
      contentId: cidName
    });

    photoHtml = `
      <div style="margin: 14px 0; text-align: center;">
        <img src="cid:${cidName}"
             alt="Foto de entrega del Pedido #${escapeHtml(order.id)}"
             style="max-width: 100%; max-height: 320px; border-radius: 14px; border: 1px solid #e5e7eb; display: inline-block; object-fit: cover;" />
      </div>
    `;
  } else if (/^https?:\/\//i.test(rawPhoto)) {
    photoHtml = `
      <div style="margin: 14px 0; text-align: center;">
        <img src="${escapeHtml(rawPhoto)}"
             alt="Foto de entrega del Pedido #${escapeHtml(order.id)}"
             style="max-width: 100%; max-height: 320px; border-radius: 14px; border: 1px solid #e5e7eb; display: inline-block; object-fit: cover;" />
      </div>
    `;
  }

  const bodyHtml = `
    <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px 18px; margin-bottom: 12px;">
      <div style="font-size: 13px; color: #4b5563; line-height: 1.6;">
        <div><strong>Dirección:</strong> ${escapeHtml(order.direccion_entrega || '')} (${escapeHtml(order.municipio || 'Villavicencio')})</div>
        <div><strong>Total:</strong> ${formatCop(order.total)}</div>
        ${
          order.observaciones_entregador
            ? `<div><strong>Nota de entrega:</strong> ${escapeHtml(order.observaciones_entregador)}</div>`
            : ''
        }
      </div>
    </div>
    ${photoHtml}
  `;

  const html = buildDanillanosEmailLayout({
    title: `Tu pedido #${order.id} fue entregado`,
    subtitle: `Hola ${order.nombre_recibe || 'Cliente'}, tu pedido ha sido entregado exitosamente. Adjuntamos el registro fotográfico de la entrega.`,
    bodyHtml,
    ctaText: 'Ver pedido en mi cuenta',
    ctaUrl: deepLinkUrl,
    footerNote: 'Gracias por confiar en Danillanos.'
  });

  return sendViaResend({
    to,
    subject: `Tu pedido #${order.id} fue entregado — Danillanos`,
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
