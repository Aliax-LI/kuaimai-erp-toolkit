import type { ErpWebClient, ErpWebConfig } from '../../core/erp-web-client';
import { createErpWebClient } from '../../core/erp-web-client';

import { resolveErpCategoryId } from './erp-category';
import {
  bridgeEntryFromItemDetail,
  buildErpAddPureSuiteBody,
  buildErpAddStickerBody,
  extractSavedItemIds,
  type PureSuiteAddPayload,
  type StickerAddPayload,
  type SuiteBridgeEntry,
} from './erp-item-payload';
import { BUNDLE_CATEGORY_NAME, ERP_ITEM_TYPE_SUITE, STICKER_CATEGORY_NAME, STICKER_UNIT_NAME } from './constants';

export interface ErpCatalogItem {
  outerId: string;
  title: string;
  sysItemId?: number;
  type?: string;
  skus?: Array<{
    skuOuterId?: string;
    sysSkuId?: number;
    title?: string;
  }>;
}

/** 按主货号或 SKU 子货号匹配（与 buildBridgeEntryForOuterId 一致） */
export function findCatalogItemByOuterId(
  items: ErpCatalogItem[],
  outerId: string,
): ErpCatalogItem | undefined {
  const normalized = outerId.trim();
  if (!normalized) {
    return undefined;
  }

  const exact = items.find((item) => item.outerId === normalized);
  if (exact) {
    return exact;
  }

  return items.find((item) => item.skus?.some((sku) => sku.skuOuterId === normalized));
}

export interface ErpCatalogClient {
  listAllOuterIds(): Promise<string[]>;
  listOuterIdsByPrefix(prefix: string, maxPages?: number): Promise<string[]>;
  listCatalogItems(): Promise<ErpCatalogItem[]>;
  getItemsByOuterIds(outerIds: string[]): Promise<ErpCatalogItem[]>;
  findItemsByTitleKeyword(keyword: string, limit?: number): Promise<ErpCatalogItem[]>;
  matchAccessoriesForImport(
    brand: string,
    productName: string,
    accessoryNames: string[],
  ): Promise<{ matched: string[]; missing: string[] }>;
  getItemDetailRecord(sysItemId: number): Promise<Record<string, unknown>>;
  buildBridgeEntryForOuterId(outerId: string): Promise<SuiteBridgeEntry | null>;
  updateItemPicPath(sysItemId: number, picPath: string): Promise<void>;
  createSticker(payload: Omit<StickerAddPayload, 'sellerCids'> & { itemCatName?: string }): Promise<number>;
  createPureSuite(payload: Omit<PureSuiteAddPayload, 'sellerCids'> & { itemCatName?: string }): Promise<number>;
}

const OUTER_ID_LOOKUP_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function mapSkuRecord(sku: Record<string, unknown>) {
  const skuOuterId = String(sku.outerId ?? sku.skuOuterId ?? '').trim();
  if (!skuOuterId) {
    return null;
  }
  return {
    skuOuterId,
    sysSkuId: typeof sku.sysSkuId === 'number' ? sku.sysSkuId : undefined,
    title: typeof sku.propertiesName === 'string' ? sku.propertiesName : undefined,
  };
}

function normalizeListItem(item: Record<string, unknown>): ErpCatalogItem | null {
  const outerId = String(item.outerId ?? item.skuOuterId ?? '').trim();
  const title = String(item.title ?? '').trim();
  const sysItemId = typeof item.sysItemId === 'number' ? item.sysItemId : undefined;
  const sysSkuId = typeof item.sysSkuId === 'number' ? item.sysSkuId : undefined;

  const nestedSkus = item.skus ?? item.skuERP ?? item.skuList;
  let skus: ErpCatalogItem['skus'];
  if (Array.isArray(nestedSkus) && nestedSkus.length > 0) {
    skus = nestedSkus
      .filter((sku): sku is Record<string, unknown> => Boolean(sku) && typeof sku === 'object')
      .map((sku) => mapSkuRecord(sku))
      .filter((sku): sku is NonNullable<typeof sku> => sku !== null);
  } else if (sysSkuId || outerId) {
    skus = [
      {
        skuOuterId: String(item.skuOuterId ?? outerId),
        sysSkuId,
        title: typeof item.propertiesName === 'string' ? item.propertiesName : undefined,
      },
    ];
  }

  if (!outerId && !title) {
    return null;
  }

  return {
    outerId,
    title,
    sysItemId,
    type: typeof item.type === 'string' ? item.type : undefined,
    skus: skus && skus.length > 0 ? skus : undefined,
  };
}

