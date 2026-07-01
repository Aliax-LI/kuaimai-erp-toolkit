import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SKU_IMPORT_CONFIG,
  brandConfigSchema,
  skuImportConfigSchema,
} from '@shared/schemas/sku-import-config';

describe('skuImportConfigSchema', () => {
  it('accepts the default config', () => {
    expect(skuImportConfigSchema.parse(DEFAULT_SKU_IMPORT_CONFIG)).toEqual(
      DEFAULT_SKU_IMPORT_CONFIG,
    );
  });

  it('fills defaults for missing arrays', () => {
    const parsed = skuImportConfigSchema.parse({});
    expect(parsed.brands).toEqual([]);
    expect(parsed.accessories).toEqual([]);
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
});
