/**
 * validator 单元测试
 * 覆盖所有公开函数的正常路径、边界值和异常输入
 */

const {
  validateContent,
  validateExpireType,
  validateCustomDays,
  validateShareId,
  MAX_TEXT_LENGTH,
} = require('../src/server/utils/validator');

// ── validateContent ───────────────────────────────────────────────────────────

describe('validateContent', () => {
  test('普通 ASCII 文本返回 valid', () => {
    expect(validateContent('hello world')).toEqual({ valid: true });
  });

  test('中文文本返回 valid', () => {
    expect(validateContent('你好，世界')).toEqual({ valid: true });
  });

  test('含换行的多行文本返回 valid', () => {
    expect(validateContent('line1\nline2\nline3')).toEqual({ valid: true });
  });

  test('空字符串返回无效', () => {
    const result = validateContent('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('仅空格返回无效', () => {
    expect(validateContent('   ').valid).toBe(false);
  });

  test('仅换行返回无效', () => {
    expect(validateContent('\n\n').valid).toBe(false);
  });

  test('null 返回无效', () => {
    expect(validateContent(null).valid).toBe(false);
  });

  test('undefined 返回无效', () => {
    expect(validateContent(undefined).valid).toBe(false);
  });

  test('数字类型返回无效', () => {
    expect(validateContent(123).valid).toBe(false);
  });

  test('对象类型返回无效', () => {
    expect(validateContent({}).valid).toBe(false);
  });

  test('超出字节上限（ASCII +1 字节）返回无效', () => {
    // ASCII 字符每个 1 字节，精确超出 MAX_TEXT_LENGTH
    const oversized = 'x'.repeat(MAX_TEXT_LENGTH + 1);
    expect(validateContent(oversized).valid).toBe(false);
  });

  test('恰好在字节上限内（ASCII）返回 valid', () => {
    const exact = 'x'.repeat(MAX_TEXT_LENGTH);
    expect(validateContent(exact)).toEqual({ valid: true });
  });

  test('多字节字符超出字节上限时返回无效', () => {
    // 每个中文字符 3 字节；构造字节数 > MAX_TEXT_LENGTH 但字符数 < MAX_TEXT_LENGTH 的情况
    const chineseOversize = '你'.repeat(Math.ceil(MAX_TEXT_LENGTH / 3) + 1);
    expect(validateContent(chineseOversize).valid).toBe(false);
  });
});

// ── validateExpireType ────────────────────────────────────────────────────────

describe('validateExpireType', () => {
  const validTypes = ['never', '1h', '1d', '7d', '30d', 'custom'];

  validTypes.forEach((type) => {
    test(`"${type}" 返回 valid`, () => {
      expect(validateExpireType(type)).toEqual({ valid: true });
    });
  });

  test('undefined 默认永不过期，返回 valid', () => {
    expect(validateExpireType(undefined)).toEqual({ valid: true });
  });

  test('null 默认永不过期，返回 valid', () => {
    expect(validateExpireType(null)).toEqual({ valid: true });
  });

  test('空字符串默认永不过期，返回 valid', () => {
    expect(validateExpireType('')).toEqual({ valid: true });
  });

  test('"2h" 返回无效', () => {
    const result = validateExpireType('2h');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('"365d" 返回无效', () => {
    expect(validateExpireType('365d').valid).toBe(false);
  });

  test('大写 "NEVER" 返回无效', () => {
    expect(validateExpireType('NEVER').valid).toBe(false);
  });
});

// ── validateCustomDays ────────────────────────────────────────────────────────

describe('validateCustomDays', () => {
  test('1（最小值）返回 valid', () => {
    expect(validateCustomDays(1)).toEqual({ valid: true });
  });

  test('365（最大值）返回 valid', () => {
    expect(validateCustomDays(365)).toEqual({ valid: true });
  });

  test('中间值 30 返回 valid', () => {
    expect(validateCustomDays(30)).toEqual({ valid: true });
  });

  test('0 返回无效', () => {
    expect(validateCustomDays(0).valid).toBe(false);
  });

  test('366 超出上限，返回无效', () => {
    expect(validateCustomDays(366).valid).toBe(false);
  });

  test('-1 负数返回无效', () => {
    expect(validateCustomDays(-1).valid).toBe(false);
  });

  test('小数 3.5 返回无效', () => {
    expect(validateCustomDays(3.5).valid).toBe(false);
  });

  test('字符串 "7" 返回无效', () => {
    expect(validateCustomDays('7').valid).toBe(false);
  });

  test('undefined 返回无效', () => {
    expect(validateCustomDays(undefined).valid).toBe(false);
  });

  test('null 返回无效', () => {
    expect(validateCustomDays(null).valid).toBe(false);
  });
});

// ── validateShareId ───────────────────────────────────────────────────────────

describe('validateShareId', () => {
  test('10 位纯字母数字返回 valid', () => {
    expect(validateShareId('aBcDeF1234')).toEqual({ valid: true });
  });

  test('8 位（最短）返回 valid', () => {
    expect(validateShareId('abcd1234')).toEqual({ valid: true });
  });

  test('16 位（最长）返回 valid', () => {
    expect(validateShareId('abcdefgh12345678')).toEqual({ valid: true });
  });

  test('7 位（过短）返回无效', () => {
    const result = validateShareId('abc1234');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('17 位（过长）返回无效', () => {
    expect(validateShareId('abcdefgh123456789').valid).toBe(false);
  });

  test('含连字符返回无效', () => {
    expect(validateShareId('abc-12345').valid).toBe(false);
  });

  test('含下划线返回无效', () => {
    expect(validateShareId('abc_12345').valid).toBe(false);
  });

  test('含空格返回无效', () => {
    expect(validateShareId('abc 12345').valid).toBe(false);
  });

  test('null 返回无效', () => {
    expect(validateShareId(null).valid).toBe(false);
  });

  test('undefined 返回无效', () => {
    expect(validateShareId(undefined).valid).toBe(false);
  });

  test('数字类型返回无效', () => {
    expect(validateShareId(12345678).valid).toBe(false);
  });
});
