import {
  BUNDLE_CATEGORY_NAME,
  ERP_ITEM_TYPE_NORMAL,
  ERP_ITEM_TYPE_SUITE,
  STICKER_CATEGORY_NAME,
  STICKER_UNIT_NAME,
} from './constants';

export const ERP_EXTEND_FIELD_VALUES = JSON.stringify({
  marketPrice: '',
  otherPrice1: '',
  otherPrice2: '',
  otherPrice3: '',
  otherPrice4: '',
  otherPrice5: '',
});

export interface SuiteBridgeEntry {
  subItemId: number;
  outerId: string;
  title: string;
  picPath?: string;
  ratio?: number;
  subSkuId?: number | string;
  skuOuterId?: string;
}

export interface StickerAddPayload {
  outerId: string;
  title: string;
  brand?: string;
  sellerCids: string;
  component?: string;
  standard?: string;
  picPath?: string;
  unit?: string;
}

export interface PureSuiteAddPayload {
  outerId: string;
  title: string;
  brand?: string;
  sellerCids: string;
  component?: string;
  standard?: string;
  picPath?: string;
  itemSuiteBridgeList: SuiteBridgeEntry[];
}

/** @deprecated 仅保留兼容；建货号请用 buildErpAddStickerBody / buildErpAddPureSuiteBody */
export interface SkuImportItemPayload {
  itemRequestType?: number;
  outerId?: string;
  title?: string;
  brand?: string;
  itemCatName?: string;
  sellerCids?: string;
  component?: string;
  standard?: string;
  picPath?: string;
  skus?: Array<{
    outerId?: string;
    propertiesName?: string;
    picPath?: string;
  }>;
  simpleSuiteBridgeModels?: Array<{
    sysItemId?: number;
    sysSkuId?: number;
    ratio?: number;
  }>;
}

function zeroSysPriceFlags(): Record<string, number> {
  return {
    isSysWeight: 0,
    isSysPriceImport: 0,
    isSysPriceOutput: 0,
    isSysWholesalePrice: 0,
    isSysVolume: 1,
    isSysMarketPrice: 0,
    isSysOtherPrice1: 0,
    isSysOtherPrice2: 0,
    isSysOtherPrice3: 0,
    isSysOtherPrice4: 0,
    isSysOtherPrice5: 0,
  };
}

function suiteSysPriceFlags(): Record<string, number> {
  return {
    isSysWeight: 1,
    isSysPriceImport: 1,
    isSysPriceOutput: 0,
    isSysWholesalePrice: 1,
    isSysVolume: 1,
    isSysMarketPrice: 0,
    isSysOtherPrice1: 1,
    isSysOtherPrice2: 0,
    isSysOtherPrice3: 0,
    isSysOtherPrice4: 0,
    isSysOtherPrice5: 0,
  };
}

export function buildSuiteBridgeListItem(entry: SuiteBridgeEntry): Record<string, unknown> {
  return {
    id: '',
    title: entry.title,
    outerId: entry.outerId,
    skuOuterId: entry.skuOuterId ?? '',
    priceImport: 0,
    priceOutput: 0,
    ratio: entry.ratio ?? 1,
    subItemId: entry.subItemId,
    subSkuId: entry.subSkuId ?? '',
    weight: 0,
    wholesalePrice: '',
    picPath: entry.picPath ?? '/resources/css/build/images/no_pic.png',
    volume: 0,
  };
}

