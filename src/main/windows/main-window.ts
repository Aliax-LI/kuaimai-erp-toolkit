import path from 'node:path';

import { BrowserWindow } from 'electron';

import { DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from '@shared/constants/app';

const rendererDevServerUrl = process.env.ELECTRON_RENDERER_URL;
const rendererEntry = path.join(__dirname, '../renderer/main_window/index.html');

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: '快麦 ERP 工具箱',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (rendererDevServerUrl) {
    mainWindow.loadURL(rendererDevServerUrl);
  } else {
    mainWindow.loadFile(rendererEntry);
  }

  return mainWindow;
}
