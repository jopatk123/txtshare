/**
 * 数据库初始化脚本（独立可执行）
 *
 * 使用 better-sqlite3 同步打开/创建数据库，启用 WAL 模式以提升并发读与写入吞吐。
 * 用法：npm run init-db
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = __dirname;
const dataDir = path.join(dbDir, 'data');
const dbPath = path.join(dataDir, 'share_text.db');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function initDatabase() {
  // 已存在则跳过，避免覆盖数据
  if (fs.existsSync(dbPath)) {
    console.info('数据库文件已存在，跳过初始化:', dbPath);
    return;
  }

  const db = new Database(dbPath);
  try {
    // 启用 WAL 模式，提升读写并发性能
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    db.exec(initSql);
    console.info('数据库初始化完成:', dbPath);
  } finally {
    db.close();
  }
}

initDatabase();
