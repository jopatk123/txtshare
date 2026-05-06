const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const { apiLimiter, createLimiter } = require('../middleware/rateLimiter');

// 公开 API 通用限流（仅限此路由文件，不影响管理员接口）
router.use(apiLimiter);

// 创建分享文本（额外叠加更严格的创建限流）
router.post('/create', createLimiter, shareController.createShareText);

// 获取分享文本
router.get('/text/:id', shareController.getShareText);

module.exports = router;
