import type { MatchedAccessorySku } from '@shared/types/sku-import';
import type {
  SkuImportPreviewProgress,
  SkuImportPreviewProgressHandler,
  SkuImportPreviewRow,
  SkuImportPreviewResult,
} from '@shared/types/sku-import';
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
import {
  findCatalogItemByOuterId,
  type ErpCatalogClient,
  type ErpCatalogItem,
} from './erp-catalog';
import type { ParsedSkuImportWorkbook } from './workbook';

type BridgeEntryResult = Awaited<ReturnType<ErpCatalogClient['buildBridgeEntryForOuterId']>>;

interface BuildSkuImportPreviewOptions {
  onProgress?: SkuImportPreviewProgressHandler;
}

interface PreviewCatalogCache {
  getItemsByOuterIds(outerIds: string[]): Promise<ErpCatalogItem[]>;
  buildBridgeEntryForOuterId(outerId: string): Promise<BridgeEntryResult>;
}

function createPreviewCatalogCache(catalog: ErpCatalogClient): PreviewCatalogCache {
  const itemCache = new Map<string, Promise<ErpCatalogItem | null>>();
  const bridgeCache = new Map<string, Promise<BridgeEntryResult>>();

  const normalize = (value: string): string => value.trim();

  return {
    async getItemsByOuterIds(outerIds: string[]): Promise<ErpCatalogItem[]> {
      const unique = [...new Set(outerIds.map(normalize).filter(Boolean))];
      const missing = unique.filter((outerId) => !itemCache.has(outerId));

      if (missing.length > 0) {
        const batchLookup = catalog.getItemsByOuterIds(missing);
        for (const outerId of missing) {
          itemCache.set(
            outerId,
            batchLookup.then((items) => findCatalogItemByOuterId(items, outerId) ?? null),
          );
        }
      }

      const items = await Promise.all(unique.map((outerId) => itemCache.get(outerId)!));
      return items.filter((item): item is ErpCatalogItem => item !== null);
    },

    buildBridgeEntryForOuterId(outerId: string): Promise<BridgeEntryResult> {
      const normalized = normalize(outerId);
      if (!bridgeCache.has(normalized)) {
        bridgeCache.set(normalized, catalog.buildBridgeEntryForOuterId(normalized));
      }
      return bridgeCache.get(normalized)!;
    },
  };
}

