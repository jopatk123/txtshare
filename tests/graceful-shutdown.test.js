const {
  createShutdownHandler,
  FORCE_SHUTDOWN_TIMEOUT_MS,
} = require('../src/server/utils/gracefulShutdown');

describe('graceful shutdown', () => {
  test('cancels cleanup, flushes, closes db, and exits after server close', () => {
    const events = [];
    const shutdown = createShutdownHandler({
      server: {
        close(callback) {
          events.push('server.close');
          callback();
        },
      },
      cleanupJob: {
        cancel() {
          events.push('cleanup.cancel');
        },
      },
      logger: {
        info(message) {
          events.push(`info:${message}`);
        },
        error(message) {
          events.push(`error:${message}`);
        },
      },
      flushPendingWrites() {
        events.push('flush');
      },
      closeDatabase() {
        events.push('closeDatabase');
      },
      exit(code) {
        events.push(`exit:${code}`);
      },
    });

    shutdown('SIGTERM', 0);

    expect(events).toEqual([
      'info:SIGTERM received, shutting down gracefully...',
      'cleanup.cancel',
      'flush',
      'server.close',
      'info:Server closed',
      'closeDatabase',
      'exit:0',
    ]);
  });

  test('runs only once even if shutdown is requested multiple times', () => {
    let exitCount = 0;
    const shutdown = createShutdownHandler({
      server: {
        close(callback) {
          callback();
        },
      },
      cleanupJob: {
        cancel() {},
      },
      logger: {
        info() {},
        error() {},
      },
      flushPendingWrites() {},
      closeDatabase() {},
      exit() {
        exitCount += 1;
      },
    });

    shutdown('SIGTERM', 0);
    shutdown('SIGINT', 0);

    expect(exitCount).toBe(1);
  });

  test('closeDatabase is called even when server is null', () => {
    const events = [];
    const shutdown = createShutdownHandler({
      server: null,
      cleanupJob: { cancel() {} },
      logger: {
        info() {},
        error() {},
      },
      flushPendingWrites() {},
      closeDatabase() {
        events.push('closeDatabase');
      },
      exit(code) {
        events.push(`exit:${code}`);
      },
    });

    shutdown('SIGTERM', 0);

    expect(events).toEqual(['closeDatabase', 'exit:0']);
  });

  test('exports force shutdown timeout constant', () => {
    expect(FORCE_SHUTDOWN_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
