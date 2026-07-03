import type { MatchedAccessorySku } from '@shared/types/sku-import';
import type { SkuImportPreviewRow, SkuImportPreviewResult } from '@shared/types/sku-import';
import type { SkuImportConfig } from '@shared/schemas/sku-import-config';
import { resolveSkuImportRules } from '@shared/schemas/sku-import-config';

import { STICKER_CATEGORY_NAME } from './constants';
import { matchAccessoriesFromConfig, resolveBrandCodeFromConfig } from './catalog-config';
import {
  buildBundleOuterId,
  buildBusinessKey,
  buildStickerTitle,
  buildBundleTitle,
  normalizeImportRowValues,
  parseAccessoryNames,
  validateImportRow,
} from './domain';
import type { ErpCatalogClient } from './erp-catalog';
import type { ParsedSkuImportWorkbook } from './workbook';

async function resolveMatchedAccessorySkus(
  catalog: ErpCatalogClient,
  configMatches: Array<{ name: string; skuCode: string }>,
): Promise<{ matched: MatchedAccessorySku[]; missing: string[] }> {
  const matched: MatchedAccessorySku[] = [];
  const missing: string[] = [];

  for (const entry of configMatches) {
    const items = await catalog.getItemsByOuterIds([entry.skuCode]);
    const item = items.find((row) => row.outerId === entry.skuCode) ?? items[0];
    if (!item?.outerId) {
      missing.push(`${entry.name}（ERP 未找到货号 ${entry.skuCode}）`);
      continue;
    }
    const bridge = await catalog.buildBridgeEntryForOuterId(item.outerId);
    if (!bridge) {
      missing.push(`${entry.name}（无法解析 ERP 货号 ${entry.skuCode}）`);
      continue;
    }
    matched.push({
      name: entry.name,
      itemOuterId: item.outerId,
      skuOuterId: bridge.outerId,
      sysItemId: bridge.subItemId,
    });
  }

  return { matched, missing };
}

function previewRowBase(input: {
  rowNumber: number;
  businessKey: string;
  normalized: ReturnType<typeof normalizeImportRowValues>;
  accessories: string[];
  proposedSkuCode: string;
  stickerOuterId: string;
  productOriginalOuterId: string;
  accessoryMatch: { matched: string[]; missing: string[] };
  matchedAccessorySkus: MatchedAccessorySku[];
  rules: ReturnType<typeof resolveSkuImportRules>;
}): Omit<SkuImportPreviewRow, 'status' | 'blockedReason' | 'existingSkuCode'> {
  const displayName = input.normalized.displayName || input.normalized.productName;
  return {
    rowNumber: input.rowNumber,
    businessKey: input.businessKey,
    brand: input.normalized.brand,
    productName: input.normalized.productName,
    capacity: input.normalized.capacity,
    stickerCode: input.normalized.stickerCode,
    displayName,
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
      displayName,
      input.accessories,
    ),
    matchedAccessoryCodes: input.accessoryMatch.matched,
    missingAccessoryNames: input.accessoryMatch.missing,
    productOriginalOuterId: input.productOriginalOuterId,
    stickerOuterId: input.stickerOuterId,
    matchedAccessorySkus: input.matchedAccessorySkus,
    bundleCategory: input.rules.bundleCategoryName,
    stickerCategory: STICKER_CATEGORY_NAME,
    stickerUnit: input.rules.stickerUnitName,
  };
}

export async function buildSkuImportPreview(
  sessionId: string,
  filePath: string,
  parsed: ParsedSkuImportWorkbook,
  catalog: ErpCatalogClient,
  importConfig: SkuImportConfig,
): Promise<SkuImportPreviewResult> {
  const rows: SkuImportPreviewRow[] = [];
  const rules = resolveSkuImportRules(importConfig);

  for (const row of parsed.rows) {
    const validationError = validateImportRow(row.values);
    const normalized = normalizeImportRowValues(row.values);
    const accessories = parseAccessoryNames(normalized.accessoriesRaw);
    const businessKey = buildBusinessKey(row.values);
    const productOriginalOuterId = normalized.productCode;

    const brandResolved = resolveBrandCodeFromConfig(normalized.brand, importConfig);
    const proposedSkuCode =
      normalized.existingSkuCode ||
      buildBundleOuterId(rules, normalized.brand, normalized.productCode, normalized.stickerCode);
    const stickerOuterId = normalized.stickerCode;

    const existingItems = await catalog.getItemsByOuterIds([proposedSkuCode, stickerOuterId]);
    const existingOuterIds = new Set(existingItems.map((item) => item.outerId));
    const bundleExists = existingOuterIds.has(proposedSkuCode);
    const stickerExists = existingOuterIds.has(stickerOuterId);

    const configAccessoryMatch = matchAccessoriesFromConfig(
      accessories,
      normalized.brand,
      importConfig,
    );

    const base = previewRowBase({
      rowNumber: row.rowNumber,
      businessKey,
      normalized,
      accessories,
      proposedSkuCode,
      stickerOuterId,
      productOriginalOuterId,
      accessoryMatch: {
        matched: configAccessoryMatch.matched.map((item) => item.skuCode),
        missing: configAccessoryMatch.missing,
      },
      matchedAccessorySkus: [],
      rules,
    });

    if (validationError) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: validationError,
      });
      continue;
    }

    if ('error' in brandResolved) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: brandResolved.error,
      });
      continue;
    }

    const productOriginalItems = await catalog.getItemsByOuterIds([productOriginalOuterId]);
    if (!productOriginalItems[0]?.outerId) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: `产品原品「${productOriginalOuterId}」在 ERP 中不存在`,
      });
      continue;
    }

    if (bundleExists) {
      rows.push({
        ...base,
        proposedSkuCode,
        existingSkuCode: proposedSkuCode,
        status: 'skipped_existing',
        blockedReason: `ERP 中已存在套装货号 ${proposedSkuCode}，将跳过创建`,
      });
      continue;
    }

    if (configAccessoryMatch.missing.length > 0) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: `未匹配配件: ${configAccessoryMatch.missing.join('、')}`,
      });
      continue;
    }

    const { matched: matchedAccessorySkus, missing: erpAccessoryMissing } =
      await resolveMatchedAccessorySkus(catalog, configAccessoryMatch.matched);

    if (erpAccessoryMissing.length > 0) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: erpAccessoryMissing.join('、'),
      });
      continue;
    }

    rows.push({
      ...base,
      matchedAccessorySkus,
      matchedAccessoryCodes: matchedAccessorySkus.map((item) => item.itemOuterId),
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
