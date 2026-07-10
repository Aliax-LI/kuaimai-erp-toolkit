export const SKU_IMPORT_SHEET_NAME = 'sheet1' as const;

export const SKU_IMPORT_RESULT_COLUMNS = {
  skuCode: '商品SKU货号',
  status: '创建状态',
  failureReason: '失败原因',
} as const;

export type SkuImportRowStatus =
  | 'pending'
  | 'preview_blocked'
  | 'skipped_existing'
  | 'uploading_image'
  | 'creating_sticker'
  | 'creating_bundle'
  | 'succeeded'
  | 'failed';

export interface SkuImportSourceRow {
  rowNumber: number;
  values: Record<string, string>;
  hasImage: boolean;
}

export interface MatchedAccessorySku {
  name: string;
  itemOuterId: string;
  skuOuterId: string;
  sysItemId?: number;
}

export interface SkuImportVerifyStep {
  label: string;
  ok: boolean;
  detail: string;
}

export interface SkuImportPreviewRow {
  rowNumber: number;
  businessKey: string;
  brand: string;
  productName: string;
  capacity: string;
  stickerCode: string;
  displayName: string;
  accessories: string[];
  proposedSkuCode: string;
  existingSkuCode?: string;
  status: SkuImportRowStatus;
  blockedReason?: string;
  stickerTitle: string;
  bundleTitle: string;
  matchedAccessoryCodes: string[];
  missingAccessoryNames: string[];
  productOriginalOuterId: string;
  stickerOuterId: string;
  matchedAccessorySkus: MatchedAccessorySku[];
  bundleCategory: string;
  stickerCategory: string;
  stickerUnit: string;
}

export interface SkuImportPreviewResult {
  sessionId: string;
  filePath: string;
  sheetName: string;
  totalRows: number;
  readyCount: number;
  blockedCount: number;
  skippedCount: number;
  rows: SkuImportPreviewRow[];
}

export type SkuImportPreviewProgressStage =
  | 'reading'
  | 'parsing'
  | 'config'
  | 'erp_lookup'
  | 'matching'
  | 'saving'
  | 'done';

export interface SkuImportPreviewProgress {
  stage: SkuImportPreviewProgressStage;
  percent: number;
  message: string;
  taskId?: string;
  filePath?: string;
  currentRows?: number;
  totalRows?: number;
}

export type SkuImportPreviewProgressHandler = (progress: SkuImportPreviewProgress) => void;

export type SkuImportExecuteProgressStage =
  | 'preparing'
  | 'executing'
  | 'writeback'
  | 'verifying'
  | 'done';

export interface SkuImportExecuteProgress {
  stage: SkuImportExecuteProgressStage;
  percent: number;
  message: string;
  taskId: string;
  filePath?: string;
  currentRows?: number;
  totalRows?: number;
  succeededCount?: number;
  failedCount?: number;
  skippedCount?: number;
}

export type SkuImportExecuteProgressHandler = (progress: SkuImportExecuteProgress) => void;

export interface SkuImportExecuteRowResult {
  rowNumber: number;
  skuCode: string;
  status: SkuImportRowStatus;
  failureReason: string;
  verifyOk?: boolean;
  verifySteps?: SkuImportVerifyStep[];
}

export interface SkuImportExecuteResult {
  sessionId: string;
  filePath: string;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  rows: SkuImportExecuteRowResult[];
}

export function summarizeSkuImportExecuteRows(
  rows: Pick<SkuImportExecuteRowResult, 'status'>[],
  totalRows?: number,
): Pick<SkuImportExecuteResult, 'succeededCount' | 'failedCount' | 'skippedCount'> {
  const succeededCount = rows.filter((row) => row.status === 'succeeded').length;
  const effectiveTotal =
    totalRows !== undefined ? Math.max(totalRows, rows.length) : rows.length;
  return {
    succeededCount,
    failedCount: effectiveTotal - succeededCount,
    skippedCount: rows.filter((row) => row.status === 'skipped_existing').length,
  };
}

export type SkuImportTaskStatus = 'previewed' | 'executing' | 'completed' | 'failed';

export interface SkuImportTaskSummary {
  taskId: string;
  filePath: string;
  fileName: string;
  /** 执行完成后写入的结果 Excel 副本（位于 userData/jobs/sku-import/results/） */
  resultFilePath?: string;
  status: SkuImportTaskStatus;
  createdAt: string;
  updatedAt: string;
  totalRows: number;
  readyCount: number;
  blockedCount: number;
  skippedCount: number;
  succeededCount?: number;
  failedCount?: number;
  verifyFailedCount?: number;
  failureMessage?: string;
}

export interface SkuImportTaskDetail extends SkuImportTaskSummary {
  preview: SkuImportPreviewResult;
  executeResult?: SkuImportExecuteResult;
}

export interface AccessoryImportResult {
  added: number;
  updated: number;
  skipped: number;
}

export interface AccessoryExportResult {
  filePath: string;
}
