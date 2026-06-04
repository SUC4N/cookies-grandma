-- ═══════════════════════════════════════════════════════════
--  Cookies Grandma — Supabase Database Setup
--  Run this ONCE in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- Admins
CREATE TABLE IF NOT EXISTS admins (
  id         SERIAL PRIMARY KEY,
  username   TEXT        NOT NULL UNIQUE,
  password   TEXT        NOT NULL,
  email      TEXT,
  full_name  TEXT        DEFAULT 'Administrator',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Products
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
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  order_number   TEXT        NOT NULL UNIQUE,
  customer_name  TEXT        NOT NULL,
  customer_phone TEXT        NOT NULL,
  customer_email TEXT,
  address        TEXT        NOT NULL,
  city           TEXT,
  postal_code    TEXT,
  nastar_qty     INTEGER     NOT NULL DEFAULT 0,
  kastangel_qty  INTEGER     NOT NULL DEFAULT 0,
  gift_wrapping  TEXT        NOT NULL DEFAULT 'none',
  notes          TEXT,
  subtotal       INTEGER     NOT NULL DEFAULT 0,
  shipping_cost  INTEGER     NOT NULL DEFAULT 0,
  total_price    INTEGER     NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'pending',
  payment_status TEXT        NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  payment_token  TEXT,
  payment_url    TEXT,
  midtrans_order TEXT,
  source         TEXT        DEFAULT 'website',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Order status history
CREATE TABLE IF NOT EXISTS order_status_logs (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings key-value store
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Seed Products ───────────────────────────────────────────
INSERT INTO products (slug, name, subtitle, description, price, stock, image) VALUES
(
  'nastar', 'Premium Nastar', 'Pineapple Jam Cookies',
  'Buttery melt-in-your-mouth shortcrust pastry shells filled with our house-made sweet-tangy pineapple jam. No preservatives — just pure goodness in every bite.',
  95000, 500, 'Resources/IMG_3962.JPG'
),
(
  'kastangel', 'Premium Kastangel', 'Cheese Finger Cookies',
  'Crispy, crumbly cheese cookies loaded with premium Edam and cheddar cheese. Baked to a delicate golden crisp. No preservatives — crafted fresh for every order.',
  95000, 500, 'Resources/IMG_3970.jpeg'
)
ON CONFLICT (slug) DO NOTHING;

-- ─── Seed Settings ───────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('site_name',                'Cookies Grandma'),
  ('wa_number',                '6281234567890'),
  ('price_gift_wrap',          '15000'),
  ('price_hamper_box',         '35000'),
  ('shipping_cost_default',    '0'),
  ('email_notifications',      'true'),
  ('order_notification_email', 'admin@cookiesgrandma.id')
ON CONFLICT (key) DO NOTHING;

-- ─── Seed Admin (password: cookiesgrandma2025) ───────────────
-- bcrypt hash of "cookiesgrandma2025" with 12 rounds
INSERT INTO admins (username, password, email, full_name) VALUES (
  'admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oZ7sXVCKm',
  'admin@cookiesgrandma.id',
  'Admin Cookies Grandma'
) ON CONFLICT (username) DO NOTHING;

-- ✅ Done! All tables and seed data created.
-- Next: Deploy to Vercel and set DATABASE_URL environment variable.
