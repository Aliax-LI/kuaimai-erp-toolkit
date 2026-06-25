import type { IpcMainInvokeEvent } from 'electron';

import { logger } from '../services/logger';

export function wrapIpcHandler<T extends unknown[], R>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R> | R,
): (event: IpcMainInvokeEvent, ...args: T) => Promise<R> {
  return async (event, ...args) => {
    const started = Date.now();
    logger.debug('ipc', `${channel} invoke`, { argCount: args.length });

    try {
      const result = await handler(event, ...args);
      logger.info('ipc', `${channel} ok`, { ms: Date.now() - started });
      return result;
    } catch (err) {
      logger.error('ipc', `${channel} fail`, {
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}
