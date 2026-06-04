/**
 * Cookies Grandma — Auth Routes (PostgreSQL)
 */
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../database/pool');
const { requireAuth } = require('../middleware/authMiddleware');

const router  = express.Router();
const SECRET  = process.env.JWT_SECRET  || 'cookiesgrandma_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username and password are required.' });

    const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username.trim()]);
    const admin = rows[0];
    if (!admin || !bcrypt.compareSync(password, admin.password))
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, full_name: admin.full_name },
      SECRET, { expiresIn: EXPIRES }
    );
    res.json({
      success: true, token,
      admin: { id: admin.id, username: admin.username, full_name: admin.full_name, email: admin.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, last_login FROM admins WHERE id = $1',
      [req.admin.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Admin not found.' });
    res.json({ success: true, admin: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ success: false, message: 'Both passwords are required.' });
    if (new_password.length < 8)
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

    const { rows } = await pool.query('SELECT password FROM admins WHERE id = $1', [req.admin.id]);
    if (!rows[0] || !bcrypt.compareSync(current_password, rows[0].password))
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    const hash = bcrypt.hashSync(new_password, 12);
    await pool.query('UPDATE admins SET password = $1 WHERE id = $2', [hash, req.admin.id]);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
