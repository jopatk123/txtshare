/**
 * 图片智能压缩工具
 * 支持粘贴/拖拽图片，自动判断并压缩
 */

const ImageCompressor = (function() {
  // 配置常量
  const CONFIG = {
    MAX_WIDTH: 1920,           // 最大宽度
    MAX_HEIGHT: 1080,          // 最大高度
    MAX_FILE_SIZE: 500 * 1024, // 单张图片最大 500KB（压缩后）
    INITIAL_QUALITY: 0.85,     // 初始 JPEG 质量
    MIN_QUALITY: 0.3,          // 最低 JPEG 质量
    QUALITY_STEP: 0.05,        // 每次降低的质量步长
    SUPPORTED_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'],
  };

  /**
   * 从粘贴事件中提取图片文件
   * @param {ClipboardEvent} event - 粘贴事件
   * @returns {File|null} 图片文件或 null
   */
  function getImageFromClipboard(event) {
    const items = event.clipboardData?.items;
    if (!items) return null;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        return items[i].getAsFile();
      }
    }
    return null;
  }

  /**
   * 从拖拽事件中提取图片文件
   * @param {DragEvent} event - 拖拽事件
   * @returns {File|null} 图片文件或 null
   */
  function getImageFromDrop(event) {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return null;

    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        return files[i];
      }
    }
    return null;
  }

  /**
   * 将 File 对象读取为 Image 元素
   * @param {File} file - 图片文件
   * @returns {Promise<{img: HTMLImageElement, originalSize: number, type: string}>}
   */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          resolve({
            img,
            originalSize: file.size,
            type: file.type
          });
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 检测图片是否包含透明通道
   * @param {HTMLCanvasElement} canvas - 画布
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @returns {boolean} 是否有透明像素
   */
  function hasTransparency(canvas, ctx) {
    try {
      // 采样检测，避免遍历所有像素
      const sampleSize = Math.min(canvas.width, 100);
      const sampleHeight = Math.min(canvas.height, 100);
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleHeight);
      const data = imageData.data;
      
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * 计算缩放后的尺寸（保持宽高比）
   * @param {number} width - 原始宽度
   * @param {number} height - 原始高度
   * @returns {{width: number, height: number}} 缩放后的尺寸
   */
  function calcResizedDimensions(width, height) {
    let newWidth = width;
    let newHeight = height;

    if (newWidth > CONFIG.MAX_WIDTH) {
      newHeight = Math.round(newHeight * (CONFIG.MAX_WIDTH / newWidth));
      newWidth = CONFIG.MAX_WIDTH;
    }

    if (newHeight > CONFIG.MAX_HEIGHT) {
      newWidth = Math.round(newWidth * (CONFIG.MAX_HEIGHT / newHeight));
      newHeight = CONFIG.MAX_HEIGHT;
    }

    return { width: newWidth, height: newHeight };
  }

  /**
   * 获取 base64 数据的字节大小
   * @param {string} dataUrl - data URL 字符串
   * @returns {number} 字节数
   */
  function getBase64Size(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return 0;
    // base64 编码后大小约为原始的 4/3
    return Math.round(base64.length * 3 / 4);
  }

  /**
   * 智能压缩图片
   * @param {File} file - 图片文件
   * @param {function} onProgress - 进度回调 (message: string)
   * @returns {Promise<{dataUrl: string, info: Object}>} 压缩后的 data URL 和压缩信息
   */
  async function compress(file, onProgress) {
    if (!CONFIG.SUPPORTED_TYPES.includes(file.type)) {
      throw new Error(`不支持的图片格式: ${file.type}`);
    }

    onProgress?.('正在读取图片...');
    const { img, originalSize, type } = await loadImage(file);

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;

    onProgress?.(`原始图片: ${originalWidth}×${originalHeight}, ${formatSize(originalSize)}`);

    // 1. 计算缩放尺寸
    const { width, height } = calcResizedDimensions(originalWidth, originalHeight);
    const needsResize = width !== originalWidth || height !== originalHeight;

    // 2. 创建画布并绘制
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 使用高质量缩放
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // 3. 判断是否需要保留透明通道
    const isTransparent = (type === 'image/png' || type === 'image/webp') && hasTransparency(canvas, ctx);

    // 4. 选择输出格式
    let outputFormat = 'image/jpeg';
    if (isTransparent) {
      outputFormat = 'image/png';
      onProgress?.('检测到透明通道，保持 PNG 格式');
    } else {
      onProgress?.('使用 JPEG 格式优化体积');
    }

    // 5. 压缩至目标大小
    let dataUrl;
    let compressedSize;

    if (outputFormat === 'image/png') {
      // PNG 无法调整质量，直接输出
      dataUrl = canvas.toDataURL('image/png');
      compressedSize = getBase64Size(dataUrl);

      // 如果 PNG 太大且没有透明通道需求，强制转 JPEG
      if (compressedSize > CONFIG.MAX_FILE_SIZE && !isTransparent) {
        onProgress?.('PNG 体积过大，转换为 JPEG...');
        outputFormat = 'image/jpeg';
      }
    }

    if (outputFormat === 'image/jpeg') {
      let quality = CONFIG.INITIAL_QUALITY;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      compressedSize = getBase64Size(dataUrl);

      // 逐步降低质量直到满足大小要求
      while (compressedSize > CONFIG.MAX_FILE_SIZE && quality > CONFIG.MIN_QUALITY) {
        quality -= CONFIG.QUALITY_STEP;
        quality = Math.max(quality, CONFIG.MIN_QUALITY);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        compressedSize = getBase64Size(dataUrl);
        onProgress?.(`压缩中... 质量: ${Math.round(quality * 100)}%, 大小: ${formatSize(compressedSize)}`);
      }
    }

    compressedSize = getBase64Size(dataUrl);
    const compressionRatio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : 0;

    const info = {
      originalSize,
      compressedSize,
      originalWidth,
      originalHeight,
      finalWidth: width,
      finalHeight: height,
      format: outputFormat,
      compressionRatio: `${compressionRatio}%`,
      wasResized: needsResize,
    };

    onProgress?.(`压缩完成: ${formatSize(originalSize)} → ${formatSize(compressedSize)} (节省 ${compressionRatio}%)`);

    return { dataUrl, info };
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化的大小字符串
   */
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * 将压缩后的图片作为 Markdown 图片语法插入
   * @param {string} dataUrl - 图片 data URL
   * @returns {string} Markdown 图片语法
   */
  function toMarkdownImage(dataUrl) {
    return `![image](${dataUrl})`;
  }

  return {
    CONFIG,
    compress,
    getImageFromClipboard,
    getImageFromDrop,
    toMarkdownImage,
    formatSize,
  };
})();
