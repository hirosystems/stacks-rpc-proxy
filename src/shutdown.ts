import { logger } from './util';

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

class ShutdownHandler {
  static readonly instance = new ShutdownHandler();
  private shutdownHandlers: (() => void | Promise<void>)[] = [];

  private constructor() {
    this.setupShutdownHandler();
  }

  registerShutdownHandler(handler: () => void | Promise<void>) {
    this.shutdownHandlers.push(handler);
  }

  private async handleShutdown() {
    const handlers = [...this.shutdownHandlers];
    this.shutdownHandlers.length = 0;
    for (const handler of handlers) {
      try {
        await Promise.resolve(handler());
      } catch (error) {
        logger.error(error, `Error during shutdown ${error}`);
      }
    }
  }

  setupShutdownHandler() {
    shutdownSignals.forEach((signal) => {
      process.on(signal, async (signal) => {
        logger.info(`received ${signal}, starting shutdown...`);
        await this.handleShutdown();
        try {
          logger.error(`Shutdown due to ${signal}`);
          process.exit(0);
        } catch (error) {
          logger.error(error, `Error during shutdown ${error}`);
          process.exit(1);
        }
      });
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error(error, `Uncaught exception ${error}`);
      // No shutdown here, just logging
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error(`Unhandled Rejection, reason: ${reason}, at: ${promise}`);
      // No shutdown here, just logging
    });
  }
}

export const Shutdown = ShutdownHandler.instance;
export default ShutdownHandler.instance;
