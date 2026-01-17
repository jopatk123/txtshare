const shareTextModel = require('../models/shareText');
const { generateId } = require('../utils/idGenerator');
const { escapeHtml } = require('../utils/xssFilter');
const { calculateExpireTime, formatDateTime } = require('../utils/dateUtil');
const { validateContent, validateExpireType, validateCustomDays, validateShareId } = require('../utils/validator');
const cache = require('../middleware/cache');
const logger = require('../middleware/logger');

/**
 * 创建分享文本
 * POST /api/create
 */
async function createShareText(req, res) {
  try {
    const { content, expireType, expireDays } = req.body;

    // 校验文本内容
    const contentValidation = validateContent(content);
    if (!contentValidation.valid) {
      return res.status(400).json({
        success: false,
        error: contentValidation.error
      });
    }

    // 校验过期类型
    const expireTypeValidation = validateExpireType(expireType);
    if (!expireTypeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: expireTypeValidation.error
      });
    }

    // 如果是自定义过期，校验天数
    if (expireType === 'custom') {
      const daysValidation = validateCustomDays(expireDays);
      if (!daysValidation.valid) {
        return res.status(400).json({
          success: false,
          error: daysValidation.error
        });
      }
    }

    // 生成唯一ID
    const id = generateId(10);

    // XSS转义处理
    const escapedContent = escapeHtml(content);

    // 计算过期时间
    const expireTime = calculateExpireTime(expireType, expireDays);

    // 存入数据库
    shareTextModel.createShareText(id, escapedContent, expireTime);

    // 存入缓存
    cache.setWithExpireTime(id, {
      content: escapedContent,
      expireTime: expireTime ? expireTime.toISOString() : null
    }, expireTime);

    // 构建分享链接
    const baseUrl = process.env.BASE_URL || 'https://script.jopatk.top';
    const shareUrl = `${baseUrl}/s/${id}`;

    logger.info(`Created share text: ${id}, expire: ${expireTime ? formatDateTime(expireTime) : 'never'}`);

    res.json({
      success: true,
      data: {
        id,
        url: shareUrl,
        expireTime: expireTime ? expireTime.toISOString() : null,
        expireTimeFormatted: formatDateTime(expireTime)
      }
    });

  } catch (error) {
    logger.error('Create share text error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  }
}

/**
 * 获取分享文本
 * GET /api/text/:id
 */
async function getShareText(req, res) {
  try {
    const { id } = req.params;

    // 校验ID
    const idValidation = validateShareId(id);
    if (!idValidation.valid) {
      return res.status(400).json({
        success: false,
        error: idValidation.error
      });
    }

    // 先查缓存
    let textData = cache.get(id);

    if (!textData) {
      // 缓存未命中，查数据库
      const record = shareTextModel.getShareTextById(id);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: '链接不存在'
        });
      }

      // 检查是否过期
      if (shareTextModel.isExpired(record)) {
        return res.status(410).json({
          success: false,
          error: '链接已失效'
        });
      }

      textData = {
        content: record.content,
        expireTime: record.expire_time,
        createTime: record.create_time,
        viewCount: record.view_count
      };

      // 存入缓存
      cache.setWithExpireTime(id, textData, record.expire_time);
    } else {
      // 缓存命中，检查是否过期
      if (textData.expireTime && new Date(textData.expireTime) < new Date()) {
        cache.del(id);
        return res.status(410).json({
          success: false,
          error: '链接已失效'
        });
      }
    }

    // 增加访问次数
    shareTextModel.incrementViewCount(id);

    logger.info(`Accessed share text: ${id}`);

    res.json({
      success: true,
      data: {
        content: textData.content,
        createTime: textData.createTime,
        expireTime: textData.expireTime,
        expireTimeFormatted: formatDateTime(textData.expireTime)
      }
    });

  } catch (error) {
    logger.error('Get share text error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  }
}

module.exports = {
  createShareText,
  getShareText
};
