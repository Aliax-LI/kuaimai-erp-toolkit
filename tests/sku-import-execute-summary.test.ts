import { describe, expect, it } from 'vitest';

import { summarizeSkuImportExecuteRows } from '@shared/types/sku-import';

describe('summarizeSkuImportExecuteRows', () => {
  it('counts all non-succeeded rows as failed', () => {
    const summary = summarizeSkuImportExecuteRows([
      { status: 'succeeded' },
      { status: 'failed' },
      { status: 'skipped_existing' },
      { status: 'preview_blocked' },
    ]);

    expect(summary).toEqual({
      succeededCount: 1,
      failedCount: 3,
      skippedCount: 1,
    });
  });

  it('uses totalRows when execute rows are incomplete', () => {
    const summary = summarizeSkuImportExecuteRows([{ status: 'succeeded' }], 2);

    expect(summary).toEqual({
      succeededCount: 1,
      failedCount: 1,
      skippedCount: 0,
    });
  });
});
