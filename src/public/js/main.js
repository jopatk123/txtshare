/**
 * 主页面脚本
 */

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('shareForm');
  const textContent = document.getElementById('textContent');
  const expireType = document.getElementById('expireType');
  const customDaysWrapper = document.getElementById('customDaysWrapper');
  const customDays = document.getElementById('customDays');
  const submitBtn = document.getElementById('submitBtn');
  const result = document.getElementById('result');
  const shareUrl = document.getElementById('shareUrl');
  const copyBtn = document.getElementById('copyBtn');
  const expireInfo = document.getElementById('expireInfo');

  // 监听过期类型变化
  expireType.addEventListener('change', function() {
    if (this.value === 'custom') {
      customDaysWrapper.classList.add('show');
    } else {
      customDaysWrapper.classList.remove('show');
    }
  });

  // 表单提交
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const content = textContent.value.trim();
    if (!content) {
      showToast('请输入要分享的文本内容', 'error');
      return;
    }

    // 检查文本长度（100KB）
    if (content.length > 100 * 1024) {
      showToast('文本过长，请删减后重试（最大100KB）', 'error');
      return;
    }

    const expireTypeValue = expireType.value;
    let expireDaysValue = null;

    if (expireTypeValue === 'custom') {
      expireDaysValue = parseInt(customDays.value, 10);
      if (!expireDaysValue || expireDaysValue < 1 || expireDaysValue > 365) {
        showToast('自定义天数必须在1-365之间', 'error');
        return;
      }
    }

    // 禁用按钮，显示加载状态
    submitBtn.disabled = true;
    submitBtn.textContent = '生成中...';

    try {
      const response = await fetch('/api/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content,
          expireType: expireTypeValue,
          expireDays: expireDaysValue
        })
      });

      const data = await response.json();

      if (data.success) {
        // 显示结果
        shareUrl.value = data.data.url;
        expireInfo.textContent = `过期时间：${formatDateTime(data.data.expireTime)}`;
        result.classList.add('show');
        showToast('分享链接生成成功！', 'success');
      } else {
        showToast(data.error || '生成失败，请重试', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('网络错误，请稍后重试', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '生成分享链接';
    }
  });

  // 复制链接
  copyBtn.addEventListener('click', function() {
    shareUrl.select();
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl.value)
        .then(() => showToast('链接已复制到剪贴板', 'success'))
        .catch(() => {
          document.execCommand('copy');
          showToast('链接已复制到剪贴板', 'success');
        });
    } else {
      document.execCommand('copy');
      showToast('链接已复制到剪贴板', 'success');
    }
  });

  // 字符计数
  textContent.addEventListener('input', function() {
    const length = this.value.length;
    const maxLength = 100 * 1024;
    const counter = document.getElementById('charCounter');
    if (counter) {
      counter.textContent = `${length.toLocaleString()} / ${maxLength.toLocaleString()} 字符`;
      if (length > maxLength) {
        counter.style.color = 'var(--error-color)';
      } else {
        counter.style.color = 'var(--text-muted)';
      }
    }
  });
});

/**
 * 显示提示消息
 */
function showToast(message, type = 'success') {
  // 移除已有的toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // 触发显示动画
  setTimeout(() => toast.classList.add('show'), 10);

  // 自动隐藏
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

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
