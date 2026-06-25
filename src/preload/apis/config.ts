import { ipcRenderer } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { AppSettings, SecretsRecord } from '@shared/schemas/store';

export const configApi = {
  getApp: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_APP),
  setApp: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_APP, partial),
  getSecretsMeta: (): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_SECRETS_META),
  setSecrets: (partial: SecretsRecord): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_SECRETS, partial),
};

export type ConfigApi = typeof configApi;
