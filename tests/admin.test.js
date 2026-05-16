/**
 * 管理员 API 测试
 * 覆盖：认证、统计、列表、删除、批量删除、清理
 */

const request = require('supertest');
const shareTextModel = require('../src/server/models/shareText');
const cache = require('../src/server/middleware/cache');

const TEST_TOKEN = 'test-admin-token-12345';
const originalBaseUrl = process.env.BASE_URL;
const originalNodeEnv = process.env.NODE_ENV;
const originalPort = process.env.PORT;

// 必须在 require app 之前设置 ADMIN_TOKEN
process.env.ADMIN_TOKEN = TEST_TOKEN;

// 需要在数据库初始化后加载 app
let app;
beforeAll(async () => {
  await shareTextModel.initDatabase();
  app = require('../src/server/app');
});

afterEach(() => {
  // 每个测试后清理测试数据，避免状态污染
  const db = shareTextModel.getDb();
  db.run("DELETE FROM share_text WHERE id LIKE 'test%'");
  db.run('DELETE FROM audit_log');
  cache.delMultiple(['testA', 'testB', 'testC']);
  if (originalBaseUrl === undefined) delete process.env.BASE_URL;
  else process.env.BASE_URL = originalBaseUrl;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalPort === undefined) delete process.env.PORT;
  else process.env.PORT = originalPort;
});

// ── 辅助：插入测试记录 ──────────────────────────────────────────────────────
function insertShare(id, content = '测试内容', expireTime = null) {
  shareTextModel.createShareText(id, content, expireTime ? new Date(expireTime) : null);
}

// ── 认证测试 ────────────────────────────────────────────────────────────────
describe('Admin 认证', () => {
  test('无令牌时返回 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('错误令牌返回 401', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('X-Admin-Token 头也支持认证', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('X-Admin-Token', TEST_TOKEN);
    expect(res.status).toBe(200);
  });

  test('正确令牌通过认证', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('ADMIN_TOKEN 未配置时返回 503', async () => {
    const original = process.env.ADMIN_TOKEN;
    delete process.env.ADMIN_TOKEN;
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(503);
    process.env.ADMIN_TOKEN = original;
  });
});

// ── 统计接口 ────────────────────────────────────────────────────────────────
describe('GET /api/admin/stats', () => {
  test('返回统计数据结构', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(typeof d.total).toBe('number');
    expect(typeof d.totalViews).toBe('number');
    expect(typeof d.expired).toBe('number');
    expect(typeof d.neverExpire).toBe('number');
  });

  test('过期记录计入 expired', async () => {
    // 使用明确的过去年份，确保 SQLite 字符串比较正确
    insertShare('testExpStat', '过期内容', '2020-01-01T00:00:00.000Z');

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.expired).toBeGreaterThanOrEqual(1);
  });

  test('同日内已过期的 ISO 时间也会计入 expired', async () => {
    insertShare('testSameDayStat', '同日过期内容', new Date(Date.now() - 60 * 1000).toISOString());

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.expired).toBeGreaterThanOrEqual(1);
  });
});

// ── 列表接口 ────────────────────────────────────────────────────────────────
describe('GET /api/admin/shares', () => {
  test('返回分页数据结构', async () => {
    const res = await request(app)
      .get('/api/admin/shares')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(typeof d.total).toBe('number');
    expect(typeof d.page).toBe('number');
    expect(typeof d.limit).toBe('number');
    expect(Array.isArray(d.rows)).toBe(true);
  });

  test('rows 包含必要字段', async () => {
    insertShare('testA', 'Hello World');
    const res = await request(app)
      .get('/api/admin/shares?limit=50')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    const row = res.body.data.rows.find(r => r.id === 'testA');
    expect(row).toBeDefined();
    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('contentPreview');
    expect(row).toHaveProperty('createTime');
    expect(row).toHaveProperty('expireTime');
    expect(row).toHaveProperty('viewCount');
    expect(row).toHaveProperty('url');
    expect(row).toHaveProperty('isExpired');
    expect(row.isExpired).toBe(false);
  });

  test('生产环境未配置 BASE_URL 时列表链接回退到 localhost + PORT', async () => {
    delete process.env.BASE_URL;
    process.env.NODE_ENV = 'production';
    process.env.PORT = '6006';

    insertShare('testA', 'Hello World');
    const res = await request(app)
      .get('/api/admin/shares?limit=50')
      .set('Host', 'evil.example.com')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    const row = res.body.data.rows.find(r => r.id === 'testA');
    expect(row.url).toBe('http://localhost:6006/s/testA');
  });

  test('isExpired 正确标记已过期记录', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    insertShare('testB', '过期记录', past);
    const res = await request(app)
      .get('/api/admin/shares?limit=50')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    const row = res.body.data.rows.find(r => r.id === 'testB');
    expect(row).toBeDefined();
    expect(row.isExpired).toBe(true);
  });

  test('search 按 ID 过滤', async () => {
    insertShare('testA', '内容A');
    insertShare('testB', '内容B');
    const res = await request(app)
      .get('/api/admin/shares?search=testA&limit=50')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    const rows = res.body.data.rows;
    expect(rows.every(r => r.id.includes('testA'))).toBe(true);
  });

  test('limit 参数最大不超过 100', async () => {
    const res = await request(app)
      .get('/api/admin/shares?limit=9999')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.body.data.limit).toBe(100);
  });

  test('page 参数不能低于 1', async () => {
    const res = await request(app)
      .get('/api/admin/shares?page=0')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.body.data.page).toBe(1);
  });
});

