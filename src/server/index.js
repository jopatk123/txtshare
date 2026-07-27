require('dotenv').config();

const schedule = require('node-schedule');
const shareTextModel = require('./models/shareText');
const cache = require('./middleware/cache');
const logger = require('./middleware/logger');
const { getConfiguredBaseUrl, warnIfBaseUrlMissing } = require('./utils/baseUrl');
const { createShutdownHandler } = require('./utils/gracefulShutdown');

const PORT = process.env.PORT || 6006;
let shutdown = null;

// 启动时立即执行一次过期清理，避免重启窗口期内过期数据堆积
function runCleanupTask() {
  logger.info('Starting cleanup task...');

  try {
    const expiredIds = shareTextModel.getExpiredIds();
    const deletedCount = shareTextModel.deleteExpiredRecords();

    if (expiredIds.length > 0) {
      cache.delMultiple(expiredIds);
    }

    logger.info(`Cleanup completed: ${deletedCount} expired records deleted`);
  } catch (error) {
    logger.error('Cleanup task error:', error);
  }
}

// 初始化数据库后启动服务器
function startServer() {
  try {
    // 初始化数据库（better-sqlite3 同步打开）
    shareTextModel.initDatabase();
    logger.info('Database initialized');

    // 启动时立即清理一次过期数据
    runCleanupTask();

    // 导入 app（需要在数据库初始化后）
    const app = require('./app');

    // 启动服务器
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Base URL: ${getConfiguredBaseUrl(PORT)}`);
      warnIfBaseUrlMissing(logger);
    });

    // 定时任务：每天凌晨 2 点清理过期数据
    const cleanupJob = schedule.scheduleJob('0 2 * * *', runCleanupTask);

    shutdown = createShutdownHandler({
      server,
      cleanupJob,
      logger,
      flushPendingWrites: shareTextModel.flushPendingWrites,
      closeDatabase: shareTextModel.closeDatabase,
      exit: (code) => process.exit(code),
    });

    // 优雅关闭
    process.on('SIGTERM', () => {
      if (shutdown) shutdown('SIGTERM', 0);
      else process.exit(0);
    });

    process.on('SIGINT', () => {
      if (shutdown) shutdown('SIGINT', 0);
      else process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 未捕获异常：记录日志、尝试落盘、退出
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  try {
    shareTextModel.closeDatabase();
  } catch (closeError) {
    logger.error('Failed to close database after uncaught exception:', closeError);
  }
  process.exit(1);
});

// 未处理 Promise 拒绝：与 uncaughtException 保持一致策略，避免进程在损坏态继续服务
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  try {
    shareTextModel.closeDatabase();
  } catch (closeError) {
    logger.error('Failed to close database after unhandled rejection:', closeError);
  }
  process.exit(1);
});

startServer();
