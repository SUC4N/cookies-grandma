/**
 * Cookies Grandma — Products Routes (PostgreSQL)
 */
const express = require('express');
const pool    = require('../database/pool');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/products  — public list
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE is_active = TRUE ORDER BY id ASC');
    res.json({ success: true, products: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET /api/products/:slug  — public single product
router.get('/:slug([a-z]+)', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE slug = $1 AND is_active = TRUE',
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, product: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET /api/products/admin/settings/all  — admin
router.get('/admin/settings/all', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM settings');
    const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({ success: true, settings });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// PATCH /api/products/admin/settings/update  — admin
router.patch('/admin/settings/update', requireAuth, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(value)]
      );
    }
    res.json({ success: true, message: 'Settings updated.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// PATCH /api/products/admin/:id  — admin update product
router.patch('/admin/:id', requireAuth, async (req, res) => {
  try {
    const { name, subtitle, description, price, stock, is_active } = req.body;
    const existing = (await pool.query('SELECT id FROM products WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });

    await pool.query(`
      UPDATE products SET
        name        = COALESCE($1, name),
        subtitle    = COALESCE($2, subtitle),
        description = COALESCE($3, description),
        price       = COALESCE($4, price),
        stock       = COALESCE($5, stock),
        is_active   = COALESCE($6, is_active),
        updated_at  = NOW()
      WHERE id = $7`,
      [
        name        || null,
        subtitle    || null,
        description || null,
        price  != null ? parseInt(price)  : null,
        stock  != null ? parseInt(stock)  : null,
        is_active != null ? Boolean(is_active) : null,
        req.params.id
      ]
    );

    const updated = (await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id])).rows[0];
    res.json({ success: true, message: 'Product updated.', product: updated });
  } catch (err) {
    console.error('Product update error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
