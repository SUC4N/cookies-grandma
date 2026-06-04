/**
 * PostgreSQL connection pool — Supabase compatible
 * Cached at module level so Vercel serverless reuses connections.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
  max: 3,                             // Small pool for serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('DB pool error:', err.message));

module.exports = pool;
