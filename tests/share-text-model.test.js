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

  test('新记录的 create_time 以 UTC ISO 返回', () => {
    shareTextModel.createShareText('testFlushPendingWrites', 'time', null);
    const row = shareTextModel.getShareTextById('testFlushPendingWrites');
    expect(row.create_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Math.abs(Date.now() - new Date(row.create_time).getTime())).toBeLessThan(5000);
  });

  test('pruneAuditLogs 删除超期记录并截断超量记录', () => {
    const db = shareTextModel.getDb();
    const saved = db
      .prepare('SELECT action, target, detail, actor_ip, user_agent, created_time FROM audit_log')
      .all();
    const insert = db.prepare(
      'INSERT INTO audit_log (action, target, detail, actor_ip, user_agent, created_time) VALUES (?, ?, ?, ?, ?, ?)'
    );

    try {
      db.exec('DELETE FROM audit_log');
      insert.run('test.prune', 'old', null, null, null, '2020-01-01 00:00:00');
      insert.run('test.prune', 'mid', null, null, null, '2024-01-01 00:00:00');
      db.prepare(
        "INSERT INTO audit_log (action, target, created_time) VALUES ('test.prune', 'fresh-1', datetime('now'))"
      ).run();
      db.prepare(
        "INSERT INTO audit_log (action, target, created_time) VALUES ('test.prune', 'fresh-2', datetime('now'))"
      ).run();
      db.prepare(
        "INSERT INTO audit_log (action, target, created_time) VALUES ('test.prune', 'fresh-3', datetime('now'))"
      ).run();

      const result = shareTextModel.pruneAuditLogs({ retentionDays: 30, maxRows: 2 });

      expect(result.deletedByAge).toBe(2);
      expect(result.deletedByCap).toBe(1);
      expect(result.retentionDays).toBe(30);
      expect(result.maxRows).toBe(2);

      const remaining = db
        .prepare('SELECT target FROM audit_log ORDER BY id ASC')
        .all()
        .map((row) => row.target);
      expect(remaining).toEqual(['fresh-2', 'fresh-3']);
    } finally {
      db.exec('DELETE FROM audit_log');
      const restore = db.prepare(
        'INSERT INTO audit_log (action, target, detail, actor_ip, user_agent, created_time) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const row of saved) {
        restore.run(
          row.action,
          row.target,
          row.detail,
          row.actor_ip,
          row.user_agent,
          row.created_time
        );
      }
    }
  });

  test('非法的审计日志保留配置回退到默认值', () => {
    const previousDays = process.env.AUDIT_LOG_RETENTION_DAYS;
    const previousRows = process.env.AUDIT_LOG_MAX_ROWS;
    process.env.AUDIT_LOG_RETENTION_DAYS = '0';
    process.env.AUDIT_LOG_MAX_ROWS = 'nope';

    try {
      expect(shareTextModel.resolveAuditLogRetention()).toEqual({
        retentionDays: shareTextModel.DEFAULT_AUDIT_LOG_RETENTION_DAYS,
        maxRows: shareTextModel.DEFAULT_AUDIT_LOG_MAX_ROWS,
      });
    } finally {
      if (previousDays === undefined) delete process.env.AUDIT_LOG_RETENTION_DAYS;
      else process.env.AUDIT_LOG_RETENTION_DAYS = previousDays;
      if (previousRows === undefined) delete process.env.AUDIT_LOG_MAX_ROWS;
      else process.env.AUDIT_LOG_MAX_ROWS = previousRows;
    }
  });

  test('旧库里的 SQLite 时间在读出时被标成 UTC', () => {
    const db = shareTextModel.getDb();
    db.prepare(
      'INSERT INTO share_text (id, content, create_time, expire_time) VALUES (?, ?, ?, ?)'
    ).run('legacySqliteTime', 'old', '2026-10-15 07:46:00', '2026-10-16 07:46:00');

    try {
      const row = shareTextModel.getShareTextById('legacySqliteTime');
      expect(row.create_time).toBe('2026-10-15T07:46:00Z');
      expect(row.expire_time).toBe('2026-10-16T07:46:00Z');
      expect(new Date(row.create_time).toISOString()).toBe('2026-10-15T07:46:00.000Z');
    } finally {
      shareTextModel.deleteShareTextById('legacySqliteTime');
    }
  });
});
