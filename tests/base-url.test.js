const { getConfiguredBaseUrl, getRequestBaseUrl, normalizeBaseUrl } = require('../src/server/utils/baseUrl');

describe('baseUrl utility', () => {
  const originalBaseUrl = process.env.BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.BASE_URL;
      return;
    }

    process.env.BASE_URL = originalBaseUrl;
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
    expect(getRequestBaseUrl({ protocol: 'http', get: () => 'ignored' }, 6006)).toBe('https://example.com');
  });

  test('derives request base url from protocol and host when BASE_URL is not set', () => {
    delete process.env.BASE_URL;
    const req = {
      protocol: 'https',
      get: (headerName) => {
        expect(headerName).toBe('host');
        return 'share.example.com';
      }
    };

    expect(getRequestBaseUrl(req, 6006)).toBe('https://share.example.com');
  });
});