const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');
const { adminLimiter } = require('../middleware/rateLimiter');

// 管理员接口独立限流（在鉴权前，防止令牌暴力猜测）
router.use(adminLimiter);

// 所有管理员 API 都需要认证
router.use(adminAuth);

// 统计信息
router.get('/stats', adminController.getStats);

// 分享列表（分页 + 搜索）
router.get('/shares', adminController.listShares);

// 删除单条
router.delete('/shares/:id', adminController.deleteShare);

// 批量删除
router.delete('/shares', adminController.deleteBatch);

// 清理过期记录
router.post('/cleanup', adminController.cleanupExpired);

module.exports = router;
