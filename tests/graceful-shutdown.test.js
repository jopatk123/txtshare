const { createShutdownHandler } = require('../src/server/utils/gracefulShutdown');

describe('graceful shutdown', () => {
  test('cancels cleanup, flushes pending writes, and exits after server close', () => {
    const events = [];
    const shutdown = createShutdownHandler({
      server: {
        close(callback) {
          events.push('server.close');
          callback();
        }
      },
      cleanupJob: {
        cancel() {
          events.push('cleanup.cancel');
        }
      },
      logger: {
        info(message) {
          events.push(`info:${message}`);
        },
        error(message) {
          events.push(`error:${message}`);
        }
      },
      flushPendingWrites() {
        events.push('flush');
      },
      exit(code) {
        events.push(`exit:${code}`);
      }
    });

    shutdown('SIGTERM', 0);

    expect(events).toEqual([
      'info:SIGTERM received, shutting down gracefully...',
      'cleanup.cancel',
      'flush',
      'server.close',
      'info:Server closed',
      'exit:0'
    ]);
  });

  test('runs only once even if shutdown is requested multiple times', () => {
    let exitCount = 0;
    const shutdown = createShutdownHandler({
      server: {
        close(callback) {
          callback();
        }
      },
      cleanupJob: {
        cancel() {}
      },
      logger: {
        info() {},
        error() {}
      },
      flushPendingWrites() {},
      exit() {
        exitCount += 1;
      }
    });

    shutdown('SIGTERM', 0);
    shutdown('SIGINT', 0);

    expect(exitCount).toBe(1);
  });
});