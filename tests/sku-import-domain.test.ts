import { describe, expect, it } from 'vitest';

import {
  allocateNextSkuCode,
  buildBusinessKey,
  buildSkuCodePrefix,
  buildStickerTitle,
  isSkuImportDataRow,
  parseAccessoryNames,
  validateImportRow,
} from '../src/tools/sku-import/domain';

describe('sku-import domain', () => {
  it('parseAccessoryNames 应按空白拆分并去重', () => {
    expect(parseAccessoryNames('自粘袋 说明书 自粘袋')).toEqual(['自粘袋', '说明书']);
  });

  it('buildBusinessKey 应组合原品编码与贴纸编码', () => {
    expect(
      buildBusinessKey({
        产品原品编码: 'YP-CJJ01-01',
        贴纸编码: '07460088',
        名称: '除胶剂50g黑瓶喷雾',
      }),
    ).toBe('YP-CJJ01-01|07460088|除胶剂50g黑瓶喷雾');
  });

  it('buildSkuCodePrefix 应使用配置品牌编码与原品缩写', () => {
    expect(buildSkuCodePrefix('39', 'YP-CJJ01-01', '强力除胶剂')).toBe('test-69-39-CJJ01');
  });

  it('allocateNextSkuCode 应基于已有货号递增', () => {
    const next = allocateNextSkuCode('test-69-39-CJJ01', [
      'test-69-39-CJJ01001',
      'test-69-39-CJJ01007',
      'test-69-39-OTHER001',
    ]);
    expect(next).toBe('test-69-39-CJJ01008');
  });

  it('buildStickerTitle 应拼接贴纸名称', () => {
    expect(buildStickerTitle('WKAU', '强力除胶剂', '50ml')).toBe('WKAU强力除胶剂50ml贴纸');
  });

  it('validateImportRow 应校验必填字段', () => {
    expect(validateImportRow({ 品牌: 'WKAU' })).toBe('缺少产品原品编码');
    expect(
      validateImportRow({
        品牌: 'WKAU',
        产品原品编码: 'YP-CJJ01-01',
        产品名: '强力除胶剂',
        容量: '50ml',
        贴纸编码: '07460088',
        名称: '除胶剂50g黑瓶喷雾',
      }),
    ).toBeUndefined();
  });

  it('isSkuImportDataRow 应忽略仅含回写列的空行', () => {
    expect(
      isSkuImportDataRow({
        创建状态: 'preview_blocked',
        失败原因: '缺少品牌',
      }),
    ).toBe(false);
    expect(
      isSkuImportDataRow({
        品牌: 'WKAU',
        产品名: '布艺泡沫干洗剂',
      }),
    ).toBe(true);
  });
});
