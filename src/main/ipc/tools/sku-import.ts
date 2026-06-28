import { BrowserWindow, ipcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/ipc-channels';

import {
  clearAllSkuImportTasks,
  deleteSkuImportTask,
  executeSkuImportTask,
  getSkuImportTask,
  listSkuImportTasks,
  pickSkuImportFile,
  previewSkuImportFile,
} from '../../services/sku-import';
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
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_PREVIEW, async (_event, filePath: string) =>
      previewSkuImportFile(filePath),
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
    wrapIpcHandler(IPC_CHANNELS.SKU_IMPORT_EXECUTE, async (_event, taskId: string) =>
      executeSkuImportTask(taskId),
    ),
  );
}
