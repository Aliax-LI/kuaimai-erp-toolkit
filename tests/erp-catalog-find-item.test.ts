import { describe, expect, it } from 'vitest';

import { findCatalogItemByOuterId, type ErpCatalogItem } from '../src/tools/sku-import/erp-catalog';

const parentItem: ErpCatalogItem = {
  outerId: 'YP-BYMPGXJ01',
  title: '布艺泡沫干洗剂',
  sysItemId: 1001,
  skus: [{ skuOuterId: 'YP-BYMPGXJ01-01', sysSkuId: 2001 }],
};

describe('findCatalogItemByOuterId', () => {
  it('应优先按主货号匹配', () => {
    expect(findCatalogItemByOuterId([parentItem], 'YP-BYMPGXJ01')).toBe(parentItem);
  });

  it('应按 SKU 子货号匹配同一商品', () => {
    expect(findCatalogItemByOuterId([parentItem], 'YP-BYMPGXJ01-01')).toBe(parentItem);
  });

  it('未命中时应返回 undefined', () => {
    expect(findCatalogItemByOuterId([parentItem], 'YP-OTHER')).toBeUndefined();
  });
});
