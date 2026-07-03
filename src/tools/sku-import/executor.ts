import { uploadToErpOss } from '../../core/erp-oss-uploader';
import type { ErpOssConfig } from '../../core/erp-oss-uploader';
import {
  summarizeSkuImportExecuteRows,
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

function isMissingItemPicPath(picPath: unknown): boolean {
  const normalized = String(picPath ?? '').trim();
  return !normalized || normalized.includes('no_pic.png');
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
      const detail = await catalog.getItemDetailRecord(existing.subItemId);
      if (isMissingItemPicPath(detail.picPath)) {
        await catalog.updateItemPicPath(existing.subItemId, createPayload.picPath);
      }
      return {
        ...existing,
        picPath: createPayload.picPath,
      };
    }
    return existing;
  }

  await catalog.createSticker({
    outerId: stickerCode,
    title: createPayload.title,
    brand: createPayload.brand,
    itemCatName: createPayload.itemCatName,
    unit: createPayload.unit,
    component: createPayload.component,
    standard: createPayload.standard,
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

  for (const previewRow of options.previewRows) {
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
        component: normalized.component,
        standard: normalized.standard,
        picPath: imageUrl,
        itemCatName: previewRow.stickerCategory,
        unit: previewRow.stickerUnit,
      });

      const accessoryBridges = await buildAccessoryBridgeEntries(
        options.catalog,
        previewRow.matchedAccessoryCodes,
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
        picPath: imageUrl,
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
    }
  }

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
