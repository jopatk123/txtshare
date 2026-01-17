const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const { createLimiter } = require('../middleware/rateLimiter');

// 创建分享文本
router.post('/create', createLimiter, shareController.createShareText);

// 获取分享文本
router.get('/text/:id', shareController.getShareText);

module.exports = router;
