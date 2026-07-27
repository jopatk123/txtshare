/**
 * Markdown 检测工具
 *
 * 从 share.js 抽离为独立模块，便于 share.js 与 Node 测试共享同一份正则，
 * 避免源码与测试之间的逻辑漂移。
 *
 * 浏览器：通过 <script> 加载后挂载到 window.isMarkdown / window.MARKDOWN_PATTERN。
 * Node：通过 require('markdownDetector.js') 取得 { isMarkdown, MARKDOWN_PATTERN }。
 */
/* global module */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  } else if (typeof root === 'object' && root !== null) {
    root.isMarkdown = exported.isMarkdown;
    root.MARKDOWN_PATTERN = exported.MARKDOWN_PATTERN;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const MARKDOWN_PATTERN =
    /(^\s{0,3}#{1,6}\s)|(```)|(^\s*[-*+]\s)|(^\s*\d+\.\s)|(\[.+?\]\(.+?\))|(^\s*>\s)|(^\s*\|.+\|\s*$)|(!\[.*?\]\(data:image\/)/m;

  function isMarkdown(text) {
    return MARKDOWN_PATTERN.test(text);
  }

  return { isMarkdown, MARKDOWN_PATTERN };
});
