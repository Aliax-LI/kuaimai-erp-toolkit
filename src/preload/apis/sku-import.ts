import { ipcRenderer, webUtils } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { SkuImportConfig } from '@shared/schemas/sku-import-config';
import type {
  AccessoryExportResult,
  AccessoryImportResult,
  SkuImportExecuteProgress,
  SkuImportPreviewProgress,
  SkuImportTaskDetail,
  SkuImportTaskSummary,
} from '@shared/types/sku-import';

export const skuImportApi = {
  pickFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_PICK_FILE),
  preview: (filePath: string): Promise<SkuImportTaskDetail> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_PREVIEW, filePath),
  onPreviewProgress: (callback: (progress: SkuImportPreviewProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: SkuImportPreviewProgress) => {
      callback(progress);
    };
    ipcRenderer.on(IPC_CHANNELS.SKU_IMPORT_PREVIEW_PROGRESS, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SKU_IMPORT_PREVIEW_PROGRESS, listener);
    };
  },
  onExecuteProgress: (callback: (progress: SkuImportExecuteProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: SkuImportExecuteProgress) => {
      callback(progress);
    };
    ipcRenderer.on(IPC_CHANNELS.SKU_IMPORT_EXECUTE_PROGRESS, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SKU_IMPORT_EXECUTE_PROGRESS, listener);
    };
  },
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
  exportResults: (taskId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_EXPORT_RESULTS, taskId),
  getConfig: (): Promise<SkuImportConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_CONFIG_GET),
  setConfig: (config: SkuImportConfig): Promise<SkuImportConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_CONFIG_SET, config),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  importAccessories: (): Promise<AccessoryImportResult | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_IMPORT_ACCESSORIES),
  exportAccessories: (): Promise<AccessoryExportResult | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_EXPORT_ACCESSORIES),
  downloadAccessoryTemplate: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_DOWNLOAD_ACCESSORY_TEMPLATE),
};

export type SkuImportApi = typeof skuImportApi;
