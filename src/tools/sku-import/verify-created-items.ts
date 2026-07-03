import type { SkuImportPreviewRow } from '@shared/types/sku-import';

import {
  ERP_ITEM_TYPE_NORMAL,
  ERP_ITEM_TYPE_SUITE,
} from './constants';
import type { ErpCatalogClient } from './erp-catalog';
import { findCatalogItemByOuterId } from './erp-catalog';
import { resolveErpCategoryId } from './erp-category';
import { extractBridgeItemIds } from './erp-item-payload';
import type { ErpWebClient } from '../../core/erp-web-client';

export interface VerifyStep {
  label: string;
  ok: boolean;
  detail: string;
}

export function verifySuiteBridgeStructure(options: {
  productOriginalItemId?: number;
  expectedAccessoryItemIds: number[];
  stickerItemId: number;
  bridgeList: Array<Record<string, unknown>>;
}): { ok: boolean; message: string } {
  const bridgeItemIds = new Set<number>();
  for (const item of options.bridgeList) {
    const { sysItemId } = extractBridgeItemIds(item);
    if (sysItemId) {
      bridgeItemIds.add(sysItemId);
    }
  }

  if (options.productOriginalItemId && !bridgeItemIds.has(options.productOriginalItemId)) {
    return {
      ok: false,
      message: `套装 bridge 缺少产品原品 subItemId=${options.productOriginalItemId}`,
    };
  }

  if (!bridgeItemIds.has(options.stickerItemId)) {
    return {
      ok: false,
      message: `套装 bridge 缺少贴纸 subItemId=${options.stickerItemId}`,
    };
  }

  const missingAccessories = options.expectedAccessoryItemIds.filter((id) => !bridgeItemIds.has(id));
  if (missingAccessories.length > 0) {
    return {
      ok: false,
      message: `套装 bridge 缺少配件 subItemId: ${missingAccessories.join('、')}`,
    };
  }

  const expectedCount =
    1 + options.expectedAccessoryItemIds.length + (options.productOriginalItemId ? 1 : 0);
  if (bridgeItemIds.size < expectedCount) {
    return {
      ok: false,
      message: `套装 bridge 项数不足：期望 ${expectedCount}，实际 ${bridgeItemIds.size}`,
    };
  }

  return {
    ok: true,
    message: options.productOriginalItemId
      ? `bridge 含产品原品 + 贴纸 + ${options.expectedAccessoryItemIds.length} 个配件`
      : `bridge 含贴纸 + ${options.expectedAccessoryItemIds.length} 个配件`,
  };
}

function extractBridgeList(detail: Record<string, unknown>): Array<Record<string, unknown>> {
  const candidates = [
    detail.itemSuiteBridgeList,
    detail.suiteBridgeList,
    detail.simpleSuiteBridgeModels,
    detail.suiteBridgeModels,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
      );
    }
  }
  return [];
}

function extractCategoryNames(detail: Record<string, unknown>): string[] {
  const names: string[] = [];
  const direct = detail.itemCategoryNames ?? detail.categoryNames ?? detail.sellerCatNames;
  if (Array.isArray(direct)) {
    for (const item of direct) {
      if (typeof item === 'string' && item.trim()) {
        names.push(item.trim());
      }
    }
  }
  const sellerCats = detail.sellerCats ?? detail.itemCategoryList;
  if (Array.isArray(sellerCats)) {
    for (const item of sellerCats) {
      if (item && typeof item === 'object') {
        const name = String((item as Record<string, unknown>).name ?? '').trim();
        if (name) {
          names.push(name);
        }
      }
    }
  }
  return [...new Set(names)];
}

