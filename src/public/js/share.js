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

      // 显示文本内容
      textContentEl.textContent = data.data.content;

      // 显示创建时间
      if (data.data.createTime) {
        const createDate = new Date(data.data.createTime);
        createTimeEl.textContent = formatDateTime(createDate);
      }

      // 显示过期时间
      expireTimeEl.textContent = data.data.expireTimeFormatted || '永不过期';

      // 设置复制功能
      copyBtn.addEventListener('click', function() {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(data.data.content)
            .then(() => showToast('内容已复制到剪贴板', 'success'))
            .catch(() => fallbackCopy(data.data.content));
        } else {
          fallbackCopy(data.data.content);
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
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
 * 显示错误页面
 */
function showError() {
  window.location.href = '/expired.html';
}
