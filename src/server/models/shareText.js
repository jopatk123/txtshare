/**
 * 分享文本数据模型
 *
 * 基于 better-sqlite3 同步 API，启用 WAL 模式：
 * - 增量写入，无需全量 export+fsync
 * - prepared statements 复用
 * - 同步事务保证原子性
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ── 路径与常量 ──────────────────────────────────────────────────────────────

const dbDir = path.join(__dirname, '../db');
const dataDir = path.join(dbDir, 'data');
const dbPath = path.join(dataDir, 'share_text.db');

// ID 碰撞重试次数（10 位 base62 碰撞概率极低，5 次足够兜底）
const MAX_ID_RETRIES = 5;
// 管理后台内容预览长度
const CONTENT_PREVIEW_LENGTH = 120;
// 分页参数上下限
const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 20;
// 审计日志查询上限
const MAX_AUDIT_LOG_LIMIT = 100;
const DEFAULT_AUDIT_LOG_LIMIT = 20;
// 批量删除单次上限
const MAX_BATCH_DELETE = 200;

const EXPIRED_RECORDS_CONDITION =
  "expire_time IS NOT NULL AND datetime(expire_time) < datetime('now')";

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ── 数据库实例与 prepared statements ─────────────────────────────────────────

let db = null;
let stmts = null;

/**
 * 轻量迁移：为旧库的 audit_log 补充 user_agent 列
 * better-sqlite3 可通过 pragma table_info 检查列是否存在
 */
function migrateAuditLogUserAgent(database) {
  const columns = database.pragma('table_info(audit_log)');
  const hasUserAgent = columns.some((col) => col.name === 'user_agent');
  if (!hasUserAgent) {
    database.exec('ALTER TABLE audit_log ADD COLUMN user_agent TEXT');
  }
}

/**
 * 初始化数据库连接并预编译 statements
 */
function initDatabase() {
  if (db) return db;

  db = new Database(dbPath);
  // WAL 提升读写并发；NORMAL 同步级别在 WAL 下不会损坏数据
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // 加载 schema（IF NOT EXISTS，安全幂等）
  const initSql = fs.readFileSync(path.join(dbDir, 'init.sql'), 'utf8');
  db.exec(initSql);

  // 轻量迁移：为旧库的 audit_log 补充 user_agent 列
  migrateAuditLogUserAgent(db);

  // 预编译常用 statements，避免每次调用重新解析 SQL
  stmts = {
    insertShare: db.prepare(`
      INSERT INTO share_text (id, content, expire_time)
      VALUES (?, ?, ?)
    `),
    getById: db.prepare(`
      SELECT id, content, create_time, expire_time, view_count
      FROM share_text
      WHERE id = ?
    `),
    incrementView: db.prepare('UPDATE share_text SET view_count = view_count + 1 WHERE id = ?'),
    deleteExpired: db.prepare(`DELETE FROM share_text WHERE ${EXPIRED_RECORDS_CONDITION}`),
    selectExpiredIds: db.prepare(`SELECT id FROM share_text WHERE ${EXPIRED_RECORDS_CONDITION}`),
    deleteById: db.prepare('DELETE FROM share_text WHERE id = ?'),
    countAll: db.prepare('SELECT COUNT(*) AS total FROM share_text'),
    countSearch: db.prepare('SELECT COUNT(*) AS total FROM share_text WHERE id LIKE ?'),
    statsTotal: db.prepare(
      'SELECT COUNT(*) AS total, COALESCE(SUM(view_count), 0) AS total_views FROM share_text'
    ),
    statsExpired: db.prepare(
      `SELECT COUNT(*) AS expired FROM share_text WHERE ${EXPIRED_RECORDS_CONDITION}`
    ),
    statsNeverExpire: db.prepare(
      'SELECT COUNT(*) AS never_expire FROM share_text WHERE expire_time IS NULL'
    ),
    insertAudit: db.prepare(`
      INSERT INTO audit_log (action, target, detail, actor_ip, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `),
    selectAudit: db.prepare(`
      SELECT id, action, target, detail, actor_ip, user_agent, created_time
      FROM audit_log
      ORDER BY id DESC
      LIMIT ?
    `),
  };

  return db;
}

/**
 * 获取数据库实例（供测试/管理直接执行 SQL）
 */
function getDb() {
  return db;
}

/**
 * 关闭数据库连接（优雅关闭时调用）
 */
function closeDatabase() {
  if (!db) return;
  // WAL 模式下 checkpoint 保证数据落盘
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // checkpoint 失败不阻塞关闭
  }
  db.close();
  db = null;
  stmts = null;
}

/**
 * 兼容旧接口：better-sqlite3 同步写入，无需 flush
 * 保留导出以避免破坏现有调用方与测试
 */
function flushPendingWrites() {
  // no-op：所有写操作已即时落盘
}

// ── 业务方法 ─────────────────────────────────────────────────────────────────

