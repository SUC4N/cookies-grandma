/**
 * Cookies Grandma — Database Connection
 * Uses Node.js built-in node:sqlite (Node v22.5+) — no compilation needed!
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'cookiesgrandma.db');

// Auto-setup if DB doesn't exist yet
if (!fs.existsSync(DB_PATH)) {
  console.log('⚙️  Database not found. Running setup...');
  require('./setup');
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

module.exports = db;
