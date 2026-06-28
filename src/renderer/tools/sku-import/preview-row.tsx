import { Badge } from '@/components/ui/badge';
import type { SkuImportPreviewRow } from '@shared/types/sku-import';

import { rowStatusBadgeVariant, rowStatusLabel } from './task-status-labels';

export function PreviewRow({ row }: { row: SkuImportPreviewRow }) {
  const accessoryText =
    row.matchedAccessorySkus.length > 0
      ? row.matchedAccessorySkus.map((item) => `${item.name} → ${item.skuOuterId}`).join('、')
      : row.matchedAccessoryCodes.join('、');

  return (
    <div className="grid gap-3 border-b px-4 py-3 text-sm last:border-b-0 xl:grid-cols-[72px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_96px]">
      <div className="font-medium text-muted-foreground">第 {row.rowNumber} 行</div>
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium">{row.displayName || row.productName}</p>
        <p className="text-xs text-muted-foreground">
          {row.brand} · {row.capacity || '—'}
        </p>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate">
          <span className="text-muted-foreground">套装 </span>
          {row.proposedSkuCode}
        </p>
        <p className="truncate text-xs text-muted-foreground">贴纸 {row.stickerOuterId}</p>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 text-xs">{row.bundleTitle}</p>
        {accessoryText && (
          <p className="truncate text-xs text-muted-foreground">配件 {accessoryText}</p>
        )}
        {row.blockedReason && row.status !== 'pending' && (
          <p className="text-xs text-destructive">{row.blockedReason}</p>
        )}
      </div>
      <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
        <p>贴纸：{row.stickerCategory}</p>
        <p>套装：{row.bundleCategory}</p>
      </div>
      <div className="flex items-start justify-end xl:justify-center">
        <Badge variant={rowStatusBadgeVariant(row.status)}>{rowStatusLabel(row.status)}</Badge>
      </div>
    </div>
  );
}

export function PreviewRowTableHeader() {
  return (
    <div className="hidden border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground xl:grid xl:grid-cols-[72px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_96px]">
      <div>行号</div>
      <div>产品</div>
      <div>货号</div>
      <div>套装 / 配件</div>
      <div>分类</div>
      <div className="text-right xl:text-center">状态</div>
    </div>
  );
}
