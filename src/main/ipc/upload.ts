import { BrowserWindow, ipcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { ErpOssUploadResult } from '@shared/types/upload';

import { pickUploadFile, uploadFileToErpOss } from '../services/upload';
import { wrapIpcHandler } from './wrap-ipc-handler';

export function registerUploadIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.UPLOAD_PICK_FILE,
    wrapIpcHandler(IPC_CHANNELS.UPLOAD_PICK_FILE, async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return pickUploadFile(win);
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.UPLOAD_ERP_OSS,
    wrapIpcHandler(
      IPC_CHANNELS.UPLOAD_ERP_OSS,
      async (_event, filePath: string): Promise<ErpOssUploadResult> =>
        uploadFileToErpOss(filePath),
    ),
  );
}
