import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SKU_IMPORT_CONFIG,
  DEFAULT_SKU_IMPORT_RULES,
  brandConfigSchema,
  skuImportConfigSchema,
} from '@shared/schemas/sku-import-config';

describe('skuImportConfigSchema', () => {
  it('accepts the default config', () => {
    expect(skuImportConfigSchema.parse(DEFAULT_SKU_IMPORT_CONFIG)).toEqual(
      DEFAULT_SKU_IMPORT_CONFIG,
    );
  });

  it('fills defaults for missing arrays and rules', () => {
    const parsed = skuImportConfigSchema.parse({});
    expect(parsed.brands).toEqual([]);
    expect(parsed.accessories).toEqual([]);
    expect(parsed.rules).toEqual(DEFAULT_SKU_IMPORT_RULES);
  });

  it('defaults enabled to true and shortName to empty', () => {
    const brand = brandConfigSchema.parse({ name: 'wkau', code: '39' });
    expect(brand.enabled).toBe(true);
    expect(brand.shortName).toBe('');
  });

  it('rejects a brand without name', () => {
    expect(() => brandConfigSchema.parse({ name: '', code: '39' })).toThrow();
  });

  it('rejects a brand without code', () => {
    expect(() => brandConfigSchema.parse({ name: 'wkau', code: '' })).toThrow();
  });

  it('preserves cleared rule values', () => {
    const parsed = skuImportConfigSchema.parse({
      rules: { skuCodePrefix: '' },
    });
    expect(parsed.rules.skuCodePrefix).toBe('');
    expect(parsed.rules.bundleCategoryName).toBe(DEFAULT_SKU_IMPORT_RULES.bundleCategoryName);
  });

  it('default config has 16 brands with leading-zero codes', () => {
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands).toHaveLength(16);
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands[0]).toEqual({
      name: 'KJM',
      code: '04',
      shortName: '',
      enabled: true,
    });
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands.find((b) => b.name === 'WKAU')?.code).toBe('39');
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands.find((b) => b.name === 'FAELUTE')?.code).toBe('42');
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands.some((b) => b.name === 'lovi')).toBe(false);
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands.some((b) => b.name === 'nimi')).toBe(false);
  });
});
