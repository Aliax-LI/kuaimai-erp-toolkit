import type { MatchedAccessorySku } from '@shared/types/sku-import';
import type { SkuImportPreviewRow, SkuImportPreviewResult } from '@shared/types/sku-import';

import {
  BUNDLE_CATEGORY_NAME,
  STICKER_CATEGORY_NAME,
} from './constants';
import {
  allocateNextSkuCode,
  buildBundleTitle,
  buildBusinessKey,
  buildSkuCodePrefix,
  buildStickerOuterId,
  buildStickerTitle,
  normalizeImportRowValues,
  parseAccessoryNames,
  validateImportRow,
} from './domain';
import type { ErpCatalogClient } from './erp-catalog';
import type { ParsedSkuImportWorkbook } from './workbook';

async function resolveMatchedAccessorySkus(
  catalog: ErpCatalogClient,
  accessoryNames: string[],
  matchedItemOuterIds: string[],
): Promise<MatchedAccessorySku[]> {
  const result: MatchedAccessorySku[] = [];
  for (let index = 0; index < accessoryNames.length; index++) {
    const name = accessoryNames[index];
    const itemOuterId = matchedItemOuterIds[index];
    if (!name || !itemOuterId) {
      continue;
    }
    const bridge = await catalog.buildBridgeEntryForOuterId(itemOuterId);
    if (!bridge) {
      throw new Error(`无法解析配件 bridge: ${itemOuterId}`);
    }
    result.push({
      name,
      itemOuterId,
      skuOuterId: bridge.outerId,
      sysItemId: bridge.subItemId,
    });
  }
  return result;
}

function previewRowBase(input: {
  rowNumber: number;
  businessKey: string;
  normalized: ReturnType<typeof normalizeImportRowValues>;
  accessories: string[];
  proposedSkuCode: string;
  stickerOuterId: string;
  accessoryMatch: { matched: string[]; missing: string[] };
  matchedAccessorySkus: MatchedAccessorySku[];
}): Omit<SkuImportPreviewRow, 'status' | 'blockedReason' | 'existingSkuCode'> {
  return {
    rowNumber: input.rowNumber,
    businessKey: input.businessKey,
    brand: input.normalized.brand,
    productName: input.normalized.productName,
    capacity: input.normalized.capacity,
    stickerCode: input.normalized.stickerCode,
    displayName: input.normalized.displayName || input.normalized.productName,
    accessories: input.accessories,
    proposedSkuCode: input.proposedSkuCode,
    stickerTitle: buildStickerTitle(
      input.normalized.brand,
      input.normalized.productName,
      input.normalized.capacity,
    ),
    bundleTitle: buildBundleTitle(
      input.normalized.brand,
      input.normalized.productName,
      input.accessories,
    ),
    matchedAccessoryCodes: input.accessoryMatch.matched,
    missingAccessoryNames: input.accessoryMatch.missing,
    stickerOuterId: input.stickerOuterId,
    matchedAccessorySkus: input.matchedAccessorySkus,
    bundleCategory: BUNDLE_CATEGORY_NAME,
    stickerCategory: STICKER_CATEGORY_NAME,
  };
}

export async function buildSkuImportPreview(
  sessionId: string,
  filePath: string,
  parsed: ParsedSkuImportWorkbook,
  catalog: ErpCatalogClient,
): Promise<SkuImportPreviewResult> {
  const rows: SkuImportPreviewRow[] = [];

  for (const row of parsed.rows) {
    const validationError = validateImportRow(row.values);
    const normalized = normalizeImportRowValues(row.values);
    const accessories = parseAccessoryNames(normalized.accessoriesRaw);
    const businessKey = buildBusinessKey(row.values);
    const prefix = buildSkuCodePrefix(
      normalized.brand,
      normalized.productCode,
      normalized.productName,
    );

    const prefixOuterIds = normalized.existingSkuCode
      ? []
      : await catalog.listOuterIdsByPrefix(prefix);
    const proposedSkuCode =
      normalized.existingSkuCode || allocateNextSkuCode(prefix, prefixOuterIds);
    const stickerOuterId = buildStickerOuterId(proposedSkuCode);

    const existingItems = await catalog.getItemsByOuterIds([proposedSkuCode, stickerOuterId]);
    const existingOuterIds = new Set(existingItems.map((item) => item.outerId));
    const bundleExists = existingOuterIds.has(proposedSkuCode);
    const stickerExists = existingOuterIds.has(stickerOuterId);

    const accessoryMatch = await catalog.matchAccessoriesForImport(
      normalized.brand,
      normalized.productName,
      accessories,
    );

    const base = previewRowBase({
      rowNumber: row.rowNumber,
      businessKey,
      normalized,
      accessories,
      proposedSkuCode,
      stickerOuterId,
      accessoryMatch,
      matchedAccessorySkus: [],
    });

    if (validationError) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: validationError,
      });
      continue;
    }

    if (bundleExists) {
      rows.push({
        ...base,
        proposedSkuCode,
        existingSkuCode: proposedSkuCode,
        status: 'skipped_existing',
        blockedReason: 'ERP 中已存在套装货号，将跳过创建',
      });
      continue;
    }

    if (accessoryMatch.missing.length > 0) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: `未匹配配件: ${accessoryMatch.missing.join('、')}`,
      });
      continue;
    }

    const matchedAccessorySkus = await resolveMatchedAccessorySkus(
      catalog,
      accessories,
      accessoryMatch.matched,
    );

    rows.push({
      ...base,
      matchedAccessorySkus,
      status: 'pending',
      blockedReason:
        stickerExists && !bundleExists
          ? `贴纸货号 ${stickerOuterId} 已存在，执行时将复用`
          : undefined,
    });
  }

  return {
    sessionId,
    filePath,
    sheetName: parsed.sheetName,
    totalRows: rows.length,
    readyCount: rows.filter((row) => row.status === 'pending').length,
    blockedCount: rows.filter((row) => row.status === 'preview_blocked').length,
    skippedCount: rows.filter((row) => row.status === 'skipped_existing').length,
    rows,
  };
}
