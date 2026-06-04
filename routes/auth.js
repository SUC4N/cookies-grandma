/**
 * Cookies Grandma — Auth Routes
 * POST /api/auth/login
 * POST /api/auth/change-password
 * GET  /api/auth/me
 */
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../database/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'cookiesgrandma_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim());
  if (!admin) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  const valid = bcrypt.compareSync(password, admin.password);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  // Update last login
  db.prepare('UPDATE admins SET last_login = datetime("now") WHERE id = ?').run(admin.id);

  const token = jwt.sign(
    { id: admin.id, username: admin.username, full_name: admin.full_name },
    SECRET,
    { expiresIn: EXPIRES }
  );

  res.json({
    success: true,
    token,
    admin: { id: admin.id, username: admin.username, full_name: admin.full_name, email: admin.email }
  });
});

// ─── ME ───────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const admin = db.prepare('SELECT id, username, full_name, email, last_login FROM admins WHERE id = ?').get(req.admin.id);
  res.json({ success: true, admin });
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Both passwords are required.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(current_password, admin.password)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hash, req.admin.id);
  res.json({ success: true, message: 'Password changed successfully.' });
});

module.exports = router;
