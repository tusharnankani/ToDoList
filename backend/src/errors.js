'use strict';

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends ApiError {
  constructor(details) {
    super(400, 'Validation failed', details);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Todo not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

module.exports = { ApiError, ValidationError, NotFoundError };
