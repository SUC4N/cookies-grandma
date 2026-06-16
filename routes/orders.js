const express = require('express');
const pool    = require('../lib/pool');
const { requireAuth } = require('../lib/authMiddleware');
const { sendOrderConfirmation, sendAdminNotification } = require('../lib/emailService');
const { createMidtransPayment } = require('../lib/paymentService');

const router = express.Router();

const genOrderNum = () => `CG-${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Math.floor(Math.random()*9000)+1000}`;

async function getSetting(key) {
  const { rows } = await pool.query('SELECT value FROM settings WHERE key=$1', [key]);
  return rows[0]?.value ?? null;
}

async function calcTotal(n, k, giftWrap) {
  const [gw, hb, sh] = await Promise.all([
    getSetting('price_gift_wrap'), getSetting('price_hamper_box'), getSetting('shipping_cost_default')
  ]);
  const giftCost = giftWrap==='gift_wrap' ? parseInt(gw||15000) : giftWrap==='hamper' ? parseInt(hb||35000) : 0;
  const subtotal = n*parseInt(process.env.PRICE_NASTAR||80000) + k*parseInt(process.env.PRICE_KASTANGEL||115000) + giftCost;
  const shipping = parseInt(sh||0);
  return { subtotal, shipping, total: subtotal+shipping };
}

// POST /api/orders — place order
router.post('/', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, address, city, postal_code,
            nastar_qty=0, kastangel_qty=0, gift_wrapping='none', notes='', payment_method='transfer' } = req.body;

    if (!customer_name?.trim()) return res.status(400).json({ success:false, message:'Name required.' });
    if (!customer_phone?.trim()) return res.status(400).json({ success:false, message:'Phone required.' });
    if (!address?.trim()) return res.status(400).json({ success:false, message:'Address required.' });
    const n=parseInt(nastar_qty), k=parseInt(kastangel_qty);
    if (n+k===0) return res.status(400).json({ success:false, message:'Select at least 1 item.' });

    const { subtotal, shipping, total } = await calcTotal(n, k, gift_wrapping);
    const order_number = genOrderNum();

    const { rows } = await pool.query(`
      INSERT INTO orders (order_number,customer_name,customer_phone,customer_email,address,city,postal_code,
        nastar_qty,kastangel_qty,gift_wrapping,notes,subtotal,shipping_cost,total_price,payment_method,
        status,payment_status,source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending','unpaid','website')
      RETURNING *`,
      [order_number,customer_name.trim(),customer_phone.trim(),customer_email||null,address.trim(),
       city||null,postal_code||null,n,k,gift_wrapping,notes||null,subtotal,shipping,total,payment_method]
    );
    const order = rows[0];
    await pool.query('INSERT INTO order_status_logs(order_id,status,note) VALUES($1,$2,$3)',
      [order.id,'pending','Order placed via website']);

    let paymentUrl = null;
    if (payment_method==='midtrans') {
      try {
        const snap = await createMidtransPayment(order);
        paymentUrl = snap.redirect_url;
        await pool.query('UPDATE orders SET payment_token=$1,payment_url=$2 WHERE id=$3',
          [snap.token,snap.redirect_url,order.id]);
      } catch(e) { console.error('Midtrans:',e.message); }
    }

    sendOrderConfirmation(order).catch(e=>console.error('Email:',e.message));
    sendAdminNotification(order).catch(e=>console.error('Admin email:',e.message));

    res.status(201).json({ success:true, message:'Order placed!', order_number, total, payment_url:paymentUrl, order });
  } catch(e) { console.error(e); res.status(500).json({ success:false, message:'Server error.' }); }
});

// GET /api/orders/track/:number
router.get('/track/:number', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE order_number=$1', [req.params.number.toUpperCase()]);
    if (!rows[0]) return res.status(404).json({ success:false, message:'Order not found.' });
    const logs = (await pool.query('SELECT * FROM order_status_logs WHERE order_id=$1 ORDER BY created_at ASC',[rows[0].id])).rows;
    res.json({ success:true, order:rows[0], logs });
  } catch(e) { res.status(500).json({ success:false, message:'Server error.' }); }
});

// GET /api/orders/admin/stats
router.get('/admin/stats', requireAuth, async (req, res) => {
  try {
    const [t,p,r,td,ns,ks,rec,mo] = await Promise.all([
      pool.query('SELECT COUNT(*)::int c FROM orders'),
      pool.query("SELECT COUNT(*)::int c FROM orders WHERE status='pending'"),
      pool.query("SELECT COALESCE(SUM(total_price),0)::int s FROM orders WHERE payment_status='paid'"),
      pool.query("SELECT COUNT(*)::int c FROM orders WHERE created_at::date=CURRENT_DATE"),
      pool.query("SELECT COALESCE(SUM(nastar_qty),0)::int s FROM orders WHERE status!='cancelled'"),
      pool.query("SELECT COALESCE(SUM(kastangel_qty),0)::int s FROM orders WHERE status!='cancelled'"),
      pool.query('SELECT id,order_number,customer_name,total_price,status,payment_status,created_at FROM orders ORDER BY created_at DESC LIMIT 5'),
      pool.query("SELECT TO_CHAR(created_at,'YYYY-MM') month,COUNT(*)::int orders,COALESCE(SUM(total_price),0)::int revenue FROM orders WHERE created_at>=NOW()-INTERVAL '6 months' GROUP BY month ORDER BY month ASC"),
    ]);
    res.json({ success:true,
      stats:{ total_orders:t.rows[0].c, pending_orders:p.rows[0].c, revenue_total:r.rows[0].s,
              orders_today:td.rows[0].c, nastar_sold:ns.rows[0].s, kastangel_sold:ks.rows[0].s },
      recent_orders:rec.rows, monthly_data:mo.rows });
  } catch(e) { console.error(e); res.status(500).json({ success:false, message:'Server error.' }); }
});

