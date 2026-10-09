'use strict';

const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

module.exports = {
  ROOT_DIR,
  PORT: Number.parseInt(process.env.PORT, 10) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  DB_PATH: process.env.DB_PATH || path.join(ROOT_DIR, 'db', 'todos.sqlite'),
  SCHEMA_PATH: path.join(ROOT_DIR, 'db', 'schema.sql'),
  SEED_PATH: path.join(ROOT_DIR, 'db', 'seed.sql'),
  FRONTEND_DIR: process.env.FRONTEND_DIR || ROOT_DIR,
};
