/**
 * 优雅关闭处理器
 *
 * 流程：
 * 1. 取消定时任务
 * 2. flush 待写数据（better-sqlite3 下为 no-op，保留兼容）
 * 3. 停止接受新连接，等待进行中请求完成
 * 4. 关闭数据库连接（WAL checkpoint + close）
 * 5. 强制超时兜底（避免长连接导致进程永久挂起）
 */

const FORCE_SHUTDOWN_TIMEOUT_MS = 10000;

function createShutdownHandler({
  server,
  cleanupJob,
  logger,
  flushPendingWrites,
  closeDatabase,
  exit,
}) {
  let shuttingDown = false;

  return function shutdown(signal, exitCode = 0) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully...`);

    if (cleanupJob && typeof cleanupJob.cancel === 'function') {
      cleanupJob.cancel();
    }

    try {
      flushPendingWrites();
    } catch (error) {
      logger.error('Failed to flush pending writes during shutdown:', error);
    }

    // 强制超时兜底：server.close 会无限等待 keep-alive 连接，
    // 超时后强制退出，避免容器编排器靠 SIGKILL 强杀
    const forceTimer = setTimeout(() => {
      logger.error(
        `Graceful shutdown timed out after ${FORCE_SHUTDOWN_TIMEOUT_MS}ms, forcing exit`
      );
      try {
        if (typeof closeDatabase === 'function') closeDatabase();
      } catch (error) {
        logger.error('Failed to close database during forced shutdown:', error);
      }
      exit(1);
    }, FORCE_SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    if (!server || typeof server.close !== 'function') {
      clearTimeout(forceTimer);
      try {
        if (typeof closeDatabase === 'function') closeDatabase();
      } catch (error) {
        logger.error('Failed to close database during shutdown:', error);
      }
      exit(exitCode);
      return;
    }

    server.close(() => {
      clearTimeout(forceTimer);
      logger.info('Server closed');
      try {
        if (typeof closeDatabase === 'function') closeDatabase();
      } catch (error) {
        logger.error('Failed to close database during shutdown:', error);
      }
      exit(exitCode);
    });
  };
}

module.exports = {
  createShutdownHandler,
  FORCE_SHUTDOWN_TIMEOUT_MS,
};
