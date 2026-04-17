const shareTextModel = require('../models/shareText');
const cache = require('../middleware/cache');
const logger = require('../middleware/logger');
const { getRequestBaseUrl } = require('../utils/baseUrl');

/**
 * 获取统计信息
 * GET /api/admin/stats
 */
async function getStats(req, res) {
  try {
    const stats = shareTextModel.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Admin getStats error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
}

/**
 * 获取所有分享列表（分页）
 * GET /api/admin/shares?page=1&limit=20&search=
 */
async function listShares(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = String(req.query.search || '').trim().slice(0, 100);

    const result = shareTextModel.getAllShareTexts({ page, limit, search });
    const baseUrl = getRequestBaseUrl(req);

    const rows = result.rows.map(row => ({
      id: row.id,
      contentPreview: row.content_preview,
      createTime: row.create_time,
      expireTime: row.expire_time,
      viewCount: row.view_count,
      url: `${baseUrl}/s/${row.id}`,
      isExpired: row.expire_time ? new Date(row.expire_time) < new Date() : false
    }));

    res.json({
      success: true,
      data: {
        total: result.total,
        page,
        limit,
        rows
      }
    });
  } catch (error) {
    logger.error('Admin listShares error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
}

/**
 * 删除单条分享
 * DELETE /api/admin/shares/:id
 */
async function deleteShare(req, res) {
  try {
    const { id } = req.params;

    if (!id || !/^[a-zA-Z0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, error: '无效的 ID' });
    }

    const deleted = shareTextModel.deleteShareTextById(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    cache.del(id);
    logger.info(`Admin deleted share: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Admin deleteShare error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
}

/**
 * 批量删除分享
 * DELETE /api/admin/shares  (body: { ids: string[] })
 */
async function deleteBatch(req, res) {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '请提供要删除的 ID 列表' });
    }

    if (ids.length > 200) {
      return res.status(400).json({ success: false, error: '单次最多删除 200 条记录' });
    }

    const validIds = ids.filter(id => typeof id === 'string' && /^[a-zA-Z0-9]+$/.test(id));

    const deleted = shareTextModel.deleteShareTextsByIds(validIds);
    cache.delMultiple(validIds);

    logger.info(`Admin batch deleted ${deleted} shares`);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    logger.error('Admin deleteBatch error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
}

/**
 * 清理所有过期记录
 * POST /api/admin/cleanup
 */
async function cleanupExpired(req, res) {
  try {
    const expiredIds = shareTextModel.getExpiredIds();
    const deleted = shareTextModel.deleteExpiredRecords();

    if (expiredIds.length > 0) {
      cache.delMultiple(expiredIds);
    }

    logger.info(`Admin cleanup: ${deleted} expired records deleted`);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    logger.error('Admin cleanup error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
}

module.exports = {
  getStats,
  listShares,
  deleteShare,
  deleteBatch,
  cleanupExpired
};
