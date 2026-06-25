import fs from 'node:fs';
import path from 'node:path';

import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';

import { uploadToErpOss } from '../../core/erp-oss-uploader';
import type { ErpOssUploadResult } from '@shared/types/upload';

import { getErpOssConfig } from './erp-oss';
import { logger } from './logger';

const UPLOAD_DIALOG_OPTIONS: OpenDialogOptions = {
  properties: ['openFile'],
  filters: [
    { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
    { name: '所有文件', extensions: ['*'] },
  ],
};

export async function pickUploadFile(win?: BrowserWindow | null): Promise<string | null> {
  const result = win
    ? await dialog.showOpenDialog(win, UPLOAD_DIALOG_OPTIONS)
    : await dialog.showOpenDialog(UPLOAD_DIALOG_OPTIONS);

  if (result.canceled || result.filePaths.length === 0) {
    logger.debug('upload', 'pick file canceled');
    return null;
  }

  const picked = result.filePaths[0] ?? null;
  logger.info('upload', 'pick file selected', { fileName: picked ? path.basename(picked) : null });
  return picked;
}

export async function uploadFileToErpOss(filePath: string): Promise<ErpOssUploadResult> {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('无效的文件路径');
  }

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`文件不存在: ${abs}`);
  }

  const config = getErpOssConfig();
  const buffer = fs.readFileSync(abs);
  const fileName = path.basename(abs);

  logger.info('upload', 'oss upload start', { fileName, bytes: buffer.length });
  const result = await uploadToErpOss(buffer, fileName, config);
  logger.info('upload', 'oss upload success', { objectKey: result.objectKey, url: result.url });
  return result;
}
