/**
 * Cookies Grandma — Email Service (Nodemailer)
 */
const nodemailer = require('nodemailer');
const db         = require('../database/db');

function fmt(n) {
  return 'Rp ' + parseInt(n).toLocaleString('id-ID');
}

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST  || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function getGiftLabel(type) {
  if (type === 'gift_wrap') return 'Gift Wrapping';
  if (type === 'hamper')    return 'Hamper Box';
  return 'None';
}

// ─── CUSTOMER CONFIRMATION EMAIL ─────────────────────────────────────────────
async function sendOrderConfirmation(order) {
  if (!process.env.EMAIL_USER || !order.customer_email) return;

  const items = [];
  if (order.nastar_qty    > 0) items.push(`Premium Nastar x${order.nastar_qty}     = ${fmt(order.nastar_qty * 95000)}`);
  if (order.kastangel_qty > 0) items.push(`Premium Kastangel x${order.kastangel_qty} = ${fmt(order.kastangel_qty * 95000)}`);

  const transporter = getTransporter();
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Cookies Grandma <noreply@cookiesgrandma.id>',
    to:      order.customer_email,
    subject: `🍪 Order Confirmed — ${order.order_number} | Cookies Grandma`,
    html: `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5EDD6;font-family:Georgia,serif">
<div style="max-width:600px;margin:40px auto;background:#FFFDF8;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <div style="background:#8B1A1A;padding:40px 40px 32px;text-align:center">
    <div style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5EDD6;letter-spacing:-0.5px">
      Cookies <em>Grandma</em>
    </div>
    <div style="font-family:sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(245,237,214,0.7);margin-top:6px">
      Premium Artisan Cookies
    </div>
  </div>

  <!-- Body -->
  <div style="padding:40px">
    <div style="font-size:22px;font-weight:700;color:#3D1F0D;margin-bottom:8px">
      Hi ${order.customer_name}! 🍪
    </div>
    <p style="color:#6B4423;font-size:16px;line-height:1.7;margin:0 0 24px">
      Thank you for your order! We've received it and will start baking your cookies fresh.
      Please allow <strong>1–3 business days</strong> for preparation before shipping.
    </p>

    <!-- Order Number -->
    <div style="background:#8B1A1A;color:#F5EDD6;border-radius:8px;padding:20px 24px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-family:sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.7">Order Number</div>
        <div style="font-size:22px;font-weight:900;letter-spacing:1px;margin-top:4px">${order.order_number}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.7">Total</div>
        <div style="font-size:22px;font-weight:900;color:#E4B96A;margin-top:4px">${fmt(order.total_price)}</div>
      </div>
    </div>

    <!-- Order Items -->
    <div style="border:1.5px solid #EAD9B8;border-radius:8px;overflow:hidden;margin-bottom:28px">
      <div style="background:#F5EDD6;padding:12px 20px;font-family:sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B4423">Order Details</div>
      <div style="padding:20px">
        ${order.nastar_qty > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EAD9B8">
          <span style="color:#3D1F0D">Premium Nastar <span style="color:#8B1A1A">×${order.nastar_qty}</span></span>
          <span style="font-weight:600;color:#3D1F0D">${fmt(order.nastar_qty * 95000)}</span>
        </div>` : ''}
        ${order.kastangel_qty > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EAD9B8">
          <span style="color:#3D1F0D">Premium Kastangel <span style="color:#8B1A1A">×${order.kastangel_qty}</span></span>
          <span style="font-weight:600;color:#3D1F0D">${fmt(order.kastangel_qty * 95000)}</span>
        </div>` : ''}
        ${order.gift_wrapping !== 'none' ? `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EAD9B8">
          <span style="color:#3D1F0D">${getGiftLabel(order.gift_wrapping)}</span>
          <span style="color:#3D1F0D">${fmt(order.gift_wrapping === 'gift_wrap' ? 15000 : 35000)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:12px 0 0;font-size:18px;font-weight:700">
          <span style="color:#3D1F0D">Total</span>
          <span style="color:#8B1A1A">${fmt(order.total_price)}</span>
        </div>
      </div>
    </div>

    <!-- Delivery Info -->
    <div style="border:1.5px solid #EAD9B8;border-radius:8px;overflow:hidden;margin-bottom:28px">
      <div style="background:#F5EDD6;padding:12px 20px;font-family:sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B4423">Delivery Address</div>
      <div style="padding:20px;color:#3D1F0D;line-height:1.6">${order.address}${order.city ? ', ' + order.city : ''}${order.postal_code ? ' ' + order.postal_code : ''}</div>
    </div>

    <!-- Payment -->
    <div style="background:#FBF6EC;border-radius:8px;padding:20px 24px;margin-bottom:28px">
      <div style="font-family:sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6B4423;margin-bottom:8px">Payment Instructions</div>
      <p style="color:#3D1F0D;font-size:14px;line-height:1.7;margin:0">
        Please transfer <strong>${fmt(order.total_price)}</strong> to our account and send your payment proof via WhatsApp to
        <strong><a href="https://wa.me/${process.env.WA_NUMBER || '6281234567890'}" style="color:#8B1A1A">+${process.env.WA_NUMBER || '6281234567890'}</a></strong>
        mentioning order number <strong>${order.order_number}</strong>.
      </p>
    </div>

    <!-- Contact -->
    <p style="color:#6B4423;font-size:14px;line-height:1.7;text-align:center;margin:0">
      Questions? WhatsApp us at
      <a href="https://wa.me/${process.env.WA_NUMBER || '6281234567890'}" style="color:#8B1A1A;font-weight:600">+${process.env.WA_NUMBER || '6281234567890'}</a>
      <br>or email <a href="mailto:hello@cookiesgrandma.id" style="color:#8B1A1A">hello@cookiesgrandma.id</a>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#3D1F0D;padding:24px 40px;text-align:center">
    <div style="font-family:sans-serif;font-size:11px;color:rgba(245,237,214,0.5);letter-spacing:1px">
      © 2025 Cookies Grandma · Premium Artisan Cookies · No Preservatives
    </div>
  </div>
</div>
</body></html>
    `,
  });
}

// ─── ADMIN NOTIFICATION EMAIL ─────────────────────────────────────────────────
async function sendAdminNotification(order) {
  const emailNotif = db.prepare("SELECT value FROM settings WHERE key = 'email_notifications'").get();
  if (emailNotif?.value !== 'true') return;

  const adminEmail = db.prepare("SELECT value FROM settings WHERE key = 'order_notification_email'").get();
  if (!adminEmail?.value || !process.env.EMAIL_USER) return;

  const transporter = getTransporter();
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Cookies Grandma <noreply@cookiesgrandma.id>',
    to:      adminEmail.value,
    subject: `🔔 New Order ${order.order_number} — ${order.customer_name} — ${fmt(order.total_price)}`,
    html: `
<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
  <h2 style="color:#8B1A1A">🍪 New Order Received!</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:8px 0;color:#666">Order #</td><td style="font-weight:600">${order.order_number}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Customer</td><td>${order.customer_name}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Phone</td><td><a href="https://wa.me/${(order.customer_phone || '').replace(/\D/g,'')}">
      ${order.customer_phone}</a></td></tr>
    <tr><td style="padding:8px 0;color:#666">Nastar</td><td>${order.nastar_qty} jar(s)</td></tr>
    <tr><td style="padding:8px 0;color:#666">Kastangel</td><td>${order.kastangel_qty} jar(s)</td></tr>
    <tr><td style="padding:8px 0;color:#666">Total</td><td style="font-size:18px;font-weight:700;color:#8B1A1A">${fmt(order.total_price)}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Address</td><td>${order.address}</td></tr>
  </table>
  <div style="margin-top:20px">
    <a href="${process.env.BASE_URL || 'http://localhost:3000'}/admin.html"
       style="background:#8B1A1A;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px">
      View in Admin Panel →
    </a>
  </div>
</div>
    `,
  });
}

module.exports = { sendOrderConfirmation, sendAdminNotification };
