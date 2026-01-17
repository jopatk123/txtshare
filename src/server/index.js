const schedule = require('node-schedule');
const shareTextModel = require('./models/shareText');
const cache = require('./middleware/cache');
const logger = require('./middleware/logger');

const PORT = process.env.PORT || 6006;

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
      logger.info(`Base URL: ${process.env.BASE_URL || 'http://localhost:' + PORT}`);
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

    // 优雅关闭
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      
      // 取消定时任务
      cleanupJob.cancel();
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      
      // 取消定时任务
      cleanupJob.cancel();
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
