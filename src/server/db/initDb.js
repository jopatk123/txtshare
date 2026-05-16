const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname);
const dataDir = path.join(dbDir, 'data');
const dbPath = path.join(dataDir, 'share_text.db');

// 确保目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function initDatabase() {
  // 如果数据库文件已存在，跳过初始化以防止数据丢失
  if (fs.existsSync(dbPath)) {
    console.log('数据库文件已存在，跳过初始化:', dbPath);
    return;
  }

  const SQL = await initSqlJs();
  
  // 创建新数据库
  const db = new SQL.Database();
  
  // 读取初始化SQL
  const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
  
  // 执行初始化
  db.run(initSql);
  
  // 保存到文件（原子写）
  const data = db.export();
  const buffer = Buffer.from(data);
  const tmpPath = `${dbPath}.tmp`;
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, dbPath);
  
  console.log('数据库初始化完成:', dbPath);
  
  db.close();
}

initDatabase().catch(console.error);
