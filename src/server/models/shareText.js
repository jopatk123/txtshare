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
 * 保存数据库到文件
 */
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
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
  saveDatabase();
}

/**
 * 删除过期记录
 * @returns {number} - 删除的记录数
 */
function deleteExpiredRecords() {
  const result = db.run(`
    DELETE FROM share_text
    WHERE expire_time IS NOT NULL AND expire_time < datetime('now')
  `);
  saveDatabase();
  return db.getRowsModified();
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

module.exports = {
  initDatabase,
  getDb,
  createShareText,
  getShareTextById,
  incrementViewCount,
  deleteExpiredRecords,
  getExpiredIds,
  isExpired
};
