const NodeCache = require('node-cache');
const { calculateCacheTTL } = require('../utils/dateUtil');

// 创建缓存实例
// stdTTL: 默认TTL（秒），0表示无限期
// checkperiod: 检查过期键的周期（秒）
const cache = new NodeCache({
  stdTTL: 0,
  checkperiod: 120,
  useClones: false // 不克隆对象，提升性能
});

/**
 * 获取缓存
 * @param {string} key - 缓存键
 * @returns {any} - 缓存值或undefined
 */
function get(key) {
  return cache.get(key);
}

/**
 * 设置缓存
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值
 * @param {number} ttl - TTL（秒），0表示无限期
 */
function set(key, value, ttl = 0) {
  cache.set(key, value, ttl);
}

/**
 * 根据过期时间设置缓存
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值
 * @param {Date|string|null} expireTime - 过期时间
 */
function setWithExpireTime(key, value, expireTime) {
  const ttl = calculateCacheTTL(expireTime);
  cache.set(key, value, ttl);
}

/**
 * 删除缓存
 * @param {string} key - 缓存键
 */
function del(key) {
  cache.del(key);
}

/**
 * 批量删除缓存
 * @param {string[]} keys - 缓存键数组
 */
function delMultiple(keys) {
  cache.del(keys);
}

/**
 * 清空所有缓存
 */
function flush() {
  cache.flushAll();
}

/**
 * 获取缓存统计信息
 * @returns {Object} - 统计信息
 */
function getStats() {
  return cache.getStats();
}

module.exports = {
  cache,
  get,
  set,
  setWithExpireTime,
  del,
  delMultiple,
  flush,
  getStats
};
