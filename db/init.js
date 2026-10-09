'use strict';

// Usage: node db/init.js [--no-seed]
// Applies db/schema.sql, then db/seed.sql if the todos table is empty.

const config = require('../backend/src/config');
const { openDatabase, applySchema, applySeed } = require('../backend/src/db');

const skipSeed = process.argv.includes('--no-seed');
const db = openDatabase(config.DB_PATH);

try {
  applySchema(db);
  console.log(`Schema applied: ${config.DB_PATH}`);
  if (skipSeed) {
    console.log('Seed skipped (--no-seed).');
  } else if (applySeed(db)) {
    console.log('Seed data inserted.');
  } else {
    console.log('Seed skipped: todos table already has rows.');
  }
} finally {
  db.close();
}
