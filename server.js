/**
 * Cookies Grandma — Express App
 * Exported for Vercel serverless (api/index.js)
 * Also runs standalone: node server.js
 */
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => cb(null, true), // Vercel handles origin security
  credentials: true,
}));

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

// Rate limiting
app.use('/api/', rateLimit({ windowMs:15*60*1000, max:200, standardHeaders:true, legacyHeaders:false }));
app.use('/api/orders', rateLimit({ windowMs:10*60*1000, max:20 }));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/products', require('./routes/products'));

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try { await require('./lib/pool').query('SELECT 1'); } catch { db = 'error'; }
  res.json({ success:true, status:'running', name:'Cookies Grandma API', db, ts: new Date().toISOString() });
});

app.get('/', (req, res) => res.json({ message:'🍪 Cookies Grandma API' }));

app.use((req, res) => res.status(404).json({ success:false, message:'Not found.' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ success:false, message:'Server error.' }); });

// ─── LOCAL DEV (not used by Vercel) ──────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`\n🍪 Running locally → http://localhost:${PORT}/api/health\n`));
}

module.exports = app;
