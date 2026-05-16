function normalizeBaseUrl(value) {
  if (!value) {
    return '';
  }

  return value.replace(/\/+$/, '');
}

function getConfiguredBaseUrl(port) {
  const explicitBaseUrl = normalizeBaseUrl(process.env.BASE_URL);

  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  return `http://localhost:${port}`;
}

/**
 * 推导请求的 base URL。
 *
 * - 显式配置 BASE_URL：始终优先使用（生产推荐）。
 * - 生产环境且未配置 BASE_URL：拒绝信任 Host 头（避免 Host 注入污染分享链接），
 *   回退到 getConfiguredBaseUrl(port)，并通过启动告警提醒运维显式配置。
 * - 非生产环境：保留原行为，便于本地开发跨主机访问。
 */
function getRequestBaseUrl(req, port) {
  const explicitBaseUrl = normalizeBaseUrl(process.env.BASE_URL);

  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  if (req && process.env.NODE_ENV !== 'production') {
    return `${req.protocol}://${req.get('host')}`;
  }

  return `http://localhost:${port}`;
}

/**
 * 启动时校验 BASE_URL 配置，在生产模式下未设置时打印告警。
 * 返回值用于测试断言（true 表示有告警）。
 */
function warnIfBaseUrlMissing(logger = console) {
  if (process.env.NODE_ENV === 'production' && !normalizeBaseUrl(process.env.BASE_URL)) {
    const message =
      '[baseUrl] NODE_ENV=production 但未配置 BASE_URL，分享链接将回退到 http://localhost。' +
      '请在 .env / 部署环境中显式设置 BASE_URL，例如 BASE_URL=https://your-domain.example';
    if (typeof logger.warn === 'function') {
      logger.warn(message);
    } else {
      console.warn(message);
    }
    return true;
  }
  return false;
}

module.exports = {
  getConfiguredBaseUrl,
  getRequestBaseUrl,
  normalizeBaseUrl,
  warnIfBaseUrlMissing
};