/**
 * 控制器 500 异常分支测试
 *
 * 通过临时让 model / cache 方法抛错，验证各控制器走 catch 分支时
 * 一律返回 { success: false, error: '服务器错误...' } 且不暴露堆栈。
 */

const request = require('supertest');
const shareTextModel = require('../src/server/models/shareText');
const cache = require('../src/server/middleware/cache');

const TEST_TOKEN = 'test-admin-token-err';
process.env.ADMIN_TOKEN = TEST_TOKEN;

let app;
beforeAll(() => {
  shareTextModel.initDatabase();
  app = require('../src/server/app');
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 公开 API 异常分支 ────────────────────────────────────────────────────────
describe('POST /api/create 异常分支', () => {
  test('模型层抛错时返回 500，不泄漏堆栈', async () => {
    jest.spyOn(shareTextModel, 'createShareText').mockImplementation(() => {
      throw new Error('boom-create');
    });

    const res = await request(app)
      .post('/api/create')
      .send({ content: 'hello', expireType: 'never' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('服务器错误，请稍后重试');
    expect(JSON.stringify(res.body)).not.toContain('boom-create');
  });

  test('ID 全部碰撞（MAX_ID_RETRIES 耗尽）返回 500', async () => {
    jest.spyOn(shareTextModel, 'getShareTextById').mockReturnValue({ id: 'dup' });

    const res = await request(app)
      .post('/api/create')
      .send({ content: 'hello', expireType: 'never' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('生成分享链接失败，请稍后重试');
  });
});

describe('GET /api/text/:id 异常分支', () => {
  test('模型层 getShareTextById 抛错时返回 500', async () => {
    // 缓存未命中才会走模型层
    cache.flush();
    jest.spyOn(shareTextModel, 'getShareTextById').mockImplementation(() => {
      throw new Error('boom-get');
    });

    const res = await request(app).get('/api/text/abcdef1234');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('服务器错误，请稍后重试');
    expect(JSON.stringify(res.body)).not.toContain('boom-get');
  });

  test('incrementViewCount 抛错时返回 500', async () => {
    // 让缓存命中以绕过 getShareTextById
    cache.setWithExpireTime(
      'cachedid1',
      { content: 'x', expireTime: null, createTime: new Date().toISOString(), viewCount: 0 },
      null
    );
    jest.spyOn(shareTextModel, 'incrementViewCount').mockImplementation(() => {
      throw new Error('boom-inc');
    });

    const res = await request(app).get('/api/text/cachedid1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── 管理员 API 异常分支 ──────────────────────────────────────────────────────
const authHeaders = { Authorization: `Bearer ${TEST_TOKEN}` };

describe('Admin 控制器异常分支', () => {
  test('getStats 抛错时返回 500', async () => {
    jest.spyOn(shareTextModel, 'getStats').mockImplementation(() => {
      throw new Error('boom-stats');
    });

    const res = await request(app).get('/api/admin/stats').set(authHeaders);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('服务器错误');
  });

  test('getAuditLogs 抛错时返回 500', async () => {
    jest.spyOn(shareTextModel, 'getAuditLogs').mockImplementation(() => {
      throw new Error('boom-audit');
    });

    const res = await request(app).get('/api/admin/audit-logs').set(authHeaders);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('listShares 抛错时返回 500', async () => {
    jest.spyOn(shareTextModel, 'getAllShareTexts').mockImplementation(() => {
      throw new Error('boom-list');
    });

    const res = await request(app).get('/api/admin/shares').set(authHeaders);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('deleteShare 抛错时返回 500', async () => {
    jest.spyOn(shareTextModel, 'deleteShareTextById').mockImplementation(() => {
      throw new Error('boom-del');
    });

    const res = await request(app).delete('/api/admin/shares/testxyz12').set(authHeaders);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('deleteBatch 抛错时返回 500', async () => {
    jest.spyOn(shareTextModel, 'deleteShareTextsByIds').mockImplementation(() => {
      throw new Error('boom-batch');
    });

    const res = await request(app)
      .delete('/api/admin/shares')
      .set(authHeaders)
      .send({ ids: ['testxyz12'] });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('cleanupExpired 抛错时返回 500', async () => {
    jest.spyOn(shareTextModel, 'getExpiredIds').mockImplementation(() => {
      throw new Error('boom-cleanup');
    });

    const res = await request(app).post('/api/admin/cleanup').set(authHeaders);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
