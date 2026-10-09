'use strict';

const express = require('express');

function createTodoRouter(service) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(service.list(req.query));
  });

  router.post('/', (req, res) => {
    res.status(201).json(service.create(req.body));
  });

  router.delete('/', (req, res) => {
    res.json(service.removeCompleted(req.query));
  });

  router.get('/:id', (req, res) => {
    res.json(service.get(req.params.id));
  });

  router.put('/:id', (req, res) => {
    res.json(service.update(req.params.id, req.body));
  });

  router.delete('/:id', (req, res) => {
    service.remove(req.params.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createTodoRouter };
