const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  // 服务端代码
  {
    files: ['src/server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^_',
      }],
      'no-console': 'off',
    },
  },
  // 测试代码
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'no-unused-vars': ['warn', {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^_',
      }],
      'no-console': 'off',
    },
  },
];
