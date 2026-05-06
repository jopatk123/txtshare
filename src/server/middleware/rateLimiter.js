const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// 测试环境跳过所有限流，避免测试用例互相干扰
const skipInTest = () => process.env.NODE_ENV === 'test';

/**
 * 公开 API 通用限流：单 IP 每分钟最多 30 次
 * 挂载在 routes/api.js 路由层，不影响管理员接口
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * 创建接口严格限流：单 IP 每分钟最多 10 次
 */
const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: skipInTest,
  message: { success: false, error: '创建请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logger.warn(`Create rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * 管理员接口独立限流：单 IP 每分钟最多 60 次
 * 独立于公开 API 限流，防止令牌暴力猜测
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: skipInTest,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logger.warn(`Admin rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

module.exports = {
  apiLimiter,
  createLimiter,
  adminLimiter,
};
