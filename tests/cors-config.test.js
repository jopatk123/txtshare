const { parseAllowedOrigins, buildCorsMiddleware } = require('../src/server/middleware/corsConfig');

describe('CORS configuration', () => {
  describe('parseAllowedOrigins', () => {
    test('returns null when env var is missing', () => {
      expect(parseAllowedOrigins(undefined)).toBeNull();
      expect(parseAllowedOrigins('')).toBeNull();
    });

    test('returns null for wildcard', () => {
      expect(parseAllowedOrigins('*')).toBeNull();
      expect(parseAllowedOrigins('  *  ')).toBeNull();
    });

    test('parses single origin', () => {
      expect(parseAllowedOrigins('https://app.example.com')).toEqual([
        'https://app.example.com'
      ]);
    });

    test('parses comma-separated multi-origin list', () => {
      expect(parseAllowedOrigins('https://a.example, https://b.example ,'))
        .toEqual(['https://a.example', 'https://b.example']);
    });
  });

  describe('buildCorsMiddleware', () => {
    function runMiddleware(mw, headers = {}) {
      return new Promise((resolve) => {
        const req = { method: 'GET', headers };
        const res = {
          _headers: {},
          getHeader(k) { return this._headers[k.toLowerCase()]; },
          setHeader(k, v) { this._headers[k.toLowerCase()] = v; },
          end() {},
          statusCode: 200
        };
        mw(req, res, (err) => resolve({ err, res }));
      });
    }

    test('wildcard mode allows any origin', async () => {
      const mw = buildCorsMiddleware('');
      const { err, res } = await runMiddleware(mw, { origin: 'https://anything.example' });
      expect(err).toBeFalsy();
      expect(res.getHeader('access-control-allow-origin')).toBeDefined();
    });

    test('whitelist mode rejects unknown origin', async () => {
      const mw = buildCorsMiddleware('https://allowed.example');
      const { err } = await runMiddleware(mw, { origin: 'https://evil.example' });
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/not allowed by CORS/);
    });

    test('whitelist mode accepts known origin', async () => {
      const mw = buildCorsMiddleware('https://allowed.example');
      const { err, res } = await runMiddleware(mw, { origin: 'https://allowed.example' });
      expect(err).toBeFalsy();
      expect(res.getHeader('access-control-allow-origin')).toBe('https://allowed.example');
    });

    test('whitelist mode allows same-origin (no Origin header)', async () => {
      const mw = buildCorsMiddleware('https://allowed.example');
      const { err } = await runMiddleware(mw, {});
      expect(err).toBeFalsy();
    });
  });
});
