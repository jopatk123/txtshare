const request = require('supertest');

describe('Security headers', () => {
  let app;

  beforeAll(async () => {
    const shareTextModel = require('../src/server/models/shareText');
    await shareTextModel.initDatabase();
    app = require('../src/server/app');
  });

  test('sets baseline security headers on root response', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('health endpoint responds with ok payload', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});
