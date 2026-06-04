/**
 * ╔══════════════════════════════════════════════════════════╗
 *  Cookies Grandma — API Server
 *  Express + PostgreSQL  |  Deployed on Render
 * ╚══════════════════════════════════════════════════════════╝
 */
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const orderRoutes   = require('./routes/orders');
const productRoutes = require('./routes/products');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow Vercel frontend + localhost for dev
const allowedOrigins = [
  process.env.FRONTEND_URL,          // e.g. https://cookies-grandma.vercel.app
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Postman, Render health checks, Vercel server-side proxy)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust Render's proxy (needed for rate-limiter to see real IPs)
app.set('trust proxy', 1);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 15,
  message: { success: false, message: 'Too many order attempts. Please wait a moment.' },
});

app.use('/api/', apiLimiter);
app.use('/api/orders', orderLimiter);

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/products', productRoutes);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    const pool = require('./database/pool');
    await pool.query('SELECT 1');
  } catch { dbStatus = 'error'; }

  res.json({
    success: true, status: 'running',
    name: 'Cookies Grandma API', version: '1.0.0',
    db: dbStatus, timestamp: new Date().toISOString(),
  });
});

// ─── ROOT ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: '🍪 Cookies Grandma API is running.', docs: '/api/health' });
});

// ─── 404 & ERROR ──────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint not found.' }));
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🍪  Cookies Grandma API Server             ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   📡  Running on port ${String(PORT).padEnd(24)}║`);
  console.log(`║   🌍  ENV: ${(process.env.NODE_ENV||'development').padEnd(35)}║`);
  console.log('╚══════════════════════════════════════════════╝\n');
});

module.exports = app;
