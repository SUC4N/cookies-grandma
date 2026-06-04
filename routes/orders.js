/**
 * Cookies Grandma — Orders Routes (node:sqlite compatible)
 */
const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const db       = require('../database/db');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendOrderConfirmation, sendAdminNotification } = require('../services/emailService');
const { createMidtransPayment } = require('../services/paymentService');

const router = express.Router();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `CG-${date}-${rand}`;
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function calcTotal(nastar, kastangel, giftWrap) {
  const priceNastar    = parseInt(process.env.PRICE_NASTAR    || 95000);
  const priceKastangel = parseInt(process.env.PRICE_KASTANGEL || 95000);
  const giftCost =
    giftWrap === 'gift_wrap' ? parseInt(getSetting('price_gift_wrap')  || 15000) :
    giftWrap === 'hamper'    ? parseInt(getSetting('price_hamper_box') || 35000) : 0;
  const shipping = parseInt(getSetting('shipping_cost_default') || 0);
  const subtotal = (nastar * priceNastar) + (kastangel * priceKastangel) + giftCost;
  return { subtotal, shipping, total: subtotal + shipping };
}

// ─── PUBLIC: PLACE ORDER ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, customer_phone, customer_email,
      address, city, postal_code,
      nastar_qty = 0, kastangel_qty = 0,
      gift_wrapping = 'none', notes = '',
      payment_method = 'transfer'
    } = req.body;

    if (!customer_name?.trim()) return res.status(400).json({ success: false, message: 'Name is required.' });
    if (!customer_phone?.trim()) return res.status(400).json({ success: false, message: 'Phone number is required.' });
    if (!address?.trim()) return res.status(400).json({ success: false, message: 'Delivery address is required.' });
    if (parseInt(nastar_qty) + parseInt(kastangel_qty) === 0)
      return res.status(400).json({ success: false, message: 'Please order at least 1 item.' });

    const n = parseInt(nastar_qty);
    const k = parseInt(kastangel_qty);
    const { subtotal, shipping, total } = calcTotal(n, k, gift_wrapping);
    const order_number = generateOrderNumber();

    const result = db.prepare(`
      INSERT INTO orders (
        order_number, customer_name, customer_phone, customer_email,
        address, city, postal_code,
        nastar_qty, kastangel_qty, gift_wrapping, notes,
        subtotal, shipping_cost, total_price,
        payment_method, status, payment_status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', 'website')
    `).run(
      order_number, customer_name.trim(), customer_phone.trim(),
      customer_email || null, address.trim(),
      city || null, postal_code || null,
      n, k, gift_wrapping, notes || null,
      subtotal, shipping, total,
      payment_method
    );

    const orderId = result.lastInsertRowid;

    db.prepare('INSERT INTO order_status_logs (order_id, status, note) VALUES (?, ?, ?)')
      .run(orderId, 'pending', 'Order placed via website');

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    // Midtrans payment (optional)
    let paymentUrl = null;
    if (payment_method === 'midtrans') {
      try {
        const snap = await createMidtransPayment(order);
        paymentUrl = snap.redirect_url;
        db.prepare('UPDATE orders SET payment_token = ?, payment_url = ?, midtrans_order = ? WHERE id = ?')
          .run(snap.token, snap.redirect_url, order_number, orderId);
      } catch (e) {
        console.error('Midtrans error (non-fatal):', e.message);
      }
    }

    // Emails (non-blocking)
    sendOrderConfirmation(order).catch(e => console.error('Email error:', e.message));
    sendAdminNotification(order).catch(e => console.error('Admin email error:', e.message));

    res.status(201).json({ success: true, message: 'Order placed successfully!', order_number, total, payment_url: paymentUrl, order });

  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── PUBLIC: TRACK ORDER ─────────────────────────────────────────────────────
router.get('/track/:number', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.number.toUpperCase());
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  const logs = db.prepare('SELECT * FROM order_status_logs WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
  res.json({ success: true, order, logs });
});

