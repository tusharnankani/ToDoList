'use strict';

const { openDatabase, applySchema, applySeed } = require('../../backend/src/db');
const { createTodoRepository, escapeLike } = require('../../backend/src/repositories/todoRepository');

describe('todoRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = openDatabase(':memory:');
    applySchema(db);
    repo = createTodoRepository(db);
  });
  afterEach(() => db.close());

  const add = (title, extra = {}) => repo.create({
    title, completed: false, priority: 'medium', due_date: null, ...extra,
  });

  test('create returns the stored row with a boolean completed flag', () => {
    const todo = add('A', { completed: true, priority: 'high', due_date: '2031-01-01' });
    expect(todo).toMatchObject({
      id: 1, title: 'A', completed: true, priority: 'high', due_date: '2031-01-01',
    });
    expect(typeof todo.created_at).toBe('string');
  });

  test('findById returns null for a missing row', () => {
    expect(repo.findById(42)).toBeNull();
  });

  test('findAll filters by status, priority and text', () => {
    add('Alpha', { priority: 'high' });
    add('Beta', { completed: true });
    add('Alphabet', { completed: true, priority: 'high' });

    expect(repo.findAll({ status: 'active' }).map((t) => t.title)).toEqual(['Alpha']);
    expect(repo.findAll({ status: 'completed' }).map((t) => t.title)).toEqual(['Beta', 'Alphabet']);
    expect(repo.findAll({ priority: 'high' }).map((t) => t.title)).toEqual(['Alpha', 'Alphabet']);
    expect(repo.findAll({ q: 'alpha' }).map((t) => t.title)).toEqual(['Alpha', 'Alphabet']);
    expect(repo.findAll({ status: 'completed', priority: 'high', q: 'bet' }).map((t) => t.title))
      .toEqual(['Alphabet']);
  });

  test('update changes only the given fields and can clear due_date', () => {
    const todo = add('Old', { due_date: '2031-01-01', priority: 'low' });
    const updated = repo.update(todo.id, { title: 'New', due_date: null });
    expect(updated).toMatchObject({ title: 'New', due_date: null, priority: 'low', completed: false });
  });

  test('update returns null when the row does not exist', () => {
    expect(repo.update(99, { title: 'x' })).toBeNull();
  });

  test('delete removes by id only', () => {
    const a = add('Same');
    const b = add('Same');
    expect(repo.delete(a.id)).toBe(true);
    expect(repo.delete(a.id)).toBe(false);
    expect(repo.findAll().map((t) => t.id)).toEqual([b.id]);
  });

  test('deleteCompleted returns the number of removed rows', () => {
    add('x');
    add('y', { completed: true });
    add('z', { completed: true });
    expect(repo.deleteCompleted()).toBe(2);
    expect(repo.findAll()).toHaveLength(1);
  });

  test('the schema itself rejects invalid rows', () => {
    const insert = (title, priority = 'low') =>
      db.prepare('INSERT INTO todos (title, priority) VALUES (?, ?)').run(title, priority);
    expect(() => insert('')).toThrow();
    expect(() => insert('   ')).toThrow();
    expect(() => insert(' padded ')).toThrow();
    expect(() => insert('x'.repeat(201))).toThrow();
    expect(() => insert('ok', 'urgent')).toThrow();
    expect(() => insert('x'.repeat(200))).not.toThrow();
  });

  test('applySeed inserts sample rows once and only into an empty table', () => {
    expect(applySeed(db)).toBe(true);
    const count = db.prepare('SELECT COUNT(*) AS c FROM todos').get().c;
    expect(count).toBeGreaterThan(0);
    expect(applySeed(db)).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS c FROM todos').get().c).toBe(count);
  });

  test('applySchema is idempotent', () => {
    add('keep');
    expect(() => applySchema(db)).not.toThrow();
    expect(repo.findAll()).toHaveLength(1);
  });

  test('escapeLike escapes %, _ and backslash', () => {
    expect(escapeLike('50%_\\')).toBe('50\\%\\_\\\\');
  });
});
