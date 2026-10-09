'use strict';

const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');

describe('/api/todos', () => {
  let ctx;
  let api;

  beforeEach(() => {
    ctx = createTestApp();
    api = request(ctx.app);
  });
  afterEach(() => {
    if (ctx.db.open) ctx.db.close();
  });

  const create = (body) => api.post('/api/todos').send(body);

  describe('POST /api/todos', () => {
    test('creates a todo with defaults and returns 201', async () => {
      const res = await create({ title: 'Buy milk' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(Number),
        title: 'Buy milk',
        completed: false,
        priority: 'medium',
        due_date: null,
      });
      expect(Date.parse(res.body.created_at)).not.toBeNaN();
      expect(Date.parse(res.body.updated_at)).not.toBeNaN();
    });

    test('trims the title and stores priority and due date', async () => {
      const res = await create({ title: '  Pay rent  ', priority: 'high', due_date: '2030-01-31' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: 'Pay rent', priority: 'high', due_date: '2030-01-31' });
    });

    test.each([
      ['missing title', {}],
      ['blank title', { title: '   ' }],
      ['non-string title', { title: 42 }],
      ['title over 200 chars', { title: 'x'.repeat(201) }],
      ['invalid priority', { title: 'a', priority: 'urgent' }],
      ['invalid due_date format', { title: 'a', due_date: '31/01/2030' }],
      ['impossible due_date', { title: 'a', due_date: '2030-02-31' }],
      ['non-boolean completed', { title: 'a', completed: 'yes' }],
    ])('rejects %s with 400', async (_name, body) => {
      const res = await create(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    test('accepts a title of exactly 200 characters', async () => {
      const res = await create({ title: 'x'.repeat(200) });
      expect(res.status).toBe(201);
    });

    test('rejects a JSON array body with 400', async () => {
      const res = await create([{ title: 'a' }]);
      expect(res.status).toBe(400);
    });

    test('rejects malformed JSON with 400', async () => {
      const res = await api.post('/api/todos').set('Content-Type', 'application/json').send('{"title":');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Malformed JSON body');
    });

    test('rejects an oversized body with 413', async () => {
      const res = await create({ title: 'a', padding: 'x'.repeat(20000) });
      expect(res.status).toBe(413);
    });

    test('stores markup and SQL metacharacters as plain text', async () => {
      const title = `<img src=x onerror=alert(1)>'); DROP TABLE todos;--`;
      const created = await create({ title });
      expect(created.status).toBe(201);
      const list = await api.get('/api/todos');
      expect(list.body.map((t) => t.title)).toEqual([title]);
    });
  });

  describe('GET /api/todos', () => {
    beforeEach(async () => {
      await create({ title: 'Write report', priority: 'high' });
      await create({ title: 'Walk the dog', priority: 'low', completed: true });
      await create({ title: 'Call 100% of clients', priority: 'high', completed: true });
      await create({ title: 'Plan_trip', priority: 'medium' });
    });

    test('lists all todos in creation order', async () => {
      const res = await api.get('/api/todos');
      expect(res.status).toBe(200);
      expect(res.body.map((t) => t.title)).toEqual([
        'Write report', 'Walk the dog', 'Call 100% of clients', 'Plan_trip',
      ]);
    });

    test('filters by status', async () => {
      const active = await api.get('/api/todos?status=active');
      expect(active.body.map((t) => t.title)).toEqual(['Write report', 'Plan_trip']);
      const done = await api.get('/api/todos?status=completed');
      expect(done.body.map((t) => t.title)).toEqual(['Walk the dog', 'Call 100% of clients']);
      const all = await api.get('/api/todos?status=all');
      expect(all.body).toHaveLength(4);
    });

    test('filters by priority', async () => {
      const res = await api.get('/api/todos?priority=high');
      expect(res.body.map((t) => t.title)).toEqual(['Write report', 'Call 100% of clients']);
    });

    test('searches titles case-insensitively with q', async () => {
      const res = await api.get('/api/todos?q=WALK');
      expect(res.body.map((t) => t.title)).toEqual(['Walk the dog']);
    });

    test('treats LIKE wildcards in q literally', async () => {
      const percent = await api.get('/api/todos').query({ q: '100%' });
      expect(percent.body.map((t) => t.title)).toEqual(['Call 100% of clients']);
      const literalUnderscore = await api.get('/api/todos').query({ q: 'n_t' });
      expect(literalUnderscore.body.map((t) => t.title)).toEqual(['Plan_trip']);
      // As an unescaped wildcard, "a_k" would match "alk" in "Walk the dog".
      const wildcardUnderscore = await api.get('/api/todos').query({ q: 'a_k' });
      expect(wildcardUnderscore.body).toEqual([]);
      const wildcard = await api.get('/api/todos').query({ q: '%' });
      expect(wildcard.body.map((t) => t.title)).toEqual(['Call 100% of clients']);
    });

    test('does not allow SQL injection through q', async () => {
      const res = await api.get('/api/todos').query({ q: "' OR 1=1 --" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect((await api.get('/api/todos')).body).toHaveLength(4);
    });

    test('combines filters', async () => {
      const res = await api.get('/api/todos?status=completed&priority=high&q=call');
      expect(res.body.map((t) => t.title)).toEqual(['Call 100% of clients']);
    });

    test.each([
      ['status=bogus'],
      ['priority=urgent'],
      ['q=a&q=b'],
      [`q=${'x'.repeat(201)}`],
    ])('rejects invalid filter %s with 400', async (qs) => {
      const res = await api.get(`/api/todos?${qs}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/todos/:id', () => {
    test('returns the todo', async () => {
      const { body } = await create({ title: 'One' });
      const res = await api.get(`/api/todos/${body.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(body);
    });

    test('returns 404 for an unknown id', async () => {
      const res = await api.get('/api/todos/9999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Todo not found' });
    });

    test.each(['abc', '0', '-1', '1.5', '1e3'])('returns 400 for invalid id %s', async (id) => {
      const res = await api.get(`/api/todos/${id}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/todos/:id', () => {
    test('updates all fields and bumps updated_at', async () => {
      const { body: original } = await create({ title: 'Old', due_date: '2030-01-01' });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const res = await api.put(`/api/todos/${original.id}`).send({
        title: '  New  ', completed: true, priority: 'low', due_date: null,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: original.id, title: 'New', completed: true, priority: 'low', due_date: null,
        created_at: original.created_at,
      });
      expect(res.body.updated_at > original.updated_at).toBe(true);
    });

    test('updates only the provided fields', async () => {
      const { body } = await create({ title: 'Keep', priority: 'high', due_date: '2030-05-05' });
      const res = await api.put(`/api/todos/${body.id}`).send({ completed: true });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        title: 'Keep', priority: 'high', due_date: '2030-05-05', completed: true,
      });
    });

    test('persists completed state across requests', async () => {
      const { body } = await create({ title: 'Persist me' });
      await api.put(`/api/todos/${body.id}`).send({ completed: true });
      const res = await api.get(`/api/todos/${body.id}`);
      expect(res.body.completed).toBe(true);
    });

    test('returns 404 for an unknown id', async () => {
      const res = await api.put('/api/todos/12345').send({ completed: true });
      expect(res.status).toBe(404);
    });

    test.each([
      ['blank title', { title: ' ' }],
      ['bad priority', { priority: 'nope' }],
      ['bad completed', { completed: 1 }],
      ['bad due_date', { due_date: 'tomorrow' }],
      ['no updatable fields', {}],
    ])('rejects %s with 400', async (_name, payload) => {
      const { body } = await create({ title: 'Target' });
      const res = await api.put(`/api/todos/${body.id}`).send(payload);
      expect(res.status).toBe(400);
    });

    test('returns 400 for an invalid id', async () => {
      const res = await api.put('/api/todos/abc').send({ completed: true });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/todos/:id', () => {
    test('deletes only the todo with that id, even with duplicate titles', async () => {
      const first = (await create({ title: 'Same' })).body;
      const second = (await create({ title: 'Same' })).body;

      const res = await api.delete(`/api/todos/${first.id}`);
      expect(res.status).toBe(204);

      const list = (await api.get('/api/todos')).body;
      expect(list.map((t) => t.id)).toEqual([second.id]);
    });

    test('returns 404 when the todo does not exist', async () => {
      const res = await api.delete('/api/todos/777');
      expect(res.status).toBe(404);
    });

    test('returns 400 for an invalid id', async () => {
      const res = await api.delete('/api/todos/abc');
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/todos?completed=true', () => {
    test('removes only completed todos and reports the count', async () => {
      await create({ title: 'Active' });
      await create({ title: 'Done 1', completed: true });
      await create({ title: 'Done 2', completed: true });

      const res = await api.delete('/api/todos?completed=true');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: 2 });

      const list = (await api.get('/api/todos')).body;
      expect(list.map((t) => t.title)).toEqual(['Active']);
    });

    test('returns deleted: 0 when nothing is completed', async () => {
      const res = await api.delete('/api/todos?completed=true');
      expect(res.body).toEqual({ deleted: 0 });
    });

    test.each(['/api/todos', '/api/todos?completed=false', '/api/todos?completed=1'])(
      'refuses to bulk delete without completed=true (%s)',
      async (url) => {
        await create({ title: 'Safe' });
        const res = await api.delete(url);
        expect(res.status).toBe(400);
        expect((await api.get('/api/todos')).body).toHaveLength(1);
      },
    );
  });

  describe('server errors', () => {
    test('returns 500 with a generic message when the database fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      ctx.db.close();
      const res = await api.get('/api/todos');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
      errorSpy.mockRestore();
    });
  });
});