export function buildErpAddStickerBody(payload: StickerAddPayload): Record<string, unknown> {
  return {
    type: '0',
    typeTag: '0',
    catName: '',
    sellerCids: payload.sellerCids,
    barcode: '',
    outerId: payload.outerId,
    shortTitle: '',
    title: payload.title,
    isVirtual: '0',
    shipper: '',
    brand: payload.brand ?? '',
    brandId: '',
    weight: 0,
    purchasePrice: '',
    sellingPrice: 0,
    makeGift: false,
    unit: payload.unit ?? STICKER_UNIT_NAME,
    wholesalePrice: 0,
    periodCast: '',
    place: '',
    component: payload.component ?? '',
    standard: payload.standard ?? '',
    record: '',
    safekind: '',
    invoice: '',
    boxnum: 0,
    x: '',
    y: '',
    z: '',
    volume: 0,
    remark: '',
    bigPic: payload.picPath ?? '',
    picPath: payload.picPath ?? '',
    ...zeroSysPriceFlags(),
    washLabelJson: '',
    itemSuiteBridgeList: [],
    definedJson: [],
    declareAmount: '',
    declareNameEn: '',
    declareNameZh: '',
    declareWeight: '',
    hsCode: '',
    assistUnitList: [],
    washLabelTemplateId: '',
    basePrice: '',
    skulist: [],
    extendFieldValues: ERP_EXTEND_FIELD_VALUES,
    api_name: 'item_add',
  };
}

export function buildErpAddPureSuiteBody(payload: PureSuiteAddPayload): Record<string, unknown> {
  return {
    type: '2',
    typeTag: '0',
    catName: '',
    sellerCids: payload.sellerCids,
    barcode: '',
    outerId: payload.outerId,
    shortTitle: '',
    title: payload.title,
    isVirtual: '0',
    shipper: '',
    brand: payload.brand ?? '',
    brandId: '',
    weight: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    makeGift: false,
    unit: '',
    wholesalePrice: 0,
    periodCast: '',
    place: '',
    component: payload.component ?? '',
    standard: payload.standard ?? '',
    record: '',
    safekind: '',
    invoice: '',
    boxnum: 0,
    x: '',
    y: '',
    z: '',
    volume: 0,
    remark: '',
    bigPic: '',
    picPath: payload.picPath ?? '',
    ...suiteSysPriceFlags(),
    washLabelJson: '',
    itemSuiteBridgeList: payload.itemSuiteBridgeList.map(buildSuiteBridgeListItem),
    definedJson: [],
    declareAmount: '',
    declareNameEn: '',
    declareNameZh: '',
    declareWeight: '',
    hsCode: '',
    assistUnitList: [],
    skus: [],
    washLabelTemplateId: '',
    basePrice: '',
    extendFieldValues: ERP_EXTEND_FIELD_VALUES,
    api_name: 'item_addPureSuite',
  };
}

export function bridgeEntryFromItemDetail(
  detail: Record<string, unknown>,
  preferredSkuOuterId?: string,
): SuiteBridgeEntry | null {
  const subItemId = typeof detail.sysItemId === 'number' ? detail.sysItemId : undefined;
  const itemOuterId = String(detail.outerId ?? '').trim();
  const title = String(detail.title ?? '').trim();
  if (!subItemId || !itemOuterId) {
    return null;
  }

  const skuList = Array.isArray(detail.skuList)
    ? detail.skuList.filter(
        (sku): sku is Record<string, unknown> => Boolean(sku) && typeof sku === 'object',
      )
    : [];

  const pickSku = (): Record<string, unknown> | undefined => {
    if (preferredSkuOuterId) {
      const matched = skuList.find((sku) => String(sku.outerId ?? '') === preferredSkuOuterId);
      if (matched) {
        return matched;
      }
    }
    return skuList[0];
  };

  if (skuList.length > 0) {
    const sku = pickSku();
    if (!sku) {
      return null;
    }
    const skuOuterId = String(sku.outerId ?? itemOuterId).trim();
    const subSkuId = typeof sku.sysSkuId === 'number' ? sku.sysSkuId : '';
    return {
      subItemId,
      outerId: skuOuterId,
      title,
      picPath: typeof sku.picPath === 'string' ? sku.picPath : typeof detail.picPath === 'string' ? detail.picPath : undefined,
      subSkuId,
      skuOuterId,
      ratio: 1,
    };
  }

  return {
    subItemId,
    outerId: itemOuterId,
    title,
    picPath: typeof detail.picPath === 'string' ? detail.picPath : undefined,
    subSkuId: '',
    skuOuterId: '',
    ratio: 1,
  };
}

