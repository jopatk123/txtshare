const request = require('supertest');

describe('Security headers', () => {
  let app;

  beforeAll(async () => {
    const shareTextModel = require('../src/server/models/shareText');
    shareTextModel.initDatabase();
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

  test('CSP script-src does not allow unsafe-inline', async () => {
    const res = await request(app).get('/');
    const csp = res.headers['content-security-policy'];
    // script-src 段应为 'self' 且不含 unsafe-inline（style-src 仍允许）
    expect(csp).toMatch(/script-src 'self';/);
    const scriptSrcPart = csp.match(/script-src [^;]+/)[0];
    expect(scriptSrcPart).not.toContain('unsafe-inline');
  });

  test('health endpoint responds with ok payload', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  test('health endpoint includes database and cache checks', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBe(true);
    expect(res.body.checks.cache).toBe(true);
  });

  test('liveness endpoint always returns 200', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('live');
  });

  test('readiness endpoint returns 200 when DB and cache are healthy', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.database).toBe(true);
    expect(res.body.checks.cache).toBe(true);
  });
});
