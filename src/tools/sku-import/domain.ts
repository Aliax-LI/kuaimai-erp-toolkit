import { SKU_CODE_PREFIX, SKU_CODE_TEST_PREFIX } from './constants';

const ACCESSORY_SPLIT_RE = /[\s,，、;；]+/;

export function parseAccessoryNames(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return [...new Set(raw.split(ACCESSORY_SPLIT_RE).map((part) => part.trim()).filter(Boolean))];
}

export function buildBusinessKey(values: Record<string, string>): string {
  const productCode = values['产品原品编码']?.trim() ?? '';
  const stickerCode = values['贴纸编码']?.trim() ?? '';
  const displayName = values['名称']?.trim() ?? values['产品名']?.trim() ?? '';
  return [productCode, stickerCode, displayName].filter(Boolean).join('|');
}

export function deriveProductAbbreviation(productCode: string, productName: string): string {
  const codeMatch = /YP-([A-Z0-9]+)/i.exec(productCode);
  if (codeMatch?.[1]) {
    return codeMatch[1].replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
  }

  const compactName = productName.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').slice(0, 6);
  return compactName || 'ITEM';
}

export function buildStickerOuterId(bundleOuterId: string): string {
  return `${bundleOuterId}-ST`;
}

export function buildSkuCodePrefix(brand: string, productCode: string, productName: string): string {
  const brandCode = brand.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'BRAND';
  const abbr = deriveProductAbbreviation(productCode, productName);
  return `${SKU_CODE_TEST_PREFIX}-${SKU_CODE_PREFIX}-${brandCode}-${abbr}`;
}

export function allocateNextSkuCode(prefix: string, existingOuterIds: string[]): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sequencePattern = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');
  let maxSequence = 0;

  for (const outerId of existingOuterIds) {
    const match = sequencePattern.exec(outerId.trim());
    if (match?.[1]) {
      maxSequence = Math.max(maxSequence, Number.parseInt(match[1], 10));
    }
  }

  return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`;
}

export function buildStickerTitle(
  brand: string,
  productName: string,
  capacity: string,
): string {
  return `${brand}${productName}${capacity}贴纸`.replace(/\s+/g, '');
}

export function buildBundleTitle(
  brand: string,
  productName: string,
  accessories: string[],
): string {
  const parts = [`${brand}${productName}*1`, ...accessories.map((item) => `${item}*1`)];
  return parts.join('+');
}

/** 仅含回写列或空行的 Excel 行不应参与预演 */
export function isSkuImportDataRow(values: Record<string, string>): boolean {
  const normalized = normalizeImportRowValues(values);
  return Boolean(
    normalized.brand ||
      normalized.productCode ||
      normalized.productName ||
      normalized.stickerCode ||
      normalized.displayName,
  );
}

export function normalizeImportRowValues(values: Record<string, string>): {
  brand: string;
  productCode: string;
  productName: string;
  capacity: string;
  stickerCode: string;
  displayName: string;
  accessoriesRaw: string;
  component: string;
  standard: string;
  existingSkuCode: string;
} {
  return {
    brand: values['品牌']?.trim() ?? '',
    productCode: values['产品原品编码']?.trim() ?? '',
    productName: values['产品名']?.trim() ?? '',
    capacity: values['容量']?.trim() ?? '',
    stickerCode: values['贴纸编码']?.trim() ?? '',
    displayName: values['名称']?.trim() ?? '',
    accessoriesRaw: values['配件']?.trim() ?? '',
    component: values['成分']?.trim() ?? '',
    standard: values['执行标准']?.trim() ?? '',
    existingSkuCode: values['商品SKU货号']?.trim() ?? '',
  };
}

export function validateImportRow(values: Record<string, string>): string | undefined {
  const row = normalizeImportRowValues(values);
  if (!row.brand) return '缺少品牌';
  if (!row.productCode) return '缺少产品原品编码';
  if (!row.productName) return '缺少产品名';
  if (!row.capacity) return '缺少容量';
  if (!row.stickerCode) return '缺少贴纸编码';
  if (!row.displayName && !row.productName) return '缺少名称';
  return undefined;
}
