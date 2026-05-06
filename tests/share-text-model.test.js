const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const shareTextModel = require('../src/server/models/shareText');

const dbPath = path.join(__dirname, '../src/server/db/data/share_text.db');

async function readPersistedViewCount(id) {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const persistedDb = new SQL.Database(fileBuffer);
  const stmt = persistedDb.prepare('SELECT view_count FROM share_text WHERE id = ?');
  stmt.bind([id]);

  let viewCount = null;
  if (stmt.step()) {
    viewCount = stmt.getAsObject().view_count;
  }

  stmt.free();
  persistedDb.close();
  return viewCount;
}

describe('shareText model persistence', () => {
  beforeAll(async () => {
    await shareTextModel.initDatabase();
  });

  afterEach(() => {
    shareTextModel.flushPendingWrites();
    shareTextModel.deleteShareTextById('testFlushPendingWrites');
  });

  test('flushPendingWrites persists debounced view count updates to disk', async () => {
    shareTextModel.createShareText('testFlushPendingWrites', 'flush me', null);
    shareTextModel.incrementViewCount('testFlushPendingWrites');

    shareTextModel.flushPendingWrites();

    await expect(readPersistedViewCount('testFlushPendingWrites')).resolves.toBe(1);
  });
});