function extractSellerCids(detail: Record<string, unknown>): string[] {
  const raw = detail.sellerCids ?? detail.sellerCatCids;
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function flagIsOn(value: unknown): boolean {
  return value === 1 || value === '1' || value === true;
}

async function verifyItemCategory(
  client: ErpWebClient,
  label: string,
  detail: Record<string, unknown> | undefined,
  expectedName: string,
): Promise<VerifyStep> {
  if (!detail) {
    return { label, ok: false, detail: '无法获取详情' };
  }

  const expectedCid = await resolveErpCategoryId(client, expectedName);
  const sellerCids = extractSellerCids(detail);
  if (sellerCids.includes(expectedCid)) {
    return { label, ok: true, detail: `${expectedName} (cid=${expectedCid})` };
  }

  const names = extractCategoryNames(detail);
  if (names.length === 0) {
    return {
      label,
      ok: false,
      detail: `sellerCids=${sellerCids.join('、') || '(空)'}，期望「${expectedName}」(cid=${expectedCid})`,
    };
  }
  const hit = names.some((name) => name === expectedName || name.includes(expectedName));
  return {
    label,
    ok: hit,
    detail: hit ? names.join('、') : `${names.join('、')}（期望「${expectedName}」）`,
  };
}

function typeLabel(type: string | undefined, expected: number): string {
  const normalized = type === String(expected) ? String(expected) : type;
  return normalized ?? '(未知)';
}

export async function verifyCreatedSkuImportRow(
  catalog: ErpCatalogClient,
  client: ErpWebClient,
  previewRow: SkuImportPreviewRow,
): Promise<{ ok: boolean; steps: VerifyStep[] }> {
  const steps: VerifyStep[] = [];
  const bundleOuterId = previewRow.proposedSkuCode;
  const stickerOuterId = previewRow.stickerOuterId;
  const accessoryOuterIds = previewRow.matchedAccessoryCodes;
  const productOriginalOuterId = previewRow.productOriginalOuterId;

  const lookupIds = [stickerOuterId, bundleOuterId, productOriginalOuterId, ...accessoryOuterIds];
  const items = await catalog.getItemsByOuterIds(lookupIds);

  const sticker = findCatalogItemByOuterId(items, stickerOuterId);
  if (!sticker?.sysItemId) {
    steps.push({ label: '贴纸存在', ok: false, detail: `未找到 outerId=${stickerOuterId}` });
  } else if (sticker.type !== String(ERP_ITEM_TYPE_NORMAL) && sticker.type !== '0') {
    steps.push({
      label: '贴纸存在',
      ok: false,
      detail: `type=${typeLabel(sticker.type, ERP_ITEM_TYPE_NORMAL)}，期望 ${ERP_ITEM_TYPE_NORMAL}`,
    });
  } else {
    steps.push({
      label: '贴纸存在',
      ok: true,
      detail: `${stickerOuterId} (sysItemId=${sticker.sysItemId})`,
    });
    const stickerDetailRaw = await client.getItemDetail(sticker.sysItemId);
    const stickerDetail =
      stickerDetailRaw && typeof stickerDetailRaw === 'object'
        ? (stickerDetailRaw as Record<string, unknown>)
        : undefined;
    const unit = String(stickerDetail?.unit ?? '').trim();
    steps.push({
      label: '贴纸单位',
      ok: unit === previewRow.stickerUnit,
      detail: unit ? unit : '(空)',
    });
    steps.push(
      await verifyItemCategory(client, '贴纸分类', stickerDetail, previewRow.stickerCategory),
    );
  }

  const bundle = findCatalogItemByOuterId(items, bundleOuterId);
  if (!bundle?.sysItemId) {
    steps.push({ label: '套装存在', ok: false, detail: `未找到 outerId=${bundleOuterId}` });
  } else if (bundle.type !== String(ERP_ITEM_TYPE_SUITE) && bundle.type !== '2') {
    steps.push({
      label: '套装存在',
      ok: false,
      detail: `type=${typeLabel(bundle.type, ERP_ITEM_TYPE_SUITE)}，期望 ${ERP_ITEM_TYPE_SUITE}`,
    });
  } else {
    steps.push({
      label: '套装存在',
      ok: true,
      detail: `${bundleOuterId} (sysItemId=${bundle.sysItemId})`,
    });
  }

  const productOriginal = findCatalogItemByOuterId(items, productOriginalOuterId);
  const productOriginalItemId = productOriginal?.sysItemId;
  if (!productOriginalItemId) {
    steps.push({
      label: '产品原品',
      ok: false,
      detail: `未找到 outerId=${productOriginalOuterId}`,
    });
  } else {
    steps.push({
      label: '产品原品',
      ok: true,
      detail: `${productOriginalOuterId} (sysItemId=${productOriginalItemId})`,
    });
  }

  const accessoryItemIds: number[] = [];
  for (const outerId of accessoryOuterIds) {
    const item = findCatalogItemByOuterId(items, outerId);
    if (!item?.sysItemId) {
      steps.push({ label: `配件 ${outerId}`, ok: false, detail: '未找到或缺少 sysItemId' });
      continue;
    }
    accessoryItemIds.push(item.sysItemId);
    steps.push({ label: `配件 ${outerId}`, ok: true, detail: `sysItemId=${item.sysItemId}` });
  }

  const stickerItemId = sticker?.sysItemId;
  if (!bundle?.sysItemId || !stickerItemId) {
    steps.push({
      label: '套装结构',
      ok: false,
      detail: '缺少套装或贴纸 sysItemId，无法校验 bridge',
    });
    return { ok: steps.every((step) => step.ok), steps };
  }

  const detailRaw = await client.getItemDetail(bundle.sysItemId);
  const detail =
    detailRaw && typeof detailRaw === 'object' ? (detailRaw as Record<string, unknown>) : {};
  const bridgeList = extractBridgeList(detail);
  const structure = verifySuiteBridgeStructure({
    productOriginalItemId,
    expectedAccessoryItemIds: accessoryItemIds,
    stickerItemId,
    bridgeList,
  });

  steps.push({
    label: '套装结构',
    ok: structure.ok,
    detail: structure.ok
      ? structure.message
      : `${structure.message}；实际 bridge subItemId: ${JSON.stringify(
          bridgeList.map((b) => extractBridgeItemIds(b).sysItemId),
        )}`,
  });

  const weightAuto = flagIsOn(detail.isSysWeight);
  const costAuto = flagIsOn(detail.isSysPriceImport);
  steps.push({
    label: '套装自动计算',
    ok: weightAuto && costAuto,
    detail: `isSysWeight=${detail.isSysWeight ?? '(空)'} isSysPriceImport=${detail.isSysPriceImport ?? '(空)'}`,
  });

  steps.push(await verifyItemCategory(client, '套装分类', detail, previewRow.bundleCategory));

  return { ok: steps.every((step) => step.ok), steps };
}
