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
    container.className = 'markdown-body markdown-share-body';
    
    // 渲染 Markdown
    const html = marked.parse(text, { breaks: true });
    // 配置 DOMPurify 允许 data: URL 的图片
    container.innerHTML = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_DATA_URI_TAGS: ['img'],
      ADD_ATTR: ['src', 'alt'],
    });
    
    // 为内嵌图片添加响应式样式
    container.querySelectorAll('img').forEach((img) => {
      img.classList.add('shared-image');
      img.loading = 'lazy';
      img.decoding = 'async';
      // 点击图片放大查看
      img.addEventListener('click', function() {
        openImageViewer(this.src);
      });
      img.style.cursor = 'zoom-in';
      img.title = '点击查看大图';
    });

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
 * 图片查看器
 */
function openImageViewer(src) {
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.className = 'image-viewer-overlay';
  
  const img = document.createElement('img');
  img.src = src;
  img.className = 'image-viewer-img';
  
  overlay.appendChild(img);
  document.body.appendChild(overlay);

  function closeViewer() {
    document.removeEventListener('keydown', handleEsc);
    overlay.remove();
  }

  // 点击遮罩关闭
  overlay.addEventListener('click', function() {
    closeViewer();
  });

  // ESC 键关闭
  function handleEsc(e) {
    if (e.key === 'Escape') {
      closeViewer();
    }
  }
  document.addEventListener('keydown', handleEsc);

  // 渐入动画
  requestAnimationFrame(() => overlay.classList.add('show'));
}

/**
 * 简单判断文本是否为 Markdown（包含图片标记检测）
 */
function isMarkdown(text) {
  return /(^\s{0,3}#{1,6}\s)|(```)|(^\s*[-*+]\s)|(^\s*\d+\.\s)|(\[.+?\]\(.+?\))|(^\s*>\s)|(^\s*\|.+\|\s*$)|(!\[.*?\]\(data:image\/)/m.test(text);
}

/**
 * 显示错误页面
 */
function showError() {
  window.location.href = '/expired.html';
}
