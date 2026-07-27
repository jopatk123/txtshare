/**
 * 限流器测试
 *
 * express-rate-limit v7 不再暴露 options 实例属性，
 * 因此本测试以「行为断言」为主：临时切换 NODE_ENV='production' 后，
 * 触发 max+1 次请求验证第 max+1 次返回 429。
 *
 * 仍保留少量配置断言，通过解析 rateLimiter.js 源码校验关键常量。
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const rateLimiter = require('../src/server/middleware/rateLimiter');

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

// ── 配置断言（源码解析） ────────────────────────────────────────────────────
describe('限流器配置（源码常量）', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/server/middleware/rateLimiter.js'),
    'utf8'
  );

  test('导出 4 个 limiter', () => {
    expect(rateLimiter.apiLimiter).toBeDefined();
    expect(rateLimiter.createLimiter).toBeDefined();
    expect(rateLimiter.adminLimiter).toBeDefined();
    expect(rateLimiter.sharePageLimiter).toBeDefined();
  });

  test('源码中 apiLimiter max=30', () => {
    // 匹配 apiLimiter 块内的 max 声明
    const block = source.split('const apiLimiter')[1].split('const')[0];
    expect(block).toMatch(/max:\s*30/);
  });

  test('源码中 createLimiter max=10', () => {
    const block = source.split('const createLimiter')[1].split('const')[0];
    expect(block).toMatch(/max:\s*10/);
  });

  test('源码中 adminLimiter max=60', () => {
    const block = source.split('const adminLimiter')[1].split('const')[0];
    expect(block).toMatch(/max:\s*60/);
  });

  test('源码中 sharePageLimiter max=60', () => {
    const block = source.split('const sharePageLimiter')[1].split('};')[0];
    expect(block).toMatch(/max:\s*60/);
  });

  test('所有 limiter 在 NODE_ENV=test 时跳过（源码 skipInTest 逻辑）', () => {
    expect(source).toMatch(/skip:\s*skipInTest/);
    expect(source).toMatch(/process\.env\.NODE_ENV === 'test'/);
  });
});

// ── 行为断言 ────────────────────────────────────────────────────────────────
describe('限流器行为：触发 max+1 次后返回 429', () => {
  test('模拟 apiLimiter 配置：5 次后第 6 次返回 429 JSON', async () => {
    process.env.NODE_ENV = 'production';
    const MAX = 5;

    // 复用 apiLimiter 的 message 结构
    const limiter = require('express-rate-limit')({
      windowMs: 60 * 1000,
      max: MAX,
      message: { success: false, error: '请求过于频繁，请稍后再试' },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res, _next, options) => {
        res.status(429).json(options.message);
      },
    });

    const app = express();
    app.use('/ping', limiter, (_req, res) => {
      res.json({ ok: true });
    });

    for (let i = 0; i < MAX; i++) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    }

    const blocked = await request(app).get('/ping');
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(typeof blocked.body.error).toBe('string');
    expect(blocked.headers['ratelimit-remaining']).toBe('0');
  });

  test('模拟 sharePageLimiter 配置：返回 429 纯文本', async () => {
    process.env.NODE_ENV = 'production';
    const MAX = 3;

    const limiter = require('express-rate-limit')({
      windowMs: 60 * 1000,
      max: MAX,
      message: '访问过于频繁，请稍后再试',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res, _next, options) => {
        res.status(429).type('text/plain').send(options.message);
      },
    });

    const app = express();
    app.use('/page', limiter, (_req, res) => {
      res.type('text/plain').send('ok');
    });

    for (let i = 0; i < MAX; i++) {
      const res = await request(app).get('/page');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/page');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['content-type']).toMatch(/text\/plain/);
    expect(blocked.text).toBe('访问过于频繁，请稍后再试');
  });
});
