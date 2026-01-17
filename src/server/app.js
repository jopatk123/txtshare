const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./routes/api');
const shareRoutes = require('./routes/share');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./middleware/logger');

const app = express();

// 信任代理（用于获取真实IP）
app.set('trust proxy', 1);

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '200kb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}`);
  });
  next();
});

// API限流
app.use('/api', apiLimiter);

// 静态文件
app.use(express.static(path.join(__dirname, '../public')));

// API路由
app.use('/api', apiRoutes);

// 分享页面路由
app.use('/s', shareRoutes);

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404处理
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../public/expired.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

module.exports = app;
