const nodemailer = require('nodemailer');
const pool       = require('./pool');

const fmt = n => 'Rp ' + parseInt(n || 0).toLocaleString('id-ID');
const giftLabel = t => t === 'gift_wrap' ? 'Gift Wrapping' : t === 'hamper' ? 'Hamper Box' : 'None';

const transporter = () => nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendOrderConfirmation(order) {
  if (!process.env.EMAIL_USER || !order.customer_email) return;
  await transporter().sendMail({
    from:    process.env.EMAIL_FROM || 'Cookies Grandma <noreply@cookiesgrandma.id>',
    to:      order.customer_email,
    subject: `🍪 Order Confirmed — ${order.order_number} | Cookies Grandma`,
    html: `
<div style="max-width:560px;margin:40px auto;font-family:Georgia,serif;background:#FFFDF8;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:#8B1A1A;padding:36px;text-align:center;color:#F5EDD6">
    <div style="font-size:26px;font-weight:900">Cookies <em>Grandma</em></div>
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.7;margin-top:4px">Premium Artisan Cookies</div>
  </div>
  <div style="padding:36px">
    <p style="font-size:20px;font-weight:700;color:#3D1F0D">Hi ${order.customer_name}! 🍪</p>
    <p style="color:#6B4423;line-height:1.7">Your order is confirmed! We'll start baking fresh — allow <strong>1–3 business days</strong> before shipping.</p>
    <div style="background:#8B1A1A;color:#F5EDD6;border-radius:8px;padding:18px 22px;margin:20px 0;display:flex;justify-content:space-between">
      <div><div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.7">Order Number</div><div style="font-size:20px;font-weight:900;margin-top:4px">${order.order_number}</div></div>
      <div style="text-align:right"><div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:0.7">Total</div><div style="font-size:20px;font-weight:900;color:#E4B96A;margin-top:4px">${fmt(order.total_price)}</div></div>
    </div>
    ${order.nastar_qty    > 0 ? `<p style="color:#3D1F0D">🍡 Premium Nastar ×${order.nastar_qty} — <strong>${fmt(order.nastar_qty * 95000)}</strong></p>` : ''}
    ${order.kastangel_qty > 0 ? `<p style="color:#3D1F0D">🧀 Premium Kastangel ×${order.kastangel_qty} — <strong>${fmt(order.kastangel_qty * 95000)}</strong></p>` : ''}
    ${order.gift_wrapping !== 'none' ? `<p style="color:#3D1F0D">🎁 ${giftLabel(order.gift_wrapping)}</p>` : ''}
    <p style="color:#6B4423;margin-top:20px">Questions? WhatsApp: <a href="https://wa.me/${process.env.WA_NUMBER || '6281234567890'}" style="color:#8B1A1A;font-weight:600">+${process.env.WA_NUMBER || '6281234567890'}</a></p>
  </div>
  <div style="background:#3D1F0D;padding:20px;text-align:center;font-size:11px;color:rgba(245,237,214,0.5)">© 2025 Cookies Grandma · No Preservatives · Handmade</div>
</div>`,
  });
}

async function sendAdminNotification(order) {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'email_notifications'");
    if (rows[0]?.value !== 'true' || !process.env.EMAIL_USER) return;
    const { rows: er } = await pool.query("SELECT value FROM settings WHERE key = 'order_notification_email'");
    if (!er[0]?.value) return;
    await transporter().sendMail({
      from:    process.env.EMAIL_FROM,
      to:      er[0].value,
      subject: `🔔 New Order ${order.order_number} — ${fmt(order.total_price)}`,
      html: `<div style="font-family:sans-serif;max-width:480px;padding:24px"><h2 style="color:#8B1A1A">New Order!</h2>
        <p><strong>Order:</strong> ${order.order_number}</p>
        <p><strong>Name:</strong> ${order.customer_name}</p>
        <p><strong>Phone:</strong> <a href="https://wa.me/${(order.customer_phone||'').replace(/\D/g,'')}">${order.customer_phone}</a></p>
        <p><strong>Items:</strong> Nastar ×${order.nastar_qty}, Kastangel ×${order.kastangel_qty}</p>
        <p><strong>Total:</strong> <span style="color:#8B1A1A;font-size:18px;font-weight:700">${fmt(order.total_price)}</span></p>
        <p><strong>Address:</strong> ${order.address}</p>
      </div>`,
    });
  } catch (e) { console.error('Admin email error:', e.message); }
}

module.exports = { sendOrderConfirmation, sendAdminNotification };
