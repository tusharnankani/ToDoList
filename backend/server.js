'use strict';

const config = require('./src/config');
const { openDatabase, applySchema } = require('./src/db');
const { createApp } = require('./src/app');

const db = openDatabase(config.DB_PATH);
applySchema(db);

const server = createApp({ db }).listen(config.PORT, config.HOST, () => {
  console.log(`ToDoList listening on http://${config.HOST}:${config.PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
