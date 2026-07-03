import { describe, expect, it } from 'vitest';

import {
  buildBundleOuterId,
  buildBundleTitle,
  buildBusinessKey,
  buildStickerTitle,
  deriveProductNameInitials,
  isSkuImportDataRow,
  parseAccessoryNames,
  validateImportRow,
} from '../src/tools/sku-import/domain';
import { DEFAULT_SKU_IMPORT_RULES } from '@shared/schemas/sku-import-config';

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

  it('deriveProductNameInitials 英文产品名取词首字母', () => {
    expect(deriveProductNameInitials('test')).toBe('T');
    expect(deriveProductNameInitials('Oil Cleaner')).toBe('OC');
  });

  it('buildBundleOuterId 应按前缀-品牌编码-产品名首字母+贴纸编码生成', () => {
    expect(
      buildBundleOuterId(DEFAULT_SKU_IMPORT_RULES, '39', 'test', 'test09590724'),
    ).toBe('69-39-Ttest09590724');
    expect(
      buildBundleOuterId({ skuCodePrefix: 'test69' }, '42', 'Oil Cleaner', 'tets09590724'),
    ).toBe('test69-42-OCtets09590724');
  });

  it('buildBundleTitle 应包含名称列容量包装信息', () => {
    expect(
      buildBundleTitle('jokjok', '油污清洁剂', '30ml黑色pe瓶（跨境）', [
        '自粘袋',
        '跨境说明书',
        '海绵',
        '喷头',
      ]),
    ).toBe(
      'jokjok油污清洁剂 - 30ml黑色pe瓶（跨境）*1+自粘袋*1+跨境说明书*1+海绵*1+喷头*1',
    );
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
