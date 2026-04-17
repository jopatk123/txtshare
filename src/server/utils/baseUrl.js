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

function getRequestBaseUrl(req, port) {
  const explicitBaseUrl = normalizeBaseUrl(process.env.BASE_URL);

  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  if (req) {
    return `${req.protocol}://${req.get('host')}`;
  }

  return `http://localhost:${port}`;
}

module.exports = {
  getConfiguredBaseUrl,
  getRequestBaseUrl,
  normalizeBaseUrl
};