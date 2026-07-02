import path from 'node:path';
import { app, BrowserWindow } from 'electron';

import { registerAllIpcHandlers } from './ipc';
import { getLogDir, initLogger, logger } from './services/logger';
import { initSkuImportJobs } from './services/sku-import';
import { ensureUserDataDirs } from './services/store';
import { createMainWindow } from './windows/main-window';

app.whenReady().then(() => {
  ensureUserDataDirs();
  initSkuImportJobs(path.join(app.getPath('userData'), 'jobs', 'sku-import'));
  initLogger();
  registerAllIpcHandlers();

  logger.info('app', 'ready', {
    version: app.getVersion(),
    userData: app.getPath('userData'),
    logDir: getLogDir(),
  });

  createMainWindow();
  logger.info('app', 'main window created');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      logger.info('app', 'main window recreated');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    logger.info('app', 'all windows closed, quitting');
    app.quit();
  }
});

process.on('uncaughtException', (err) => {
  logger.error('process', 'uncaughtException', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('process', 'unhandledRejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});
