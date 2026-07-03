import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { AppSettings, SecretsRecord } from '@shared/schemas/store';
import type { ErpConnectionTestInput } from '@shared/types/erp-connection';

import {
  deleteSecrets,
  getAppSettings,
  getErpSecrets,
  getSecretsMeta,
  setAppSettings,
  setSecrets,
} from '../services/store';
import { testErpConnection } from '../services/erp-connection';
import { wrapIpcHandler } from './wrap-ipc-handler';

export function registerConfigIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_APP,
    wrapIpcHandler(IPC_CHANNELS.CONFIG_GET_APP, () => getAppSettings()),
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SET_APP,
    wrapIpcHandler(IPC_CHANNELS.CONFIG_SET_APP, (_event, partial: Partial<AppSettings>) =>
      setAppSettings(partial),
    ),
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_SECRETS_META,
    wrapIpcHandler(IPC_CHANNELS.CONFIG_GET_SECRETS_META, () => getSecretsMeta()),
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_SECRETS,
    wrapIpcHandler(IPC_CHANNELS.CONFIG_GET_SECRETS, () => getErpSecrets()),
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SET_SECRETS,
    wrapIpcHandler(IPC_CHANNELS.CONFIG_SET_SECRETS, (_event, partial: SecretsRecord) =>
      setSecrets(partial),
    ),
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_SECRETS,
    wrapIpcHandler(IPC_CHANNELS.CONFIG_DELETE_SECRETS, (_event, keys: string[]) =>
      deleteSecrets(keys),
    ),
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_TEST_ERP_CONNECTION,
    wrapIpcHandler(
      IPC_CHANNELS.CONFIG_TEST_ERP_CONNECTION,
      (_event, input: ErpConnectionTestInput = {}) => testErpConnection(input),
    ),
  );
}
