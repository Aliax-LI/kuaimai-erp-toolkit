import { uploadToErpOss } from '../../core/erp-oss-uploader';
import type { ErpOssConfig } from '../../core/erp-oss-uploader';
import {
  summarizeSkuImportExecuteRows,
  type SkuImportExecuteProgressHandler,
  type SkuImportExecuteResult,
  type SkuImportPreviewRow,
} from '@shared/types/sku-import';

import { isSkuImportDataRow, normalizeImportRowValues } from './domain';
import type { ErpCatalogClient } from './erp-catalog';
import type { SuiteBridgeEntry } from './erp-item-payload';
import {
  applySkuImportWorkbookResults,
  sweepGhostRowWritebacks,
  type ParsedSkuImportWorkbook,
} from './workbook';

function shouldWritebackRow(parsed: ParsedSkuImportWorkbook, rowNumber: number): boolean {
  const sourceRow = parsed.rows.find((row) => row.rowNumber === rowNumber);
  return Boolean(sourceRow && isSkuImportDataRow(sourceRow.values));
}

async function resolveStickerBridgeEntry(
  catalog: ErpCatalogClient,
  stickerCode: string,
  createPayload: {
    title: string;
    brand?: string;
    component?: string;
    standard?: string;
    picPath?: string;
    itemCatName: string;
    unit: string;
  },
): Promise<SuiteBridgeEntry> {
  const existing = await catalog.buildBridgeEntryForOuterId(stickerCode);
  if (existing) {
    if (createPayload.picPath) {
      await catalog.updateItemPicPath(existing.subItemId, createPayload.picPath);
    }
    return existing;
  }

  await catalog.createSticker({
    outerId: stickerCode,
    title: createPayload.title,
    brand: createPayload.brand,
    itemCatName: createPayload.itemCatName,
    unit: createPayload.unit,
    picPath: createPayload.picPath,
  });

  const created = await catalog.buildBridgeEntryForOuterId(stickerCode);
  if (!created) {
    throw new Error(`贴纸创建后无法解析 bridge: ${stickerCode}`);
  }
  return created;
}

async function buildAccessoryBridgeEntries(
  catalog: ErpCatalogClient,
  accessoryOuterIds: string[],
): Promise<SuiteBridgeEntry[]> {
  const entries: SuiteBridgeEntry[] = [];
  for (const outerId of accessoryOuterIds) {
    const entry = await catalog.buildBridgeEntryForOuterId(outerId);
    if (!entry) {
      throw new Error(`配件不存在或无法解析 bridge: ${outerId}`);
    }
    entries.push(entry);
  }
  return entries;
}

