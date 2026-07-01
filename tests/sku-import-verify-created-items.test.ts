import { describe, expect, it } from 'vitest';

import { verifySuiteBridgeStructure } from '../src/tools/sku-import/verify-created-items';

describe('verifySuiteBridgeStructure', () => {
  it('应要求 bridge 含贴纸与全部配件 subItemId', () => {
    const result = verifySuiteBridgeStructure({
      expectedAccessoryItemIds: [101, 102],
      stickerItemId: 200,
      bridgeList: [
        { subItemId: 101, ratio: 1 },
        { subItemId: 102, ratio: 1 },
        { sysItemId: 200, ratio: 1 },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('贴纸');
  });

  it('应要求 bridge 含产品原品 subItemId', () => {
    const result = verifySuiteBridgeStructure({
      productOriginalItemId: 50,
      expectedAccessoryItemIds: [101],
      stickerItemId: 200,
      bridgeList: [
        { subItemId: 50, ratio: 1 },
        { subItemId: 101, ratio: 1 },
        { sysItemId: 200, ratio: 1 },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('产品原品');
  });

  it('缺少配件时应失败并说明', () => {
    const result = verifySuiteBridgeStructure({
      expectedAccessoryItemIds: [101, 102],
      stickerItemId: 200,
      bridgeList: [{ subItemId: 200, ratio: 1 }],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('配件');
  });
});
