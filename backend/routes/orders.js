/**
 * Cookies Grandma — Orders Routes (PostgreSQL)
 */
const express  = require('express');
const pool     = require('../database/pool');
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

async function getSetting(key) {
  const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

async function calcTotal(nastar, kastangel, giftWrap) {
  const [giftWrapPrice, hamperPrice, shippingDefault] = await Promise.all([
    getSetting('price_gift_wrap'),
    getSetting('price_hamper_box'),
    getSetting('shipping_cost_default'),
  ]);
  const priceNastar    = parseInt(process.env.PRICE_NASTAR    || 80000);
  const priceKastangel = parseInt(process.env.PRICE_KASTANGEL || 115000);
  const giftCost =
    giftWrap === 'gift_wrap' ? parseInt(giftWrapPrice  || 15000) :
    giftWrap === 'hamper'    ? parseInt(hamperPrice    || 35000) : 0;
  const shipping = parseInt(shippingDefault || 0);
  const subtotal = (nastar * priceNastar) + (kastangel * priceKastangel) + giftCost;
  return { subtotal, shipping, total: subtotal + shipping };
}

// ─── PUBLIC: PLACE ORDER ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, customer_phone, customer_email,
      address, city, postal_code,
      nastar_qty    = 0,
      kastangel_qty = 0,
      gift_wrapping = 'none',
      notes         = '',
      payment_method = 'transfer'
    } = req.body;

    if (!customer_name?.trim())  return res.status(400).json({ success: false, message: 'Name is required.' });
    if (!customer_phone?.trim()) return res.status(400).json({ success: false, message: 'Phone number is required.' });
    if (!address?.trim())        return res.status(400).json({ success: false, message: 'Delivery address is required.' });

    const n = parseInt(nastar_qty);
    const k = parseInt(kastangel_qty);
    if (n + k === 0)
      return res.status(400).json({ success: false, message: 'Please order at least 1 item.' });

    const { subtotal, shipping, total } = await calcTotal(n, k, gift_wrapping);
    const order_number = generateOrderNumber();

    const { rows } = await pool.query(`
      INSERT INTO orders (
        order_number, customer_name, customer_phone, customer_email,
        address, city, postal_code,
        nastar_qty, kastangel_qty, gift_wrapping, notes,
        subtotal, shipping_cost, total_price,
        payment_method, status, payment_status, source
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
        'pending','unpaid','website'
      ) RETURNING *`,
      [
        order_number, customer_name.trim(), customer_phone.trim(),
        customer_email || null, address.trim(),
        city || null, postal_code || null,
        n, k, gift_wrapping, notes || null,
        subtotal, shipping, total,
        payment_method
      ]
    );

    const order = rows[0];

    await pool.query(
      'INSERT INTO order_status_logs (order_id, status, note) VALUES ($1,$2,$3)',
      [order.id, 'pending', 'Order placed via website']
    );

    // Midtrans (optional, non-fatal)
    let paymentUrl = null;
    if (payment_method === 'midtrans') {
      try {
        const snap = await createMidtransPayment(order);
        paymentUrl = snap.redirect_url;
        await pool.query(
          'UPDATE orders SET payment_token=$1, payment_url=$2, midtrans_order=$3 WHERE id=$4',
          [snap.token, snap.redirect_url, order_number, order.id]
        );
      } catch (e) { console.error('Midtrans (non-fatal):', e.message); }
    }

    // Emails (non-blocking)
    sendOrderConfirmation(order).catch(e => console.error('Email:', e.message));
    sendAdminNotification(order).catch(e => console.error('Admin email:', e.message));

    res.status(201).json({ success: true, message: 'Order placed successfully!', order_number, total, payment_url: paymentUrl, order });
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── PUBLIC: TRACK ORDER ─────────────────────────────────────────────────────
router.get('/track/:number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM orders WHERE order_number = $1',
      [req.params.number.toUpperCase()]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Order not found.' });

    const order = rows[0];
    const logs  = (await pool.query(
      'SELECT * FROM order_status_logs WHERE order_id = $1 ORDER BY created_at ASC',
      [order.id]
    )).rows;
    res.json({ success: true, order, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── ADMIN: STATS ─────────────────────────────────────────────────────────────
router.get('/admin/stats', requireAuth, async (req, res) => {
  try {
    const [
      totalRes, pendingRes, revenueRes, todayRes,
      nastarRes, kastangelRes, recentRes, monthlyRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS c FROM orders'),
      pool.query("SELECT COUNT(*)::int AS c FROM orders WHERE status = 'pending'"),
      pool.query("SELECT COALESCE(SUM(total_price),0)::int AS s FROM orders WHERE payment_status = 'paid'"),
      pool.query("SELECT COUNT(*)::int AS c FROM orders WHERE created_at::date = CURRENT_DATE"),
      pool.query("SELECT COALESCE(SUM(nastar_qty),0)::int AS s FROM orders WHERE status != 'cancelled'"),
      pool.query("SELECT COALESCE(SUM(kastangel_qty),0)::int AS s FROM orders WHERE status != 'cancelled'"),
      pool.query(`SELECT id, order_number, customer_name, total_price, status, payment_status, created_at
                  FROM orders ORDER BY created_at DESC LIMIT 5`),
      pool.query(`SELECT TO_CHAR(created_at,'YYYY-MM') AS month,
                         COUNT(*)::int AS orders,
                         COALESCE(SUM(total_price),0)::int AS revenue
                  FROM orders
                  WHERE created_at >= NOW() - INTERVAL '6 months'
                  GROUP BY month ORDER BY month ASC`),
    ]);

    res.json({
      success: true,
      stats: {
        total_orders:   totalRes.rows[0].c,
        pending_orders: pendingRes.rows[0].c,
        revenue_total:  revenueRes.rows[0].s,
        orders_today:   todayRes.rows[0].c,
        nastar_sold:    nastarRes.rows[0].s,
        kastangel_sold: kastangelRes.rows[0].s,
      },
      recent_orders: recentRes.rows,
      monthly_data:  monthlyRes.rows,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── ADMIN: LIST ALL ORDERS ───────────────────────────────────────────────────
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params     = [];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (search.trim()) {
      params.push(`%${search}%`);
      const n = params.length;
      params.push(`%${search}%`, `%${search}%`);
      conditions.push(`(customer_name ILIKE $${n} OR order_number ILIKE $${n+1} OR customer_phone ILIKE $${n+2})`);
    }

    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [totalRes, ordersRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM orders ${whereClause}`, params),
      pool.query(
        `SELECT id, order_number, customer_name, customer_phone, customer_email,
                nastar_qty, kastangel_qty, total_price, status, payment_status,
                payment_method, gift_wrapping, created_at
         FROM orders ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
    ]);

    const total = totalRes.rows[0].c;
    res.json({
      success: true,
      orders:  ordersRes.rows,
      total,
      page:    parseInt(page),
      pages:   Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── ADMIN: GET DETAIL ────────────────────────────────────────────────────────
router.get('/admin/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Order not found.' });
    const order = rows[0];
    const logs  = (await pool.query(
      'SELECT * FROM order_status_logs WHERE order_id = $1 ORDER BY created_at ASC',
      [order.id]
    )).rows;
    res.json({ success: true, order, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── ADMIN: UPDATE STATUS ─────────────────────────────────────────────────────
router.patch('/admin/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, payment_status, note } = req.body;
    const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled'];
    const validPayments = ['unpaid','paid','refunded'];

    if (status && !validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    if (payment_status && !validPayments.includes(payment_status))
      return res.status(400).json({ success: false, message: 'Invalid payment_status.' });

    const existing = (await pool.query('SELECT id FROM orders WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ success: false, message: 'Order not found.' });

    const setClauses = [];
    const vals       = [];
    if (status)         { vals.push(status);         setClauses.push(`status = $${vals.length}`); }
    if (payment_status) { vals.push(payment_status); setClauses.push(`payment_status = $${vals.length}`); }
    setClauses.push('updated_at = NOW()');
    vals.push(req.params.id);

    await pool.query(
      `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${vals.length}`,
      vals
    );

    if (status) {
      await pool.query(
        'INSERT INTO order_status_logs (order_id, status, note) VALUES ($1,$2,$3)',
        [req.params.id, status, note || 'Status updated by admin']
      );
    }

    const updated = (await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])).rows[0];
    res.json({ success: true, message: 'Order updated.', order: updated });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── ADMIN: DELETE ────────────────────────────────────────────────────────────
router.delete('/admin/:id', requireAuth, async (req, res) => {
  try {
    const existing = (await pool.query('SELECT id FROM orders WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ success: false, message: 'Order not found.' });
    // Logs deleted via CASCADE
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Order deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── MIDTRANS WEBHOOK ─────────────────────────────────────────────────────────
router.post('/payment/notification', async (req, res) => {
  try {
    const { order_id, transaction_status, fraud_status, payment_type } = req.body;
    const { rows } = await pool.query('SELECT * FROM orders WHERE order_number = $1', [order_id]);
    if (!rows[0]) return res.status(404).json({ message: 'Order not found' });
    const order = rows[0];

    let paymentStatus = 'unpaid', orderStatus = order.status;
    if (['capture','settlement'].includes(transaction_status) && (!fraud_status || fraud_status === 'accept')) {
      paymentStatus = 'paid';
      if (orderStatus === 'pending') orderStatus = 'confirmed';
    } else if (['cancel','deny','expire'].includes(transaction_status)) {
      paymentStatus = 'unpaid';
    } else if (transaction_status === 'refund') {
      paymentStatus = 'refunded';
    }

    await pool.query(
      'UPDATE orders SET payment_status=$1, status=$2, payment_method=$3, updated_at=NOW() WHERE id=$4',
      [paymentStatus, orderStatus, payment_type, order.id]
    );
    if (paymentStatus === 'paid') {
      await pool.query(
        'INSERT INTO order_status_logs (order_id, status, note) VALUES ($1,$2,$3)',
        [order.id, orderStatus, `Payment confirmed via Midtrans (${payment_type})`]
      );
    }
    res.json({ message: 'OK' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;
