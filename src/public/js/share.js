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

      // 显示文本内容：支持 Markdown 渲染
      const rawContent = typeof data.data.content === 'string' ? data.data.content : '';
      renderContent(textContentEl, rawContent);

      // 显示创建时间
      if (data.data.createTime) {
        const createDate = new Date(data.data.createTime);
        createTimeEl.textContent = formatDateTime(createDate);
      }

      // 显示过期时间
      expireTimeEl.textContent = formatDateTime(data.data.expireTime);

      // 设置复制功能
      copyBtn.addEventListener('click', function() {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(rawContent)
            .then(() => showToast('内容已复制到剪贴板', 'success'))
            .catch(() => fallbackCopy(rawContent));
        } else {
          fallbackCopy(rawContent);
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
 * 渲染内容（Markdown 或纯文本）
 */
function renderContent(container, rawText) {
  const text = typeof rawText === 'string' ? rawText : '';

  if (isMarkdown(text) && window.marked && window.DOMPurify) {
    // 设置 Markdown 渲染容器样式
    container.className = 'markdown-body';
    
    // 渲染 Markdown
    const html = marked.parse(text, { breaks: true });
    container.innerHTML = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    
    // 代码高亮
    if (window.hljs) {
      container.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  } else {
    // 纯文本样式
    container.className = 'plain-text';
    container.textContent = text;
  }
}

/**
 * 简单判断文本是否为 Markdown
 */
function isMarkdown(text) {
  return /(^\s{0,3}#{1,6}\s)|(```)|(^\s*[-*+]\s)|(^\s*\d+\.\s)|(\[.+?\]\(.+?\))|(^\s*>\s)|(^\s*\|.+\|\s*$)/m.test(text);
}

/**
 * 显示错误页面
 */
function showError() {
  window.location.href = '/expired.html';
}
