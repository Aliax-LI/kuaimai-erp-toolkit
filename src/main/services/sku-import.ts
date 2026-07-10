import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';

import type {
  SkuImportExecuteProgress,
  SkuImportExecuteProgressHandler,
  SkuImportExecuteRowResult,
  SkuImportPreviewProgress,
  SkuImportPreviewProgressHandler,
  SkuImportTaskDetail,
  SkuImportTaskSummary,
} from '@shared/types/sku-import';
import { SKU_IMPORT_SHEET_NAME, summarizeSkuImportExecuteRows } from '@shared/types/sku-import';

import { createErpWebClient } from '../../core/erp-web-client';
import { createErpCatalogClient } from '../../tools/sku-import/erp-catalog';
import { executeSkuImportRows } from '../../tools/sku-import/executor';
import { buildSkuImportPreview } from '../../tools/sku-import/preview';
import {
  buildSkuImportResultExportDefaultPath,
  buildSkuImportResultFilePath,
  getSkuImportResultTaskDir,
} from '../../tools/sku-import/result-file-path';
import { getSkuImportConfig } from './sku-import-config';
import { verifyCreatedSkuImportRow } from '../../tools/sku-import/verify-created-items';
import {
  applySkuImportWorkbookResults,
  clearSkuImportWorkbookResults,
  parseSkuImportWorkbook,
  sweepGhostRowWritebacks,
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

function formatFileAccessError(filePath: string, err: unknown): Error {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
  const message = err instanceof Error ? err.message : String(err);
  if (code === 'EACCES' || code === 'EPERM' || /operation not permitted|permission/i.test(message)) {
    return new Error(
      `访问 Excel 被系统权限拒绝：${filePath}。请把文件移动到“文稿/下载”等可访问目录，或在 macOS「系统设置 > 隐私与安全性 > 文件与文件夹/完全磁盘访问权限」允许本应用访问。`,
    );
  }
  return err instanceof Error ? err : new Error(message);
}

function readWorkbookBuffer(filePath: string): Buffer {
  try {
    return fs.readFileSync(path.resolve(filePath));
  } catch (err) {
    throw formatFileAccessError(filePath, err);
  }
}

function writeWorkbookBuffer(filePath: string, buffer: Buffer): void {
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    throw formatFileAccessError(filePath, err);
  }
}

let jobsDir = '';

export function initSkuImportJobs(dir: string): void {
  jobsDir = dir;
  fs.mkdirSync(jobsDir, { recursive: true });
  fs.mkdirSync(getSkuImportResultsDir(), { recursive: true });
  logger.info('sku-import', 'jobs dir ready', { jobsDir, resultsDir: getSkuImportResultsDir() });
}

function getSkuImportResultsDir(): string {
  return path.join(requireJobsDir(), 'results');
}

function deleteSkuImportResultArtifacts(taskId: string, resultFilePath?: string): void {
  const taskDir = getSkuImportResultTaskDir(getSkuImportResultsDir(), taskId);
  if (fs.existsSync(taskDir)) {
    fs.rmSync(taskDir, { recursive: true, force: true });
  }
  if (resultFilePath && fs.existsSync(resultFilePath) && !resultFilePath.startsWith(taskDir)) {
    fs.unlinkSync(resultFilePath);
  }
}

function clearSkuImportResultArtifacts(): void {
  const resultsDir = getSkuImportResultsDir();
  if (!fs.existsSync(resultsDir)) {
    return;
  }
  for (const entry of fs.readdirSync(resultsDir)) {
    fs.rmSync(path.join(resultsDir, entry), { recursive: true, force: true });
  }
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
  const workbookBuffer = readWorkbookBuffer(task.filePath);
  return parseSkuImportWorkbook(workbookBuffer, task.parsed.sheetName);
}

