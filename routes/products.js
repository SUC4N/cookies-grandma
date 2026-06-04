const express = require('express');
const pool    = require('../lib/pool');
const { requireAuth } = require('../lib/authMiddleware');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE is_active=TRUE ORDER BY id ASC');
    res.json({ success:true, products:rows });
  } catch(e) { res.status(500).json({ success:false, message:'Server error.' }); }
});

router.get('/:slug([a-z]+)', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE slug=$1 AND is_active=TRUE', [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ success:false, message:'Not found.' });
    res.json({ success:true, product:rows[0] });
  } catch(e) { res.status(500).json({ success:false, message:'Server error.' }); }
});

router.get('/admin/settings/all', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM settings');
    res.json({ success:true, settings:Object.fromEntries(rows.map(r=>[r.key,r.value])) });
  } catch(e) { res.status(500).json({ success:false, message:'Server error.' }); }
});

router.patch('/admin/settings/update', requireAuth, async (req, res) => {
  try {
    for (const [k,v] of Object.entries(req.body))
      await pool.query(`INSERT INTO settings(key,value,updated_at) VALUES($1,$2,NOW())
        ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`, [k,String(v)]);
    res.json({ success:true, message:'Settings updated.' });
  } catch(e) { res.status(500).json({ success:false, message:'Server error.' }); }
});

router.patch('/admin/:id', requireAuth, async (req, res) => {
  try {
    const { name,subtitle,description,price,stock,is_active } = req.body;
    if (!(await pool.query('SELECT id FROM products WHERE id=$1',[req.params.id])).rows[0])
      return res.status(404).json({ success:false, message:'Not found.' });
    await pool.query(`UPDATE products SET name=COALESCE($1,name),subtitle=COALESCE($2,subtitle),
      description=COALESCE($3,description),price=COALESCE($4,price),stock=COALESCE($5,stock),
      is_active=COALESCE($6,is_active),updated_at=NOW() WHERE id=$7`,
      [name||null,subtitle||null,description||null,
       price!=null?parseInt(price):null,stock!=null?parseInt(stock):null,
       is_active!=null?Boolean(is_active):null,req.params.id]);
    const updated = (await pool.query('SELECT * FROM products WHERE id=$1',[req.params.id])).rows[0];
    res.json({ success:true, product:updated });
  } catch(e) { res.status(500).json({ success:false, message:'Server error.' }); }
});

module.exports = router;
