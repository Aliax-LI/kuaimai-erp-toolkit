import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { ErpLoginParams, ErpLoginResult } from '@shared/types/auth';

import { loginErpAndSaveCookie } from '../services/auth';
import { wrapIpcHandler } from './wrap-ipc-handler';

export function registerAuthIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.AUTH_ERP_LOGIN,
    wrapIpcHandler(IPC_CHANNELS.AUTH_ERP_LOGIN, async (_event, params: ErpLoginParams) => {
      if (!params?.companyName?.trim() || !params?.userName?.trim() || !params?.password) {
        throw new Error('请填写公司名、账号和密码');
      }

      return loginErpAndSaveCookie(params);
    }),
  );
}
