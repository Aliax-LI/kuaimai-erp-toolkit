import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { LogLevel } from '../services/logger';

import { logger } from '../services/logger';

interface RendererLogPayload {
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

export function registerDebugIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DEBUG_LOG, (_event, payload: RendererLogPayload) => {
    const level = payload?.level ?? 'info';
    const scope = payload?.scope ? `renderer:${payload.scope}` : 'renderer';
    const message = payload?.message ?? '';

    switch (level) {
      case 'error':
        logger.error(scope, message, payload.data);
        break;
      case 'warn':
        logger.warn(scope, message, payload.data);
        break;
      case 'debug':
        logger.debug(scope, message, payload.data);
        break;
      default:
        logger.info(scope, message, payload.data);
        break;
    }
  });
}