export async function executeSkuImportRows(options: {
  sessionId: string;
  filePath: string;
  parsed: ParsedSkuImportWorkbook;
  previewRows: SkuImportPreviewRow[];
  catalog: ErpCatalogClient;
  ossConfig: ErpOssConfig;
  onProgress?: SkuImportExecuteProgressHandler;
}): Promise<{ executeResult: SkuImportExecuteResult; updatedWorkbook: Buffer }> {
  const rowResults: SkuImportExecuteResult['rows'] = [];
  const writebacks: Array<{
    rowNumber: number;
    skuCode: string;
    status: string;
    failureReason: string;
  }> = [];

  const pushWriteback = (entry: {
    rowNumber: number;
    skuCode: string;
    status: string;
    failureReason: string;
  }) => {
    if (shouldWritebackRow(options.parsed, entry.rowNumber)) {
      writebacks.push(entry);
    }
  };
  const totalRows = options.previewRows.length;
  const emitRowProgress = (index: number) => {
    const summary = summarizeSkuImportExecuteRows(rowResults, totalRows);
    options.onProgress?.({
      stage: 'executing',
      taskId: options.sessionId,
      filePath: options.filePath,
      percent: totalRows > 0 ? 5 + ((index + 1) / totalRows) * 80 : 85,
      message: `正在处理第 ${index + 1} / ${totalRows} 行`,
      currentRows: index + 1,
      totalRows,
      ...summary,
    });
  };

  options.onProgress?.({
    stage: 'executing',
    taskId: options.sessionId,
    filePath: options.filePath,
    percent: 5,
    message: `准备创建 ${totalRows} 行`,
    currentRows: 0,
    totalRows,
  });

  for (const [index, previewRow] of options.previewRows.entries()) {
    if (previewRow.status === 'skipped_existing') {
      rowResults.push({
        rowNumber: previewRow.rowNumber,
        skuCode: previewRow.existingSkuCode ?? previewRow.proposedSkuCode,
        status: 'skipped_existing',
        failureReason: previewRow.blockedReason ?? '已存在，跳过',
      });
      pushWriteback({
        rowNumber: previewRow.rowNumber,
        skuCode: previewRow.existingSkuCode ?? previewRow.proposedSkuCode,
        status: 'skipped_existing',
        failureReason: previewRow.blockedReason ?? '已存在，跳过',
      });
      emitRowProgress(index);
      continue;
    }

    if (previewRow.status !== 'pending') {
      rowResults.push({
        rowNumber: previewRow.rowNumber,
        skuCode: previewRow.proposedSkuCode,
        status: previewRow.status,
        failureReason: previewRow.blockedReason ?? '预演未通过',
      });
      pushWriteback({
        rowNumber: previewRow.rowNumber,
        skuCode: previewRow.proposedSkuCode,
        status: previewRow.status,
        failureReason: previewRow.blockedReason ?? '预演未通过',
      });
      emitRowProgress(index);
      continue;
    }

    const sourceRow = options.parsed.rows.find((row) => row.rowNumber === previewRow.rowNumber);
    const normalized = normalizeImportRowValues(sourceRow?.values ?? {});
    const bundleOuterId = previewRow.proposedSkuCode;
    const stickerCode = previewRow.stickerOuterId;

    try {
      const existingBundles = await options.catalog.getItemsByOuterIds([bundleOuterId]);
      if (existingBundles.length > 0) {
        rowResults.push({
          rowNumber: previewRow.rowNumber,
          skuCode: bundleOuterId,
          status: 'skipped_existing',
          failureReason: 'ERP 中已存在套装货号，将跳过创建',
        });
        pushWriteback({
          rowNumber: previewRow.rowNumber,
          skuCode: bundleOuterId,
          status: 'skipped_existing',
          failureReason: 'ERP 中已存在套装货号，将跳过创建',
        });
        emitRowProgress(index);
        continue;
      }

      let imageUrl: string | undefined;
      const image = sourceRow?.images[0];
      if (image) {
        const upload = await uploadToErpOss(
          image.buffer,
          image.fileName || `row-${previewRow.rowNumber}.png`,
          options.ossConfig,
        );
        imageUrl = upload.url;
      }

      const stickerBridge = await resolveStickerBridgeEntry(options.catalog, stickerCode, {
        title: previewRow.stickerTitle,
        brand: previewRow.brand,
        itemCatName: previewRow.stickerCategory,
        unit: previewRow.stickerUnit,
        picPath: imageUrl,
      });

      const accessoryBridges = await buildAccessoryBridgeEntries(
        options.catalog,
        previewRow.matchedAccessorySkus.map((item) => item.skuOuterId),
      );

      const productOriginalBridge = await options.catalog.buildBridgeEntryForOuterId(
        previewRow.productOriginalOuterId,
      );
      if (!productOriginalBridge) {
        throw new Error(`产品原品不存在或无法解析 bridge: ${previewRow.productOriginalOuterId}`);
      }

      await options.catalog.createPureSuite({
        outerId: bundleOuterId,
        title: previewRow.bundleTitle,
        brand: previewRow.brand,
        itemCatName: previewRow.bundleCategory,
        component: normalized.component,
        standard: normalized.standard,
        itemSuiteBridgeList: [productOriginalBridge, ...accessoryBridges, stickerBridge],
      });

      rowResults.push({
        rowNumber: previewRow.rowNumber,
        skuCode: bundleOuterId,
        status: 'succeeded',
        failureReason: '',
      });
      pushWriteback({
        rowNumber: previewRow.rowNumber,
        skuCode: bundleOuterId,
        status: 'succeeded',
        failureReason: '',
      });
      emitRowProgress(index);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rowResults.push({
        rowNumber: previewRow.rowNumber,
        skuCode: bundleOuterId,
        status: 'failed',
        failureReason: message,
      });
      pushWriteback({
        rowNumber: previewRow.rowNumber,
        skuCode: bundleOuterId,
        status: 'failed',
        failureReason: message,
      });
      emitRowProgress(index);
    }
  }

  options.onProgress?.({
    stage: 'writeback',
    taskId: options.sessionId,
    filePath: options.filePath,
    percent: 90,
    message: '正在写回 Excel 创建结果',
    currentRows: totalRows,
    totalRows,
    ...summarizeSkuImportExecuteRows(rowResults, totalRows),
  });
  let updatedWorkbook = await applySkuImportWorkbookResults(
    options.parsed.workbookBuffer,
    options.parsed.sheetName,
    writebacks,
  );
  updatedWorkbook = await sweepGhostRowWritebacks(updatedWorkbook, options.parsed.sheetName);

  return {
    executeResult: {
      sessionId: options.sessionId,
      filePath: options.filePath,
      ...summarizeSkuImportExecuteRows(rowResults, options.previewRows.length),
      rows: rowResults,
    },
    updatedWorkbook,
  };
}
