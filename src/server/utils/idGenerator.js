const crypto = require('crypto');

/**
 * 生成唯一ID
 * 使用crypto模块生成8-16位的随机字母数字混合字符串
 * @param {number} length - ID长度，默认10位
 * @returns {string} - 生成的唯一ID
 */
function generateId(length = 10) {
  // 定义字符集：大小写字母 + 数字
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charsLength = chars.length;
  
  let result = '';
  for (let i = 0; i < length; i++) {
    // 使用 crypto.randomInt 消除模偶偏差
    result += chars[crypto.randomInt(charsLength)];
  }
  
  return result;
}

module.exports = {
  generateId
};