/** @internal 仅供单测 */
export function normalizeListItemForTest(item: Record<string, unknown>): ErpCatalogItem | null {
  return normalizeListItem(item);
}

function normalizeListItems(raw: unknown): ErpCatalogItem[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const body = raw as Record<string, unknown>;
  const list = Array.isArray(body.list)
    ? body.list
    : Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.rows)
        ? body.rows
        : [];
  return list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => normalizeListItem(item))
    .filter((item): item is ErpCatalogItem => item !== null);
}

function mergeCatalogItemSkus(
  target: ErpCatalogItem,
  source: ErpCatalogItem,
): void {
  const skuByOuterId = new Map<string, NonNullable<ErpCatalogItem['skus']>[number]>();
  for (const sku of target.skus ?? []) {
    if (sku.skuOuterId) {
      skuByOuterId.set(sku.skuOuterId, sku);
    }
  }
  for (const sku of source.skus ?? []) {
    if (!sku.skuOuterId || skuByOuterId.has(sku.skuOuterId)) {
      continue;
    }
    skuByOuterId.set(sku.skuOuterId, sku);
  }
  const skus = [...skuByOuterId.values()];
  target.skus = skus.length > 0 ? skus : target.skus;
}

function extractQuerySingleList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const body = raw as Record<string, unknown>;
  if (Array.isArray(body.list)) {
    return body.list;
  }
  if (body.data && typeof body.data === 'object') {
    const data = body.data as Record<string, unknown>;
    if (Array.isArray(data.list)) {
      return data.list;
    }
    if (Array.isArray(data.rows)) {
      return data.rows;
    }
  }
  return [];
}

async function resolveSellerCidsForCategory(
  client: ErpWebClient,
  cache: Map<string, string>,
  categoryName: string,
): Promise<string> {
  const normalized = categoryName.trim();
  if (!normalized) {
    throw new Error('分类名称为空');
  }
  if (cache.has(normalized)) {
    return cache.get(normalized)!;
  }

  const id = await resolveErpCategoryId(client, normalized);
  cache.set(normalized, id);
  return id;
}

function normalizeDetailItems(raw: unknown): ErpCatalogItem[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const body = raw as Record<string, unknown>;
  const skuList = Array.isArray(body.skuList) ? body.skuList : [];
  const outerId = String(body.outerId ?? '').trim();
  const title = String(body.title ?? '').trim();
  const sysItemId = typeof body.sysItemId === 'number' ? body.sysItemId : undefined;

  if (!outerId && !title && !sysItemId) {
    return [];
  }

  return [
    {
      outerId,
      title,
      sysItemId,
      type: typeof body.type === 'string' ? String(body.type) : undefined,
      skus: skuList
        .filter((sku): sku is Record<string, unknown> => Boolean(sku) && typeof sku === 'object')
        .map((sku) => ({
          skuOuterId: typeof sku.outerId === 'string' ? sku.outerId : undefined,
          sysSkuId: typeof sku.sysSkuId === 'number' ? sku.sysSkuId : undefined,
          title: typeof sku.propertiesName === 'string' ? sku.propertiesName : undefined,
        })),
    },
  ];
}