// GET /api/orders/admin/all
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const { status, page=1, limit=20, search='' } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const conds=[], params=[];
    if (status && status!=='all') { params.push(status); conds.push(`status=$${params.length}`); }
    if (search.trim()) {
      params.push(`%${search}%`);
      const n=params.length; params.push(`%${search}%`,`%${search}%`);
      conds.push(`(customer_name ILIKE $${n} OR order_number ILIKE $${n+1} OR customer_phone ILIKE $${n+2})`);
    }
    const w = conds.length ? 'WHERE '+conds.join(' AND ') : '';
    const [tot, ord] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int c FROM orders ${w}`, params),
      pool.query(`SELECT id,order_number,customer_name,customer_phone,customer_email,nastar_qty,kastangel_qty,
        total_price,status,payment_status,payment_method,gift_wrapping,created_at FROM orders ${w}
        ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params,parseInt(limit),offset])
    ]);
    res.json({ success:true, orders:ord.rows, total:tot.rows[0].c, page:parseInt(page), pages:Math.ceil(tot.rows[0].c/parseInt(limit)) });
  } catch(e) { console.error(e); res.status(500).json({ success:false, message:'Server error.' }); }
});

// GET /api/orders/admin/:id
router.get('/admin/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success:false, message:'Not found.' });
    const logs = (await pool.query('SELECT * FROM order_status_logs WHERE order_id=$1 ORDER BY created_at ASC',[rows[0].id])).rows;
    res.json({ success:true, order:rows[0], logs });
  } catch(e) { res.status(500).json({ success:false, message:'Server error.' }); }
});

// PATCH /api/orders/admin/:id/status
router.patch('/admin/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, payment_status, note } = req.body;
    const vS=['pending','confirmed','processing','shipped','delivered','cancelled'];
    const vP=['unpaid','paid','refunded'];
    if (status && !vS.includes(status)) return res.status(400).json({ success:false, message:'Invalid status.' });
    if (payment_status && !vP.includes(payment_status)) return res.status(400).json({ success:false, message:'Invalid payment_status.' });
    if (!(await pool.query('SELECT id FROM orders WHERE id=$1',[req.params.id])).rows[0])
      return res.status(404).json({ success:false, message:'Not found.' });
    const sets=[], vals=[];
    if (status)         { vals.push(status);         sets.push(`status=$${vals.length}`); }
    if (payment_status) { vals.push(payment_status); sets.push(`payment_status=$${vals.length}`); }
    sets.push('updated_at=NOW()'); vals.push(req.params.id);
    await pool.query(`UPDATE orders SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
    if (status) await pool.query('INSERT INTO order_status_logs(order_id,status,note) VALUES($1,$2,$3)',
      [req.params.id,status,note||'Updated by admin']);
    const updated = (await pool.query('SELECT * FROM orders WHERE id=$1',[req.params.id])).rows[0];
    res.json({ success:true, message:'Updated.', order:updated });
  } catch(e) { console.error(e); res.status(500).json({ success:false, message:'Server error.' }); }
});

// DELETE /api/orders/admin/:id
router.delete('/admin/:id', requireAuth, async (req, res) => {
  try {
    if (!(await pool.query('SELECT id FROM orders WHERE id=$1',[req.params.id])).rows[0])
      return res.status(404).json({ success:false, message:'Not found.' });
    await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    res.json({ success:true, message:'Deleted.' });
  } catch(e) { res.status(500).json({ success:false, message:'Server error.' }); }
});

// POST /api/orders/payment/notification (Midtrans webhook)
router.post('/payment/notification', async (req, res) => {
  try {
    const { order_id, transaction_status, fraud_status, payment_type } = req.body;
    const { rows } = await pool.query('SELECT * FROM orders WHERE order_number=$1', [order_id]);
    if (!rows[0]) return res.status(404).json({ message:'Not found' });
    const o = rows[0];
    let ps='unpaid', os=o.status;
    if (['capture','settlement'].includes(transaction_status) && (!fraud_status||fraud_status==='accept')) {
      ps='paid'; if (os==='pending') os='confirmed';
    } else if (['cancel','deny','expire'].includes(transaction_status)) ps='unpaid';
    else if (transaction_status==='refund') ps='refunded';
    await pool.query('UPDATE orders SET payment_status=$1,status=$2,payment_method=$3,updated_at=NOW() WHERE id=$4',
      [ps,os,payment_type,o.id]);
    if (ps==='paid') await pool.query('INSERT INTO order_status_logs(order_id,status,note) VALUES($1,$2,$3)',
      [o.id,os,`Paid via Midtrans (${payment_type})`]);
    res.json({ message:'OK' });
  } catch(e) { res.status(500).json({ message:'Error' }); }
});

module.exports = router;
