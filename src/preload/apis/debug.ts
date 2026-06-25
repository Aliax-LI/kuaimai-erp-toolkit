import { ipcRenderer } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';

export type DebugLogLevel = 'debug' | 'info' | 'warn' | 'error';

export const debugApi = {
  log: (
    level: DebugLogLevel,
    scope: string,
    message: string,
    data?: unknown,
  ): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DEBUG_LOG, { level, scope, message, data }),
};

export type DebugApi = typeof debugApi;
