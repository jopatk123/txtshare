require('dotenv').config();

const schedule = require('node-schedule');
const shareTextModel = require('./models/shareText');
const cache = require('./middleware/cache');
const logger = require('./middleware/logger');
const { getConfiguredBaseUrl, warnIfBaseUrlMissing } = require('./utils/baseUrl');
const { createShutdownHandler } = require('./utils/gracefulShutdown');

const PORT = process.env.PORT || 6006;
let shutdown = null;

// 初始化数据库后启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await shareTextModel.initDatabase();
    logger.info('Database initialized');

    // 导入app（需要在数据库初始化后）
    const app = require('./app');

    // 启动服务器
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Base URL: ${getConfiguredBaseUrl(PORT)}`);
      warnIfBaseUrlMissing(logger);
    });

    // 定时任务：每天凌晨2点清理过期数据
    const cleanupJob = schedule.scheduleJob('0 2 * * *', () => {
      logger.info('Starting scheduled cleanup task...');
      
      try {
        // 获取要删除的过期ID（用于清理缓存）
        const expiredIds = shareTextModel.getExpiredIds();
        
        // 删除数据库中的过期记录
        const deletedCount = shareTextModel.deleteExpiredRecords();
        
        // 清理缓存
        if (expiredIds.length > 0) {
          cache.delMultiple(expiredIds);
        }
        
        logger.info(`Cleanup completed: ${deletedCount} expired records deleted`);
      } catch (error) {
        logger.error('Cleanup task error:', error);
      }
    });

    shutdown = createShutdownHandler({
      server,
      cleanupJob,
      logger,
      flushPendingWrites: shareTextModel.flushPendingWrites,
      exit: (code) => process.exit(code)
    });

    // 优雅关闭
    process.on('SIGTERM', () => {
      shutdown('SIGTERM', 0);
    });

    process.on('SIGINT', () => {
      shutdown('SIGINT', 0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  try {
    shareTextModel.flushPendingWrites();
  } catch (flushError) {
    logger.error('Failed to flush pending writes after uncaught exception:', flushError);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
