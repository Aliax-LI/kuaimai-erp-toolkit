import { describe, expect, it } from 'vitest';

import {
  buildBundleOuterId,
  buildBundleTitle,
  buildBusinessKey,
  buildStickerTitle,
  deriveProductNameInitials,
  isSkuImportDataRow,
  normalizeImportRowValues,
  parseAccessoryNames,
  validateImportRow,
} from '../src/tools/sku-import/domain';
import { DEFAULT_SKU_IMPORT_RULES } from '@shared/schemas/sku-import-config';

describe('sku-import domain', () => {
  it('parseAccessoryNames 应按空白拆分并去重', () => {
    expect(parseAccessoryNames('自粘袋 说明书 自粘袋')).toEqual(['自粘袋', '说明书']);
  });

  it('buildBusinessKey 应组合原品编码、贴纸编码、产品名与容量', () => {
    expect(
      buildBusinessKey({
        产品原品编码: 'YP-CJJ01-01',
        贴纸编码: '07460088',
        产品名: '强力除胶剂',
        容量: '50ml',
      }),
    ).toBe('YP-CJJ01-01|07460088|强力除胶剂|50ml');
  });

  it('deriveProductNameInitials 英文产品名取词首字母', () => {
    expect(deriveProductNameInitials('test')).toBe('T');
    expect(deriveProductNameInitials('Oil Cleaner')).toBe('OC');
  });

  it('deriveProductNameInitials 中文产品名取拼音首字母并大写', () => {
    expect(deriveProductNameInitials('穿戴甲胶水')).toBe('CDJJS');
    expect(deriveProductNameInitials('布艺泡沫干洗剂')).toBe('BYPMGXJ');
    expect(deriveProductNameInitials('车漆镀晶喷雾3.0')).toBe('CQDJPW');
  });

  it('buildBundleOuterId 应按前缀-品牌编码-产品名首字母+贴纸编码生成', () => {
    expect(
      buildBundleOuterId(DEFAULT_SKU_IMPORT_RULES, '39', 'test', 'test09590724'),
    ).toBe('69-39-T-test09590724');
    expect(
      buildBundleOuterId({ skuCodePrefix: 'test69' }, '42', 'Oil Cleaner', 'tets09590724'),
    ).toBe('test69-42-OC-tets09590724');
    expect(
      buildBundleOuterId(DEFAULT_SKU_IMPORT_RULES, '39', '穿戴甲胶水', '09590707'),
    ).toBe('69-39-CDJJS-09590707');
  });

  it('buildBundleTitle 应按品牌+产品名+容量与配件拼接', () => {
    expect(
      buildBundleTitle('WKAU', '除味剂', '60ml', ['自粘袋', '说明书', '白色按压喷头']),
    ).toBe('WKAU除味剂60ml*1+自粘袋*1+说明书*1+白色按压喷头*1');
  });

  it('buildStickerTitle 无备注时应拼接基础贴纸名称', () => {
    expect(buildStickerTitle('WKAU', '强力除胶剂', '50ml')).toBe('WKAU强力除胶剂50ml贴纸');
  });

  it('buildStickerTitle 有备注时应追加贴纸备注', () => {
    expect(buildStickerTitle('WKAU', '除味剂', '60ml', '跨境专用')).toBe(
      'WKAU除味剂60ml贴纸-跨境专用',
    );
    expect(buildStickerTitle('WKAU', '除味剂', '60ml', ' ')).toBe('WKAU除味剂60ml贴纸');
  });

  it('normalizeImportRowValues 应解析新表格列', () => {
    expect(
      normalizeImportRowValues({
        日期: '2026/06/29',
        产品原品编码: 'YP-CWJ01-04',
        品牌: 'WKAU',
        产品名: '除味剂',
        容量: '60ml',
        贴纸编码: '0957069011',
        贴纸备注: '跨境专用',
        配件: '自粘袋 说明书',
        成分: 'Water',
        执行标准: 'Capacity:60ml',
      }),
    ).toMatchObject({
      productCode: 'YP-CWJ01-04',
      stickerRemark: '跨境专用',
      displayName: '除味剂60ml',
      accessoriesRaw: '自粘袋 说明书',
    });
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
