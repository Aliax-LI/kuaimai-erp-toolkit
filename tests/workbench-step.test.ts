import { describe, expect, it } from 'vitest';

import { resolveWorkbenchStepFromSummary, resolveWorkbenchStepIndex } from '@shared/workbench-step';
import type { SkuImportTaskSummary } from '@shared/types/sku-import';

import { isErpConnected } from '../src/renderer/lib/connection-status';

describe('isErpConnected', () => {
  it('returns true when cookie and companyId configured', () => {
    expect(isErpConnected({ erpCookie: true, erpCompanyId: true })).toBe(true);
  });

  it('returns false when either missing', () => {
    expect(isErpConnected({ erpCookie: true, erpCompanyId: false })).toBe(false);
    expect(isErpConnected({ erpCookie: false, erpCompanyId: true })).toBe(false);
  });
});

describe('resolveWorkbenchStepFromSummary', () => {
  const base: SkuImportTaskSummary = {
    taskId: 't1',
    filePath: '/a.xlsx',
    fileName: 'a.xlsx',
    status: 'previewed',
    createdAt: '',
    updatedAt: '',
    totalRows: 1,
    readyCount: 1,
    blockedCount: 0,
    skippedCount: 0,
  };

  it('returns create for previewed task', () => {
    expect(resolveWorkbenchStepFromSummary(base)).toBe('create');
  });

  it('returns create for executing task', () => {
    expect(resolveWorkbenchStepFromSummary({ ...base, status: 'executing' })).toBe('create');
  });

  it('returns result for completed task', () => {
    expect(
      resolveWorkbenchStepFromSummary({ ...base, status: 'completed', succeededCount: 1 }),
    ).toBe('result');
  });

  it('returns result for failed task', () => {
    expect(resolveWorkbenchStepFromSummary({ ...base, status: 'failed' })).toBe('result');
  });

  it('maps step to 1-based index', () => {
    expect(resolveWorkbenchStepIndex('import')).toBe(1);
    expect(resolveWorkbenchStepIndex('result')).toBe(3);
  });
});
