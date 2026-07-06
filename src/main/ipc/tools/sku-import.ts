import { BrowserWindow, ipcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';
import type { SkuImportConfig } from '@shared/schemas/sku-import-config';

import {
  clearAllSkuImportTasks,
  deleteSkuImportTask,
  executeSkuImportTask,
  exportSkuImportTaskResults,
  getSkuImportTask,
  listSkuImportTasks,
  pickSkuImportFile,
  previewSkuImportFile,
} from '../../services/sku-import';
import { getSkuImportConfig, setSkuImportConfig } from '../../services/sku-import-config';
import { wrapIpcHandler } from '../wrap-ipc-handler';

export function registerSkuImportIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_PICK_FILE,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_PICK_FILE, async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return pickSkuImportFile(win);
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_PREVIEW,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_PREVIEW, async (event, filePath: string) =>
      previewSkuImportFile(filePath, (progress) => {
        event.sender.send(IPC_CHANNELS.SKU_IMPORT_PREVIEW_PROGRESS, progress);
      }),
    ),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_LIST_TASKS,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_LIST_TASKS, async () => listSkuImportTasks()),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_GET_TASK,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_GET_TASK, async (_event, taskId: string) =>
      getSkuImportTask(taskId),
    ),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_DELETE_TASK,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_DELETE_TASK, async (_event, taskId: string) => {
      deleteSkuImportTask(taskId);
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_CLEAR_ALL_TASKS,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_CLEAR_ALL_TASKS, async () => clearAllSkuImportTasks()),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_EXECUTE,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_EXECUTE, async (event, taskId: string) =>
      executeSkuImportTask(taskId, (progress) => {
        event.sender.send(IPC_CHANNELS.SKU_IMPORT_EXECUTE_PROGRESS, progress);
      }),
    ),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_EXPORT_RESULTS,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_EXPORT_RESULTS, async (event, taskId: string) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return exportSkuImportTaskResults(taskId, win);
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_CONFIG_GET,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_CONFIG_GET, async () => getSkuImportConfig()),
  );

  ipcMain.handle(
    IPC_CHANNELS.SKU_IMPORT_CONFIG_SET,
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_CONFIG_SET, async (_event, config: SkuImportConfig) =>
      setSkuImportConfig(config),
    ),
  );
}
