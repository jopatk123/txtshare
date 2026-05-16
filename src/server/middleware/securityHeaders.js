/**
 * 基础 HTTP 安全头中间件
 *
 * 故意不引入 helmet：本服务渲染少量内联脚本/样式，CSP 由本文件集中维护，
 * 既减少供应链面，也便于在审计时一次看清所有策略。
 */

const DEFAULT_CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"],
  // 现有页面（index/share/admin）内嵌少量 <script>/style，暂允许 unsafe-inline。
  // 后续若全部抽离到 .js/.css 文件，可移除并启用 nonce。
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"]
};

function buildCspHeader(directives = DEFAULT_CSP_DIRECTIVES) {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

function securityHeaders() {
  const cspHeader = buildCspHeader();

  return function securityHeadersMiddleware(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Content-Security-Policy', cspHeader);

    if (req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }

    next();
  };
}

module.exports = securityHeaders;
module.exports.buildCspHeader = buildCspHeader;
module.exports.DEFAULT_CSP_DIRECTIVES = DEFAULT_CSP_DIRECTIVES;
