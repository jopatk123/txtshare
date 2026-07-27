/**
 * Vendor JS 文件完整性测试
 * 验证下载到本地的第三方库文件存在且包含预期的全局导出
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

  describe('highlight.min.js', () => {
    const filePath = path.join(vendorDir, 'highlight.min.js');

    test('文件存在', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('文件不为空（大于 50KB）', () => {
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(50 * 1024);
    });

    test('文件内容包含 highlight.js 标识', () => {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toMatch(/Highlight\.js/i);
    });

    test('文件内容包含 hljs 全局导出', () => {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('hljs');
    });
  });

  describe('share.html SRI', () => {
    const shareHtmlPath = path.resolve(__dirname, '../src/public/share.html');
    const VENDOR_FILES = ['marked.min.js', 'purify.min.js', 'highlight.min.js'];

    test('share.html 文件存在', () => {
      expect(fs.existsSync(shareHtmlPath)).toBe(true);
    });

    VENDOR_FILES.forEach((file) => {
      test(`${file} 在 share.html 中带 integrity 与 crossorigin 属性`, () => {
        const html = fs.readFileSync(shareHtmlPath, 'utf8');
        const tagRegex = new RegExp(`<script\\s+[^>]*src="/js/vendor/${file}"[^>]*>`, 'i');
        const match = html.match(tagRegex);
        expect(match).not.toBeNull();
        const tag = match[0];
        // 必须含 integrity="sha384-..."
        expect(tag).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/);
        // 必须含 crossorigin 属性
        expect(tag).toMatch(/crossorigin="anonymous"/i);
      });

      test(`${file} 的 SRI 哈希与当前文件内容一致`, () => {
        const html = fs.readFileSync(shareHtmlPath, 'utf8');
        const tagRegex = new RegExp(`<script\\s+[^>]*src="/js/vendor/${file}"[^>]*>`, 'i');
        const tag = html.match(tagRegex)[0];
        const declared = tag.match(/integrity="(sha384-[A-Za-z0-9+/=]+)"/)[1];

        const fileBuf = fs.readFileSync(path.join(vendorDir, file));
        const computed = 'sha384-' + crypto.createHash('sha384').update(fileBuf).digest('base64');
        expect(declared).toBe(computed);
      });
    });
  });
});
