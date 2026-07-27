/**
 * Markdown 检测逻辑测试
 *
 * 直接复用 share.js 在浏览器中加载的同一份实现（markdownDetector.js），
 * 杜绝源码与测试之间的逻辑漂移。
 */

const { isMarkdown, MARKDOWN_PATTERN } = require('../src/public/js/markdownDetector');

describe('isMarkdown 检测逻辑', () => {
  test('模块导出 isMarkdown 函数与 MARKDOWN_PATTERN 正则', () => {
    expect(typeof isMarkdown).toBe('function');
    expect(MARKDOWN_PATTERN).toBeInstanceOf(RegExp);
  });

  describe('应识别为 Markdown', () => {
    test('ATX 标题 H1', () => {
      expect(isMarkdown('# 标题')).toBe(true);
    });

    test('ATX 标题 H2', () => {
      expect(isMarkdown('## 二级标题')).toBe(true);
    });

    test('ATX 标题 H6', () => {
      expect(isMarkdown('###### 六级标题')).toBe(true);
    });

    test('代码块（三反引号）', () => {
      expect(isMarkdown('```\nconst x = 1;\n```')).toBe(true);
    });

    test('行内代码块开始', () => {
      expect(isMarkdown('``` javascript\nconsole.log(1)\n```')).toBe(true);
    });

    test('无序列表 -', () => {
      expect(isMarkdown('- 列表项')).toBe(true);
    });

    test('无序列表 *', () => {
      expect(isMarkdown('* 列表项')).toBe(true);
    });

    test('无序列表 +', () => {
      expect(isMarkdown('+ 列表项')).toBe(true);
    });

    test('有序列表', () => {
      expect(isMarkdown('1. 第一项')).toBe(true);
    });

    test('多行有序列表', () => {
      expect(isMarkdown('1. 第一项\n2. 第二项')).toBe(true);
    });

    test('链接语法', () => {
      expect(isMarkdown('[点击这里](https://example.com)')).toBe(true);
    });

    test('图片语法', () => {
      expect(isMarkdown('![图片](https://example.com/img.png)')).toBe(true);
    });

    test('Base64 内嵌图片', () => {
      expect(isMarkdown('![图](data:image/png;base64,abc)')).toBe(true);
    });

    test('引用块', () => {
      expect(isMarkdown('> 这是引用')).toBe(true);
    });

    test('表格', () => {
      expect(isMarkdown('| 列1 | 列2 |')).toBe(true);
    });

    test('混合：标题 + 列表', () => {
      expect(isMarkdown('# 标题\n- 条目1\n- 条目2')).toBe(true);
    });
  });

  describe('应识别为纯文本（非 Markdown）', () => {
    test('普通文本', () => {
      expect(isMarkdown('这是一段普通文本')).toBe(false);
    });

    test('多行普通文本', () => {
      expect(isMarkdown('第一行\n第二行\n第三行')).toBe(false);
    });

    test('URL 字符串（无 Markdown 语法）', () => {
      expect(isMarkdown('https://example.com')).toBe(false);
    });

    test('数字和标点', () => {
      expect(isMarkdown('价格: 100.00 元')).toBe(false);
    });

    test('空字符串', () => {
      expect(isMarkdown('')).toBe(false);
    });

    test('仅空白字符', () => {
      expect(isMarkdown('   \n  ')).toBe(false);
    });

    test('#号但后面无空格（非标题语法）', () => {
      expect(isMarkdown('#标签')).toBe(false);
    });

    test('普通数字加点（非有序列表）', () => {
      expect(isMarkdown('版本 1.0 发布')).toBe(false);
    });
  });
});
