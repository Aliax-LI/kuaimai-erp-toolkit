import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkuImportTaskDetail } from '@shared/types/sku-import';

import { PreviewRow, PreviewRowTableHeader } from './preview-row';

export function TaskDetailPanel({ detail }: { detail: SkuImportTaskDetail }) {
  const preview = detail.preview;
  const executeResult = detail.executeResult ?? null;

  const executableRows = useMemo(
    () => preview.rows.filter((row) => row.status === 'pending'),
    [preview.rows],
  );
  const blockedRows = useMemo(
    () => preview.rows.filter((row) => row.status === 'preview_blocked'),
    [preview.rows],
  );
  const skippedRows = useMemo(
    () => preview.rows.filter((row) => row.status === 'skipped_existing'),
    [preview.rows],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-sm">总行数：{detail.totalRows}</CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-sm">可执行：{detail.readyCount}</CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-sm">阻断：{detail.blockedCount}</CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-sm">跳过：{detail.skippedCount}</CardContent>
        </Card>
      </div>

      <Card className="min-h-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-sm">可执行记录</CardTitle>
            <p className="mt-1 truncate text-xs text-muted-foreground">{detail.filePath}</p>
          </div>
          <Badge variant={executableRows.length > 0 ? 'default' : 'secondary'}>
            {executableRows.length} 条
          </Badge>
        </CardHeader>
        <CardContent className="min-h-0 p-0">
          {executableRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              该任务没有可执行记录
            </div>
          ) : (
            <div className="max-h-[min(480px,50vh)] overflow-auto">
              <PreviewRowTableHeader />
              {executableRows.map((row) => (
                <PreviewRow key={row.rowNumber} row={row} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(blockedRows.length > 0 || skippedRows.length > 0) && (
        <Card className="min-h-0">
          <CardHeader>
            <CardTitle className="text-sm">其他记录</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-0">
            {blockedRows.map((row) => (
              <PreviewRow key={row.rowNumber} row={row} />
            ))}
            {skippedRows.map((row) => (
              <PreviewRow key={row.rowNumber} row={row} />
            ))}
          </CardContent>
        </Card>
      )}

      {executeResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">执行结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              成功 {executeResult.succeededCount} · 失败 {executeResult.failedCount} · 跳过{' '}
              {executeResult.skippedCount}。结果已写回原 Excel。
            </p>
            <div className="divide-y rounded-md border">
              {executeResult.rows.map((row) => (
                <div key={row.rowNumber} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      第 {row.rowNumber} 行 · {row.skuCode}
                    </span>
                    <Badge
                      variant={
                        row.verifyOk === false
                          ? 'destructive'
                          : row.status === 'failed'
                            ? 'destructive'
                            : 'default'
                      }
                    >
                      {row.status}
                      {row.verifyOk === false
                        ? ' / 验证未通过'
                        : row.verifyOk
                          ? ' / 已验证'
                          : ''}
                    </Badge>
                  </div>
                  {row.failureReason && (
                    <p className="text-xs text-destructive">{row.failureReason}</p>
                  )}
                  {row.verifySteps?.map((step) => (
                    <p
                      key={step.label}
                      className={step.ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}
                    >
                      {step.ok ? '✓' : '✗'} {step.label}: {step.detail}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
