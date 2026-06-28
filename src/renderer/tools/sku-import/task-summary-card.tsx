import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkuImportTaskSummary } from '@shared/types/sku-import';

import { formatTaskTime, taskStatusBadgeVariant, taskStatusLabel } from './task-status-labels';

interface TaskSummaryCardProps {
  task: SkuImportTaskSummary;
  executing: boolean;
  onExecute: () => void;
}

export function TaskSummaryCard({ task, executing, onExecute }: TaskSummaryCardProps) {
  const canExecute = task.status === 'previewed' && task.readyCount > 0 && !executing;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-sm">{task.fileName}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{formatTaskTime(task.createdAt)}</p>
        </div>
        <Badge variant={taskStatusBadgeVariant(task.status)}>{taskStatusLabel(task.status)}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          可执行 {task.readyCount} · 阻断 {task.blockedCount} · 跳过 {task.skippedCount} · 共{' '}
          {task.totalRows}
          {task.status === 'completed' && ` · 成功 ${task.succeededCount ?? 0}`}
        </p>
        {(task.failureMessage || task.verifyFailedCount) && (
          <p className="text-xs text-destructive">
            {[task.failureMessage, task.verifyFailedCount ? `验证未通过 ${task.verifyFailedCount} 条` : '']
              .filter(Boolean)
              .join('；')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!canExecute} onClick={onExecute}>
            <Play />
            {executing ? '执行中…' : '执行'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={`/tasks?expand=${task.taskId}`}>查看详情</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
