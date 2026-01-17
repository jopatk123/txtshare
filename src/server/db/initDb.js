const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname);
const dbPath = path.join(dbDir, 'share_text.db');

// 确保目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // 创建新数据库
  const db = new SQL.Database();
  
  // 读取初始化SQL
  const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
  
  // 执行初始化
  db.run(initSql);
  
  // 保存到文件
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  
  console.log('数据库初始化完成:', dbPath);
  
  db.close();
}

initDatabase().catch(console.error);
