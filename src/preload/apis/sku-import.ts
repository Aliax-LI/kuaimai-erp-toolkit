import { ipcRenderer, webUtils } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { SkuImportConfig } from '@shared/schemas/sku-import-config';
import type { SkuImportTaskDetail, SkuImportTaskSummary } from '@shared/types/sku-import';

export const skuImportApi = {
  pickFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_PICK_FILE),
  preview: (filePath: string): Promise<SkuImportTaskDetail> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_PREVIEW, filePath),
  listTasks: (): Promise<SkuImportTaskSummary[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_LIST_TASKS),
  getTask: (taskId: string): Promise<SkuImportTaskDetail> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_GET_TASK, taskId),
  deleteTask: (taskId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_DELETE_TASK, taskId),
  clearAllTasks: (): Promise<{ clearedTaskCount: number; clearedFiles: string[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_CLEAR_ALL_TASKS),
  execute: (taskId: string): Promise<SkuImportTaskDetail> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_EXECUTE, taskId),
  getConfig: (): Promise<SkuImportConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_CONFIG_GET),
  setConfig: (config: SkuImportConfig): Promise<SkuImportConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_CONFIG_SET, config),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
};

export type SkuImportApi = typeof skuImportApi;