// ── 删除单条 ────────────────────────────────────────────────────────────────
describe('DELETE /api/admin/shares/:id', () => {
  test('删除存在的记录返回 success', async () => {
    insertShare('testA', '要删除的内容');
    const res = await request(app)
      .delete('/api/admin/shares/testA')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // 确认已删除
    expect(shareTextModel.getShareTextById('testA')).toBeNull();

    const [log] = shareTextModel.getAuditLogs({ limit: 1 });
    expect(log.action).toBe('admin.deleteShare');
    expect(log.target).toBe('testA');
  });

  test('删除不存在的记录返回 404', async () => {
    const res = await request(app)
      .delete('/api/admin/shares/nonexistentid999')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('无效 ID（含特殊字符）返回 400', async () => {
    // Express 会规范化路径，所以用含连字符/非字母数字的合法路径段测试
    const res = await request(app)
      .delete('/api/admin/shares/invalid-id-with-dashes')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── 批量删除 ────────────────────────────────────────────────────────────────
describe('DELETE /api/admin/shares (batch)', () => {
  test('批量删除多条记录', async () => {
    insertShare('testA', '内容A');
    insertShare('testB', '内容B');
    const res = await request(app)
      .delete('/api/admin/shares')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ ids: ['testA', 'testB'] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBe(2);
    expect(shareTextModel.getShareTextById('testA')).toBeNull();
    expect(shareTextModel.getShareTextById('testB')).toBeNull();

    const [log] = shareTextModel.getAuditLogs({ limit: 1 });
    expect(log.action).toBe('admin.deleteBatch');
    expect(log.detail.deleted).toBe(2);
  });

  test('ids 为空数组返回 400', async () => {
    const res = await request(app)
      .delete('/api/admin/shares')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ ids: [] });
    expect(res.status).toBe(400);
  });

  test('ids 非数组返回 400', async () => {
    const res = await request(app)
      .delete('/api/admin/shares')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ ids: 'testA' });
    expect(res.status).toBe(400);
  });

  test('超过 200 条记录返回 400', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `testid${i}`);
    const res = await request(app)
      .delete('/api/admin/shares')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ ids });
    expect(res.status).toBe(400);
  });

  test('无效 ID 被过滤，只删除合法 ID', async () => {
    insertShare('testA', '内容A');
    const res = await request(app)
      .delete('/api/admin/shares')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ ids: ['testA', '../evil', '<script>'] });
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(1);
  });
});

// ── 清理过期 ────────────────────────────────────────────────────────────────
describe('POST /api/admin/cleanup', () => {
  test('清理过期记录返回删除数量', async () => {
    // 使用明确的过去年份，确保 SQLite 字符串比较正确
    insertShare('testA', '过期1', '2020-01-01T00:00:00.000Z');
    insertShare('testB', '过期2', '2020-01-02T00:00:00.000Z');
    insertShare('testC', '永久', null);

    const res = await request(app)
      .post('/api/admin/cleanup')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBeGreaterThanOrEqual(2);
    // 永久记录不被删除
    expect(shareTextModel.getShareTextById('testC')).not.toBeNull();

    const [log] = shareTextModel.getAuditLogs({ limit: 1 });
    expect(log.action).toBe('admin.cleanupExpired');
    expect(log.detail.deleted).toBeGreaterThanOrEqual(2);
  });

  test('同日内已过期的 ISO 时间会被清理', async () => {
    insertShare('testSameDayCleanup', '同日过期', new Date(Date.now() - 60 * 1000).toISOString());

    const res = await request(app)
      .post('/api/admin/cleanup')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBeGreaterThanOrEqual(1);
    expect(shareTextModel.getShareTextById('testSameDayCleanup')).toBeNull();
  });

  test('无过期记录时 deleted 为 0', async () => {
    // 先清理所有过期记录
    shareTextModel.deleteExpiredRecords();

    const res = await request(app)
      .post('/api/admin/cleanup')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(0);
  });
});

// ── 管理员页面 ──────────────────────────────────────────────────────────────
describe('GET /admin/', () => {
  test('返回 200 和 HTML 页面', async () => {
    const res = await request(app).get('/admin/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).not.toContain('sessionStorage');
    expect(res.text).toContain('令牌仅保存在当前页面内存');
  });

  test('GET /admin 重定向到 /admin/', async () => {
    // express.static 对目录请求发出 301 重定向
    const res = await request(app).get('/admin');
    expect([301, 302]).toContain(res.status);
    expect(res.headers.location).toMatch(/\/admin\//);
  });
});

describe('GET /api/admin/audit-logs', () => {
  test('返回审计日志列表', async () => {
    insertShare('testA', '审计内容');
    await request(app)
      .delete('/api/admin/shares/testA')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    const res = await request(app)
      .get('/api/admin/audit-logs?limit=5')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.rows)).toBe(true);
    expect(res.body.data.rows[0]).toHaveProperty('action');
    expect(res.body.data.rows[0]).toHaveProperty('actorIp');
  });
});
