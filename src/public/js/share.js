/**
 * 分享页面脚本
 */

document.addEventListener('DOMContentLoaded', async function() {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('content');
  const textContentEl = document.getElementById('textContent');
  const createTimeEl = document.getElementById('createTime');
  const expireTimeEl = document.getElementById('expireTime');
  const copyBtn = document.getElementById('copyBtn');

  // 从URL获取分享ID
  const pathParts = window.location.pathname.split('/');
  const shareId = pathParts[pathParts.length - 1];

  if (!shareId) {
    showError();
    return;
  }

  try {
    const response = await fetch(`/api/text/${shareId}`);
    const data = await response.json();

    if (data.success) {
      // 隐藏加载，显示内容
      loadingEl.classList.remove('show');
      contentEl.style.display = 'block';

      // 显示文本内容：后端已做 HTML 转义，这里用 innerHTML 让实体正确显示
      const escapedContent = typeof data.data.content === 'string' ? data.data.content : '';
      textContentEl.innerHTML = escapedContent;

      // 显示创建时间
      if (data.data.createTime) {
        const createDate = new Date(data.data.createTime);
        createTimeEl.textContent = formatDateTime(createDate);
      }

      // 显示过期时间
      expireTimeEl.textContent = formatDateTime(data.data.expireTime);

      // 设置复制功能
      copyBtn.addEventListener('click', function() {
        const decoded = decodeHtmlEntities(escapedContent);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(decoded)
            .then(() => showToast('内容已复制到剪贴板', 'success'))
            .catch(() => fallbackCopy(decoded));
        } else {
          fallbackCopy(decoded);
        }
      });

    } else {
      // 跳转到失效页面
      window.location.href = '/expired.html';
    }
  } catch (error) {
    console.error('Error:', error);
    window.location.href = '/expired.html';
  }
});

/**
 * 格式化日期时间
 */
function formatDateTime(date) {
  if (!date) return '永不过期';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '永不过期';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 降级复制方法
 */
function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    showToast('内容已复制到剪贴板', 'success');
  } catch (err) {
    showToast('复制失败，请手动复制', 'error');
  }
  
  document.body.removeChild(textarea);
}

/**
 * 显示提示消息
 */
function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * 将 HTML 实体反解为原始文本（用于复制）
 */
function decodeHtmlEntities(escaped) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = escaped;
  return textarea.value;
}

/**
 * 显示错误页面
 */
function showError() {
  window.location.href = '/expired.html';
}
