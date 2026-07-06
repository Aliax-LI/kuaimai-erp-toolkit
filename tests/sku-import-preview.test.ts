import { describe, expect, it, vi } from 'vitest';

import type { SkuImportConfig } from '../src/shared/schemas/sku-import-config';
import { DEFAULT_SKU_IMPORT_CONFIG } from '../src/shared/schemas/sku-import-config';
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
  ...DEFAULT_SKU_IMPORT_CONFIG,
  brands: [{ name: 'WKAU', code: '39', shortName: 'W', enabled: true }],
  accessories: [
    { name: '自粘袋', skuCode: 'PJ-ZND01', brand: 'WKAU', enabled: true },
    { name: '说明书', skuCode: 'PJ-SMS01', brand: 'WKAU', enabled: true },
  ],
};

const configMissingManual: SkuImportConfig = {
  ...DEFAULT_SKU_IMPORT_CONFIG,
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
    expect(result.rows[0].matchedAccessoryCodes).toEqual(['PJ-ZND01-02', 'PJ-SMS01-01']);
    expect(result.rows[0].productOriginalOuterId).toBe('YP-BYMPGXJ01');
    expect(result.rows[0].stickerOuterId).toBe('test0628');
    expect(result.rows[0].proposedSkuCode).toBe('69-39-T-test0628');
  });

  it('重复配件预演应批量预取并复用 ERP 查询结果', async () => {
    const parsed: ParsedSkuImportWorkbook = {
      ...baseParsed,
      rows: [
        baseParsed.rows[0],
        {
          ...baseParsed.rows[0],
          rowNumber: 3,
          values: {
            ...validRowValues,
            贴纸编码: 'test0629',
          },
        },
      ],
    };
    const getItemsByOuterIds = vi.fn(async (ids: string[]) => {
      const map: Record<string, { outerId: string; sysItemId: number; title: string }> = {
        'YP-BYMPGXJ01': { outerId: 'YP-BYMPGXJ01', sysItemId: 50, title: '原品' },
        'PJ-ZND01': { outerId: 'PJ-ZND01', sysItemId: 100, title: '自粘袋' },
        'PJ-SMS01': { outerId: 'PJ-SMS01', sysItemId: 101, title: '说明书' },
      };
      return ids.filter((id) => map[id]).map((id) => map[id]);
    });
    const buildBridgeEntryForOuterId = vi.fn(async (outerId: string) => ({
      subItemId: outerId === 'PJ-ZND01' ? 100 : 101,
      outerId: `${outerId}-SKU`,
      title: outerId,
      ratio: 1,
    }));
    const catalog = mockCatalog({
      getItemsByOuterIds,
      buildBridgeEntryForOuterId,
    });

    const result = await buildSkuImportPreview('s1', '/tmp/x.xlsx', parsed, catalog, testConfig);

    expect(result.readyCount).toBe(2);
    expect(getItemsByOuterIds).toHaveBeenCalledTimes(1);
    expect(getItemsByOuterIds.mock.calls[0][0]).toEqual(
      expect.arrayContaining(['YP-BYMPGXJ01', 'PJ-ZND01', 'PJ-SMS01', 'test0628', 'test0629']),
    );
    expect(buildBridgeEntryForOuterId).toHaveBeenCalledTimes(2);
  });

  it('配置子货号时应精确匹配 SKU 而非取第一个子 SKU', async () => {
    const subSkuConfig: SkuImportConfig = {
      ...testConfig,
      accessories: [
        { name: '自粘袋', skuCode: 'PJ-ZND01-01', brand: 'WKAU', enabled: true },
        { name: '说明书', skuCode: 'PJ-SHMS01-02', brand: 'WKAU', enabled: true },
      ],
    };
    const parentItems = {
      'PJ-ZND01': {
        outerId: 'PJ-ZND01',
        sysItemId: 100,
        title: '自粘袋',
        skus: [
          { skuOuterId: 'PJ-ZND01-02', sysSkuId: 1002 },
          { skuOuterId: 'PJ-ZND01-01', sysSkuId: 1001 },
        ],
      },
      'PJ-SHMS01': {
        outerId: 'PJ-SHMS01',
        sysItemId: 101,
        title: '说明书',
        skus: [
          { skuOuterId: 'PJ-SHMS01-03', sysSkuId: 1013 },
          { skuOuterId: 'PJ-SHMS01-02', sysSkuId: 1012 },
        ],
      },
    };
    const catalog = mockCatalog({
      listOuterIdsByPrefix: vi.fn().mockResolvedValue([]),
      getItemsByOuterIds: vi.fn(async (ids: string[]) => {
        const map: Record<
          string,
          { outerId: string; sysItemId: number; title: string; skus?: Array<{ skuOuterId: string; sysSkuId: number }> }
        > = {
          'YP-BYMPGXJ01': { outerId: 'YP-BYMPGXJ01', sysItemId: 50, title: '原品' },
          ...parentItems,
        };
        const bySubSku = (id: string) => {
          for (const item of Object.values(parentItems)) {
            if (item.skus?.some((sku) => sku.skuOuterId === id)) {
              return item;
            }
          }
          return undefined;
        };
        return ids
          .map((id) => map[id] ?? bySubSku(id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
      }),
      buildBridgeEntryForOuterId: vi.fn(async (outerId: string) => {
        const skuMap: Record<string, { subItemId: number; skuOuterId: string }> = {
          'PJ-ZND01-01': { subItemId: 100, skuOuterId: 'PJ-ZND01-01' },
          'PJ-ZND01-02': { subItemId: 100, skuOuterId: 'PJ-ZND01-02' },
          'PJ-SHMS01-02': { subItemId: 101, skuOuterId: 'PJ-SHMS01-02' },
          'PJ-SHMS01-03': { subItemId: 101, skuOuterId: 'PJ-SHMS01-03' },
          'PJ-ZND01': { subItemId: 100, skuOuterId: 'PJ-ZND01-02' },
          'PJ-SHMS01': { subItemId: 101, skuOuterId: 'PJ-SHMS01-03' },
        };
        const hit = skuMap[outerId];
        if (!hit) {
          return null;
        }
        return {
          subItemId: hit.subItemId,
          outerId: hit.skuOuterId,
          title: outerId,
          ratio: 1,
        };
      }),
    });

    const result = await buildSkuImportPreview(
      's1',
      '/tmp/x.xlsx',
      baseParsed,
      catalog,
      subSkuConfig,
    );

    expect(result.rows[0].status).toBe('pending');
    expect(result.rows[0].matchedAccessorySkus).toEqual([
      { name: '自粘袋', itemOuterId: 'PJ-ZND01', skuOuterId: 'PJ-ZND01-01', sysItemId: 100 },
      { name: '说明书', itemOuterId: 'PJ-SHMS01', skuOuterId: 'PJ-SHMS01-02', sysItemId: 101 },
    ]);
    expect(result.rows[0].matchedAccessoryCodes).toEqual(['PJ-ZND01-01', 'PJ-SHMS01-02']);
    expect(vi.mocked(catalog.buildBridgeEntryForOuterId).mock.calls.map(([id]) => id)).toEqual([
      'PJ-ZND01-01',
      'PJ-SHMS01-02',
    ]);
  });

  it('预演时应上报 ERP 查询与行匹配进度', async () => {
    const catalog = mockCatalog({});
    mockProductOriginal(catalog);
    const onProgress = vi.fn();

    await buildSkuImportPreview('s1', '/tmp/x.xlsx', baseParsed, catalog, configMissingManual, {
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'erp_lookup',
        percent: 35,
        totalRows: 1,
      }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'matching',
        currentRows: 1,
        totalRows: 1,
      }),
    );
  });
});