/**
 * 创建分享文本记录
 * @param {string} id - 唯一ID
 * @param {string} content - 文本内容
 * @param {Date|null} expireTime - 过期时间，null 表示永不过期
 */
function createShareText(id, content, expireTime) {
  stmts.insertShare.run(id, content, expireTime ? expireTime.toISOString() : null);
}

/**
 * 根据 ID 获取分享文本
 */
function getShareTextById(id) {
  return stmts.getById.get(id) || null;
}

/**
 * 增加访问次数（WAL 模式下写入开销极低）
 */
function incrementViewCount(id) {
  stmts.incrementView.run(id);
}

/**
 * 删除过期记录
 * @returns {number} 删除的记录数
 */
function deleteExpiredRecords() {
  const info = stmts.deleteExpired.run();
  return info.changes;
}

/**
 * 获取所有过期记录的 ID（用于清理缓存）
 * @returns {string[]}
 */
function getExpiredIds() {
  return stmts.selectExpiredIds.all().map((row) => row.id);
}

/**
 * 检查文本是否过期
 */
function isExpired(record) {
  if (!record) return true;
  if (!record.expire_time) return false;
  return new Date(record.expire_time) < new Date();
}

/**
 * 获取所有分享文本（分页，内容截断用于预览）
 * @param {Object} options - { page, limit, search }
 * @returns {{ total: number, rows: Object[] }}
 */
function getAllShareTexts({ page = 1, limit = DEFAULT_PAGE_LIMIT, search = '' } = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let total;
  let rows;
  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    total = stmts.countSearch.get(like).total;
    rows = db
      .prepare(
        `SELECT id, substr(content, 1, ${CONTENT_PREVIEW_LENGTH}) AS content_preview,
                create_time, expire_time, view_count
         FROM share_text
         WHERE id LIKE ?
         ORDER BY create_time DESC
         LIMIT ? OFFSET ?`
      )
      .all(like, safeLimit, offset);
  } else {
    total = stmts.countAll.get().total;
    rows = db
      .prepare(
        `SELECT id, substr(content, 1, ${CONTENT_PREVIEW_LENGTH}) AS content_preview,
                create_time, expire_time, view_count
         FROM share_text
         ORDER BY create_time DESC
         LIMIT ? OFFSET ?`
      )
      .all(safeLimit, offset);
  }

  return { total, rows };
}

/**
 * 根据 ID 删除单条记录
 */
function deleteShareTextById(id) {
  const info = stmts.deleteById.run(id);
  return info.changes > 0;
}

/**
 * 批量删除记录
 * @param {string[]} ids
 * @returns {number} 删除的记录数
 */
function deleteShareTextsByIds(ids) {
  if (!ids || ids.length === 0) return 0;
  if (ids.length > MAX_BATCH_DELETE) {
    throw new Error(`单次最多删除 ${MAX_BATCH_DELETE} 条记录`);
  }
  const placeholders = ids.map(() => '?').join(',');
  const info = db.prepare(`DELETE FROM share_text WHERE id IN (${placeholders})`).run(...ids);
  return info.changes;
}

/**
 * 获取数据库统计信息
 */
function getStats() {
  const totalRow = stmts.statsTotal.get();
  const expiredRow = stmts.statsExpired.get();
  const neverRow = stmts.statsNeverExpire.get();
  return {
    total: totalRow.total,
    totalViews: totalRow.total_views,
    expired: expiredRow.expired,
    neverExpire: neverRow.never_expire,
  };
}

/**
 * 写入审计日志
 */
function createAuditLog({ action, target, detail = null, actorIp = null, userAgent = null }) {
  stmts.insertAudit.run(
    action,
    target,
    detail === null ? null : JSON.stringify(detail),
    actorIp,
    userAgent
  );
}

/**
 * 查询审计日志
 */
function getAuditLogs({ limit = DEFAULT_AUDIT_LOG_LIMIT } = {}) {
  const safeLimit = Math.min(
    MAX_AUDIT_LOG_LIMIT,
    Math.max(1, parseInt(limit, 10) || DEFAULT_AUDIT_LOG_LIMIT)
  );
  return stmts.selectAudit.all(safeLimit).map((row) => {
    let detail = null;
    if (row.detail) {
      try {
        detail = JSON.parse(row.detail);
      } catch {
        detail = row.detail;
      }
    }
    return {
      id: row.id,
      action: row.action,
      target: row.target,
      detail,
      actorIp: row.actor_ip,
      userAgent: row.user_agent,
      createdTime: row.created_time,
    };
  });
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  flushPendingWrites,
  createShareText,
  getShareTextById,
  incrementViewCount,
  deleteExpiredRecords,
  getExpiredIds,
  isExpired,
  getAllShareTexts,
  deleteShareTextById,
  deleteShareTextsByIds,
  getStats,
  createAuditLog,
  getAuditLogs,
  // 暴露常量供测试与外部使用
  MAX_BATCH_DELETE,
  MAX_ID_RETRIES,
  CONTENT_PREVIEW_LENGTH,
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
};
