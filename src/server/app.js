const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');
const shareRoutes = require('./routes/share');
const adminRoutes = require('./routes/admin');
const logger = require('./middleware/logger');
const securityHeaders = require('./middleware/securityHeaders');
const { buildCorsMiddleware } = require('./middleware/corsConfig');
const { getTrustProxySetting } = require('./utils/trustProxy');

const app = express();

// 默认不信任转发头，部署在反向代理后时通过 TRUST_PROXY 显式开启。
app.set('trust proxy', getTrustProxySetting());

// 隐藏 X-Powered-By
app.disable('x-powered-by');

// 安全响应头（CSP、XFO、XCTO、Referrer-Policy 等）
app.use(securityHeaders());

// CORS：默认允许任意源以兼容旧部署；设置 ALLOWED_ORIGINS 后转为白名单
app.use(buildCorsMiddleware());

app.use(express.json({ limit: '3mb' })); // 限制请求体大小（支持内嵌图片）
app.use(express.urlencoded({ extended: true, limit: '3mb' }));

// 简易健康检查（供容器/负载均衡探活）
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

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
