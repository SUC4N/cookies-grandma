/**
 * Cookies Grandma — Products Routes (node:sqlite compatible)
 */
const express = require('express');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ─── PUBLIC: LIST ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY id ASC').all();
  res.json({ success: true, products });
});

// ─── PUBLIC: GET BY SLUG ──────────────────────────────────────────────────────
router.get('/:slug([a-z]+)', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
  res.json({ success: true, product });
});

// ─── ADMIN: UPDATE PRODUCT ────────────────────────────────────────────────────
router.patch('/admin/:id', requireAuth, (req, res) => {
  const { name, subtitle, description, price, stock, is_active } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

  db.prepare(`
    UPDATE products SET
      name        = COALESCE(?, name),
      subtitle    = COALESCE(?, subtitle),
      description = COALESCE(?, description),
      price       = COALESCE(?, price),
      stock       = COALESCE(?, stock),
      is_active   = COALESCE(?, is_active),
      updated_at  = datetime('now')
    WHERE id = ?
  `).run(
    name        || null,
    subtitle    || null,
    description || null,
    price  != null ? parseInt(price)  : null,
    stock  != null ? parseInt(stock)  : null,
    is_active != null ? (is_active ? 1 : 0) : null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.json({ success: true, message: 'Product updated.', product: updated });
});

// ─── ADMIN: GET SETTINGS ──────────────────────────────────────────────────────
router.get('/admin/settings/all', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ success: true, settings });
});

// ─── ADMIN: UPDATE SETTINGS ───────────────────────────────────────────────────
router.patch('/admin/settings/update', requireAuth, (req, res) => {
  const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`);
  Object.entries(req.body).forEach(([k, v]) => stmt.run(k, String(v)));
  res.json({ success: true, message: 'Settings updated.' });
});

module.exports = router;
