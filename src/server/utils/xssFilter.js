/**
 * XSS转义处理工具
 * 对HTML特殊字符进行转义，防止跨站脚本攻击
 */

const escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * 转义HTML特殊字符
 * @param {string} str - 原始字符串
 * @returns {string} - 转义后的字符串
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str.replace(/[&<>"'`=\/]/g, char => escapeMap[char]);
}

/**
 * 反转义HTML特殊字符
 * @param {string} str - 转义后的字符串
 * @returns {string} - 原始字符串
 */
function unescapeHtml(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=');
}

module.exports = {
  escapeHtml,
  unescapeHtml
};
