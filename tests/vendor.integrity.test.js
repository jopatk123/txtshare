/**
 * Vendor JS 文件完整性测试
 * 验证下载到本地的第三方库文件存在且包含预期的全局导出
 */

const fs = require('fs');
const path = require('path');

const vendorDir = path.resolve(__dirname, '../src/public/js/vendor');

describe('Vendor 文件完整性', () => {
  describe('marked.min.js', () => {
    const filePath = path.join(vendorDir, 'marked.min.js');

    test('文件存在', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('文件不为空（大于 10KB）', () => {
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(10 * 1024);
    });

    test('文件内容包含 marked 标识', () => {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toMatch(/marked/i);
    });

    test('文件内容包含 parse 方法', () => {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('parse');
    });
  });

  describe('purify.min.js', () => {
    const filePath = path.join(vendorDir, 'purify.min.js');

    test('文件存在', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('文件不为空（大于 5KB）', () => {
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(5 * 1024);
    });

    test('文件内容包含 DOMPurify 标识', () => {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toMatch(/DOMPurify/i);
    });

    test('文件内容包含 sanitize 方法', () => {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('sanitize');
    });
  });
});
