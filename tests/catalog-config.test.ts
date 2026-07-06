import { describe, expect, it } from 'vitest';

import {
  findBrandInConfig,
  matchAccessoriesFromConfig,
  resolveBrandCodeFromConfig,
} from '../src/tools/sku-import/catalog-config';
import { DEFAULT_SKU_IMPORT_CONFIG } from '../src/shared/schemas/sku-import-config';

describe('catalog-config', () => {
  it('findBrandInConfig 应大小写不敏感匹配', () => {
    expect(findBrandInConfig('WKAU', DEFAULT_SKU_IMPORT_CONFIG)?.code).toBe('39');
    expect(findBrandInConfig('wkau', DEFAULT_SKU_IMPORT_CONFIG)?.code).toBe('39');
  });

  it('resolveBrandCodeFromConfig 未配置品牌应返回错误', () => {
    const result = resolveBrandCodeFromConfig('UNKNOWN', DEFAULT_SKU_IMPORT_CONFIG);
    expect(result).toEqual({ error: '品牌「UNKNOWN」未在配置中找到' });
  });

  it('matchAccessoriesFromConfig 应按名称精确匹配且不关联品牌', () => {
    const config = {
      brands: DEFAULT_SKU_IMPORT_CONFIG.brands,
      accessories: [
        { name: '自粘袋', skuCode: 'PJ-ZND01', brand: 'lovi', enabled: true },
        { name: '说明书', skuCode: 'PJ-SMS01', brand: '', enabled: true },
        { name: '护理液', skuCode: 'HLY03', brand: 'lovi', enabled: true },
      ],
    };
    const result = matchAccessoriesFromConfig(['自粘袋', '说明书'], 'WKAU', config);
    expect(result.missing).toEqual([]);
    expect(result.matched).toEqual([
      { name: '自粘袋', skuCode: 'PJ-ZND01' },
      { name: '说明书', skuCode: 'PJ-SMS01' },
    ]);
  });

  it('matchAccessoriesFromConfig 未配置配件应列入 missing', () => {
    const config = {
      brands: DEFAULT_SKU_IMPORT_CONFIG.brands,
      accessories: [{ name: '自粘袋', skuCode: 'PJ-ZND01', brand: 'wkau', enabled: true }],
    };
    const result = matchAccessoriesFromConfig(['自粘袋', '说明书'], 'WKAU', config);
    expect(result.matched).toHaveLength(1);
    expect(result.missing).toEqual(['说明书']);
  });
});
