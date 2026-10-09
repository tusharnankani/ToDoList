'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

function openDatabase(dbPath = config.DB_PATH) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  return db;
}

function applySchema(db) {
  db.exec(fs.readFileSync(config.SCHEMA_PATH, 'utf8'));
}

function applySeed(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM todos').get();
  if (count > 0) {
    return false;
  }
  db.exec(fs.readFileSync(config.SEED_PATH, 'utf8'));
  return true;
}

module.exports = { openDatabase, applySchema, applySeed };