function toTaskSummary(task: SkuImportJobRecord): SkuImportTaskSummary {
  const verifyFailedCount = task.executeResult?.rows.filter((row) => row.verifyOk === false).length;
  const executeCounts = task.executeResult
    ? summarizeSkuImportExecuteRows(task.executeResult.rows, task.preview.totalRows)
    : null;
  return {
    taskId: task.id,
    filePath: task.filePath,
    fileName: path.basename(task.filePath),
    resultFilePath: task.resultFilePath,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    totalRows: task.preview.totalRows,
    readyCount: task.preview.readyCount,
    blockedCount: task.preview.blockedCount,
    skippedCount: task.preview.skippedCount,
    succeededCount: executeCounts?.succeededCount,
    failedCount: executeCounts?.failedCount,
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

function emitPreviewProgress(
  onProgress: SkuImportPreviewProgressHandler | undefined,
  progress: SkuImportPreviewProgress,
): void {
  onProgress?.({
    ...progress,
    percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
  });
}

function emitExecuteProgress(
  onProgress: SkuImportExecuteProgressHandler | undefined,
  progress: SkuImportExecuteProgress,
): void {
  onProgress?.({
    ...progress,
    percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
  });
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
  onProgress?: SkuImportExecuteProgressHandler,
): Promise<NonNullable<SkuImportJobRecord['executeResult']>> {
  const catalog = createErpCatalogClient(getErpWebConfig());
  const client = createErpWebClient(getErpWebConfig());
  const enrichedRows: SkuImportExecuteRowResult[] = [];
  const totalRows = executeResult.rows.length;

  for (const [index, rowResult] of executeResult.rows.entries()) {
    if (rowResult.status !== 'succeeded' && rowResult.status !== 'skipped_existing') {
      enrichedRows.push(rowResult);
      emitExecuteProgress(onProgress, {
        stage: 'verifying',
        taskId: task.id,
        filePath: task.filePath,
        percent: totalRows > 0 ? 92 + ((index + 1) / totalRows) * 7 : 99,
        message: `正在验证第 ${index + 1} / ${totalRows} 行`,
        currentRows: index + 1,
        totalRows,
        ...summarizeSkuImportExecuteRows(enrichedRows, task.preview.totalRows),
      });
      continue;
    }

    const previewRow = task.preview.rows.find((row) => row.rowNumber === rowResult.rowNumber);
    if (!previewRow) {
      enrichedRows.push(rowResult);
      emitExecuteProgress(onProgress, {
        stage: 'verifying',
        taskId: task.id,
        filePath: task.filePath,
        percent: totalRows > 0 ? 92 + ((index + 1) / totalRows) * 7 : 99,
        message: `正在验证第 ${index + 1} / ${totalRows} 行`,
        currentRows: index + 1,
        totalRows,
        ...summarizeSkuImportExecuteRows(enrichedRows, task.preview.totalRows),
      });
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
    emitExecuteProgress(onProgress, {
      stage: 'verifying',
      taskId: task.id,
      filePath: task.filePath,
      percent: totalRows > 0 ? 92 + ((index + 1) / totalRows) * 7 : 99,
      message: `正在验证第 ${index + 1} / ${totalRows} 行`,
      currentRows: index + 1,
      totalRows,
      ...summarizeSkuImportExecuteRows(enrichedRows, task.preview.totalRows),
    });
  }

  return {
    ...executeResult,
    ...summarizeSkuImportExecuteRows(enrichedRows, task.preview.totalRows),
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
      const workbookBuffer = readWorkbookBuffer(filePath);
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
      writeWorkbookBuffer(filePath, updated);
      clearedFiles.push(filePath);
    } catch (err) {
      logger.warn('sku-import', 'clear workbook results failed', {
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const clearedTaskCount = clearSkuImportJobs(requireJobsDir());
  clearSkuImportResultArtifacts();
  logger.info('sku-import', 'all tasks cleared', { clearedTaskCount, clearedFiles });
  return { clearedTaskCount, clearedFiles };
}

export function deleteSkuImportTask(taskId: string): void {
  const task = getTaskOrThrow(taskId);
  if (task.status === 'executing') {
    throw new Error('任务执行中，无法删除');
  }
  deleteSkuImportResultArtifacts(taskId, task.resultFilePath);
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

export async function previewSkuImportFile(
  filePath: string,
  onProgress?: SkuImportPreviewProgressHandler,
): Promise<SkuImportTaskDetail> {
  if (!filePath.trim() || !fs.existsSync(filePath)) {
    throw new Error('Excel 文件不存在');
  }

  const taskId = randomUUID();
  const now = new Date().toISOString();
  emitPreviewProgress(onProgress, {
    taskId,
    filePath,
    stage: 'reading',
    percent: 5,
    message: '正在读取 Excel 文件',
  });
  const workbookBuffer = readWorkbookBuffer(filePath);
  emitPreviewProgress(onProgress, {
    taskId,
    filePath,
    stage: 'parsing',
    percent: 15,
    message: '正在解析 Sheet1',
  });
  const parsed = await parseSkuImportWorkbook(workbookBuffer, SKU_IMPORT_SHEET_NAME);
  emitPreviewProgress(onProgress, {
    taskId,
    filePath,
    stage: 'config',
    percent: 25,
    message: `已读取 ${parsed.rows.length} 行，正在加载配置`,
    currentRows: 0,
    totalRows: parsed.rows.length,
  });
  const catalog = createErpCatalogClient(getErpWebConfig());
  const importConfig = getSkuImportConfig();

  logger.info('sku-import', 'preview start', {
    filePath,
    rowCount: parsed.rows.length,
    taskId,
  });

  const preview = await buildSkuImportPreview(
    taskId,
    filePath,
    parsed,
    catalog,
    importConfig,
    {
      onProgress: (progress) =>
        emitPreviewProgress(onProgress, {
          ...progress,
          taskId,
          filePath,
        }),
    },
  );
  emitPreviewProgress(onProgress, {
    taskId,
    filePath,
    stage: 'saving',
    percent: 98,
    message: '正在保存预演任务',
    currentRows: parsed.rows.length,
    totalRows: parsed.rows.length,
  });
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
  emitPreviewProgress(onProgress, {
    taskId,
    filePath,
    stage: 'done',
    percent: 100,
    message: '预演完成',
    currentRows: parsed.rows.length,
    totalRows: parsed.rows.length,
  });

  return toTaskDetail(task);
}

export async function executeSkuImportTask(
  taskId: string,
  onProgress?: SkuImportExecuteProgressHandler,
): Promise<SkuImportTaskDetail> {
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
  emitExecuteProgress(onProgress, {
    stage: 'preparing',
    taskId,
    filePath: task.filePath,
    percent: 1,
    message: '正在准备创建任务',
    currentRows: 0,
    totalRows: task.preview.rows.length,
  });

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
      onProgress: (progress) => emitExecuteProgress(onProgress, progress),
    });

    const resultFilePath = buildSkuImportResultFilePath(
      getSkuImportResultsDir(),
      taskId,
      task.filePath,
    );
    let writebackFailed: string | undefined;
    emitExecuteProgress(onProgress, {
      stage: 'writeback',
      taskId,
      filePath: resultFilePath,
      percent: 88,
      message: `正在写入结果副本：${path.basename(resultFilePath)}`,
      currentRows: executeResult.rows.length,
      totalRows: executeResult.rows.length,
      ...summarizeSkuImportExecuteRows(executeResult.rows, task.preview.totalRows),
    });
    try {
      fs.mkdirSync(path.dirname(resultFilePath), { recursive: true });
      writeWorkbookBuffer(resultFilePath, updatedWorkbook);
      task.resultFilePath = resultFilePath;
    } catch (writeErr) {
      writebackFailed =
        writeErr instanceof Error ? writeErr.message : String(writeErr);
      logger.warn('sku-import', 'result workbook write failed', {
        taskId,
        resultFilePath,
        error: writebackFailed,
      });
    }

    task.parsed = {
      ...task.parsed,
      rows: parsed.rows,
    };
    task.executeResult = await enrichExecuteResultWithVerification(task, {
      ...executeResult,
      ...summarizeSkuImportExecuteRows(executeResult.rows, task.preview.totalRows),
    }, onProgress);
    task.status = 'completed';
    task.updatedAt = new Date().toISOString();

    const verifyFailedCount = task.executeResult.rows.filter((row) => row.verifyOk === false).length;
    if (writebackFailed) {
      task.failureMessage = `创建已完成，但结果 Excel 写入失败：${writebackFailed}。请点击「导出结果 Excel」重试。`;
    } else if (verifyFailedCount > 0) {
      task.failureMessage = `${verifyFailedCount} 条记录结构验证未通过，请在 ERP 中检查`;
    }

    persistTask(task);

    logger.info('sku-import', 'execute done', {
      taskId,
      succeededCount: task.executeResult.succeededCount,
      failedCount: task.executeResult.failedCount,
      skippedCount: task.executeResult.skippedCount,
      verifyFailedCount,
      resultFilePath: task.resultFilePath,
      writebackFailed: Boolean(writebackFailed),
    });
    emitExecuteProgress(onProgress, {
      stage: 'done',
      taskId,
      filePath: task.resultFilePath ?? task.filePath,
      percent: 100,
      message: task.resultFilePath
        ? `创建完成，结果已写入 ${path.basename(task.resultFilePath)}`
        : '创建完成',
      currentRows: task.executeResult.rows.length,
      totalRows: task.executeResult.rows.length,
      succeededCount: task.executeResult.succeededCount,
      failedCount: task.executeResult.failedCount,
      skippedCount: task.executeResult.skippedCount,
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
  taskId: string,
  results: Array<{ rowNumber: number; skuCode: string; status: string; failureReason: string }>,
): Promise<string> {
  const workbookBuffer = readWorkbookBuffer(filePath);
  const updated = await applySkuImportWorkbookResults(
    workbookBuffer,
    SKU_IMPORT_SHEET_NAME,
    results,
  );
  const resultFilePath = buildSkuImportResultFilePath(
    getSkuImportResultsDir(),
    taskId,
    filePath,
  );
  fs.mkdirSync(path.dirname(resultFilePath), { recursive: true });
  writeWorkbookBuffer(resultFilePath, updated);
  return resultFilePath;
}

export async function exportSkuImportTaskResults(
  taskId: string,
  win?: BrowserWindow | null,
): Promise<string | null> {
  const task = getTaskOrThrow(taskId);
  if (!task.executeResult) {
    throw new Error('该任务还没有执行结果，无法导出');
  }

  const parsed = await loadParsedWithWorkbook(task);
  const updated = await applySkuImportWorkbookResults(
    parsed.workbookBuffer,
    parsed.sheetName,
    task.executeResult.rows.map((row) => ({
      rowNumber: row.rowNumber,
      skuCode: row.skuCode,
      status: row.status,
      failureReason: row.failureReason,
    })),
  );
  const finalWorkbook = await sweepGhostRowWritebacks(updated, parsed.sheetName);
  if (task.resultFilePath && fs.existsSync(task.resultFilePath)) {
    const result = win
      ? await dialog.showSaveDialog(win, {
          defaultPath: buildSkuImportResultExportDefaultPath(task.filePath),
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        })
      : await dialog.showSaveDialog({
          defaultPath: buildSkuImportResultExportDefaultPath(task.filePath),
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        });

    if (result.canceled || !result.filePath) {
      return null;
    }

    fs.copyFileSync(task.resultFilePath, result.filePath);
    return result.filePath;
  }

  const defaultPath = buildSkuImportResultExportDefaultPath(task.filePath);
  const result = win
    ? await dialog.showSaveDialog(win, {
        defaultPath,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
    : await dialog.showSaveDialog({
        defaultPath,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });

  if (result.canceled || !result.filePath) {
    return null;
  }

  writeWorkbookBuffer(result.filePath, finalWorkbook);
  return result.filePath;
}
