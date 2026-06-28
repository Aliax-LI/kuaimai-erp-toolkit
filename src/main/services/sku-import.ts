import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';

import type {
  SkuImportExecuteRowResult,
  SkuImportTaskDetail,
  SkuImportTaskSummary,
} from '@shared/types/sku-import';
import { SKU_IMPORT_SHEET_NAME } from '@shared/types/sku-import';

import { createErpWebClient } from '../../core/erp-web-client';
import { createErpCatalogClient } from '../../tools/sku-import/erp-catalog';
import { executeSkuImportRows } from '../../tools/sku-import/executor';
import { buildSkuImportPreview } from '../../tools/sku-import/preview';
import { verifyCreatedSkuImportRow } from '../../tools/sku-import/verify-created-items';
import {
  applySkuImportWorkbookResults,
  clearSkuImportWorkbookResults,
  parseSkuImportWorkbook,
  type ParsedSkuImportWorkbook,
} from '../../tools/sku-import/workbook';

import { getErpOssConfig } from './erp-oss';
import { getErpWebConfig } from './erp-web';
import { logger } from './logger';
import {
  clearSkuImportJobs,
  deleteSkuImportJob,
  listSkuImportJobs,
  loadSkuImportJob,
  saveSkuImportJob,
  type SkuImportJobRecord,
} from './sku-import-jobs';

const EXCEL_DIALOG_OPTIONS: OpenDialogOptions = {
  properties: ['openFile'],
  filters: [
    { name: 'Excel', extensions: ['xlsx'] },
    { name: '所有文件', extensions: ['*'] },
  ],
};

let jobsDir = '';

export function initSkuImportJobs(dir: string): void {
  jobsDir = dir;
  fs.mkdirSync(jobsDir, { recursive: true });
  logger.info('sku-import', 'jobs dir ready', { jobsDir });
}

function requireJobsDir(): string {
  if (!jobsDir) {
    throw new Error('建货号任务目录未初始化');
  }
  return jobsDir;
}

function persistTask(task: SkuImportJobRecord): void {
  saveSkuImportJob(requireJobsDir(), task);
}

function loadParsedWithWorkbook(task: SkuImportJobRecord): Promise<ParsedSkuImportWorkbook> {
  const workbookBuffer = fs.readFileSync(path.resolve(task.filePath));
  return parseSkuImportWorkbook(workbookBuffer, task.parsed.sheetName);
}

function toTaskSummary(task: SkuImportJobRecord): SkuImportTaskSummary {
  const verifyFailedCount = task.executeResult?.rows.filter((row) => row.verifyOk === false).length;
  return {
    taskId: task.id,
    filePath: task.filePath,
    fileName: path.basename(task.filePath),
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    totalRows: task.preview.totalRows,
    readyCount: task.preview.readyCount,
    blockedCount: task.preview.blockedCount,
    skippedCount: task.preview.skippedCount,
    succeededCount: task.executeResult?.succeededCount,
    failedCount: task.executeResult?.failedCount,
    verifyFailedCount: verifyFailedCount || undefined,
    failureMessage: task.failureMessage,
  };
}

function toTaskDetail(task: SkuImportJobRecord): SkuImportTaskDetail {
  return {
    ...toTaskSummary(task),
    preview: task.preview,
    executeResult: task.executeResult,
  };
}

function getTaskOrThrow(taskId: string): SkuImportJobRecord {
  const task = loadSkuImportJob(requireJobsDir(), taskId);
  if (!task) {
    throw new Error('任务不存在或已删除');
  }
  return task;
}

async function enrichExecuteResultWithVerification(
  task: SkuImportJobRecord,
  executeResult: NonNullable<SkuImportJobRecord['executeResult']>,
): Promise<NonNullable<SkuImportJobRecord['executeResult']>> {
  const catalog = createErpCatalogClient(getErpWebConfig());
  const client = createErpWebClient(getErpWebConfig());
  const enrichedRows: SkuImportExecuteRowResult[] = [];

  for (const rowResult of executeResult.rows) {
    if (rowResult.status !== 'succeeded' && rowResult.status !== 'skipped_existing') {
      enrichedRows.push(rowResult);
      continue;
    }

    const previewRow = task.preview.rows.find((row) => row.rowNumber === rowResult.rowNumber);
    if (!previewRow) {
      enrichedRows.push(rowResult);
      continue;
    }

    const verification = await verifyCreatedSkuImportRow(catalog, client, previewRow);
    const failedLabels = verification.steps.filter((step) => !step.ok).map((step) => step.label);
    enrichedRows.push({
      ...rowResult,
      verifyOk: verification.ok,
      verifySteps: verification.steps,
      failureReason:
        rowResult.failureReason ||
        (verification.ok ? '' : `结构验证未通过: ${failedLabels.join('、')}`),
    });
  }

  return {
    ...executeResult,
    rows: enrichedRows,
  };
}

export function listSkuImportTasks(): SkuImportTaskSummary[] {
  return listSkuImportJobs(requireJobsDir()).map((task) => toTaskSummary(task));
}

export function getSkuImportTask(taskId: string): SkuImportTaskDetail {
  return toTaskDetail(getTaskOrThrow(taskId));
}

