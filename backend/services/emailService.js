/**
 * Cookies Grandma — Email Service (Nodemailer + PostgreSQL)
 */
const nodemailer = require('nodemailer');
const pool       = require('../database/pool');

function fmt(n) { return 'Rp ' + parseInt(n || 0).toLocaleString('id-ID'); }
function giftLabel(t) {
  return t === 'gift_wrap' ? 'Gift Wrapping' : t === 'hamper' ? 'Hamper Box' : 'None';
}

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST  || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

async function sendOrderConfirmation(order) {
  if (!process.env.EMAIL_USER || !order.customer_email) return;

  const transporter = getTransporter();
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Cookies Grandma <noreply@cookiesgrandma.id>',
    to:      order.customer_email,
    subject: `🍪 Order Confirmed — ${order.order_number} | Cookies Grandma`,
    html: `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5EDD6;font-family:Georgia,serif">
<div style="max-width:600px;margin:40px auto;background:#FFFDF8;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#8B1A1A;padding:40px;text-align:center">
    <div style="font-size:28px;font-weight:900;color:#F5EDD6">Cookies <em>Grandma</em></div>
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(245,237,214,0.7);margin-top:6px">Premium Artisan Cookies</div>
  </div>
  <div style="padding:40px">
    <div style="font-size:22px;font-weight:700;color:#3D1F0D;margin-bottom:8px">Hi ${order.customer_name}! 🍪</div>
    <p style="color:#6B4423;font-size:16px;line-height:1.7;margin:0 0 24px">
      Thank you for your order! We'll start baking fresh — allow <strong>1–3 business days</strong> before shipping.
    </p>
    <div style="background:#8B1A1A;color:#F5EDD6;border-radius:8px;padding:20px 24px;margin-bottom:28px;display:flex;justify-content:space-between">
      <div>
        <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.7">Order Number</div>
        <div style="font-size:22px;font-weight:900;letter-spacing:1px;margin-top:4px">${order.order_number}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.7">Total</div>
        <div style="font-size:22px;font-weight:900;color:#E4B96A;margin-top:4px">${fmt(order.total_price)}</div>
      </div>
    </div>
    <div style="border:1.5px solid #EAD9B8;border-radius:8px;overflow:hidden;margin-bottom:28px">
      <div style="background:#F5EDD6;padding:12px 20px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B4423">Order Details</div>
      <div style="padding:20px">
        ${order.nastar_qty > 0    ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EAD9B8"><span>🍡 Premium Nastar ×${order.nastar_qty}</span><strong>${fmt(order.nastar_qty * 80000)}</strong></div>` : ''}
        ${order.kastangel_qty > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EAD9B8"><span>🧀 Premium Kastangel ×${order.kastangel_qty}</span><strong>${fmt(order.kastangel_qty * 115000)}</strong></div>` : ''}
        ${order.gift_wrapping !== 'none' ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EAD9B8"><span>🎁 ${giftLabel(order.gift_wrapping)}</span><span>${fmt(order.gift_wrapping === 'gift_wrap' ? 15000 : 35000)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:12px 0 0;font-size:18px;font-weight:700">
          <span>Total</span><span style="color:#8B1A1A">${fmt(order.total_price)}</span>
        </div>
      </div>
    </div>
    <p style="color:#6B4423;font-size:14px;line-height:1.7;text-align:center">
      Questions? WhatsApp: <a href="https://wa.me/${process.env.WA_NUMBER || '6281234567890'}" style="color:#8B1A1A;font-weight:600">+${process.env.WA_NUMBER || '6281234567890'}</a>
    </p>
  </div>
  <div style="background:#3D1F0D;padding:24px 40px;text-align:center">
    <div style="font-size:11px;color:rgba(245,237,214,0.5)">© 2025 Cookies Grandma · Premium Artisan Cookies · No Preservatives</div>
  </div>
</div></body></html>`,
  });
}

async function sendAdminNotification(order) {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'email_notifications'");
    if (rows[0]?.value !== 'true') return;

    const { rows: emailRows } = await pool.query("SELECT value FROM settings WHERE key = 'order_notification_email'");
    if (!emailRows[0]?.value || !process.env.EMAIL_USER) return;

    const transporter = getTransporter();
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'Cookies Grandma <noreply@cookiesgrandma.id>',
      to:      emailRows[0].value,
      subject: `🔔 New Order ${order.order_number} — ${order.customer_name} — ${fmt(order.total_price)}`,
      html: `
<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
  <h2 style="color:#8B1A1A">🍪 New Order Received!</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:8px 0;color:#666">Order #</td><td style="font-weight:600">${order.order_number}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Customer</td><td>${order.customer_name}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Phone</td><td><a href="https://wa.me/${(order.customer_phone||'').replace(/\D/g,'')}">${order.customer_phone}</a></td></tr>
    <tr><td style="padding:8px 0;color:#666">Nastar</td><td>${order.nastar_qty} jar(s)</td></tr>
    <tr><td style="padding:8px 0;color:#666">Kastangel</td><td>${order.kastangel_qty} jar(s)</td></tr>
    <tr><td style="padding:8px 0;color:#666">Total</td><td style="font-size:18px;font-weight:700;color:#8B1A1A">${fmt(order.total_price)}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Address</td><td>${order.address}</td></tr>
  </table>
  <div style="margin-top:20px">
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin"
       style="background:#8B1A1A;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px">
      View in Admin Panel →
    </a>
  </div>
</div>`,
    });
  } catch (e) {
    console.error('Admin notification email error:', e.message);
  }
}

module.exports = { sendOrderConfirmation, sendAdminNotification };
