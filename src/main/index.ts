import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';

import { registerAllIpcHandlers } from './ipc';
import { getLogDir, initLogger, logger } from './services/logger';
import { ensureUserDataDirs } from './services/store';
import { createMainWindow } from './windows/main-window';

if (started) {
  app.quit();
}

app.whenReady().then(() => {
  ensureUserDataDirs();
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
