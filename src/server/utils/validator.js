/**
 * 参数校验工具
 */

// 文本最大长度限制：100KB（约10万字符）
const MAX_TEXT_LENGTH = 100 * 1024;

// 允许的过期类型
const VALID_EXPIRE_TYPES = ['never', '1h', '1d', '7d', '30d', 'custom'];

/**
 * 校验文本内容
 * @param {string} content - 文本内容
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateContent(content) {
  if (!content || typeof content !== 'string') {
    return {
      valid: false,
      error: '文本内容不能为空'
    };
  }

  if (content.trim().length === 0) {
    return {
      valid: false,
      error: '文本内容不能为空'
    };
  }

  if (content.length > MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: '文本过长，请删减后重试（最大100KB）'
    };
  }

  return { valid: true };
}

/**
 * 校验过期类型
 * @param {string} expireType - 过期类型
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateExpireType(expireType) {
  if (!expireType) {
    return { valid: true }; // 默认永不过期
  }

  if (!VALID_EXPIRE_TYPES.includes(expireType)) {
    return {
      valid: false,
      error: '无效的过期类型'
    };
  }

  return { valid: true };
}

/**
 * 校验自定义天数
 * @param {number} days - 天数
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateCustomDays(days) {
  if (typeof days !== 'number' || !Number.isInteger(days)) {
    return {
      valid: false,
      error: '自定义天数必须是整数'
    };
  }

  if (days < 1 || days > 365) {
    return {
      valid: false,
      error: '自定义天数必须在1-365之间'
    };
  }

  return { valid: true };
}

/**
 * 校验分享ID
 * @param {string} id - 分享ID
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateShareId(id) {
  if (!id || typeof id !== 'string') {
    return {
      valid: false,
      error: '无效的分享ID'
    };
  }

  // ID应该是8-16位字母数字
  if (!/^[A-Za-z0-9]{8,16}$/.test(id)) {
    return {
      valid: false,
      error: '无效的分享ID格式'
    };
  }

  return { valid: true };
}

module.exports = {
  MAX_TEXT_LENGTH,
  VALID_EXPIRE_TYPES,
  validateContent,
  validateExpireType,
  validateCustomDays,
  validateShareId
};
