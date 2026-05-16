/**
 * 验证 sql.js 模型在落盘过程中使用「临时文件 + rename」做原子替换，
 * 避免半写导致整库损坏。
 */

const fs = require('fs');
const path = require('path');

const dbFile = path.resolve(__dirname, '../src/server/db/data/share_text.db');

describe('Atomic database write', () => {
  let shareTextModel;
  let originalRename;
  let originalUnlink;

  beforeAll(async () => {
    shareTextModel = require('../src/server/models/shareText');
    await shareTextModel.initDatabase();
  });

  afterEach(() => {
    if (originalRename) fs.renameSync = originalRename;
    if (originalUnlink) fs.unlinkSync = originalUnlink;
    originalRename = null;
    originalUnlink = null;
  });

  test('writes to tmp file then renames into place', () => {
    const tmpPath = `${dbFile}.tmp`;
    let sawTmpBeforeRename = false;
    let renamedTo = null;

    originalRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (from === tmpPath && to === dbFile) {
        sawTmpBeforeRename = fs.existsSync(tmpPath);
        renamedTo = to;
      }
      return originalRename.call(fs, from, to);
    };

    const id = `atomic${Date.now().toString(36)}`;
    shareTextModel.createShareText(id, 'atomic-write-test', null);

    expect(sawTmpBeforeRename).toBe(true);
    expect(renamedTo).toBe(dbFile);
    expect(fs.existsSync(dbFile)).toBe(true);
    expect(fs.existsSync(tmpPath)).toBe(false);

    // 清理
    shareTextModel.deleteShareTextById(id);
  });

  test('rename failure leaves original db intact', () => {
    const tmpPath = `${dbFile}.tmp`;
    const originalSize = fs.statSync(dbFile).size;

    originalRename = fs.renameSync;
    fs.renameSync = (from) => {
      if (from === tmpPath) {
        throw new Error('simulated rename failure');
      }
      return originalRename.apply(fs, arguments);
    };

    expect(() => {
      shareTextModel.createShareText(`fail${Date.now().toString(36)}`, 'x', null);
    }).toThrow(/simulated rename failure/);

    // 原库未损坏，大小仍然合理
    const finalSize = fs.statSync(dbFile).size;
    expect(finalSize).toBe(originalSize);

    // 清理可能残留的 tmp 文件
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  });
});
