/**
 * Cookies Grandma — Database Setup & Seeder
 * Uses Node.js built-in node:sqlite (Node v22.5+)
 * Run: node database/setup.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path   = require('path');

const DB_PATH = path.join(__dirname, 'cookiesgrandma.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

console.log('🍪 Setting up Cookies Grandma database...\n');

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    email       TEXT,
    full_name   TEXT    DEFAULT 'Administrator',
    created_at  TEXT    DEFAULT (datetime('now')),
    last_login  TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    subtitle    TEXT,
    description TEXT,
    price       INTEGER NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 999,
    image       TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number    TEXT    NOT NULL UNIQUE,
    customer_name   TEXT    NOT NULL,
    customer_phone  TEXT    NOT NULL,
    customer_email  TEXT,
    address         TEXT    NOT NULL,
    city            TEXT,
    postal_code     TEXT,
    nastar_qty      INTEGER NOT NULL DEFAULT 0,
    kastangel_qty   INTEGER NOT NULL DEFAULT 0,
    gift_wrapping   TEXT    NOT NULL DEFAULT 'none',
    notes           TEXT,
    subtotal        INTEGER NOT NULL DEFAULT 0,
    shipping_cost   INTEGER NOT NULL DEFAULT 0,
    total_price     INTEGER NOT NULL DEFAULT 0,
    status          TEXT    NOT NULL DEFAULT 'pending',
    payment_status  TEXT    NOT NULL DEFAULT 'unpaid',
    payment_method  TEXT,
    payment_token   TEXT,
    payment_url     TEXT,
    midtrans_order  TEXT,
    source          TEXT    DEFAULT 'website',
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_status_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL,
    status     TEXT    NOT NULL,
    note       TEXT,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

console.log('✅ Tables created.\n');

// ─── SEED ADMIN ──────────────────────────────────────────────────────────────

const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || 'cookiesgrandma2025';
const existing  = db.prepare('SELECT id FROM admins WHERE username = ?').get(adminUser);

if (!existing) {
  const hash = bcrypt.hashSync(adminPass, 12);
  db.prepare(`
    INSERT INTO admins (username, password, email, full_name)
    VALUES (?, ?, ?, ?)
  `).run(adminUser, hash, 'admin@cookiesgrandma.id', 'Admin Cookies Grandma');
  console.log(`✅ Admin created: ${adminUser} / ${adminPass}`);
  console.log('   ⚠️  CHANGE THIS PASSWORD after first login!\n');
} else {
  console.log('ℹ️  Admin already exists, skipping.\n');
}

// ─── SEED PRODUCTS ───────────────────────────────────────────────────────────

const products = [
  {
    slug:        'nastar',
    name:        'Premium Nastar',
    subtitle:    'Pineapple Jam Cookies',
    description: 'Buttery melt-in-your-mouth shortcrust pastry shells filled with our house-made sweet-tangy pineapple jam. Each golden ball is rolled to perfection and dusted with fine cheese for a signature finish. No preservatives — just pure goodness in every bite.',
    price:       parseInt(process.env.PRICE_NASTAR || 95000),
    stock:       500,
    image:       'Resources/IMG_3962.JPG',
  },
  {
    slug:        'kastangel',
    name:        'Premium Kastangel',
    subtitle:    'Cheese Finger Cookies',
    description: 'Crispy, crumbly cheese cookies generously loaded with premium Edam and cheddar cheese. Baked to a delicate golden crisp, each finger dissolves into a rich, savoury-sweet flavour on the palate. No preservatives — crafted fresh for every order.',
    price:       parseInt(process.env.PRICE_KASTANGEL || 95000),
    stock:       500,
    image:       'Resources/IMG_3970.jpeg',
  }
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (slug, name, subtitle, description, price, stock, image)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

products.forEach(p => {
  const result = insertProduct.run(p.slug, p.name, p.subtitle, p.description, p.price, p.stock, p.image);
  if (result.changes) console.log(`✅ Product seeded: ${p.name}`);
  else console.log(`ℹ️  Product already exists: ${p.name}`);
});

// ─── SEED SETTINGS ───────────────────────────────────────────────────────────

const defaultSettings = [
  ['site_name',                'Cookies Grandma'],
  ['wa_number',                process.env.WA_NUMBER        || '6281234567890'],
  ['price_gift_wrap',          process.env.PRICE_GIFT_WRAP  || '15000'],
  ['price_hamper_box',         process.env.PRICE_HAMPER_BOX || '35000'],
  ['shipping_cost_default',    '0'],
  ['email_notifications',      'true'],
  ['order_notification_email', process.env.EMAIL_USER || 'admin@cookiesgrandma.id'],
];

const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
defaultSettings.forEach(([k, v]) => insertSetting.run(k, v));
console.log('\n✅ Settings seeded.');

db.close();
console.log('\n🎉 Database setup complete!');
console.log('   Run "npm start" to launch the server.\n');
