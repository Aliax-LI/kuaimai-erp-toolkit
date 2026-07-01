import { describe, expect, it } from 'vitest';

import {
  assertErpBusinessSuccess,
  generateErpTrackId,
  parseCookieValue,
  resolveErpAccessToken,
} from '../src/core/erp-web-client';
import {
  buildErpAddPureSuiteBody,
  buildErpAddStickerBody,
  extractSavedItemIds,
} from '../src/tools/sku-import/erp-item-payload';

describe('erp-web-client', () => {
  it('parseCookieValue 应解析 Cookie 中的键值', () => {
    expect(parseCookieValue('JSESSIONID=abc; accessToken=token123', 'accessToken')).toBe('token123');
  });

  it('generateErpTrackId 应生成 trackid 前缀', () => {
    expect(generateErpTrackId(1_782_621_031_467)).toMatch(/^trackid1782621031467_\d+$/);
  });

  it('assertErpBusinessSuccess 在 result=1 时返回 data', () => {
    expect(assertErpBusinessSuccess({ result: 1, data: { total: 3 } }, 'test')).toEqual({ total: 3 });
  });

  it('assertErpBusinessSuccess 在 result!=1 时抛错', () => {
    expect(() => assertErpBusinessSuccess({ result: 901, message: '会话失效' }, 'test')).toThrow(
      '会话失效',
    );
  });
});

describe('erp-item-payload', () => {
  it('buildErpAddStickerBody 应对齐 /item/add 页面参数', () => {
    const body = buildErpAddStickerBody({
      outerId: '69-WKAU-CJJ001-ST',
      title: '贴纸标题',
      brand: 'WKAU',
      sellerCids: '7664943215',
      picPath: 'https://example.com/a.png',
    });

    expect(body.type).toBe('0');
    expect(body.outerId).toBe('69-WKAU-CJJ001-ST');
    expect(body.unit).toBe('张');
    expect(body.skulist).toEqual([]);
    expect(body.isSysVolume).toBe(1);
    expect(body.isSysWeight).toBe(0);
    expect(body.api_name).toBe('item_add');
  });

  it('buildErpAddPureSuiteBody 应映射 itemSuiteBridgeList 与自动计算标志', () => {
    const body = buildErpAddPureSuiteBody({
      outerId: '69-WKAU-CJJ001',
      title: '套装标题',
      sellerCids: '4427982317',
      itemSuiteBridgeList: [
        {
          subItemId: 1,
          outerId: 'PJ-01',
          title: '配件',
          ratio: 1,
        },
      ],
    });

    expect(body.type).toBe('2');
    expect(body.isSysWeight).toBe(1);
    expect(body.isSysPriceImport).toBe(1);
    expect(body.isSysWholesalePrice).toBe(1);
    expect(body.isSysOtherPrice1).toBe(1);
    expect(body.itemSuiteBridgeList).toEqual([
      expect.objectContaining({
        subItemId: 1,
        outerId: 'PJ-01',
        subSkuId: '',
        skuOuterId: '',
        ratio: 1,
      }),
    ]);
    expect(body.api_name).toBe('item_addPureSuite');
  });

  it('extractSavedItemIds 应兼容数组响应与 sysItemId 回退', () => {
    expect(
      extractSavedItemIds([
        {
          sysItemId: 100,
          skuList: [{ sysSkuId: 0 }],
        },
      ]),
    ).toEqual({ sysItemId: 100, sysSkuId: 100 });
  });
});
