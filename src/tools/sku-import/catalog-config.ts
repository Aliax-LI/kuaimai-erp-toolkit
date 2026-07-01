import type { AccessoryConfig, BrandConfig, SkuImportConfig } from '@shared/schemas/sku-import-config';

export interface ConfigAccessoryMatch {
  name: string;
  skuCode: string;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function findBrandInConfig(
  brandName: string,
  config: SkuImportConfig,
): BrandConfig | undefined {
  const key = normalizeKey(brandName);
  return config.brands.find((brand) => normalizeKey(brand.name) === key);
}

export function resolveBrandCodeFromConfig(
  brandName: string,
  config: SkuImportConfig,
): { code: string } | { error: string } {
  const brand = findBrandInConfig(brandName, config);
  if (!brand) {
    return { error: `品牌「${brandName}」未在配置中找到` };
  }
  if (!brand.enabled) {
    return { error: `品牌「${brandName}」已停用` };
  }
  if (!brand.code.trim()) {
    return { error: `品牌「${brandName}」缺少编码` };
  }
  return { code: brand.code.trim() };
}

export function matchAccessoriesFromConfig(
  accessoryNames: string[],
  rowBrand: string,
  config: SkuImportConfig,
): { matched: ConfigAccessoryMatch[]; missing: string[] } {
  const matched: ConfigAccessoryMatch[] = [];
  const missing: string[] = [];
  const rowBrandKey = normalizeKey(rowBrand);

  for (const rawName of accessoryNames) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }
    const key = normalizeKey(name);
    const hits = config.accessories.filter((accessory) => {
      if (!accessory.enabled) {
        return false;
      }
      if (normalizeKey(accessory.name) !== key) {
        return false;
      }
      if (accessory.brand.trim() && normalizeKey(accessory.brand) !== rowBrandKey) {
        return false;
      }
      return true;
    });

    if (hits.length === 0) {
      missing.push(name);
      continue;
    }
    if (hits.length > 1) {
      missing.push(`${name}（配置中存在多条同名配件）`);
      continue;
    }

    const hit = hits[0];
    if (!hit.skuCode.trim()) {
      missing.push(`${name}（配置中 SKU 编码为空）`);
      continue;
    }
    matched.push({ name, skuCode: hit.skuCode.trim() });
  }

  return { matched, missing };
}
