/**
 * 主页面脚本
 */

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('shareForm');
  const editor = document.getElementById('textContent');
  const expireType = document.getElementById('expireType');
  const customDaysWrapper = document.getElementById('customDaysWrapper');
  const customDays = document.getElementById('customDays');
  const submitBtn = document.getElementById('submitBtn');
  const result = document.getElementById('result');
  const shareUrl = document.getElementById('shareUrl');
  const copyBtn = document.getElementById('copyBtn');
  const expireInfo = document.getElementById('expireInfo');
  const imageProgress = document.getElementById('imageProgress');

  // 内容最大限制（2MB，含图片 base64）
  const MAX_CONTENT_KB = 2048;
  const MAX_CONTENT_SIZE = MAX_CONTENT_KB * 1024;

  // 已插入的图片计数
  let imageCount = 0;

  // ======== 将 contenteditable 内容序列化为纯文本/Markdown ========
  function getEditorContent() {
    const parts = [];

    function serialize(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toUpperCase();
        // editor-img-wrapper: <div contenteditable=false> 包裹的图片
        if (tag === 'DIV' && node.classList.contains('editor-img-wrapper')) {
          const imgEl = node.querySelector('img');
          if (imgEl) {
            const alt = imgEl.alt || `image-${imgEl.dataset.index || ''}`;
            if (parts.length > 0 && parts[parts.length - 1] !== '\n') parts.push('\n');
            parts.push(`![${alt}](${imgEl.src})`);
            parts.push('\n');
          }
        } else if (tag === 'IMG') {
          const alt = node.alt || `image-${node.dataset.index || ''}`;
          if (parts.length > 0 && parts[parts.length - 1] !== '\n') parts.push('\n');
          parts.push(`![${alt}](${node.src})`);
          parts.push('\n');
        } else if (tag === 'BR') {
          parts.push('\n');
        } else if (tag === 'DIV' || tag === 'P') {
          // 块级元素：内容前确保有换行（首个块除外）
          if (parts.length > 0 && parts[parts.length - 1] !== '\n') parts.push('\n');
          Array.from(node.childNodes).forEach(serialize);
          if (parts.length > 0 && parts[parts.length - 1] !== '\n') parts.push('\n');
        } else {
          Array.from(node.childNodes).forEach(serialize);
        }
      }
    }

    Array.from(editor.childNodes).forEach(serialize);
    return parts.join('').trim();
  }

  // ======== 监听过期类型变化 ========
  expireType.addEventListener('change', function() {
    if (this.value === 'custom') {
      customDaysWrapper.classList.add('show');
    } else {
      customDaysWrapper.classList.remove('show');
    }
  });

  // ======== 图片粘贴处理 ========
  editor.addEventListener('paste', async function(e) {
    const imageFile = ImageCompressor.getImageFromClipboard(e);
    if (!imageFile) return; // 非图片，走默认行为（允许粘贴文本）

    e.preventDefault();
    await handleImageInsert(imageFile);
  });

  // ======== 图片拖拽处理 ========
  editor.addEventListener('dragover', function(e) {
    e.preventDefault();
    editor.classList.add('drag-over');
  });

  editor.addEventListener('dragleave', function(e) {
    e.preventDefault();
    editor.classList.remove('drag-over');
  });

  editor.addEventListener('drop', async function(e) {
    editor.classList.remove('drag-over');
    const imageFile = ImageCompressor.getImageFromDrop(e);
    if (!imageFile) return;

    e.preventDefault();
    await handleImageInsert(imageFile);
  });

  /**
   * 处理图片插入（粘贴或拖拽）
   */
  async function handleImageInsert(imageFile) {
    showImageProgress('正在处理图片...');
    submitBtn.disabled = true;

    // 记录处理前的选区，以便后续在正确位置插入
    const savedRange = saveCursorRange();

    try {
      const { dataUrl, info } = await ImageCompressor.compress(imageFile, function(msg) {
        showImageProgress(msg);
      });

      imageCount++;
      insertImageAtCaret(dataUrl, imageCount, savedRange);
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
   * 保存当前光标/选区范围
   */
  function saveCursorRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      return sel.getRangeAt(0).cloneRange();
    }
    return null;
  }

  /**
   * 在指定范围（或末尾）插入图片元素
   */
  function insertImageAtCaret(dataUrl, index, savedRange) {
    // 构建图片 wrapper（contenteditable=false 防止光标进入内部）
    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'false';
    wrapper.className = 'editor-img-wrapper';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = `image-${index}`;
    img.dataset.index = index;
    img.className = 'editor-inline-image';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'editor-img-remove';
    removeBtn.title = '移除图片';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      removeEditorImage(wrapper, index);
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);

    editor.focus();
    const sel = window.getSelection();

    let range;
    if (savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
      range = savedRange;
    } else if (sel && sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
    }

    if (range && editor.contains(range.commonAncestorContainer)) {
      range.deleteContents();

      const frag = document.createDocumentFragment();
      frag.appendChild(document.createElement('br'));
      frag.appendChild(wrapper);
      const afterBr = document.createElement('br');
      frag.appendChild(afterBr);

      range.insertNode(frag);

      const newRange = document.createRange();
      newRange.setStartAfter(afterBr);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      editor.appendChild(document.createElement('br'));
      editor.appendChild(wrapper);
      editor.appendChild(document.createElement('br'));
    }
  }

  /**
   * 从编辑器中移除图片 wrapper
   */
  function removeEditorImage(wrapperEl, index) {
    const prev = wrapperEl.previousSibling;
    const next = wrapperEl.nextSibling;
    if (prev && prev.nodeName === 'BR') prev.remove();
    if (next && next.nodeName === 'BR') next.remove();
    wrapperEl.remove();
    updateCharCounter();
    showToast('图片已移除', 'success');
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

  // ======== 表单提交 ========
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const content = getEditorContent();
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

    submitBtn.disabled = true;
    submitBtn.textContent = '生成中...';

    try {
      const response = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          expireType: expireTypeValue,
          expireDays: expireDaysValue
        })
      });

      const data = await response.json();

      if (data.success) {
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

  // ======== 复制链接 ========
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

  // ======== 字符/大小计数 ========
  function updateCharCounter() {
    const content = getEditorContent();
    const sizeKB = new Blob([content]).size / 1024;
    const counter = document.getElementById('charCounter');
    if (counter) {
      counter.textContent = `${sizeKB.toFixed(1)} / ${MAX_CONTENT_KB.toLocaleString()} KB`;
      counter.style.color = sizeKB > MAX_CONTENT_KB ? 'var(--error-color)' : 'var(--text-muted)';
    }
  }

  editor.addEventListener('input', updateCharCounter);
});

