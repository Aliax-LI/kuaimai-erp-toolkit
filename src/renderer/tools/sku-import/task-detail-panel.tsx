import { useMemo, useState } from 'react';
import { CircleCheckBig, CircleX } from 'lucide-react';

import { CopyButton } from '@/components/shared/copy-button';
import { SegmentedControl } from '@/components/shared/segmented-control';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  previewRowBundleCode,
  previewRowReason,
  previewRowStatusTone,
  rowStatusLabel,
} from '@/tools/sku-import/task-status-labels';
import type { SkuImportTaskDetail } from '@shared/types/sku-import';
import { summarizeSkuImportExecuteRows } from '@shared/types/sku-import';

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
    const resultByRow = new Map(executeResult.rows.map((row) => [row.rowNumber, row]));

    return detail.preview.rows
      .map((previewRow) => {
        const row = resultByRow.get(previewRow.rowNumber);
        const status = row?.status ?? previewRow.status;
        return {
          rowNumber: previewRow.rowNumber,
          skuCode: row?.skuCode ?? previewRow.proposedSkuCode,
          status,
          failureReason:
            row?.failureReason ??
            previewRow.blockedReason ??
            (status === 'succeeded' ? '' : '未创建成功'),
          brand: previewRow.brand || '—',
          productName: previewRow.productName || previewRow.displayName || '—',
          stickerCode: previewRow.stickerOuterId || previewRow.proposedSkuCode || row?.skuCode || '—',
          bundleCode: previewRow.proposedSkuCode || row?.skuCode || '—',
          detailText:
            row?.failureReason ||
            previewRow.blockedReason ||
            (status === 'succeeded' ? '创建成功' : '—'),
        };
      })
      .filter((row) =>
        filter === 'success' ? row.status === 'succeeded' : row.status !== 'succeeded',
      );
  }, [detail.preview.rows, executeResult, filter]);

  if (executeResult) {
    const summary = summarizeSkuImportExecuteRows(executeResult.rows, detail.totalRows);

    return (
      <div className="min-w-0 space-y-4 bg-cream/40 p-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="成功"
            value={summary.succeededCount}
            icon={CircleCheckBig}
            tone="success"
          />
          <StatCard label="失败" value={summary.failedCount} icon={CircleX} tone="danger" />
          <StatCard label="总计" value={detail.totalRows} tone="neutral" />
        </div>

        <SegmentedControl
          options={[
            { value: 'success' as const, label: `成功 (${summary.succeededCount})` },
            { value: 'failed' as const, label: `失败 (${summary.failedCount})` },
          ]}
          value={filter}
          onChange={setFilter}
        />

        <div className="max-h-72 overflow-x-auto overflow-y-auto border border-beige bg-cream scrollbar-thin">
          <table className="w-full min-w-[56rem] table-fixed text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="w-12 px-3 py-2 text-left text-xs font-medium text-brown-soft">行</th>
                <th className="w-[9%] px-3 py-2 text-left text-xs font-medium text-brown-soft">品牌</th>
                <th className="w-[16%] px-3 py-2 text-left text-xs font-medium text-brown-soft">产品</th>
                <th className="w-[14%] px-3 py-2 text-left text-xs font-medium text-brown-soft">贴纸货号</th>
                <th className="w-[14%] px-3 py-2 text-left text-xs font-medium text-brown-soft">套装货号</th>
                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-brown-soft">状态</th>
                <th className="w-[22%] px-3 py-2 text-left text-xs font-medium text-brown-soft">说明</th>
                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-brown-soft">操作</th>
              </tr>
            </thead>
            <tbody>
              {executeRows.map((row) => (
                <tr key={row.rowNumber} className="border-b border-beige/50 hover:bg-cream-warm/30">
                  <td className="px-3 py-2 text-brown-soft">{row.rowNumber}</td>
                  <td className="truncate px-3 py-2 font-medium">{row.brand}</td>
                  <td className="truncate px-3 py-2">{row.productName}</td>
                  <td className="truncate px-3 py-2 font-mono text-xs text-brown-soft">{row.stickerCode}</td>
                  <td
                    className="truncate px-3 py-2 font-mono text-xs text-brown-soft"
                    title={row.bundleCode !== '—' ? row.bundleCode : undefined}
                  >
                    {row.bundleCode}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={executeRowStatusTone(row.status)}>
                      {rowStatusLabel(row.status)}
                    </StatusBadge>
                  </td>
                  <td className="truncate px-3 py-2 text-xs text-brown-soft" title={row.detailText}>
                    {row.detailText}
                  </td>
                  <td className="px-3 py-2">
                    <CopyButton text={row.bundleCode} />
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
    <div className="min-w-0 space-y-4 bg-cream/40 p-4">
      <p className="text-sm text-brown-soft">
        可创建 {detail.readyCount} 条
        {detail.blockedCount > 0 && ` · 待修复 ${detail.blockedCount} 条`}
        {detail.skippedCount > 0 && ` · 将跳过 ${detail.skippedCount} 条`}
        {' · '}共 {detail.totalRows} 行
        {detail.status === 'previewed' && ' · 尚未执行创建'}
      </p>

      <div className="max-h-72 overflow-x-auto overflow-y-auto border border-beige bg-cream scrollbar-thin">
        <table className="w-full min-w-[48rem] table-fixed text-sm">
          <thead>
            <tr className="border-b border-beige bg-cream/50">
              <th className="w-12 px-3 py-2 text-left text-xs font-medium text-brown-soft">行</th>
              <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-brown-soft">品牌</th>
              <th className="w-[18%] px-3 py-2 text-left text-xs font-medium text-brown-soft">产品</th>
              <th className="w-[14%] px-3 py-2 text-left text-xs font-medium text-brown-soft">套装货号</th>
              <th className="w-[14%] px-3 py-2 text-left text-xs font-medium text-brown-soft">贴纸货号</th>
              <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-brown-soft">状态</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">说明</th>
            </tr>
          </thead>
          <tbody>
            {detail.preview.rows.map((row) => {
              const bundleCode = previewRowBundleCode(row);
              const reason = previewRowReason(row);
              return (
              <tr key={row.rowNumber} className="border-b border-beige/50 hover:bg-cream-warm/30">
                <td className="px-3 py-2 text-brown-soft">{row.rowNumber}</td>
                <td className="truncate px-3 py-2 font-medium">{row.brand || '—'}</td>
                <td className="truncate px-3 py-2">{row.productName || row.displayName || '—'}</td>
                <td
                  className="truncate px-3 py-2 font-mono text-xs text-brown-soft"
                  title={bundleCode !== '—' ? bundleCode : undefined}
                >
                  {bundleCode}
                </td>
                <td className="truncate px-3 py-2 font-mono text-xs text-brown-soft">
                  {row.stickerOuterId || '—'}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge tone={previewRowStatusTone(row.status)}>
                    {rowStatusLabel(row.status)}
                  </StatusBadge>
                </td>
                <td className="truncate px-3 py-2 text-xs text-brown-soft" title={reason}>
                  {reason}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
