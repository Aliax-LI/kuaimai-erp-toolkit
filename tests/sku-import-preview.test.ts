import { describe, expect, it, vi } from 'vitest';

import type { SkuImportConfig } from '../src/shared/schemas/sku-import-config';
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
    matchAccessoriesForImport: vi.fn().mockResolvedValue({ matched: [], missing: [] }),
    getItemDetailRecord: vi.fn().mockResolvedValue({}),
    buildBridgeEntryForOuterId: vi.fn().mockResolvedValue(null),
    createSticker: vi.fn(),
    createPureSuite: vi.fn(),
    ...overrides,
  } as ErpCatalogClient;
}

const testConfig: SkuImportConfig = {
  brands: [{ name: 'WKAU', code: '39', shortName: 'W', enabled: true }],
  accessories: [
    { name: '自粘袋', skuCode: 'PJ-ZND01', brand: 'WKAU', enabled: true },
    { name: '说明书', skuCode: 'PJ-SMS01', brand: 'WKAU', enabled: true },
  ],
};

const configMissingManual: SkuImportConfig = {
  brands: testConfig.brands,
  accessories: [testConfig.accessories[0]],
};

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

function mockProductOriginal(catalog: ErpCatalogClient) {
  vi.mocked(catalog.getItemsByOuterIds).mockImplementation(async (ids: string[]) => {
    if (ids.includes('YP-BYMPGXJ01')) {
      return [{ outerId: 'YP-BYMPGXJ01', sysItemId: 50, title: '原品' }];
    }
    return [];
  });
}

describe('buildSkuImportPreview', () => {
  it('配件未在配置中匹配时应 preview_blocked', async () => {
    const catalog = mockCatalog({});
    mockProductOriginal(catalog);
    const result = await buildSkuImportPreview(
      's1',
      '/tmp/x.xlsx',
      baseParsed,
      catalog,
      configMissingManual,
    );
    expect(result.rows[0].status).toBe('preview_blocked');
    expect(result.rows[0].blockedReason).toContain('说明书');
    expect(result.readyCount).toBe(0);
  });

  it('配件全匹配时应解析 matchedAccessorySkus', async () => {
    const catalog = mockCatalog({
      listOuterIdsByPrefix: vi.fn().mockResolvedValue([]),
      getItemsByOuterIds: vi.fn(async (ids: string[]) => {
        const map: Record<string, { outerId: string; sysItemId: number; title: string }> = {
          'YP-BYMPGXJ01': { outerId: 'YP-BYMPGXJ01', sysItemId: 50, title: '原品' },
          'PJ-ZND01': { outerId: 'PJ-ZND01', sysItemId: 100, title: '自粘袋' },
          'PJ-SMS01': { outerId: 'PJ-SMS01', sysItemId: 101, title: '说明书' },
        };
        return ids
          .filter((id) => map[id])
          .map((id) => map[id]);
      }),
      buildBridgeEntryForOuterId: vi.fn(async (outerId: string) => ({
        subItemId: outerId === 'PJ-ZND01' ? 100 : outerId === 'PJ-SMS01' ? 101 : 50,
        outerId:
          outerId === 'PJ-ZND01'
            ? 'PJ-ZND01-02'
            : outerId === 'PJ-SMS01'
              ? 'PJ-SMS01-01'
              : outerId,
        title: outerId,
        ratio: 1,
      })),
    });
    const result = await buildSkuImportPreview(
      's1',
      '/tmp/x.xlsx',
      baseParsed,
      catalog,
      testConfig,
    );
    expect(result.rows[0].status).toBe('pending');
    expect(result.rows[0].matchedAccessorySkus).toHaveLength(2);
    expect(result.rows[0].matchedAccessorySkus[0].skuOuterId).toBe('PJ-ZND01-02');
    expect(result.rows[0].productOriginalOuterId).toBe('YP-BYMPGXJ01');
    expect(result.rows[0].stickerOuterId).toContain('-ST');
  });
});
