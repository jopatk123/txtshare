const request = require('supertest');

const shareTextModel = require('../src/server/models/shareText');

describe('share page route', () => {
  let app;

  beforeAll(async () => {
    shareTextModel.initDatabase();
    app = require('../src/server/app');
  });

  test('serves share page for valid-looking id path', async () => {
    const res = await request(app).get('/s/Abc12345Z9');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('查看分享');
  });

  test('invalid id path serves expired page', async () => {
    const res = await request(app).get('/s/invalid-id');
    expect(res.status).toBe(200);
    expect(res.text).toContain('失效');
  });
});
