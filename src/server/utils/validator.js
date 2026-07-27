/**
 * 参数校验工具
 */

// 文本最大长度限制：2MB（支持内嵌 base64 图片）
const MAX_TEXT_LENGTH = 2 * 1024 * 1024;

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
      error: '文本内容不能为空',
    };
  }

  if (content.length === 0 || content.trim().length === 0) {
    return {
      valid: false,
      error: '文本内容不能为空',
    };
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: '内容过大，请删减后重试（最大2MB）',
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
      error: '无效的过期类型',
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
      error: '自定义天数必须是整数',
    };
  }

  if (days < 1 || days > 365) {
    return {
      valid: false,
      error: '自定义天数必须在1-365之间',
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
      error: '无效的分享ID',
    };
  }

  // ID应该是8-16位字母数字
  if (!/^[A-Za-z0-9]{8,16}$/.test(id)) {
    return {
      valid: false,
      error: '无效的分享ID格式',
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
  validateShareId,
};
