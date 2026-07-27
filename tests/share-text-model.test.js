/**
 * 模型持久化测试
 * 验证 better-sqlite3 的增量写入特性：写操作即时落盘，无需显式 flush
 */

const Database = require('better-sqlite3');
const path = require('path');

const shareTextModel = require('../src/server/models/shareText');

const dbPath = path.join(__dirname, '../src/server/db/data/share_text.db');

function readPersistedViewCount(id) {
  // 以只读方式打开同一数据库文件，验证数据已落盘
  const roDb = new Database(dbPath, { readonly: true });
  try {
    const row = roDb.prepare('SELECT view_count FROM share_text WHERE id = ?').get(id);
    return row ? row.view_count : null;
  } finally {
    roDb.close();
  }
}

describe('shareText model persistence', () => {
  beforeAll(() => {
    shareTextModel.initDatabase();
  });

  afterEach(() => {
    shareTextModel.deleteShareTextById('testFlushPendingWrites');
  });

  test('incrementViewCount writes are immediately persisted to disk', () => {
    shareTextModel.createShareText('testFlushPendingWrites', 'flush me', null);
    shareTextModel.incrementViewCount('testFlushPendingWrites');

    // better-sqlite3 同步写入，无需 flush，另一连接读取应得到最新值
    expect(readPersistedViewCount('testFlushPendingWrites')).toBe(1);
  });
});