// ─── ADMIN: STATS ─────────────────────────────────────────────────────────────
router.get('/admin/stats', requireAuth, (req, res) => {
  const total_orders   = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const pending_orders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c;
  const revenue_total  = db.prepare("SELECT COALESCE(SUM(total_price),0) as s FROM orders WHERE payment_status = 'paid'").get().s;
  const orders_today   = db.prepare("SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = DATE('now')").get().c;
  const nastar_sold    = db.prepare("SELECT COALESCE(SUM(nastar_qty),0) as s FROM orders WHERE status != 'cancelled'").get().s;
  const kastangel_sold = db.prepare("SELECT COALESCE(SUM(kastangel_qty),0) as s FROM orders WHERE status != 'cancelled'").get().s;

  const recent = db.prepare(`
    SELECT id, order_number, customer_name, total_price, status, payment_status, created_at
    FROM orders ORDER BY created_at DESC LIMIT 5
  `).all();

  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month,
           COUNT(*) as orders,
           COALESCE(SUM(total_price),0) as revenue
    FROM orders
    WHERE created_at >= datetime('now', '-6 months')
    GROUP BY month ORDER BY month ASC
  `).all();

  res.json({ success: true,
    stats: { total_orders, pending_orders, revenue_total, orders_today, nastar_sold, kastangel_sold },
    recent_orders: recent, monthly_data: monthly
  });
});

// ─── ADMIN: LIST ALL ─────────────────────────────────────────────────────────
router.get('/admin/all', requireAuth, (req, res) => {
  const { status, page = 1, limit = 20, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = []; let params = [];
  if (status && status !== 'all') { where.push('status = ?'); params.push(status); }
  if (search) {
    where.push('(customer_name LIKE ? OR order_number LIKE ? OR customer_phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total  = db.prepare(`SELECT COUNT(*) as c FROM orders ${whereClause}`).get(...params).c;
  const orders = db.prepare(`
    SELECT id, order_number, customer_name, customer_phone, customer_email,
           nastar_qty, kastangel_qty, total_price, status, payment_status,
           payment_method, gift_wrapping, created_at
    FROM orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ success: true, orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// ─── ADMIN: GET DETAIL ────────────────────────────────────────────────────────
router.get('/admin/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  const logs = db.prepare('SELECT * FROM order_status_logs WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
  res.json({ success: true, order, logs });
});

// ─── ADMIN: UPDATE STATUS ─────────────────────────────────────────────────────
router.patch('/admin/:id/status', requireAuth, (req, res) => {
  const { status, payment_status, note } = req.body;
  const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled'];
  const validPayments = ['unpaid','paid','refunded'];

  if (status && !validStatuses.includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  if (payment_status && !validPayments.includes(payment_status))
    return res.status(400).json({ success: false, message: 'Invalid payment_status.' });

  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  const updates = []; const vals = [];
  if (status)         { updates.push('status = ?');         vals.push(status); }
  if (payment_status) { updates.push('payment_status = ?'); vals.push(payment_status); }
  updates.push("updated_at = datetime('now')");
  vals.push(req.params.id);

  db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

  if (status) {
    db.prepare('INSERT INTO order_status_logs (order_id, status, note) VALUES (?, ?, ?)')
      .run(req.params.id, status, note || 'Status updated by admin');
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json({ success: true, message: 'Order updated.', order: updated });
});

// ─── ADMIN: DELETE ────────────────────────────────────────────────────────────
router.delete('/admin/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  db.prepare('DELETE FROM order_status_logs WHERE order_id = ?').run(req.params.id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Order deleted.' });
});

// ─── MIDTRANS WEBHOOK ─────────────────────────────────────────────────────────
router.post('/payment/notification', async (req, res) => {
  try {
    const { order_id, transaction_status, fraud_status, payment_type } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order_id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let payment_status = 'unpaid', order_status = order.status;
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      if (fraud_status === 'accept' || !fraud_status) {
        payment_status = 'paid';
        if (order_status === 'pending') order_status = 'confirmed';
      }
    } else if (['cancel','deny','expire'].includes(transaction_status)) {
      payment_status = 'unpaid';
    } else if (transaction_status === 'refund') {
      payment_status = 'refunded';
    }

    db.prepare("UPDATE orders SET payment_status = ?, status = ?, payment_method = ?, updated_at = datetime('now') WHERE id = ?")
      .run(payment_status, order_status, payment_type, order.id);

    if (payment_status === 'paid') {
      db.prepare('INSERT INTO order_status_logs (order_id, status, note) VALUES (?, ?, ?)')
        .run(order.id, order_status, `Payment confirmed via Midtrans (${payment_type})`);
    }

    res.json({ message: 'OK' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;
