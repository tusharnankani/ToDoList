'use strict';

const v = require('../../backend/src/validation');
const { ValidationError } = require('../../backend/src/errors');

describe('validateCreate', () => {
  test('applies defaults and trims the title', () => {
    expect(v.validateCreate({ title: '  hi  ' })).toEqual({
      title: 'hi', completed: false, priority: 'medium', due_date: null,
    });
  });

  test('accepts all fields', () => {
    expect(v.validateCreate({
      title: 'x', completed: true, priority: 'low', due_date: '2024-02-29',
    })).toEqual({ title: 'x', completed: true, priority: 'low', due_date: '2024-02-29' });
  });

  test('ignores unknown and read-only fields', () => {
    const data = v.validateCreate({ title: 'x', id: 99, created_at: 'now', extra: 1 });
    expect(Object.keys(data).sort()).toEqual(['completed', 'due_date', 'priority', 'title']);
  });

  test.each([null, undefined, 'text', 5, []])('rejects non-object body %p', (body) => {
    expect(() => v.validateCreate(body)).toThrow(ValidationError);
  });

  test('collects every problem', () => {
    try {
      v.validateCreate({ title: '', priority: 'x', due_date: 'y', completed: 'z' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.status).toBe(400);
      expect(error.details).toHaveLength(4);
    }
  });

  test('rejects 2023-02-29 (not a leap year) but accepts 2024-02-29', () => {
    expect(() => v.validateCreate({ title: 'x', due_date: '2023-02-29' })).toThrow(ValidationError);
    expect(v.validateCreate({ title: 'x', due_date: '2024-02-29' }).due_date).toBe('2024-02-29');
  });
});

describe('validateUpdate', () => {
  test('returns only provided fields', () => {
    expect(v.validateUpdate({ completed: true })).toEqual({ completed: true });
    expect(v.validateUpdate({ due_date: null })).toEqual({ due_date: null });
  });

  test('requires at least one updatable field', () => {
    expect(() => v.validateUpdate({})).toThrow(ValidationError);
    expect(() => v.validateUpdate({ id: 1 })).toThrow(ValidationError);
  });

  test('validates provided fields', () => {
    expect(() => v.validateUpdate({ title: '   ' })).toThrow(ValidationError);
    expect(() => v.validateUpdate({ priority: 'nope' })).toThrow(ValidationError);
  });
});

describe('validateId', () => {
  test('parses positive integers', () => {
    expect(v.validateId('12')).toBe(12);
  });

  test.each(['0', '-3', '1.2', 'abc', '', '01', '9007199254740993', undefined, 5])(
    'rejects %p', (value) => {
      expect(() => v.validateId(value)).toThrow(ValidationError);
    },
  );
});

describe('validateFilters', () => {
  test('defaults', () => {
    expect(v.validateFilters({})).toEqual({ status: 'all', priority: null, q: null });
    expect(v.validateFilters(undefined)).toEqual({ status: 'all', priority: null, q: null });
  });

  test('accepts valid values and trims q', () => {
    expect(v.validateFilters({ status: 'active', priority: 'high', q: '  milk ' }))
      .toEqual({ status: 'active', priority: 'high', q: 'milk' });
  });

  test('treats a blank q as no search', () => {
    expect(v.validateFilters({ q: '   ' }).q).toBeNull();
  });

  test('rejects bad values', () => {
    expect(() => v.validateFilters({ status: 'x' })).toThrow(ValidationError);
    expect(() => v.validateFilters({ priority: ['low'] })).toThrow(ValidationError);
    expect(() => v.validateFilters({ q: ['a', 'b'] })).toThrow(ValidationError);
  });
});

describe('validateClearCompleted', () => {
  test('only accepts completed=true', () => {
    expect(() => v.validateClearCompleted({ completed: 'true' })).not.toThrow();
    expect(() => v.validateClearCompleted({ completed: 'false' })).toThrow(ValidationError);
    expect(() => v.validateClearCompleted({})).toThrow(ValidationError);
  });
});
