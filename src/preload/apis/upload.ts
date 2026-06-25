import { ipcRenderer } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { ErpOssUploadResult } from '@shared/types/upload';

export const uploadApi = {
  pickFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_PICK_FILE),
  erpOss: (filePath: string): Promise<ErpOssUploadResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_ERP_OSS, filePath),
};

export type UploadApi = typeof uploadApi;
