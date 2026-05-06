function createShutdownHandler({ server, cleanupJob, logger, flushPendingWrites, exit }) {
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

    if (!server || typeof server.close !== 'function') {
      exit(exitCode);
      return;
    }

    server.close(() => {
      logger.info('Server closed');
      exit(exitCode);
    });
  };
}

module.exports = {
  createShutdownHandler
};