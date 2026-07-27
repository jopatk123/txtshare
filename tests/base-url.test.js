const {
  getConfiguredBaseUrl,
  getRequestBaseUrl,
  normalizeBaseUrl,
  warnIfBaseUrlMissing,
} = require('../src/server/utils/baseUrl');

describe('baseUrl utility', () => {
  const originalBaseUrl = process.env.BASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.BASE_URL;
    } else {
      process.env.BASE_URL = originalBaseUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  test('normalizeBaseUrl removes trailing slashes', () => {
    expect(normalizeBaseUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeBaseUrl('https://example.com///')).toBe('https://example.com');
  });

  test('prefers explicit BASE_URL for configured base url', () => {
    process.env.BASE_URL = 'https://example.com/';
    expect(getConfiguredBaseUrl(6006)).toBe('https://example.com');
  });

  test('falls back to localhost when BASE_URL is not set', () => {
    delete process.env.BASE_URL;
    expect(getConfiguredBaseUrl(6006)).toBe('http://localhost:6006');
  });

  test('uses explicit BASE_URL for request base url', () => {
    process.env.BASE_URL = 'https://example.com/';
    expect(getRequestBaseUrl({ protocol: 'http', get: () => 'ignored' }, 6006)).toBe(
      'https://example.com'
    );
  });

  test('derives request base url from Host header in non-production', () => {
    delete process.env.BASE_URL;
    process.env.NODE_ENV = 'development';
    const req = {
      protocol: 'https',
      get: (headerName) => {
        expect(headerName).toBe('host');
        return 'share.example.com';
      },
    };

    expect(getRequestBaseUrl(req, 6006)).toBe('https://share.example.com');
  });

  test('refuses to trust Host header in production without BASE_URL', () => {
    delete process.env.BASE_URL;
    process.env.NODE_ENV = 'production';
    const req = {
      protocol: 'https',
      get: () => 'attacker.example.com',
    };

    expect(getRequestBaseUrl(req, 6006)).toBe('http://localhost:6006');
  });

  test('falls back to process.env.PORT when port arg is omitted', () => {
    delete process.env.BASE_URL;
    process.env.NODE_ENV = 'production';
    process.env.PORT = '7001';
    const req = {
      protocol: 'https',
      get: () => 'attacker.example.com',
    };

    expect(getRequestBaseUrl(req)).toBe('http://localhost:7001');
  });

  test('warnIfBaseUrlMissing emits warning in production without BASE_URL', () => {
    delete process.env.BASE_URL;
    process.env.NODE_ENV = 'production';
    const warn = jest.fn();
    expect(warnIfBaseUrlMissing({ warn })).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  test('warnIfBaseUrlMissing stays silent when BASE_URL is set', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'production';
    const warn = jest.fn();
    expect(warnIfBaseUrlMissing({ warn })).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  test('warnIfBaseUrlMissing stays silent outside production', () => {
    delete process.env.BASE_URL;
    process.env.NODE_ENV = 'development';
    const warn = jest.fn();
    expect(warnIfBaseUrlMissing({ warn })).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
