import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryListV2 = vi.fn();
const querySingle = vi.fn();

vi.mock('../src/core/erp-web-client', () => ({
  createErpWebClient: () => ({
    queryListV2,
    querySingle,
    getItemDetail: vi.fn(),
    addItem: vi.fn(),
    addPureSuite: vi.fn(),
    saveItem: vi.fn(),
    listBaseUnits: vi.fn(),
    listSysCategories: vi.fn(),
  }),
  ErpWebError: class ErpWebError extends Error {},
}));

import {
  createErpCatalogClient,
  findCatalogItemByOuterId,
  normalizeListItemForTest,
} from '../src/tools/sku-import/erp-catalog';

const config = {
  baseUrl: 'https://erp.superboss.cc',
  cookie: 'x=1',
  companyId: '140109',
};

describe('normalizeListItem sku arrays', () => {
  it('应从 skus 数组映射多个子货号', () => {
    const item = normalizeListItemForTest({
      outerId: 'YP-ZBQXJ01',
      title: '珠宝清洗剂',
      sysItemId: 5658398639519744,
      skus: [
        {
          outerId: 'YP-ZBQXJ01-03',
          skuOuterId: 'YP-ZBQXJ01-03',
          sysSkuId: 713113192169984,
          propertiesName: '50ml柠檬味',
        },
      ],
    });

    expect(item).toEqual({
      outerId: 'YP-ZBQXJ01',
      title: '珠宝清洗剂',
      sysItemId: 5658398639519744,
      type: undefined,
      skus: [
        {
          skuOuterId: 'YP-ZBQXJ01-03',
          sysSkuId: 713113192169984,
          title: '50ml柠檬味',
        },
      ],
    });
  });

  it('应从 skuERP 数组映射子货号', () => {
    const item = normalizeListItemForTest({
      outerId: 'YP-ZBQXJ01',
      title: '珠宝清洗剂',
      skuERP: [{ outerId: 'YP-ZBQXJ01-03', sysSkuId: 1 }],
    });

    expect(item?.skus?.[0]?.skuOuterId).toBe('YP-ZBQXJ01-03');
  });

  it('应从 skuList 数组映射规格商家编码', () => {
    const item = normalizeListItemForTest({
      outerId: 'YP-CXJ01',
      title: '除锈剂',
      sysItemId: 9,
      skuList: [{ outerId: 'YP-CXJ01-17', sysSkuId: 17, propertiesName: '30ml增强款-白瓶' }],
    });

    expect(item?.skus?.[0]).toEqual({
      skuOuterId: 'YP-CXJ01-17',
      sysSkuId: 17,
      title: '30ml增强款-白瓶',
    });
  });
});

describe('getItemsByOuterIds fallback', () => {
  beforeEach(() => {
    queryListV2.mockReset();
    querySingle.mockReset();
  });

  it('queryListV2 无结果时应 fallback querySingle(content=outerId)', async () => {
    queryListV2.mockResolvedValue({ list: [] });
    querySingle.mockResolvedValue({
      list: [
        {
          outerId: 'YP-ZBQXJ01',
          title: '珠宝清洗剂',
          sysItemId: 1,
          skus: [{ outerId: 'YP-ZBQXJ01-03', sysSkuId: 2 }],
        },
      ],
    });

    const catalog = createErpCatalogClient(config);
    const items = await catalog.getItemsByOuterIds(['YP-ZBQXJ01-03']);

    expect(querySingle).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'YP-ZBQXJ01-03',
        content: 'outerId',
        api_name: 'item_querySingle',
      }),
    );
    expect(findCatalogItemByOuterId(items, 'YP-ZBQXJ01-03')?.outerId).toBe('YP-ZBQXJ01');
  });

  it('queryListV2 已命中时不应调用 querySingle', async () => {
    queryListV2.mockResolvedValue({
      list: [
        {
          outerId: 'PJ-ZND01',
          title: '自粘袋',
          sysItemId: 10,
        },
      ],
    });

    const catalog = createErpCatalogClient(config);
    await catalog.getItemsByOuterIds(['PJ-ZND01']);

    expect(querySingle).not.toHaveBeenCalled();
  });

  it('同一主货号的规格应合并 skuList，而不是被先到的列表行盖掉', async () => {
    queryListV2.mockResolvedValue({
      list: [{ outerId: 'YP-CXJ01', title: '除锈剂', sysItemId: 9 }],
    });
    querySingle.mockImplementation(async (query: { text?: string }) => ({
      list: [
        {
          outerId: 'YP-CXJ01',
          title: '除锈剂',
          sysItemId: 9,
          skuList: [{ outerId: query.text, sysSkuId: 1, propertiesName: '规格' }],
        },
      ],
    }));

    const catalog = createErpCatalogClient(config);
    const items = await catalog.getItemsByOuterIds(['YP-CXJ01-17', 'YP-CXJ01-10']);

    expect(items).toHaveLength(1);
    expect(findCatalogItemByOuterId(items, 'YP-CXJ01-17')?.outerId).toBe('YP-CXJ01');
    expect(findCatalogItemByOuterId(items, 'YP-CXJ01-10')?.outerId).toBe('YP-CXJ01');
  });

  it('两者均无结果时返回空数组', async () => {
    queryListV2.mockResolvedValue({ list: [] });
    querySingle.mockResolvedValue({ list: [] });

    const catalog = createErpCatalogClient(config);
    const items = await catalog.getItemsByOuterIds(['YP-MISSING']);

    expect(items).toEqual([]);
  });
});
