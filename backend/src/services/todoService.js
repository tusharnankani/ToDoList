'use strict';

const { NotFoundError } = require('../errors');
const validation = require('../validation');

function createTodoService(repository) {
  function getOrThrow(id) {
    const todo = repository.findById(id);
    if (!todo) {
      throw new NotFoundError();
    }
    return todo;
  }

  return {
    list(query) {
      return repository.findAll(validation.validateFilters(query));
    },

    get(rawId) {
      return getOrThrow(validation.validateId(rawId));
    },

    create(body) {
      return repository.create(validation.validateCreate(body));
    },

    update(rawId, body) {
      const id = validation.validateId(rawId);
      const fields = validation.validateUpdate(body);
      const updated = repository.update(id, fields);
      if (!updated) {
        throw new NotFoundError();
      }
      return updated;
    },

    remove(rawId) {
      const id = validation.validateId(rawId);
      if (!repository.delete(id)) {
        throw new NotFoundError();
      }
    },

    removeCompleted(query) {
      validation.validateClearCompleted(query);
      return { deleted: repository.deleteCompleted() };
    },
  };
}

module.exports = { createTodoService };
