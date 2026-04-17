const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../db');
const dataDir = path.join(dbDir, 'data');
const dbPath = path.join(dataDir, 'share_text.db');

// 确保目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let _saveTimer = null;

/**
 * 初始化数据库
 */
async function initDatabase() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  // 如果数据库文件存在，加载它
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    // 执行初始化SQL
    const initSql = fs.readFileSync(path.join(dbDir, 'init.sql'), 'utf8');
    db.run(initSql);
    saveDatabase();
  }
  
  return db;
}

/**
 * 保存数据库到文件（立即保存，用于关键操作）
 */
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * 延迟保存数据库到文件（用于非关键操作如 viewCount 更新，减少 I/O 压力）
 * 多次调用会合并为一次写入，延迟 2 秒
 */
function saveDatabaseDebounced() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveDatabase();
    _saveTimer = null;
  }, 2000);
}

/**
 * 获取数据库实例（同步方法，用于已初始化后）
 */
function getDb() {
  return db;
}

/**
 * 创建分享文本记录
 * @param {string} id - 唯一ID
 * @param {string} content - 文本内容
 * @param {Date|null} expireTime - 过期时间，null表示永不过期
 */
function createShareText(id, content, expireTime) {
  const stmt = db.prepare(`
    INSERT INTO share_text (id, content, expire_time)
    VALUES (?, ?, ?)
  `);
  stmt.run([id, content, expireTime ? expireTime.toISOString() : null]);
  stmt.free();
  saveDatabase();
}

/**
 * 根据ID获取分享文本
 * @param {string} id - 分享ID
 * @returns {Object|null} - 文本记录或null
 */
function getShareTextById(id) {
  const stmt = db.prepare(`
    SELECT id, content, create_time, expire_time, view_count
    FROM share_text
    WHERE id = ?
  `);
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

/**
 * 增加访问次数
 * @param {string} id - 分享ID
 */
function incrementViewCount(id) {
  db.run(`UPDATE share_text SET view_count = view_count + 1 WHERE id = ?`, [id]);
  saveDatabaseDebounced(); // 访问计数是非关键操作，使用延迟保存
}

/**
 * 删除过期记录
 * @returns {number} - 删除的记录数
 */
function deleteExpiredRecords() {
  db.run(`
    DELETE FROM share_text
    WHERE expire_time IS NOT NULL AND expire_time < datetime('now')
  `);
  // 必须在 saveDatabase()（即 db.export()）之前读取，否则会被重置为 0
  const affected = db.getRowsModified();
  saveDatabase();
  return affected;
}

/**
 * 获取所有过期记录的ID（用于清理缓存）
 * @returns {string[]} - 过期记录ID数组
 */
function getExpiredIds() {
  const results = [];
  const stmt = db.prepare(`
    SELECT id FROM share_text
    WHERE expire_time IS NOT NULL AND expire_time < datetime('now')
  `);
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row.id);
  }
  stmt.free();
  return results;
}

/**
 * 检查文本是否过期
 * @param {Object} record - 数据库记录
 * @returns {boolean} - 是否过期
 */
function isExpired(record) {
  if (!record) return true;
  if (!record.expire_time) return false; // null表示永不过期
  return new Date(record.expire_time) < new Date();
}

/**
 * 获取所有分享文本（分页，内容截断用于预览）
 * @param {Object} options - { page, limit, search }
 * @returns {{ total: number, rows: Object[] }}
 */
function getAllShareTexts({ page = 1, limit = 20, search = '' } = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  let whereClause = '';

  if (search && search.trim()) {
    whereClause = ' WHERE id LIKE ?';
    params.push(`%${search.trim()}%`);
  }

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM share_text${whereClause}`);
  if (params.length > 0) countStmt.bind(params);
  let total = 0;
  if (countStmt.step()) {
    total = countStmt.getAsObject().total;
  }
  countStmt.free();

  const dataStmt = db.prepare(
    `SELECT id, substr(content, 1, 120) as content_preview, create_time, expire_time, view_count
     FROM share_text${whereClause}
     ORDER BY create_time DESC LIMIT ? OFFSET ?`
  );
  dataStmt.bind([...params, limit, offset]);

  const rows = [];
  while (dataStmt.step()) {
    rows.push(dataStmt.getAsObject());
  }
  dataStmt.free();

  return { total, rows };
}

/**
 * 根据ID删除单条记录
 * @param {string} id - 分享ID
 * @returns {boolean} - 是否删除成功
 */
function deleteShareTextById(id) {
  db.run('DELETE FROM share_text WHERE id = ?', [id]);
  const affected = db.getRowsModified();
  if (affected > 0) saveDatabase();
  return affected > 0;
}

/**
 * 批量删除记录
 * @param {string[]} ids - 分享ID数组
 * @returns {number} - 删除的记录数
 */
function deleteShareTextsByIds(ids) {
  if (!ids || ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM share_text WHERE id IN (${placeholders})`, ids);
  const affected = db.getRowsModified();
  if (affected > 0) saveDatabase();
  return affected;
}

/**
 * 获取数据库统计信息
 * @returns {{ total: number, totalViews: number, expired: number, neverExpire: number }}
 */
function getStats() {
  const totalStmt = db.prepare(
    'SELECT COUNT(*) as total, COALESCE(SUM(view_count), 0) as total_views FROM share_text'
  );
  let total = 0;
  let totalViews = 0;
  if (totalStmt.step()) {
    const row = totalStmt.getAsObject();
    total = row.total;
    totalViews = row.total_views;
  }
  totalStmt.free();

  const expiredStmt = db.prepare(
    `SELECT COUNT(*) as expired FROM share_text
     WHERE expire_time IS NOT NULL AND expire_time < datetime('now')`
  );
  let expired = 0;
  if (expiredStmt.step()) {
    expired = expiredStmt.getAsObject().expired;
  }
  expiredStmt.free();

  const neverExpireStmt = db.prepare(
    'SELECT COUNT(*) as never_expire FROM share_text WHERE expire_time IS NULL'
  );
  let neverExpire = 0;
  if (neverExpireStmt.step()) {
    neverExpire = neverExpireStmt.getAsObject().never_expire;
  }
  neverExpireStmt.free();

  return { total, totalViews, expired, neverExpire };
}

module.exports = {
  initDatabase,
  getDb,
  createShareText,
  getShareTextById,
  incrementViewCount,
  deleteExpiredRecords,
  getExpiredIds,
  isExpired,
  getAllShareTexts,
  deleteShareTextById,
  deleteShareTextsByIds,
  getStats
};
