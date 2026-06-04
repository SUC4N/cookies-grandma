/**
 * ╔══════════════════════════════════════════════════╗
 *  Cookies Grandma — Main Server
 *  Node.js + Express + SQLite
 * ╚══════════════════════════════════════════════════╝
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const rateLimit  = require('express-rate-limit');

const authRoutes     = require('./routes/auth');
const orderRoutes    = require('./routes/orders');
const productRoutes  = require('./routes/products');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.BASE_URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — protect API from abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  message: { success: false, message: 'Too many order attempts. Please wait a moment.' }
});

app.use('/api/', apiLimiter);
app.use('/api/orders', orderLimiter);

// ─── STATIC FILES ─────────────────────────────────────────────────────────────

// Serve the main site & admin panel
app.use(express.static(path.join(__dirname), {
  index: false, // We control routing below
}));

// ─── API ROUTES ───────────────────────────────────────────────────────────────

app.use('/api/auth',     authRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/products', productRoutes);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    name: 'Cookies Grandma API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── PAGE ROUTES ──────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 fallback
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🍪  Cookies Grandma Server Running         ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   🌐  Website:  http://localhost:${PORT}         ║`);
  console.log(`║   🔧  Admin:    http://localhost:${PORT}/admin    ║`);
  console.log(`║   📡  API:      http://localhost:${PORT}/api      ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   ENV: ${(process.env.NODE_ENV || 'development').padEnd(37)}║`);
  console.log('╚══════════════════════════════════════════════╝\n');
});

module.exports = app;
