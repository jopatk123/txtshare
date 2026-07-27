/**
 * 公开分享 API 集成测试
 * 覆盖：创建分享、获取分享、边界校验、过期处理、缓存命中、API 404
 */

const request = require('supertest');
const shareTextModel = require('../src/server/models/shareText');
const cache = require('../src/server/middleware/cache');
const originalBaseUrl = process.env.BASE_URL;
const originalNodeEnv = process.env.NODE_ENV;
const originalPort = process.env.PORT;

let app;
beforeAll(async () => {
  shareTextModel.initDatabase();
  app = require('../src/server/app');
});

afterEach(() => {
  const db = shareTextModel.getDb();
  db.exec("DELETE FROM share_text WHERE id LIKE 'test%'");
  cache.flush();
  if (originalBaseUrl === undefined) delete process.env.BASE_URL;
  else process.env.BASE_URL = originalBaseUrl;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalPort === undefined) delete process.env.PORT;
  else process.env.PORT = originalPort;
});

// ── POST /api/create ─────────────────────────────────────────────────────────

describe('POST /api/create', () => {
  test('成功创建，返回 id / url / expireTime', async () => {
    const res = await request(app)
      .post('/api/create')
      .send({ content: 'hello world', expireType: 'never' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('url');
    expect(res.body.data.expireTime).toBeNull();
    expect(res.body.data.expireTimeFormatted).toBe('永不过期');
  });

  test('1h 过期类型返回约 1 小时后的过期时间', async () => {
    const before = Date.now();
    const res = await request(app)
      .post('/api/create')
      .send({ content: 'expire soon', expireType: '1h' });

    expect(res.status).toBe(200);
    const expireMs = new Date(res.body.data.expireTime).getTime();
    expect(expireMs).toBeGreaterThan(before + 59 * 60 * 1000);
    expect(expireMs).toBeLessThan(before + 61 * 60 * 1000);
  });

  test('7d 过期类型返回约 7 天后的过期时间', async () => {
    const before = Date.now();
    const res = await request(app)
      .post('/api/create')
      .send({ content: 'expire week', expireType: '7d' });

    expect(res.status).toBe(200);
    const expireMs = new Date(res.body.data.expireTime).getTime();
    expect(expireMs).toBeGreaterThan(before + 6 * 24 * 60 * 60 * 1000);
    expect(expireMs).toBeLessThan(before + 8 * 24 * 60 * 60 * 1000);
  });

  test('custom 类型使用 expireDays 参数', async () => {
    const before = Date.now();
    const res = await request(app)
      .post('/api/create')
      .send({ content: 'custom days', expireType: 'custom', expireDays: 5 });

    expect(res.status).toBe(200);
    const expireMs = new Date(res.body.data.expireTime).getTime();
    expect(expireMs).toBeGreaterThan(before + 4 * 24 * 60 * 60 * 1000);
    expect(expireMs).toBeLessThan(before + 6 * 24 * 60 * 60 * 1000);
  });

  test('缺少 content 字段返回 400', async () => {
    const res = await request(app).post('/api/create').send({ expireType: 'never' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('空字符串 content 返回 400', async () => {
    const res = await request(app).post('/api/create').send({ content: '', expireType: 'never' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('仅空格 content 返回 400', async () => {
    const res = await request(app)
      .post('/api/create')
      .send({ content: '   ', expireType: 'never' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('无效 expireType 返回 400', async () => {
    const res = await request(app)
      .post('/api/create')
      .send({ content: '内容', expireType: 'invalid-type' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('custom expireType 缺少 expireDays 返回 400', async () => {
    const res = await request(app)
      .post('/api/create')
      .send({ content: '内容', expireType: 'custom' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('custom expireDays 超出范围（366）返回 400', async () => {
    const res = await request(app)
      .post('/api/create')
      .send({ content: '内容', expireType: 'custom', expireDays: 366 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('custom expireDays 为 0 返回 400', async () => {
    const res = await request(app)
      .post('/api/create')
      .send({ content: '内容', expireType: 'custom', expireDays: 0 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('未提供 expireType 时默认永不过期', async () => {
    const res = await request(app).post('/api/create').send({ content: '无过期字段' });

    expect(res.status).toBe(200);
    expect(res.body.data.expireTime).toBeNull();
  });

  test('分享链接包含正确的 /s/:id 路径', async () => {
    const res = await request(app)
      .post('/api/create')
      .send({ content: 'url test', expireType: 'never' });

    expect(res.body.data.url).toMatch(/\/s\/[A-Za-z0-9]{8,16}$/);
  });

  test('生产环境未配置 BASE_URL 时回退到 localhost + PORT，而不是 undefined', async () => {
    delete process.env.BASE_URL;
    process.env.NODE_ENV = 'production';
    process.env.PORT = '6006';

    const res = await request(app)
      .post('/api/create')
      .set('Host', 'evil.example.com')
      .send({ content: 'prod url fallback', expireType: 'never' });

    expect(res.status).toBe(200);
    expect(res.body.data.url).toMatch(/^http:\/\/localhost:6006\/s\/[A-Za-z0-9]{8,16}$/);
  });
});

// ── GET /api/text/:id ────────────────────────────────────────────────────────

describe('GET /api/text/:id', () => {
  test('获取已创建的分享内容', async () => {
    const createRes = await request(app)
      .post('/api/create')
      .send({ content: 'read test content', expireType: 'never' });

    const { id } = createRes.body.data;
    const res = await request(app).get(`/api/text/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('read test content');
    expect(res.body.data).toHaveProperty('createTime');
    expect(res.body.data).toHaveProperty('expireTime');
    expect(res.body.data).toHaveProperty('expireTimeFormatted');
  });

  test('不存在的 ID 返回 404', async () => {
    const res = await request(app).get('/api/text/notfound99');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('格式不合法的 ID（过短）返回 400', async () => {
    const res = await request(app).get('/api/text/abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('含特殊字符的 ID 返回 400', async () => {
    // Express 对 / 和 % 做 URL 解码，用合法路径段但含非法字符
    const res = await request(app).get('/api/text/badid--abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('已过期的分享返回 410', async () => {
    shareTextModel.createShareText('testExpR001', '过期内容', new Date(Date.now() - 1000));

    const res = await request(app).get('/api/text/testExpR001');

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
  });

  test('缓存命中时仍能正确返回内容', async () => {
    const createRes = await request(app)
      .post('/api/create')
      .send({ content: 'cache test', expireType: 'never' });

    const { id } = createRes.body.data;

    // 第一次请求（可能命中缓存，也可能填充缓存）
    const res1 = await request(app).get(`/api/text/${id}`);
    // 第二次请求必定命中缓存
    const res2 = await request(app).get(`/api/text/${id}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res2.body.data.content).toBe('cache test');
  });

  test('每次访问后 viewCount 自增', async () => {
    const createRes = await request(app)
      .post('/api/create')
      .send({ content: 'view count test', expireType: 'never' });

    const { id } = createRes.body.data;

    await request(app).get(`/api/text/${id}`);
    await request(app).get(`/api/text/${id}`);

    // better-sqlite3 同步写入，无需 flush
    const record = shareTextModel.getShareTextById(id);
    expect(record.view_count).toBeGreaterThanOrEqual(2);
  });

  test('中文内容可以完整存取', async () => {
    const createRes = await request(app)
      .post('/api/create')
      .send({ content: '你好，世界！这是中文测试内容。', expireType: 'never' });

    const { id } = createRes.body.data;
    const res = await request(app).get(`/api/text/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('你好，世界！这是中文测试内容。');
  });
});

// ── 未知 API 路径 ─────────────────────────────────────────────────────────────

describe('未知 API 路径', () => {
  test('GET /api/unknown 返回 JSON 格式的 404', async () => {
    const res = await request(app).get('/api/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/unknown 同样返回 JSON 404', async () => {
    const res = await request(app).post('/api/no-such-route').send({});

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
