'use strict';

const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');

describe('GET /api/health', () => {
  let ctx;
  beforeEach(() => { ctx = createTestApp(); });
  afterEach(() => ctx.db.close());

  test('returns {"status":"ok"}', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('unknown API routes return a JSON 404', async () => {
    const res = await request(ctx.app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  test('serves the frontend page but not backend source files', async () => {
    const page = await request(ctx.app).get('/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('data-testid="todo-input"');

    const leak = await request(ctx.app).get('/package.json');
    expect(leak.status).toBe(404);
    const leak2 = await request(ctx.app).get('/backend/server.js');
    expect(leak2.status).toBe(404);
  });
});
