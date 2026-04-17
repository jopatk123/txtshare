const crypto = require('crypto');
const logger = require('./logger');

/**
 * 管理员认证中间件
 * 通过 Authorization: Bearer <token> 或 X-Admin-Token: <token> 请求头验证。
 * 若未配置 ADMIN_TOKEN 环境变量，则返回 503（管理功能已禁用）。
 */
function adminAuth(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(503).json({
      success: false,
      error: '管理员功能未启用，请配置 ADMIN_TOKEN 环境变量'
    });
  }

  // 从请求头中提取 token
  let requestToken = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    requestToken = authHeader.slice(7);
  } else if (req.headers['x-admin-token']) {
    requestToken = req.headers['x-admin-token'];
  }

  if (!requestToken) {
    return res.status(401).json({
      success: false,
      error: '未提供认证令牌'
    });
  }

  // 使用时间安全比较，防止 timing attack
  try {
    const adminBuf = Buffer.from(adminToken, 'utf8');
    const requestBuf = Buffer.from(requestToken, 'utf8');
    const valid =
      adminBuf.length === requestBuf.length &&
      crypto.timingSafeEqual(adminBuf, requestBuf);

    if (!valid) {
      logger.warn(`Admin auth failed from IP: ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: '认证令牌无效'
      });
    }
  } catch {
    return res.status(401).json({
      success: false,
      error: '认证令牌无效'
    });
  }

  next();
}

module.exports = adminAuth;
