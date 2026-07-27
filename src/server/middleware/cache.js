const NodeCache = require('node-cache');
const { calculateCacheTTL } = require('../utils/dateUtil');
const logger = require('./logger');

// 缓存条目数量上限：超过后不再缓存新条目（降级而非 OOM）
// node-cache 不支持 LRU 淘汰，靠 TTL + 兜底 TTL 控制增长
const MAX_CACHE_KEYS = 2000;
// 永不过期条目的兜底 TTL（秒）：避免永久驻留导致内存无限增长
const NEVER_EXPIRE_FALLBACK_TTL = 24 * 60 * 60; // 24h

// 创建缓存实例
// stdTTL: 默认TTL（秒），0表示无限期
// checkperiod: 检查过期键的周期（秒）
const cache = new NodeCache({
  stdTTL: 0,
  checkperiod: 120,
  useClones: false, // 不克隆对象，提升性能
});

/**
 * 获取缓存
 */
function get(key) {
  return cache.get(key);
}

/**
 * 设置缓存（带容量上限保护）
 */
function set(key, value, ttl = 0) {
  if (cache.getStats().keys >= MAX_CACHE_KEYS) {
    logger.warn(`Cache reached MAX_CACHE_KEYS(${MAX_CACHE_KEYS}), skip set for key: ${key}`);
    return false;
  }
  // ttl=0 表示永不过期，应用兜底 TTL 避免永久驻留
  const effectiveTtl = ttl === 0 ? NEVER_EXPIRE_FALLBACK_TTL : ttl;
  return cache.set(key, value, effectiveTtl);
}

/**
 * 根据过期时间设置缓存
 */
function setWithExpireTime(key, value, expireTime) {
  const ttl = calculateCacheTTL(expireTime);
  // TTL < 0 表示已过期，不应缓存
  if (ttl < 0) return false;
  // ttl === 0 表示永不过期，应用兜底 TTL
  const effectiveTtl = ttl === 0 ? NEVER_EXPIRE_FALLBACK_TTL : ttl;
  return set(key, value, effectiveTtl);
}

/**
 * 删除缓存
 */
function del(key) {
  return cache.del(key);
}

/**
 * 批量删除缓存
 */
function delMultiple(keys) {
  return cache.del(keys);
}

/**
 * 清空所有缓存
 */
function flush() {
  cache.flushAll();
}

/**
 * 获取缓存统计信息
 */
function getStats() {
  return cache.getStats();
}

/**
 * 缓存是否健康（供健康检查使用）
 */
function isHealthy() {
  const stats = cache.getStats();
  return stats.keys < MAX_CACHE_KEYS;
}

module.exports = {
  cache,
  get,
  set,
  setWithExpireTime,
  del,
  delMultiple,
  flush,
  getStats,
  isHealthy,
  MAX_CACHE_KEYS,
  NEVER_EXPIRE_FALLBACK_TTL,
};
