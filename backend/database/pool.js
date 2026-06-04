/**
 * Cookies Grandma — PostgreSQL Connection Pool
 * Uses the `pg` package with connection pooling.
 * DATABASE_URL is provided automatically by Render.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }   // Required for Render PostgreSQL
    : false,
  max: 10,              // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = pool;
