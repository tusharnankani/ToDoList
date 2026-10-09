'use strict';

const { openDatabase, applySchema } = require('../../backend/src/db');
const { createApp } = require('../../backend/src/app');

function createTestApp() {
  const db = openDatabase(':memory:');
  applySchema(db);
  return { db, app: createApp({ db }) };
}

module.exports = { createTestApp };
