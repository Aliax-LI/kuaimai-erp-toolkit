export const SKU_IMPORT_SHEET_NAME = '待创建货号记录' as const;

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