export function createErpCatalogClient(config: ErpWebConfig): ErpCatalogClient {
  const client: ErpWebClient = createErpWebClient(config);
  const categoryIdCache = new Map<string, string>();

  async function querySingleByTitle(text: string, limit = 50): Promise<ErpCatalogItem[]> {
    const normalized = text.trim();
    if (!normalized) {
      return [];
    }

    const response = await client.querySingle({
      text: normalized,
      filterSysItemId: '',
      content: 'title',
      isAccurate: 0,
      flag: 0,
      order: 'desc',
      purchasePriceScope: 0,
      onSale: '',
      pageSize: limit,
      pageNo: 1,
      api_name: 'item_querySingle',
    });

    return extractQuerySingleList(response)
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => normalizeListItem(item))
      .filter((item): item is ErpCatalogItem => item !== null);
  }

  async function querySingleByOuterId(text: string): Promise<ErpCatalogItem[]> {
    const normalized = text.trim();
    if (!normalized) {
      return [];
    }

    const response = await client.querySingle({
      text: normalized,
      filterSysItemId: '',
      content: 'outerId',
      isAccurate: 0,
      flag: 0,
      order: 'desc',
      purchasePriceScope: 0,
      onSale: '',
      pageSize: 50,
      pageNo: 1,
      api_name: 'item_querySingle',
    });

    return extractQuerySingleList(response)
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => normalizeListItem(item))
      .filter((item): item is ErpCatalogItem => item !== null);
  }

  async function queryCatalogPage(pageNo: number, pageSize: number, filters: Record<string, string> = {}) {
    return client.queryListV2({
      pageNo,
      pageSize,
      orderDesc: true,
      ...filters,
    });
  }

  return {
    async listCatalogItems(): Promise<ErpCatalogItem[]> {
      const items: ErpCatalogItem[] = [];
      let pageNo = 1;
      const pageSize = 200;

      while (true) {
        const response = await queryCatalogPage(pageNo, pageSize);
        const pageItems = normalizeListItems(response);
        if (pageItems.length === 0) {
          break;
        }
        items.push(...pageItems);

        if (pageItems.length < pageSize) {
          break;
        }
        pageNo += 1;
      }

      return items;
    },

    async listOuterIdsByPrefix(prefix: string, maxPages = 10): Promise<string[]> {
      const normalizedPrefix = prefix.trim();
      if (!normalizedPrefix) {
        return [];
      }

      const outerIds = new Set<string>();
      const pageSize = 200;

      for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
        const response = await queryCatalogPage(pageNo, pageSize);
        const pageItems = normalizeListItems(response);
        if (pageItems.length === 0) {
          break;
        }

        for (const item of pageItems) {
          if (item.outerId?.startsWith(normalizedPrefix)) {
            outerIds.add(item.outerId);
          }
          for (const sku of item.skus ?? []) {
            if (sku.skuOuterId?.startsWith(normalizedPrefix)) {
              outerIds.add(sku.skuOuterId);
            }
          }
        }

        if (pageItems.length < pageSize) {
          break;
        }
      }

      return [...outerIds];
    },

    async listAllOuterIds(): Promise<string[]> {
      const outerIds = new Set<string>();
      for (const item of await this.listCatalogItems()) {
        if (item.outerId) {
          outerIds.add(item.outerId);
        }
        for (const sku of item.skus ?? []) {
          if (sku.skuOuterId) {
            outerIds.add(sku.skuOuterId);
          }
        }
      }
      return [...outerIds];
    },

    async getItemsByOuterIds(outerIds: string[]): Promise<ErpCatalogItem[]> {
      const unique = [...new Set(outerIds.map((item) => item.trim()).filter(Boolean))];
      if (unique.length === 0) {
        return [];
      }

      const items: ErpCatalogItem[] = [];
      const seen = new Set<string>();

      const lookupResults = await mapWithConcurrency(unique, OUTER_ID_LOOKUP_CONCURRENCY, async (outerId) => {
        const responses = await Promise.all(
          (['outerId', 'skuOuterId'] as const).map((field) =>
            queryCatalogPage(1, 5, { [field]: outerId }),
          ),
        );
        const listHits = responses.flatMap((response) => normalizeListItems(response));

        if (findCatalogItemByOuterId(listHits, outerId)) {
          return listHits;
        }

        const singleHits = await querySingleByOuterId(outerId);
        return [...listHits, ...singleHits];
      });

      for (const hits of lookupResults) {
        for (const item of hits) {
          const key = item.outerId || String(item.sysItemId ?? '');
          if (!key || seen.has(key)) {
            const existing = items.find((candidate) => {
              const existingKey = candidate.outerId || String(candidate.sysItemId ?? '');
              return existingKey === key;
            });
            if (existing) {
              mergeCatalogItemSkus(existing, item);
            }
            continue;
          }
          seen.add(key);
          items.push(item);
        }
      }
      return items;
    },

    async findItemsByTitleKeyword(keyword: string, limit = 20): Promise<ErpCatalogItem[]> {
      const normalized = keyword.trim();
      if (!normalized) {
        return [];
      }

      const fromQuerySingle = await querySingleByTitle(normalized, Math.max(limit, 50));
      if (fromQuerySingle.length > 0) {
        return fromQuerySingle
          .filter((item) => item.title.includes(normalized))
          .slice(0, limit);
      }

      const response = await queryCatalogPage(1, Math.max(limit, 20), { title: normalized });
      return normalizeListItems(response)
        .filter((item) => item.title.includes(normalized))
        .slice(0, limit);
    },

    async matchAccessoriesForImport(
      brand: string,
      productName: string,
      accessoryNames: string[],
    ): Promise<{ matched: string[]; missing: string[] }> {
      const matched: string[] = [];
      const missing: string[] = [];

      for (const name of accessoryNames) {
        const candidates = await querySingleByTitle(name, 50);
        const scored = candidates
          .map((item) => {
            let score = 0;
            if (item.title.includes(name)) {
              score += 1;
            }
            if (brand && item.title.includes(brand)) {
              score += 3;
            }
            if (productName && item.title.includes(productName)) {
              score += 2;
            }
            return { item, score };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        const hit = scored[0]?.item;
        if (hit?.outerId && hit.type !== '2' && hit.type !== String(ERP_ITEM_TYPE_SUITE)) {
          if (!matched.includes(hit.outerId)) {
            matched.push(hit.outerId);
          }
          continue;
        }
        if (hit?.outerId && (hit.type === '2' || hit.type === String(ERP_ITEM_TYPE_SUITE))) {
          missing.push(`${name}（匹配到套件 ${hit.outerId}，需单品 type=0）`);
          continue;
        }
        missing.push(name);
      }

      return { matched, missing };
    },

    async getItemDetailRecord(sysItemId: number): Promise<Record<string, unknown>> {
      const raw = await client.getItemDetail(sysItemId);
      if (!raw || typeof raw !== 'object') {
        return {};
      }
      return raw as Record<string, unknown>;
    },

    async buildBridgeEntryForOuterId(outerId: string): Promise<SuiteBridgeEntry | null> {
      const items = await this.getItemsByOuterIds([outerId]);
      const hit = findCatalogItemByOuterId(items, outerId);
      if (!hit?.sysItemId) {
        return null;
      }
      const detail = await this.getItemDetailRecord(hit.sysItemId);
      const preferredSkuOuterId = hit.skus?.find((sku) => sku.skuOuterId === outerId)?.skuOuterId
        ?? hit.skus?.[0]?.skuOuterId;
      return bridgeEntryFromItemDetail(detail, preferredSkuOuterId);
    },

    async updateItemPicPath(sysItemId: number, picPath: string): Promise<void> {
      const normalized = picPath.trim();
      if (!normalized) {
        return;
      }
      await client.saveItem({
        sysItemId,
        id: sysItemId,
        picPath: normalized,
        bigPic: normalized,
      });
    },

    async createSticker(
      payload: Omit<StickerAddPayload, 'sellerCids'> & { itemCatName?: string },
    ): Promise<number> {
      const categoryName = payload.itemCatName?.trim() || STICKER_CATEGORY_NAME;
      const sellerCids = await resolveSellerCidsForCategory(client, categoryIdCache, categoryName);
      const body = buildErpAddStickerBody({
        outerId: payload.outerId,
        title: payload.title,
        brand: payload.brand,
        sellerCids,
        component: payload.component,
        standard: payload.standard,
        picPath: payload.picPath,
        unit: payload.unit ?? STICKER_UNIT_NAME,
      });
      const response = await client.addItem(body);
      const { sysItemId } = extractSavedItemIds(response);
      if (!sysItemId) {
        throw new Error(`贴纸创建成功但未返回 sysItemId: ${payload.outerId}`);
      }
      return sysItemId;
    },

    async createPureSuite(
      payload: Omit<PureSuiteAddPayload, 'sellerCids'> & { itemCatName?: string },
    ): Promise<number> {
      const categoryName = payload.itemCatName?.trim() || BUNDLE_CATEGORY_NAME;
      const sellerCids = await resolveSellerCidsForCategory(client, categoryIdCache, categoryName);
      const { itemCatName: _ignored, ...rest } = payload;
      const body = buildErpAddPureSuiteBody({
        ...rest,
        sellerCids,
      });
      const response = await client.addPureSuite(body);
      const { sysItemId } = extractSavedItemIds(response);
      if (!sysItemId) {
        throw new Error(`套装创建成功但未返回 sysItemId: ${payload.outerId}`);
      }
      return sysItemId;
    },
  };
}
