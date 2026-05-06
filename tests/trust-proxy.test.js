const { parseTrustProxy } = require('../src/server/utils/trustProxy');

describe('trust proxy parsing', () => {
  test('defaults to false for unset values', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy(null)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('   ')).toBe(false);
  });

  test('parses booleans', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('TRUE')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('FALSE')).toBe(false);
  });

  test('parses hop counts', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  test('parses proxy subnet lists', () => {
    expect(parseTrustProxy('loopback, linklocal, uniquelocal')).toEqual([
      'loopback',
      'linklocal',
      'uniquelocal'
    ]);
  });

  test('keeps explicit string strategies', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
  });
});

describe('app trust proxy wiring', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    jest.resetModules();

    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
      return;
    }

    process.env.TRUST_PROXY = originalTrustProxy;
  });

  test('defaults to false on the Express app', () => {
    delete process.env.TRUST_PROXY;
    const app = require('../src/server/app');
    expect(app.get('trust proxy')).toBe(false);
  });

  test('supports explicit proxy hop counts on the Express app', () => {
    process.env.TRUST_PROXY = '1';
    const app = require('../src/server/app');
    expect(app.get('trust proxy')).toBe(1);
  });
});