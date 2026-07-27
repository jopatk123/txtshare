const cors = require('cors');

/**
 * 解析 ALLOWED_ORIGINS 环境变量并返回适用于 cors() 的 origin 选项。
 *
 * - 未设置或为 '*'：允许任意来源（默认行为，兼容公共部署）
 * - 单个或逗号分隔的多个源：仅允许这些精确匹配的来源
 */
function parseAllowedOrigins(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === '*') return null;

  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCorsMiddleware(allowedOriginsEnv = process.env.ALLOWED_ORIGINS) {
  const list = parseAllowedOrigins(allowedOriginsEnv);

  if (!list) {
    return cors();
  }

  return cors({
    origin(origin, callback) {
      // 同源请求无 Origin 头，直接放行；其余按白名单匹配
      if (!origin || list.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: false,
  });
}

module.exports = {
  parseAllowedOrigins,
  buildCorsMiddleware,
};
