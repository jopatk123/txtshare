/**
 * 验证 better-sqlite3 WAL 模式下的写入原子性与数据完整性。
 *
 * better-sqlite3 通过 SQLite 引擎自身的 WAL + 事务机制保证原子性，
 * 不再需要应用层「临时文件 + rename」的兜底，本测试验证：
 * 1. WAL 模式已启用
 * 2. 写入后数据可被另一只读连接读取（数据已落盘到 WAL）
 * 3. 写入失败时事务回滚，数据不被破坏
 */

const Database = require('better-sqlite3');
const path = require('path');

const shareTextModel = require('../src/server/models/shareText');

const dbPath = path.join(__dirname, '../src/server/db/data/share_text.db');

describe('better-sqlite3 WAL atomicity & integrity', () => {
  beforeAll(() => {
    shareTextModel.initDatabase();
  });

  afterEach(() => {
    const db = shareTextModel.getDb();
    db.exec("DELETE FROM share_text WHERE id LIKE 'atomic%'");
  });

  test('WAL journal mode is enabled', () => {
    const db = shareTextModel.getDb();
    const row = db.pragma('journal_mode', { simple: true });
    expect(row).toBe('wal');
  });

  test('writes are visible to a separate read-only connection immediately', () => {
    const id = `atomic${Date.now().toString(36)}`;
    shareTextModel.createShareText(id, 'atomic-write-test', null);

    const roDb = new Database(dbPath, { readonly: true });
    try {
      const row = roDb.prepare('SELECT id, content FROM share_text WHERE id = ?').get(id);
      expect(row).toBeTruthy();
      expect(row.id).toBe(id);
      expect(row.content).toBe('atomic-write-test');
    } finally {
      roDb.close();
    }
  });

  test('transaction rollback on failure leaves prior data intact', () => {
    const id = `atomicRollback${Date.now().toString(36)}`;
    shareTextModel.createShareText(id, 'initial', null);

    const db = shareTextModel.getDb();
    // 在事务中故意抛错，验证回滚
    expect(() => {
      const tx = db.transaction(() => {
        db.prepare('UPDATE share_text SET content = ? WHERE id = ?').run('modified', id);
        throw new Error('simulated failure');
      });
      tx();
    }).toThrow(/simulated failure/);

    // 原数据未被修改
    const row = shareTextModel.getShareTextById(id);
    expect(row.content).toBe('initial');
  });
});
