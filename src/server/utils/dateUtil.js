/**
 * 日期时间工具函数
 * 用于计算过期时间
 */

/**
 * 根据过期类型计算过期时间
 * @param {string} expireType - 过期类型: 'never', '1h', '1d', '7d', '30d', 'custom'
 * @param {number} customDays - 自定义天数（当expireType为'custom'时使用）
 * @returns {Date|null} - 过期时间，null表示永不过期
 */
function calculateExpireTime(expireType, customDays = 0) {
  if (expireType === 'never' || !expireType) {
    return null; // 永不过期
  }

  const now = new Date();

  switch (expireType) {
    case '1h':
      return new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1小时
    case '1d':
      return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 1天
    case '7d':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天
    case '30d':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天
    case 'custom':
      if (customDays > 0) {
        return new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000);
      }
      return null;
    default:
      return null;
  }
}

/**
 * 格式化日期时间为可读字符串
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} - 格式化后的日期字符串
 */
function formatDateTime(date) {
  if (!date) return '永不过期';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 计算缓存TTL（秒）
 * @param {Date|string|null} expireTime - 过期时间
 * @returns {number} - 缓存TTL秒数，0表示无限期
 */
function calculateCacheTTL(expireTime) {
  if (!expireTime) {
    return 0; // 0表示node-cache中的无限期
  }
  
  const expire = typeof expireTime === 'string' ? new Date(expireTime) : expireTime;
  const now = new Date();
  const ttl = Math.floor((expire.getTime() - now.getTime()) / 1000);
  
  return ttl > 0 ? ttl : 0;
}

module.exports = {
  calculateExpireTime,
  formatDateTime,
  calculateCacheTTL
};
