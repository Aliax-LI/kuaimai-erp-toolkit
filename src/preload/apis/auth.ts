import { ipcRenderer } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { ErpLoginParams, ErpLoginResult } from '@shared/types/auth';

export const authApi = {
  erpLogin: (params: ErpLoginParams): Promise<ErpLoginResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_ERP_LOGIN, params),
};

export type AuthApi = typeof authApi;