async function resolveMatchedAccessorySkus(
  catalog: PreviewCatalogCache,
  configMatches: Array<{ name: string; skuCode: string }>,
): Promise<{ matched: MatchedAccessorySku[]; missing: string[] }> {
  const matched: MatchedAccessorySku[] = [];
  const missing: string[] = [];

  for (const entry of configMatches) {
    const items = await catalog.getItemsByOuterIds([entry.skuCode]);
    const item = findCatalogItemByOuterId(items, entry.skuCode);
    if (!item?.outerId) {
      missing.push(`${entry.name}（ERP 未找到货号 ${entry.skuCode}）`);
      continue;
    }
    const bridge = await catalog.buildBridgeEntryForOuterId(entry.skuCode);
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
  const displayName = `${input.normalized.productName}${input.normalized.capacity}`.replace(/\s+/g, '');
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
      input.normalized.stickerRemark,
    ),
    bundleTitle: buildBundleTitle(
      input.normalized.brand,
      input.normalized.productName,
      input.normalized.capacity,
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
  options: BuildSkuImportPreviewOptions = {},
): Promise<SkuImportPreviewResult> {
  const rows: SkuImportPreviewRow[] = [];
  const rules = resolveSkuImportRules(importConfig);
  const catalogCache = createPreviewCatalogCache(catalog);
  const emitProgress = (progress: SkuImportPreviewProgress) => {
    options.onProgress?.({
      taskId: sessionId,
      filePath,
      ...progress,
      percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
    });
  };
  const rowContexts = parsed.rows.map((row) => {
    const validationError = validateImportRow(row.values);
    const normalized = normalizeImportRowValues(row.values);
    const accessories = parseAccessoryNames(normalized.accessoriesRaw);
    const businessKey = buildBusinessKey(row.values);
    const productOriginalOuterId = normalized.productCode;
    const brandResolved = resolveBrandCodeFromConfig(normalized.brand, importConfig);
    const proposedSkuCode =
      normalized.existingSkuCode ||
      ('code' in brandResolved
        ? buildBundleOuterId(
            rules,
            brandResolved.code,
            normalized.productName,
            normalized.stickerCode,
          )
        : '');
    const stickerOuterId = normalized.stickerCode;
    const configAccessoryMatch = matchAccessoriesFromConfig(
      accessories,
      normalized.brand,
      importConfig,
    );

    return {
      row,
      validationError,
      normalized,
      accessories,
      businessKey,
      productOriginalOuterId,
      brandResolved,
      proposedSkuCode,
      stickerOuterId,
      configAccessoryMatch,
    };
  });

  emitProgress({
    stage: 'erp_lookup',
    percent: 35,
    message: `准备查询 ERP 基础数据，共 ${rowContexts.length} 行`,
    currentRows: 0,
    totalRows: rowContexts.length,
  });
  await catalogCache.getItemsByOuterIds(
    rowContexts.flatMap((context) => {
      if (context.validationError || 'error' in context.brandResolved) {
        return [];
      }
      return [
        context.proposedSkuCode,
        context.stickerOuterId,
        context.productOriginalOuterId,
        ...context.configAccessoryMatch.matched.map((item) => item.skuCode),
      ];
    }),
  );
  emitProgress({
    stage: 'matching',
    percent: rowContexts.length > 0 ? 65 : 90,
    message: rowContexts.length > 0 ? '开始匹配品牌、贴纸和配件' : 'Excel 中没有可预演行',
    currentRows: 0,
    totalRows: rowContexts.length,
  });
  const emitRowProgress = (index: number) => {
    const currentRows = index + 1;
    emitProgress({
      stage: 'matching',
      percent: 65 + (currentRows / Math.max(rowContexts.length, 1)) * 30,
      message: `正在匹配第 ${currentRows} / ${rowContexts.length} 行`,
      currentRows,
      totalRows: rowContexts.length,
    });
  };

  for (const [index, context] of rowContexts.entries()) {
    const {
      row,
      validationError,
      normalized,
      accessories,
      businessKey,
      productOriginalOuterId,
      brandResolved,
      proposedSkuCode,
      stickerOuterId,
      configAccessoryMatch,
    } = context;

    let bundleExists = false;
    let stickerExists = false;

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
      emitRowProgress(index);
      continue;
    }

    if ('error' in brandResolved) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: brandResolved.error,
      });
      emitRowProgress(index);
      continue;
    }

    const existingItems = await catalogCache.getItemsByOuterIds([proposedSkuCode, stickerOuterId]);
    const existingOuterIds = new Set(existingItems.map((item) => item.outerId));
    bundleExists = existingOuterIds.has(proposedSkuCode);
    stickerExists = existingOuterIds.has(stickerOuterId);

    const productOriginalItems = await catalogCache.getItemsByOuterIds([productOriginalOuterId]);
    if (!productOriginalItems[0]?.outerId) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: `产品原品「${productOriginalOuterId}」在 ERP 中不存在`,
      });
      emitRowProgress(index);
      continue;
    }

    if (bundleExists) {
      rows.push({
        ...base,
        proposedSkuCode,
        existingSkuCode: proposedSkuCode,
        status: 'preview_blocked',
        blockedReason: 'ERP 中已存在套装货号，不允许导入',
      });
      emitRowProgress(index);
      continue;
    }

    if (configAccessoryMatch.missing.length > 0) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: `未匹配配件: ${configAccessoryMatch.missing.join('、')}`,
      });
      emitRowProgress(index);
      continue;
    }

    const { matched: matchedAccessorySkus, missing: erpAccessoryMissing } =
      await resolveMatchedAccessorySkus(catalogCache, configAccessoryMatch.matched);

    if (erpAccessoryMissing.length > 0) {
      rows.push({
        ...base,
        status: 'preview_blocked',
        blockedReason: erpAccessoryMissing.join('、'),
      });
      emitRowProgress(index);
      continue;
    }

    rows.push({
      ...base,
      matchedAccessorySkus,
      matchedAccessoryCodes: matchedAccessorySkus.map((item) => item.skuOuterId),
      status: 'pending',
      blockedReason:
        stickerExists && !bundleExists
          ? `贴纸货号 ${stickerOuterId} 已存在，执行时将复用`
          : undefined,
    });
    emitRowProgress(index);
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
