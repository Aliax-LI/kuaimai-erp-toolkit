import { describe, expect, it, vi } from 'vitest';

import { buildSkuImportPreview } from '../src/tools/sku-import/preview';
import type { ErpCatalogClient } from '../src/tools/sku-import/erp-catalog';
import type { ParsedSkuImportWorkbook } from '../src/tools/sku-import/workbook';

function mockCatalog(overrides: Partial<ErpCatalogClient>): ErpCatalogClient {
  return {
    listAllOuterIds: vi.fn().mockResolvedValue([]),
    listOuterIdsByPrefix: vi.fn().mockResolvedValue([]),
    listCatalogItems: vi.fn().mockResolvedValue([]),
    getItemsByOuterIds: vi.fn().mockResolvedValue([]),
    findItemsByTitleKeyword: vi.fn().mockResolvedValue([]),
    matchAccessoriesForImport: vi.fn().mockResolvedValue({ matched: [], missing: ['说明书'] }),
    getItemDetailRecord: vi.fn().mockResolvedValue({}),
    buildBridgeEntryForOuterId: vi.fn().mockResolvedValue(null),
    createSticker: vi.fn(),
    createPureSuite: vi.fn(),
    ...overrides,
  } as ErpCatalogClient;
}

const validRowValues = {
  品牌: 'WKAU',
  产品名: 'test',
  容量: '30ml',
  配件: '自粘袋 说明书',
  产品原品编码: 'YP-BYMPGXJ01',
  贴纸编码: 'test0628',
  名称: '布艺泡沫干洗剂30g喷剂',
};

const baseParsed: ParsedSkuImportWorkbook = {
  sheetName: '待创建货号记录',
  headers: [],
  rows: [
    {
      rowNumber: 2,
      values: validRowValues,
      images: [],
    },
  ],
  workbookBuffer: Buffer.alloc(0),
};

describe('buildSkuImportPreview', () => {
  it('配件未完全匹配时应 preview_blocked', async () => {
    const catalog = mockCatalog({});
    const result = await buildSkuImportPreview('s1', '/tmp/x.xlsx', baseParsed, catalog);
    expect(result.rows[0].status).toBe('preview_blocked');
    expect(result.rows[0].blockedReason).toContain('说明书');
    expect(result.readyCount).toBe(0);
  });

  it('配件全匹配时应解析 matchedAccessorySkus', async () => {
    const catalog = mockCatalog({
      listOuterIdsByPrefix: vi.fn().mockResolvedValue([]),
      getItemsByOuterIds: vi.fn().mockResolvedValue([]),
      matchAccessoriesForImport: vi.fn().mockResolvedValue({
        matched: ['PJ-ZND01', 'PJ-SMS01'],
        missing: [],
      }),
      buildBridgeEntryForOuterId: vi.fn(async (outerId: string) => ({
        subItemId: outerId === 'PJ-ZND01' ? 100 : 200,
        outerId: outerId === 'PJ-ZND01' ? 'PJ-ZND01-02' : 'PJ-SMS01-01',
        title: outerId,
        ratio: 1,
      })),
    });
    const result = await buildSkuImportPreview('s1', '/tmp/x.xlsx', baseParsed, catalog);
    expect(result.rows[0].status).toBe('pending');
    expect(result.rows[0].matchedAccessorySkus).toHaveLength(2);
    expect(result.rows[0].matchedAccessorySkus[0].skuOuterId).toBe('PJ-ZND01-02');
    expect(result.rows[0].stickerOuterId).toContain('-ST');
  });
});
