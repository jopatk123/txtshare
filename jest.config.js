module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/server/**/*.js',
    // 入口脚本仅为副作用执行，不计入覆盖率
    '!src/server/db/initDb.js',
    '!src/server/index.js',
  ],
  coverageDirectory: 'coverage',
  // 既有覆盖率基线，后续只允许上升不允许下降
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75,
    },
  },
  // 串行执行：测试共享 SQLite 文件，多 worker 并行会触发写竞争
  maxWorkers: 1,
  // node-schedule / winson 会保留句柄，强制退出避免悬挂
  forceExit: true,
  testTimeout: 10000,
};
