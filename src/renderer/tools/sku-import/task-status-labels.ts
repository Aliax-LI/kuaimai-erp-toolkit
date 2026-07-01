import type { SkuImportPreviewRow, SkuImportTaskStatus } from '@shared/types/sku-import';

export function rowStatusLabel(status: SkuImportPreviewRow['status']): string {
  switch (status) {
    case 'pending':
      return '可执行';
    case 'preview_blocked':
      return '已阻断';
    case 'skipped_existing':
      return '将跳过';
    case 'succeeded':
      return '已成功';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}

export type PreviewRowStatusTone = 'success' | 'danger' | 'warning' | 'neutral' | 'progress';

export function previewRowStatusTone(status: SkuImportPreviewRow['status']): PreviewRowStatusTone {
  switch (status) {
    case 'pending':
      return 'success';
    case 'preview_blocked':
    case 'failed':
      return 'danger';
    case 'skipped_existing':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function previewRowReason(row: SkuImportPreviewRow): string {
  if (row.status === 'preview_blocked') {
    return row.blockedReason ?? '预演未通过';
  }
  if (row.status === 'skipped_existing') {
    const sku = row.existingSkuCode ?? row.proposedSkuCode;
    return row.blockedReason ?? (sku ? `ERP 中已存在套装货号 ${sku}` : 'ERP 中已存在套装货号');
  }
  if (row.status === 'pending') {
    if (row.blockedReason) {
      return row.blockedReason;
    }
    return `将创建套装 ${row.proposedSkuCode}`;
  }
  return row.blockedReason ?? '—';
}

export function rowStatusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'succeeded':
    case 'skipped_existing':
      return 'default';
    case 'failed':
    case 'preview_blocked':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function taskStatusLabel(status: SkuImportTaskStatus): string {
  switch (status) {
    case 'previewed':
      return '已预演';
    case 'executing':
      return '执行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '执行失败';
    default:
      return status;
  }
}

export function taskStatusBadgeVariant(
  status: SkuImportTaskStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'previewed':
      return 'secondary';
    case 'executing':
      return 'outline';
    case 'completed':
      return 'default';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function formatTaskTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
