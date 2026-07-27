/**
 * 基础 HTTP 安全头中间件
 *
 * 故意不引入 helmet：本服务渲染少量内联样式，CSP 由本文件集中维护，
 * 既减少供应链面，也便于在审计时一次看清所有策略。
 *
 * script-src 已收紧为 'self'：所有脚本均以外部 .js 形式加载，
 * admin/index.html 的内联脚本已抽离到 /js/admin.js。
 */

const { getConfiguredBaseUrl } = require('../utils/baseUrl');

const DEFAULT_CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"],
  // 所有脚本均以外部 .js 加载，admin 内联脚本已抽离，可移除 unsafe-inline
  'script-src': ["'self'"],
  // 内联 <style> 仍存在（admin/index.html 的 <style> 块），保留 unsafe-inline
  // 样式注入风险低，且不影响脚本执行
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
};

function buildCspHeader(directives = DEFAULT_CSP_DIRECTIVES) {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

function isHttpsBaseUrlConfigured() {
  const baseUrl = getConfiguredBaseUrl(0);
  return baseUrl && baseUrl.startsWith('https://');
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

    // HSTS：当请求本身是 HTTPS，或生产环境显式配置了 https BASE_URL 时下发。
    // 解耦自 req.secure，避免反代后 TRUST_PROXY=false 导致 HSTS 永不下发。
    if (req.secure || (process.env.NODE_ENV === 'production' && isHttpsBaseUrlConfigured())) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }

    next();
  };
}

module.exports = securityHeaders;
module.exports.buildCspHeader = buildCspHeader;
module.exports.DEFAULT_CSP_DIRECTIVES = DEFAULT_CSP_DIRECTIVES;
