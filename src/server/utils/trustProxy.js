function parseTrustProxy(value) {
  if (value === undefined || value === null) {
    return false;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (lowered === 'true') {
    return true;
  }

  if (lowered === 'false') {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (normalized.includes(',')) {
    return normalized
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return normalized;
}

function getTrustProxySetting() {
  return parseTrustProxy(process.env.TRUST_PROXY);
}

module.exports = {
  parseTrustProxy,
  getTrustProxySetting,
};
