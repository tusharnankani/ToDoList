'use strict';

const { createTodoService } = require('../../backend/src/services/todoService');
const { NotFoundError, ValidationError } = require('../../backend/src/errors');

function fakeRepository(overrides = {}) {
  return {
    findAll: jest.fn(() => []),
    findById: jest.fn(() => null),
    create: jest.fn((data) => ({ id: 1, ...data })),
    update: jest.fn(() => null),
    delete: jest.fn(() => false),
    deleteCompleted: jest.fn(() => 0),
    ...overrides,
  };
}

describe('todoService', () => {
  test('list passes validated filters to the repository', () => {
    const repo = fakeRepository();
    createTodoService(repo).list({ status: 'completed', q: ' a ' });
    expect(repo.findAll).toHaveBeenCalledWith({ status: 'completed', priority: null, q: 'a' });
  });

  test('list rejects invalid filters before touching the repository', () => {
    const repo = fakeRepository();
    expect(() => createTodoService(repo).list({ status: 'bad' })).toThrow(ValidationError);
    expect(repo.findAll).not.toHaveBeenCalled();
  });

  test('get throws NotFoundError when missing', () => {
    expect(() => createTodoService(fakeRepository()).get('5')).toThrow(NotFoundError);
  });

  test('get returns the todo', () => {
    const repo = fakeRepository({ findById: jest.fn(() => ({ id: 5 })) });
    expect(createTodoService(repo).get('5')).toEqual({ id: 5 });
    expect(repo.findById).toHaveBeenCalledWith(5);
  });

  test('create validates and normalises input', () => {
    const repo = fakeRepository();
    createTodoService(repo).create({ title: '  x ' });
    expect(repo.create).toHaveBeenCalledWith({
      title: 'x', completed: false, priority: 'medium', due_date: null,
    });
  });

  test('create does not call the repository on invalid input', () => {
    const repo = fakeRepository();
    expect(() => createTodoService(repo).create({ title: '' })).toThrow(ValidationError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  test('update throws NotFoundError when the repository finds nothing', () => {
    expect(() => createTodoService(fakeRepository()).update('3', { completed: true }))
      .toThrow(NotFoundError);
  });

  test('update validates the id and body first', () => {
    const repo = fakeRepository();
    const service = createTodoService(repo);
    expect(() => service.update('abc', { completed: true })).toThrow(ValidationError);
    expect(() => service.update('3', {})).toThrow(ValidationError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  test('update returns the updated todo', () => {
    const repo = fakeRepository({ update: jest.fn(() => ({ id: 3, completed: true })) });
    expect(createTodoService(repo).update('3', { completed: true })).toEqual({ id: 3, completed: true });
    expect(repo.update).toHaveBeenCalledWith(3, { completed: true });
  });

  test('remove throws NotFoundError when nothing was deleted', () => {
    expect(() => createTodoService(fakeRepository()).remove('3')).toThrow(NotFoundError);
  });

  test('remove succeeds when the repository deleted a row', () => {
    const repo = fakeRepository({ delete: jest.fn(() => true) });
    expect(() => createTodoService(repo).remove('3')).not.toThrow();
  });

  test('removeCompleted requires completed=true and reports the count', () => {
    const repo = fakeRepository({ deleteCompleted: jest.fn(() => 4) });
    const service = createTodoService(repo);
    expect(() => service.removeCompleted({})).toThrow(ValidationError);
    expect(repo.deleteCompleted).not.toHaveBeenCalled();
    expect(service.removeCompleted({ completed: 'true' })).toEqual({ deleted: 4 });
  });
});
