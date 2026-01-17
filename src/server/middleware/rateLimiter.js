const rateLimit = require('express-rate-limit');
const logger = require('./logger');

/**
 * 创建限流中间件
 * 单IP每分钟最多请求30次
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 30, // 每个IP最多30次请求
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true, // 返回rate limit信息到`RateLimit-*`头部
  legacyHeaders: false, // 禁用`X-RateLimit-*`头部
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  }
});

/**
 * 创建更严格的限流中间件（用于创建接口）
 * 单IP每分钟最多创建10次
 */
const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 每个IP最多10次创建请求
  message: {
    success: false,
    error: '创建请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Create rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  }
});

module.exports = {
  apiLimiter,
  createLimiter
};
