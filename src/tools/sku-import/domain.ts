import type { SkuImportRules } from '@shared/schemas/sku-import-config';
import { pinyin } from 'pinyin-pro';

const ACCESSORY_SPLIT_RE = /[\s,，、;；]+/;
const CJK_RE = /[\u4e00-\u9fff]/;
const LATIN_LETTER_RE = /[A-Za-z]/;
const TITLE_SEPARATOR_RE = /^[\s\-—–_:：/\\|]+/;

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

/** 产品名首字母大写：中文按拼音首字母，英文按词首字母，忽略数字与符号 */
export function deriveProductNameInitials(productName: string): string {
  const trimmed = productName.trim();
  if (!trimmed) {
    return '';
  }

  let result = '';
  let inLatinWord = false;

  for (const char of trimmed) {
    if (CJK_RE.test(char)) {
      const initial = pinyin(char, {
        pattern: 'first',
        toneType: 'none',
        type: 'array',
      })[0];
      if (initial && LATIN_LETTER_RE.test(initial)) {
        result += initial.toUpperCase();
      }
      inLatinWord = false;
      continue;
    }

    if (LATIN_LETTER_RE.test(char)) {
      if (!inLatinWord) {
        result += char.toUpperCase();
      }
      inLatinWord = true;
      continue;
    }

    inLatinWord = false;
  }

  return result || trimmed[0].toUpperCase();
}

export function buildStickerOuterId(bundleOuterId: string): string {
  return `${bundleOuterId}-ST`;
}

/** 套装货号：{前缀}-{品牌编码}-{产品名首字母}-{贴纸编码} */
export function buildBundleOuterId(
  rules: Pick<SkuImportRules, 'skuCodePrefix'>,
  brandCode: string,
  productName: string,
  stickerCode: string,
): string {
  const prefix = rules.skuCodePrefix.trim();
  const code = brandCode.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'BRAND';
  const initials = deriveProductNameInitials(productName);
  const sticker = stickerCode.trim();
  return `${prefix}-${code}-${initials}-${sticker}`;
}

export function buildStickerTitle(
  brand: string,
  productName: string,
  capacity: string,
): string {
  return `${brand}${productName}${capacity}贴纸`.replace(/\s+/g, '');
}

function trimLeadingTitleSeparators(value: string): string {
  return value.replace(TITLE_SEPARATOR_RE, '').trim();
}

function stripLeadingTitleToken(value: string, token: string): string {
  const normalizedToken = token.trim();
  const trimmed = trimLeadingTitleSeparators(value);
  if (!normalizedToken) {
    return trimmed;
  }

  if (trimmed.toLowerCase().startsWith(normalizedToken.toLowerCase())) {
    return trimLeadingTitleSeparators(trimmed.slice(normalizedToken.length));
  }

  return trimmed;
}

function buildBundlePrimaryTitle(brand: string, productName: string, displayName: string): string {
  const baseTitle = `${brand}${productName}`.replace(/\s+/g, '');
  const rawPackageLabel = displayName.trim() || productName.trim();
  const packageLabel = stripLeadingTitleToken(
    stripLeadingTitleToken(rawPackageLabel, brand),
    productName,
  );

  return packageLabel ? `${baseTitle} - ${packageLabel}*1` : `${baseTitle}*1`;
}

export function buildBundleTitle(
  brand: string,
  productName: string,
  displayName: string,
  accessories: string[],
): string {
  const parts = [
    buildBundlePrimaryTitle(brand, productName, displayName),
    ...accessories.map((item) => item.trim()).filter(Boolean).map((item) => `${item}*1`),
  ];
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