export async function clearAllSkuImportTasks(): Promise<{
  clearedTaskCount: number;
  clearedFiles: string[];
}> {
  const filePaths = [...new Set(listSkuImportJobs(requireJobsDir()).map((task) => task.filePath))];
  const clearedFiles: string[] = [];

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    try {
      const workbookBuffer = fs.readFileSync(path.resolve(filePath));
      const parsed = await parseSkuImportWorkbook(workbookBuffer, SKU_IMPORT_SHEET_NAME);
      const rowNumbers = parsed.rows.map((row) => row.rowNumber);
      if (rowNumbers.length === 0) {
        continue;
      }
      const updated = await clearSkuImportWorkbookResults(
        workbookBuffer,
        SKU_IMPORT_SHEET_NAME,
        rowNumbers,
      );
      fs.writeFileSync(filePath, updated);
      clearedFiles.push(filePath);
    } catch (err) {
      logger.warn('sku-import', 'clear workbook results failed', {
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const clearedTaskCount = clearSkuImportJobs(requireJobsDir());
  logger.info('sku-import', 'all tasks cleared', { clearedTaskCount, clearedFiles });
  return { clearedTaskCount, clearedFiles };
}

export function deleteSkuImportTask(taskId: string): void {
  const task = getTaskOrThrow(taskId);
  if (task.status === 'executing') {
    throw new Error('任务执行中，无法删除');
  }
  deleteSkuImportJob(requireJobsDir(), taskId);
  logger.info('sku-import', 'task deleted', { taskId });
}

export async function pickSkuImportFile(win?: BrowserWindow | null): Promise<string | null> {
  const result = win
    ? await dialog.showOpenDialog(win, EXCEL_DIALOG_OPTIONS)
    : await dialog.showOpenDialog(EXCEL_DIALOG_OPTIONS);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0] ?? null;
}

export async function previewSkuImportFile(filePath: string): Promise<SkuImportTaskDetail> {
  if (!filePath.trim() || !fs.existsSync(filePath)) {
    throw new Error('Excel 文件不存在');
  }

  const workbookBuffer = fs.readFileSync(path.resolve(filePath));
  const parsed = await parseSkuImportWorkbook(workbookBuffer, SKU_IMPORT_SHEET_NAME);
  const catalog = createErpCatalogClient(getErpWebConfig());
  const taskId = randomUUID();
  const now = new Date().toISOString();

  logger.info('sku-import', 'preview start', {
    filePath,
    rowCount: parsed.rows.length,
    taskId,
  });

  const preview = await buildSkuImportPreview(taskId, filePath, parsed, catalog);
  const task: SkuImportJobRecord = {
    id: taskId,
    filePath,
    parsed,
    preview,
    status: 'previewed',
    createdAt: now,
    updatedAt: now,
  };
  persistTask(task);

  logger.info('sku-import', 'preview done', {
    taskId,
    readyCount: preview.readyCount,
    blockedCount: preview.blockedCount,
    skippedCount: preview.skippedCount,
  });

  return toTaskDetail(task);
}

export async function executeSkuImportTask(taskId: string): Promise<SkuImportTaskDetail> {
  const task = getTaskOrThrow(taskId);
  if (task.status === 'executing') {
    throw new Error('任务正在执行中');
  }
  if (task.status === 'completed') {
    throw new Error('任务已执行完成');
  }
  if (task.preview.readyCount <= 0) {
    throw new Error('没有可执行的记录');
  }

  task.status = 'executing';
  task.updatedAt = new Date().toISOString();
  task.failureMessage = undefined;
  persistTask(task);

  const catalog = createErpCatalogClient(getErpWebConfig());
  const ossConfig = getErpOssConfig();
  const parsed = await loadParsedWithWorkbook(task);

  logger.info('sku-import', 'execute start', {
    taskId,
    rowCount: task.preview.rows.length,
  });

  try {
    const { executeResult, updatedWorkbook } = await executeSkuImportRows({
      sessionId: taskId,
      filePath: task.filePath,
      parsed,
      previewRows: task.preview.rows,
      catalog,
      ossConfig,
    });

    fs.writeFileSync(task.filePath, updatedWorkbook);
    task.parsed = {
      ...task.parsed,
      rows: parsed.rows,
    };
    task.executeResult = await enrichExecuteResultWithVerification(task, executeResult);
    task.status = 'completed';
    task.updatedAt = new Date().toISOString();

    const verifyFailedCount = task.executeResult.rows.filter((row) => row.verifyOk === false).length;
    if (verifyFailedCount > 0) {
      task.failureMessage = `${verifyFailedCount} 条记录结构验证未通过，请在 ERP 中检查`;
    }

    persistTask(task);

    logger.info('sku-import', 'execute done', {
      taskId,
      succeededCount: task.executeResult.succeededCount,
      failedCount: task.executeResult.failedCount,
      skippedCount: task.executeResult.skippedCount,
      verifyFailedCount,
    });

    return toTaskDetail(task);
  } catch (err) {
    task.status = 'failed';
    task.failureMessage = err instanceof Error ? err.message : String(err);
    task.updatedAt = new Date().toISOString();
    persistTask(task);
    logger.error('sku-import', 'execute failed', {
      taskId,
      error: task.failureMessage,
    });
    throw err;
  }
}

export async function writeSkuImportResultsOnly(
  filePath: string,
  results: Array<{ rowNumber: number; skuCode: string; status: string; failureReason: string }>,
): Promise<void> {
  const workbookBuffer = fs.readFileSync(path.resolve(filePath));
  const updated = await applySkuImportWorkbookResults(
    workbookBuffer,
    SKU_IMPORT_SHEET_NAME,
    results,
  );
  fs.writeFileSync(filePath, updated);
}
