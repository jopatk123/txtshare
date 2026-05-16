const express = require('express');
const router = express.Router();
const path = require('path');
const logger = require('../middleware/logger');
const { sharePageLimiter } = require('../middleware/rateLimiter');
const { validateShareId } = require('../utils/validator');

/**
 * 分享页面路由
 * GET /s/:id
 */
router.get('/:id', sharePageLimiter, (req, res) => {
  try {
    const { id } = req.params;

    // 校验ID
    const idValidation = validateShareId(id);
    if (!idValidation.valid) {
      return res.sendFile(path.join(__dirname, '../../public/expired.html'));
    }

    // 返回分享页面
    res.sendFile(path.join(__dirname, '../../public/share.html'));

  } catch (error) {
    logger.error('Share page error:', error);
    res.sendFile(path.join(__dirname, '../../public/expired.html'));
  }
});

module.exports = router;
