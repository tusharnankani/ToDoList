'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');
const { createTodoRepository } = require('./repositories/todoRepository');
const { createTodoService } = require('./services/todoService');
const { createTodoRouter } = require('./routes/todos');
const { createHealthRouter } = require('./routes/health');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp({ db, frontendDir = config.FRONTEND_DIR } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  const service = createTodoService(createTodoRepository(db));
  app.use('/api/health', createHealthRouter());
  app.use('/api/todos', createTodoRouter(service));
  app.use('/api', notFoundHandler);

  // Serve only the frontend assets, never the repository root.
  app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
  for (const dir of ['JS', 'CSS', 'assets']) {
    app.use(`/${dir}`, express.static(path.join(frontendDir, dir)));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
