import { describe, expect, it } from 'vitest';

import type { AccessoryConfig } from '@shared/schemas/sku-import-config';
import {
  mergeAccessoriesByName,
  parseAccessoryStatus,
} from '../src/tools/sku-import/accessories-merge';

describe('parseAccessoryStatus', () => {
  it.each([
    ['', true],
    ['启用', true],
    ['是', true],
    ['true', true],
    ['1', true],
    ['禁用', false],
    ['否', false],
    ['false', false],
    ['0', false],
    ['未知', true],
  ])('"%s" → enabled=%s', (raw, expected) => {
    expect(parseAccessoryStatus(raw)).toBe(expected);
  });
});

describe('mergeAccessoriesByName', () => {
  const existing: AccessoryConfig[] = [
    { name: '自粘袋', skuCode: 'PJ-OLD', brand: 'WKAU', enabled: true },
    { name: '说明书', skuCode: 'PJ-SMS', brand: '', enabled: false },
  ];

  it('同名更新 sku 与状态并保留 brand', () => {
    const { accessories, added, updated, skipped } = mergeAccessoriesByName(existing, [
      { name: '自粘袋', skuCode: 'PJ-NEW', statusRaw: '禁用' },
    ]);
    expect(updated).toBe(1);
    expect(added).toBe(0);
    expect(skipped).toBe(0);
    expect(accessories.find((a) => a.name === '自粘袋')).toMatchObject({
      skuCode: 'PJ-NEW',
      brand: 'WKAU',
      enabled: false,
    });
    expect(accessories.find((a) => a.name === '说明书')).toBeTruthy();
  });

  it('新名称追加且 brand 为空', () => {
    const { accessories, added } = mergeAccessoriesByName(existing, [
      { name: '面膜刷', skuCode: 'PJ-MMS', statusRaw: '' },
    ]);
    expect(added).toBe(1);
    expect(accessories.at(-1)).toMatchObject({
      name: '面膜刷',
      skuCode: 'PJ-MMS',
      brand: '',
      enabled: true,
    });
  });

  it('空名称或空 SKU 计入 skipped', () => {
    const { skipped } = mergeAccessoriesByName(existing, [
      { name: '', skuCode: 'X', statusRaw: '' },
      { name: '新配件', skuCode: '', statusRaw: '' },
    ]);
    expect(skipped).toBe(2);
  });

  it('文件内重复名称第二行 skipped', () => {
    const { skipped, updated } = mergeAccessoriesByName(existing, [
      { name: '自粘袋', skuCode: 'PJ-A', statusRaw: '' },
      { name: '自粘袋', skuCode: 'PJ-B', statusRaw: '' },
    ]);
    expect(updated).toBe(1);
    expect(skipped).toBe(1);
    expect(
      accessoriesFindSku(
        mergeAccessoriesByName(existing, [
          { name: '自粘袋', skuCode: 'PJ-A', statusRaw: '' },
          { name: '自粘袋', skuCode: 'PJ-B', statusRaw: '' },
        ]).accessories,
        '自粘袋',
      ),
    ).toBe('PJ-A');
  });
});

function accessoriesFindSku(accessories: AccessoryConfig[], name: string): string | undefined {
  return accessories.find((a) => a.name === name)?.skuCode;
}
