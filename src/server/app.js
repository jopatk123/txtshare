const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./routes/api');
const shareRoutes = require('./routes/share');
const adminRoutes = require('./routes/admin');
const logger = require('./middleware/logger');
const { getTrustProxySetting } = require('./utils/trustProxy');

const app = express();

// 默认不信任转发头，部署在反向代理后时通过 TRUST_PROXY 显式开启。
app.set('trust proxy', getTrustProxySetting());

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '3mb' })); // 限制请求体大小（支持内嵌图片）
app.use(express.urlencoded({ extended: true, limit: '3mb' }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}`);
  });
  next();
});

// 静态文件
app.use(express.static(path.join(__dirname, '../public')));

// API路由
app.use('/api', apiRoutes);

// 管理员API路由
app.use('/api/admin', adminRoutes);

// 分享页面路由
app.use('/s', shareRoutes);

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 管理员页面（/admin 重定向到 /admin/）
app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});

// API 路由 404：返回 JSON 而非 HTML
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

// 通用 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../public/expired.html'));
});

// 错误处理
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

module.exports = app;
