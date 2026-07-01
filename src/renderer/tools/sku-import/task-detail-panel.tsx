import { useMemo, useState } from 'react';
import { CircleCheckBig, CircleX } from 'lucide-react';

import { CopyButton } from '@/components/shared/copy-button';
import { SegmentedControl } from '@/components/shared/segmented-control';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  previewRowReason,
  previewRowStatusTone,
  rowStatusLabel,
} from '@/tools/sku-import/task-status-labels';
import type { SkuImportTaskDetail } from '@shared/types/sku-import';

type ExecuteFilter = 'success' | 'failed';

function executeRowStatusTone(status: string) {
  switch (status) {
    case 'succeeded':
      return 'success' as const;
    case 'failed':
      return 'danger' as const;
    case 'skipped_existing':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}

export function SkuImportTaskDetailPanel({ detail }: { detail: SkuImportTaskDetail }) {
  const executeResult = detail.executeResult;
  const [filter, setFilter] = useState<ExecuteFilter>('success');

  const executeRows = useMemo(() => {
    if (!executeResult) {
      return [];
    }
    return executeResult.rows
      .map((row) => {
        const previewRow = detail.preview.rows.find((item) => item.rowNumber === row.rowNumber);
        return {
          ...row,
          brand: previewRow?.brand ?? '—',
          productName: previewRow?.productName ?? previewRow?.displayName ?? '—',
          stickerCode: previewRow?.stickerOuterId || previewRow?.proposedSkuCode || row.skuCode,
          bundleCode: previewRow?.proposedSkuCode || row.skuCode,
          detailText: row.failureReason || (row.status === 'succeeded' ? '创建成功' : '—'),
        };
      })
      .filter((row) =>
        filter === 'success' ? row.status === 'succeeded' : row.status === 'failed',
      );
  }, [detail.preview.rows, executeResult, filter]);

  if (executeResult) {
    const totalCount =
      executeResult.succeededCount + executeResult.failedCount + executeResult.skippedCount;

    return (
      <div className="space-y-4 bg-cream/40 p-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="成功"
            value={executeResult.succeededCount}
            icon={CircleCheckBig}
            tone="success"
          />
          <StatCard label="失败" value={executeResult.failedCount} icon={CircleX} tone="danger" />
          <StatCard label="总计" value={totalCount || detail.totalRows} tone="neutral" />
        </div>

        <SegmentedControl
          options={[
            { value: 'success' as const, label: `成功 (${executeResult.succeededCount})` },
            { value: 'failed' as const, label: `失败 (${executeResult.failedCount})` },
          ]}
          value={filter}
          onChange={setFilter}
        />

        <div className="max-h-72 overflow-y-auto rounded-lg border border-beige bg-cream scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">行</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">品牌</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">产品</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">贴纸货号</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">套装货号</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">状态</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">说明</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">操作</th>
              </tr>
            </thead>
            <tbody>
              {executeRows.map((row) => (
                <tr key={row.rowNumber} className="border-b border-beige/50 hover:bg-cream-warm/30">
                  <td className="px-3 py-2 text-brown-soft">{row.rowNumber}</td>
                  <td className="px-3 py-2 font-medium">{row.brand}</td>
                  <td className="px-3 py-2">{row.productName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-brown-soft">{row.stickerCode}</td>
                  <td className="px-3 py-2 font-mono text-xs text-brown-soft">{row.bundleCode}</td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={executeRowStatusTone(row.status)}>
                      {rowStatusLabel(row.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-xs text-brown-soft">{row.detailText}</td>
                  <td className="px-3 py-2">
                    <CopyButton text={row.stickerCode} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {executeRows.length === 0 && (
            <div className="py-8 text-center text-sm text-brown-soft">
              {filter === 'success' ? '暂无成功记录' : '暂无失败记录'}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-cream/40 p-4">
      <p className="text-sm text-brown-soft">
        可执行 {detail.readyCount} 条
        {detail.blockedCount > 0 && ` · 阻断 ${detail.blockedCount} 条`}
        {detail.skippedCount > 0 && ` · 跳过 ${detail.skippedCount} 条`}
        {' · '}共 {detail.totalRows} 行
        {detail.status === 'previewed' && ' · 尚未执行创建'}
      </p>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-beige bg-cream scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-cream/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">行</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">品牌</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">产品</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">状态</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">说明</th>
            </tr>
          </thead>
          <tbody>
            {detail.preview.rows.map((row) => (
              <tr key={row.rowNumber} className="border-b border-beige/50 hover:bg-cream-warm/30">
                <td className="px-3 py-2 text-brown-soft">{row.rowNumber}</td>
                <td className="px-3 py-2 font-medium">{row.brand || '—'}</td>
                <td className="px-3 py-2">{row.productName || row.displayName || '—'}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={previewRowStatusTone(row.status)}>
                    {rowStatusLabel(row.status)}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-xs text-brown-soft">{previewRowReason(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
