import { describe, expect, it } from 'vitest';

import {
  previewRowBundleCode,
  previewRowReason,
  previewRowStatusTone,
  rowStatusLabel,
} from '../src/renderer/tools/sku-import/task-status-labels';
import type { SkuImportPreviewRow } from '../src/shared/types/sku-import';

function baseRow(overrides: Partial<SkuImportPreviewRow>): SkuImportPreviewRow {
  return {
    rowNumber: 2,
    businessKey: 'k',
    brand: 'WKAU',
    productName: '测试产品',
    capacity: '30ml',
    stickerCode: 's1',
    displayName: '测试',
    accessories: [],
    proposedSkuCode: 'test-69-39-ITEM001',
    status: 'pending',
    stickerTitle: '',
    bundleTitle: '',
    matchedAccessoryCodes: [],
    missingAccessoryNames: [],
    productOriginalOuterId: 'YP-01',
    stickerOuterId: 'test-69-39-ITEM001-ST',
    matchedAccessorySkus: [],
    bundleCategory: '',
    stickerCategory: '',
    stickerUnit: '张',
    ...overrides,
  };
}

describe('preview row labels', () => {
  it('rowStatusLabel 应映射预演状态', () => {
    expect(rowStatusLabel('pending')).toBe('可创建');
    expect(rowStatusLabel('preview_blocked')).toBe('待修复');
    expect(rowStatusLabel('skipped_existing')).toBe('将跳过');
  });

  it('previewRowReason 应返回阻断或跳过原因', () => {
    expect(
      previewRowReason(
        baseRow({
          status: 'preview_blocked',
          blockedReason: '未匹配配件: 说明书',
        }),
      ),
    ).toBe('未匹配配件: 说明书');

    expect(
      previewRowReason(
        baseRow({
          status: 'preview_blocked',
          proposedSkuCode: 'test-69-WKAU-001',
          blockedReason: 'ERP 中已存在套装货号，不允许导入',
        }),
      ),
    ).toBe('ERP 中已存在套装货号，不允许导入');

    expect(
      previewRowBundleCode(
        baseRow({
          status: 'skipped_existing',
          proposedSkuCode: '69-39-Ttest0628',
          existingSkuCode: '69-39-Ttest0628',
        }),
      ),
    ).toBe('69-39-Ttest0628');
  });

  it('previewRowStatusTone 应按状态分配色调', () => {
    expect(previewRowStatusTone('pending')).toBe('success');
    expect(previewRowStatusTone('preview_blocked')).toBe('danger');
    expect(previewRowStatusTone('skipped_existing')).toBe('warning');
  });
});
