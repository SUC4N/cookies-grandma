/**
 * Cookies Grandma — PostgreSQL Database Setup & Seeder
 * Safe to run multiple times (idempotent).
 * Run: node database/setup.js
 * Render runs this automatically before start via render.yaml.
 */
require('dotenv').config();

const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function setup() {
  const client = await pool.connect();
  console.log('\n🍪 Setting up Cookies Grandma PostgreSQL database...\n');

  try {
    await client.query('BEGIN');

    // ─── SCHEMA ──────────────────────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id          SERIAL PRIMARY KEY,
        username    TEXT        NOT NULL UNIQUE,
        password    TEXT        NOT NULL,
        email       TEXT,
        full_name   TEXT        DEFAULT 'Administrator',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        last_login  TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id          SERIAL PRIMARY KEY,
        slug        TEXT        NOT NULL UNIQUE,
        name        TEXT        NOT NULL,
        subtitle    TEXT,
        description TEXT,
        price       INTEGER     NOT NULL,
        stock       INTEGER     NOT NULL DEFAULT 999,
        image       TEXT,
        is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id              SERIAL PRIMARY KEY,
        order_number    TEXT        NOT NULL UNIQUE,
        customer_name   TEXT        NOT NULL,
        customer_phone  TEXT        NOT NULL,
        customer_email  TEXT,
        address         TEXT        NOT NULL,
        city            TEXT,
        postal_code     TEXT,
        nastar_qty      INTEGER     NOT NULL DEFAULT 0,
        kastangel_qty   INTEGER     NOT NULL DEFAULT 0,
        gift_wrapping   TEXT        NOT NULL DEFAULT 'none',
        notes           TEXT,
        subtotal        INTEGER     NOT NULL DEFAULT 0,
        shipping_cost   INTEGER     NOT NULL DEFAULT 0,
        total_price     INTEGER     NOT NULL DEFAULT 0,
        status          TEXT        NOT NULL DEFAULT 'pending',
        payment_status  TEXT        NOT NULL DEFAULT 'unpaid',
        payment_method  TEXT,
        payment_token   TEXT,
        payment_url     TEXT,
        midtrans_order  TEXT,
        source          TEXT        DEFAULT 'website',
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_status_logs (
        id         SERIAL PRIMARY KEY,
        order_id   INTEGER     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        status     TEXT        NOT NULL,
        note       TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Tables created (or already exist).\n');

    // ─── SEED ADMIN ──────────────────────────────────────────────────────────

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'cookiesgrandma2025';
    const existing  = await pool.query('SELECT id FROM admins WHERE username = $1', [adminUser]);

    if (existing.rows.length === 0) {
      const hash = bcrypt.hashSync(adminPass, 12);
      await pool.query(
        `INSERT INTO admins (username, password, email, full_name)
         VALUES ($1, $2, $3, $4)`,
        [adminUser, hash, 'admin@cookiesgrandma.id', 'Admin Cookies Grandma']
      );
      console.log(`✅ Admin created: ${adminUser} / ${adminPass}`);
      console.log('   ⚠️  CHANGE THIS PASSWORD after first login!\n');
    } else {
      console.log('ℹ️  Admin already exists, skipping.\n');
    }

    // ─── SEED PRODUCTS ───────────────────────────────────────────────────────

    const products = [
      {
        slug: 'nastar', name: 'Premium Nastar', subtitle: 'Pineapple Jam Cookies',
        description: 'Buttery melt-in-your-mouth shortcrust pastry shells filled with our house-made sweet-tangy pineapple jam. Each golden ball is rolled to perfection and dusted with fine cheese for a signature finish. No preservatives — just pure goodness in every bite.',
        price: parseInt(process.env.PRICE_NASTAR || 95000), stock: 500,
        image: '/images/IMG_3962.JPG',
      },
      {
        slug: 'kastangel', name: 'Premium Kastangel', subtitle: 'Cheese Finger Cookies',
        description: 'Crispy, crumbly cheese cookies generously loaded with premium Edam and cheddar cheese. Baked to a delicate golden crisp, each finger dissolves into a rich, savoury-sweet flavour. No preservatives — crafted fresh for every order.',
        price: parseInt(process.env.PRICE_KASTANGEL || 95000), stock: 500,
        image: '/images/IMG_3970.jpeg',
      }
    ];

    for (const p of products) {
      const res = await pool.query(
        `INSERT INTO products (slug, name, subtitle, description, price, stock, image)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (slug) DO NOTHING`,
        [p.slug, p.name, p.subtitle, p.description, p.price, p.stock, p.image]
      );
      if (res.rowCount > 0) console.log(`✅ Product seeded: ${p.name}`);
      else console.log(`ℹ️  Product exists: ${p.name}`);
    }

    // ─── SEED SETTINGS ───────────────────────────────────────────────────────

    const defaults = [
      ['site_name',                'Cookies Grandma'],
      ['wa_number',                process.env.WA_NUMBER        || '6281234567890'],
      ['price_gift_wrap',          process.env.PRICE_GIFT_WRAP  || '15000'],
      ['price_hamper_box',         process.env.PRICE_HAMPER_BOX || '35000'],
      ['shipping_cost_default',    '0'],
      ['email_notifications',      'true'],
      ['order_notification_email', process.env.EMAIL_USER || 'admin@cookiesgrandma.id'],
    ];

    for (const [key, value] of defaults) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }

    console.log('\n✅ Settings seeded.');
    console.log('\n🎉 Database setup complete!\n');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Setup failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setup().catch(err => {
  console.error(err);
  process.exit(1);
});
