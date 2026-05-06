/**
 * dateUtil 单元测试
 * 覆盖：calculateExpireTime / formatDateTime / calculateCacheTTL
 */

const {
  calculateExpireTime,
  formatDateTime,
  calculateCacheTTL,
} = require('../src/server/utils/dateUtil');

// ── calculateExpireTime ───────────────────────────────────────────────────────

describe('calculateExpireTime', () => {
  test('"never" 返回 null', () => {
    expect(calculateExpireTime('never')).toBeNull();
  });

  test('undefined 返回 null（默认永不过期）', () => {
    expect(calculateExpireTime(undefined)).toBeNull();
  });

  test('空字符串返回 null', () => {
    expect(calculateExpireTime('')).toBeNull();
  });

  test('null 返回 null', () => {
    expect(calculateExpireTime(null)).toBeNull();
  });

  test('"1h" 返回约 1 小时后的 Date', () => {
    const before = Date.now();
    const result = calculateExpireTime('1h');
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThan(before + 59 * 60 * 1000);
    expect(result.getTime()).toBeLessThan(before + 61 * 60 * 1000);
  });

  test('"1d" 返回约 1 天后的 Date', () => {
    const before = Date.now();
    const result = calculateExpireTime('1d');
    expect(result.getTime()).toBeGreaterThan(before + 23 * 60 * 60 * 1000);
    expect(result.getTime()).toBeLessThan(before + 25 * 60 * 60 * 1000);
  });

  test('"7d" 返回约 7 天后的 Date', () => {
    const before = Date.now();
    const result = calculateExpireTime('7d');
    expect(result.getTime()).toBeGreaterThan(before + 6 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBeLessThan(before + 8 * 24 * 60 * 60 * 1000);
  });

  test('"30d" 返回约 30 天后的 Date', () => {
    const before = Date.now();
    const result = calculateExpireTime('30d');
    expect(result.getTime()).toBeGreaterThan(before + 29 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBeLessThan(before + 31 * 24 * 60 * 60 * 1000);
  });

  test('"custom" + customDays=5 返回约 5 天后的 Date', () => {
    const before = Date.now();
    const result = calculateExpireTime('custom', 5);
    expect(result.getTime()).toBeGreaterThan(before + 4 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBeLessThan(before + 6 * 24 * 60 * 60 * 1000);
  });

  test('"custom" 未提供 customDays 返回 null', () => {
    expect(calculateExpireTime('custom')).toBeNull();
  });

  test('"custom" + customDays=0 返回 null', () => {
    expect(calculateExpireTime('custom', 0)).toBeNull();
  });

  test('未知类型返回 null', () => {
    expect(calculateExpireTime('unknown')).toBeNull();
  });
});

// ── formatDateTime ────────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  test('null 返回"永不过期"', () => {
    expect(formatDateTime(null)).toBe('永不过期');
  });

  test('undefined 返回"永不过期"', () => {
    expect(formatDateTime(undefined)).toBe('永不过期');
  });

  test('Date 对象格式化为 yyyy-MM-dd HH:mm:ss 格式', () => {
    const result = formatDateTime(new Date('2024-06-15T12:30:45.000Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  test('ISO 字符串同样能格式化', () => {
    const result = formatDateTime('2024-01-01T00:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  test('月份和日期补零', () => {
    // 手动构造一个已知本地时间
    const d = new Date(2024, 0, 5, 8, 3, 7); // Jan 5, 08:03:07
    const result = formatDateTime(d);
    expect(result).toMatch(/-01-05 /);
    expect(result).toMatch(/:03:07$/);
  });
});

// ── calculateCacheTTL ─────────────────────────────────────────────────────────

describe('calculateCacheTTL', () => {
  test('null 返回 0（node-cache 中表示永不过期）', () => {
    expect(calculateCacheTTL(null)).toBe(0);
  });

  test('undefined 返回 0', () => {
    expect(calculateCacheTTL(undefined)).toBe(0);
  });

  test('未来 60 秒的 Date 返回正数 TTL（≤60）', () => {
    const future = new Date(Date.now() + 60 * 1000);
    const ttl = calculateCacheTTL(future);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  test('过去时间返回 -1', () => {
    const past = new Date(Date.now() - 1000);
    expect(calculateCacheTTL(past)).toBe(-1);
  });

  test('ISO 字符串（未来）返回正数 TTL', () => {
    const future = new Date(Date.now() + 120 * 1000).toISOString();
    const ttl = calculateCacheTTL(future);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  test('ISO 字符串（过去）返回 -1', () => {
    const past = new Date(Date.now() - 5000).toISOString();
    expect(calculateCacheTTL(past)).toBe(-1);
  });
});
