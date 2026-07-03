import { ipcRenderer } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { AppSettings, SecretsRecord } from '@shared/schemas/store';
import type {
  ErpConnectionTestInput,
  ErpConnectionTestResult,
} from '@shared/types/erp-connection';

export const configApi = {
  getApp: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_APP),
  setApp: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_APP, partial),
  getSecretsMeta: (): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_SECRETS_META),
  getSecrets: (): Promise<{ erpCookie: string; erpCompanyId: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_SECRETS),
  setSecrets: (partial: SecretsRecord): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_SECRETS, partial),
  deleteSecrets: (keys: string[]): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_DELETE_SECRETS, keys),
  testErpConnection: (input: ErpConnectionTestInput = {}): Promise<ErpConnectionTestResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_TEST_ERP_CONNECTION, input),
};

export type ConfigApi = typeof configApi;
