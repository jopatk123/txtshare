/**
 * 静态文件服务测试
 * 验证 Express 能正确提供 vendor JS 文件，状态码和 Content-Type 正确
 */

const request = require('supertest');
const app = require('../src/server/app');

describe('Vendor 静态文件服务', () => {
  describe('GET /js/vendor/marked.min.js', () => {
    test('返回 200 状态码', async () => {
      const res = await request(app).get('/js/vendor/marked.min.js');
      expect(res.status).toBe(200);
    });

    test('Content-Type 为 JavaScript', async () => {
      const res = await request(app).get('/js/vendor/marked.min.js');
      expect(res.headers['content-type']).toMatch(/javascript/);
    });

    test('响应体非空', async () => {
      const res = await request(app).get('/js/vendor/marked.min.js');
      expect(res.text.length).toBeGreaterThan(0);
    });
  });

  describe('GET /js/vendor/purify.min.js', () => {
    test('返回 200 状态码', async () => {
      const res = await request(app).get('/js/vendor/purify.min.js');
      expect(res.status).toBe(200);
    });

    test('Content-Type 为 JavaScript', async () => {
      const res = await request(app).get('/js/vendor/purify.min.js');
      expect(res.headers['content-type']).toMatch(/javascript/);
    });

    test('响应体非空', async () => {
      const res = await request(app).get('/js/vendor/purify.min.js');
      expect(res.text.length).toBeGreaterThan(0);
    });
  });

  describe('不存在的 vendor 文件', () => {
    test('返回 404', async () => {
      const res = await request(app).get('/js/vendor/nonexistent.min.js');
      expect(res.status).toBe(404);
    });
  });
});
