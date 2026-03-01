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
  const imageProgress = document.getElementById('imageProgress');
  const imagePreview = document.getElementById('imagePreview');

  // 内容最大限制（2MB，含图片 base64）
  const MAX_CONTENT_KB = 2048;
  const MAX_CONTENT_SIZE = MAX_CONTENT_KB * 1024;

  // 已插入的图片计数
  let imageCount = 0;

  // 监听过期类型变化
  expireType.addEventListener('change', function() {
    if (this.value === 'custom') {
      customDaysWrapper.classList.add('show');
    } else {
      customDaysWrapper.classList.remove('show');
    }
  });

  // ======== 图片粘贴处理 ========
  textContent.addEventListener('paste', async function(e) {
    const imageFile = ImageCompressor.getImageFromClipboard(e);
    if (!imageFile) return; // 非图片粘贴，走默认行为

    e.preventDefault();
    await handleImageInsert(imageFile);
  });

  // ======== 图片拖拽处理 ========
  textContent.addEventListener('dragover', function(e) {
    e.preventDefault();
    textContent.classList.add('drag-over');
  });

  textContent.addEventListener('dragleave', function(e) {
    e.preventDefault();
    textContent.classList.remove('drag-over');
  });

  textContent.addEventListener('drop', async function(e) {
    textContent.classList.remove('drag-over');
    const imageFile = ImageCompressor.getImageFromDrop(e);
    if (!imageFile) return;

    e.preventDefault();
    await handleImageInsert(imageFile);
  });

  /**
   * 处理图片插入（粘贴或拖拽）
   */
  async function handleImageInsert(imageFile) {
    // 显示进度
    showImageProgress('正在处理图片...');
    submitBtn.disabled = true;

    try {
      const { dataUrl, info } = await ImageCompressor.compress(imageFile, function(msg) {
        showImageProgress(msg);
      });

      // 生成 Markdown 图片标记
      imageCount++;
      const markdownImg = `![image-${imageCount}](${dataUrl})`;

      // 在光标位置插入
      insertAtCursor(textContent, markdownImg);

      // 添加图片预览缩略图
      addImagePreview(dataUrl, info, imageCount);

      // 更新字符计数
      updateCharCounter();

      showToast(`图片已插入 (${ImageCompressor.formatSize(info.compressedSize)})`, 'success');
    } catch (err) {
      console.error('Image compression error:', err);
      showToast(err.message || '图片处理失败', 'error');
    } finally {
      hideImageProgress();
      submitBtn.disabled = false;
    }
  }

  /**
   * 在光标位置插入文本
   */
  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    // 确保图片标记前后有换行
    const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';

    textarea.value = before + prefix + text + suffix + after;
    
    // 移动光标到插入内容后
    const newPos = (before + prefix + text + suffix).length;
    textarea.selectionStart = newPos;
    textarea.selectionEnd = newPos;
    textarea.focus();
  }

  /**
   * 添加图片预览缩略图
   */
  function addImagePreview(dataUrl, info, index) {
    imagePreview.style.display = 'flex';

    const item = document.createElement('div');
    item.className = 'image-preview-item';
    item.dataset.index = index;

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = `image-${index}`;

    const overlay = document.createElement('div');
    overlay.className = 'image-preview-overlay';
    overlay.innerHTML = `
      <span class="image-preview-size">${ImageCompressor.formatSize(info.compressedSize)}</span>
      <button type="button" class="image-preview-remove" title="移除图片">&times;</button>
    `;

    // 移除图片
    overlay.querySelector('.image-preview-remove').addEventListener('click', function() {
      // 从 textarea 中移除对应的 markdown 图片标记
      const pattern = `![image-${index}]`;
      const content = textContent.value;
      // 找到完整的 ![image-N](data:...) 并移除
      const regex = new RegExp(`\\n?!\\[image-${index}\\]\\([^)]+\\)\\n?`, 'g');
      textContent.value = content.replace(regex, '\n').replace(/^\n+|\n+$/g, '');
      
      item.remove();
      updateCharCounter();

      // 如果没有图片了，隐藏预览区
      if (imagePreview.children.length === 0) {
        imagePreview.style.display = 'none';
      }

      showToast('图片已移除', 'success');
    });

    item.appendChild(img);
    item.appendChild(overlay);
    imagePreview.appendChild(item);
  }

  /**
   * 显示图片处理进度
   */
  function showImageProgress(message) {
    imageProgress.style.display = 'block';
    imageProgress.querySelector('.image-progress-text').textContent = message;
  }

  /**
   * 隐藏图片处理进度
   */
  function hideImageProgress() {
    imageProgress.style.display = 'none';
  }

  // 表单提交
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const content = textContent.value.trim();
    if (!content) {
      showToast('请输入要分享的文本内容', 'error');
      return;
    }

    // 检查内容大小（2MB）
    const contentSize = new Blob([content]).size;
    if (contentSize > MAX_CONTENT_SIZE) {
      showToast(`内容过大，请删减后重试（最大 ${MAX_CONTENT_KB} KB）`, 'error');
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

  // 字符/大小计数
  function updateCharCounter() {
    const content = textContent.value;
    const sizeKB = new Blob([content]).size / 1024;
    const counter = document.getElementById('charCounter');
    if (counter) {
      counter.textContent = `${sizeKB.toFixed(1)} / ${MAX_CONTENT_KB.toLocaleString()} KB`;
      if (sizeKB > MAX_CONTENT_KB) {
        counter.style.color = 'var(--error-color)';
      } else {
        counter.style.color = 'var(--text-muted)';
      }
    }
  }

  textContent.addEventListener('input', updateCharCounter);
});