function defaultSkuList(
  outerId: string,
  picPath: string | undefined,
  skus: SkuImportItemPayload['skus'],
): Array<Record<string, unknown>> {
  const source = skus?.length
    ? skus
    : [{ outerId, propertiesName: '默认', picPath }];
  return source.map((sku) => ({
    outerId: sku.outerId ?? outerId,
    propertiesName: sku.propertiesName ?? '默认',
    picPath: sku.picPath ?? picPath,
    activeStatus: 1,
  }));
}

/** @deprecated 建货号已改用 add / addPureSuite */
export function buildErpSaveItemBody(payload: SkuImportItemPayload): Record<string, unknown> {
  const outerId = payload.outerId?.trim() ?? '';
  const itemType = payload.itemRequestType ?? ERP_ITEM_TYPE_NORMAL;
  const isSuite = itemType === ERP_ITEM_TYPE_SUITE;

  const body: Record<string, unknown> = {
    type: isSuite ? ERP_ITEM_TYPE_SUITE : ERP_ITEM_TYPE_NORMAL,
    outerId,
    title: payload.title,
    brand: payload.brand,
    component: payload.component,
    standard: payload.standard,
    picPath: payload.picPath,
    activeStatus: 1,
    isSkuItem: 0,
  };

  if (payload.skus?.length) {
    body.skuList = defaultSkuList(outerId, payload.picPath, payload.skus);
  }

  if (payload.sellerCids?.trim()) {
    body.sellerCids = payload.sellerCids.trim();
  }

  if (payload.itemCatName === STICKER_CATEGORY_NAME) {
    body.remark = STICKER_CATEGORY_NAME;
  }

  if (isSuite && payload.simpleSuiteBridgeModels?.length) {
    body.suiteBridgeList = payload.simpleSuiteBridgeModels
      .filter((item) => item.sysItemId != null && item.sysSkuId != null)
      .map((item) => ({
        sysItemId: item.sysItemId,
        sysSkuId: item.sysSkuId,
        ratio: item.ratio ?? 1,
      }));
  }

  return body;
}

function pickFirstRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : undefined;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('sysItemId' in record || 'outerId' in record || 'id' in record) {
      return record;
    }
    const first = record['0'];
    if (first && typeof first === 'object') {
      return first as Record<string, unknown>;
    }
  }
  return undefined;
}

export function extractSavedItemIds(response: Record<string, unknown> | unknown): {
  sysItemId?: number;
  sysSkuId?: number;
} {
  const record = pickFirstRecord(response);
  if (!record) {
    return {};
  }

  const sysItemId =
    typeof record.sysItemId === 'number'
      ? record.sysItemId
      : typeof record.id === 'number'
        ? record.id
        : undefined;

  const skuList = Array.isArray(record.skuList)
    ? record.skuList
    : Array.isArray(record.skus)
      ? record.skus
      : Array.isArray(record.skulist)
        ? record.skulist
        : [];
  const firstSku = skuList[0] as Record<string, unknown> | undefined;
  const listedSkuId = typeof firstSku?.sysSkuId === 'number' ? firstSku.sysSkuId : undefined;
  const sysSkuId = listedSkuId != null && listedSkuId !== 0 ? listedSkuId : sysItemId;

  return { sysItemId, sysSkuId };
}

export function extractBridgeItemIds(
  bridge: Record<string, unknown>,
): { sysItemId?: number; sysSkuId?: number } {
  const sysItemId =
    typeof bridge.subItemId === 'number'
      ? bridge.subItemId
      : typeof bridge.sysItemId === 'number'
        ? bridge.sysItemId
        : undefined;
  const sysSkuId =
    typeof bridge.subSkuId === 'number' && bridge.subSkuId !== 0
      ? bridge.subSkuId
      : typeof bridge.sysSkuId === 'number' && bridge.sysSkuId !== 0
        ? bridge.sysSkuId
        : sysItemId;
  return { sysItemId, sysSkuId };
}

/** 分类名仅用于 deprecated saveItem 路径 */
export { BUNDLE_CATEGORY_NAME, STICKER_CATEGORY_NAME };
