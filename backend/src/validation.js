'use strict';

const { ValidationError } = require('./errors');

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['all', 'active', 'completed'];
const TITLE_MAX = 200;
const QUERY_MAX = 200;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function checkTitle(value, errors) {
  if (typeof value !== 'string') {
    errors.push('title must be a string');
    return undefined;
  }
  const title = value.trim();
  if (title.length === 0) {
    errors.push('title must not be blank');
  } else if (title.length > TITLE_MAX) {
    errors.push(`title must be at most ${TITLE_MAX} characters`);
  } else {
    return title;
  }
  return undefined;
}

function checkCompleted(value, errors) {
  if (typeof value !== 'boolean') {
    errors.push('completed must be a boolean');
    return undefined;
  }
  return value;
}

function checkPriority(value, errors) {
  if (!PRIORITIES.includes(value)) {
    errors.push(`priority must be one of: ${PRIORITIES.join(', ')}`);
    return undefined;
  }
  return value;
}

function checkDueDate(value, errors) {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !isRealDate(value)) {
    errors.push('due_date must be null or a valid date in YYYY-MM-DD format');
    return undefined;
  }
  return value;
}

function has(body, key) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function validateCreate(body) {
  const errors = [];
  if (!isPlainObject(body)) {
    throw new ValidationError(['request body must be a JSON object']);
  }

  const data = {};
  if (!has(body, 'title')) {
    errors.push('title is required');
  } else {
    data.title = checkTitle(body.title, errors);
  }
  data.completed = has(body, 'completed') ? checkCompleted(body.completed, errors) : false;
  data.priority = has(body, 'priority') ? checkPriority(body.priority, errors) : 'medium';
  data.due_date = has(body, 'due_date') ? checkDueDate(body.due_date, errors) : null;

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
  return data;
}

function validateUpdate(body) {
  const errors = [];
  if (!isPlainObject(body)) {
    throw new ValidationError(['request body must be a JSON object']);
  }

  const data = {};
  if (has(body, 'title')) data.title = checkTitle(body.title, errors);
  if (has(body, 'completed')) data.completed = checkCompleted(body.completed, errors);
  if (has(body, 'priority')) data.priority = checkPriority(body.priority, errors);
  if (has(body, 'due_date')) data.due_date = checkDueDate(body.due_date, errors);

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push('provide at least one of: title, completed, priority, due_date');
  }
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
  return data;
}

function validateId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new ValidationError(['id must be a positive integer']);
  }
  return Number(value);
}

function validateFilters(query) {
  const errors = [];
  const filters = { status: 'all', priority: null, q: null };
  const source = isPlainObject(query) ? query : {};

  if (source.status !== undefined) {
    if (typeof source.status === 'string' && STATUSES.includes(source.status)) {
      filters.status = source.status;
    } else {
      errors.push(`status must be one of: ${STATUSES.join(', ')}`);
    }
  }
  if (source.priority !== undefined) {
    if (typeof source.priority === 'string' && PRIORITIES.includes(source.priority)) {
      filters.priority = source.priority;
    } else {
      errors.push(`priority must be one of: ${PRIORITIES.join(', ')}`);
    }
  }
  if (source.q !== undefined) {
    if (typeof source.q !== 'string') {
      errors.push('q must be a single string');
    } else if (source.q.trim().length > QUERY_MAX) {
      errors.push(`q must be at most ${QUERY_MAX} characters`);
    } else if (source.q.trim().length > 0) {
      filters.q = source.q.trim();
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
  return filters;
}

function validateClearCompleted(query) {
  if (!isPlainObject(query) || query.completed !== 'true') {
    throw new ValidationError(['DELETE /api/todos requires the query parameter completed=true']);
  }
}

module.exports = {
  PRIORITIES,
  STATUSES,
  TITLE_MAX,
  validateCreate,
  validateUpdate,
  validateId,
  validateFilters,
  validateClearCompleted,
};
