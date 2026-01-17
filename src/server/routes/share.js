const express = require('express');
const router = express.Router();
const path = require('path');
const shareTextModel = require('../models/shareText');
const cache = require('../middleware/cache');
const logger = require('../middleware/logger');
const { validateShareId } = require('../utils/validator');

/**
 * 分享页面路由
 * GET /s/:id
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // 校验ID
    const idValidation = validateShareId(id);
    if (!idValidation.valid) {
      return res.sendFile(path.join(__dirname, '../../public/expired.html'));
    }

    // 先查缓存
    let textData = cache.get(id);

    if (!textData) {
      // 缓存未命中，查数据库
      const record = shareTextModel.getShareTextById(id);

      if (!record) {
        return res.sendFile(path.join(__dirname, '../../public/expired.html'));
      }

      // 检查是否过期
      if (shareTextModel.isExpired(record)) {
        return res.sendFile(path.join(__dirname, '../../public/expired.html'));
      }

      textData = {
        content: record.content,
        expireTime: record.expire_time
      };

      // 存入缓存
      cache.setWithExpireTime(id, textData, record.expire_time);
    } else {
      // 缓存命中，检查是否过期
      if (textData.expireTime && new Date(textData.expireTime) < new Date()) {
        cache.del(id);
        return res.sendFile(path.join(__dirname, '../../public/expired.html'));
      }
    }

    logger.info(`Page accessed: /s/${id}`);

    // 返回分享页面
    res.sendFile(path.join(__dirname, '../../public/share.html'));

  } catch (error) {
    logger.error('Share page error:', error);
    res.sendFile(path.join(__dirname, '../../public/expired.html'));
  }
});

module.exports = router;
