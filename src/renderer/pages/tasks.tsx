import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Play, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { PagePanelBody, PageSurface } from '@/components/layout/page-canvas/PageCanvas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSkuImportTasks } from '@/hooks/use-sku-import-tasks';
import { cn } from '@/lib/utils';
import { logRenderer } from '@/lib/kuaimai-client';
import { TaskDetailPanel } from '@/tools/sku-import/task-detail-panel';
import {
  formatTaskTime,
  taskStatusBadgeVariant,
  taskStatusLabel,
} from '@/tools/sku-import/task-status-labels';
import type { SkuImportTaskDetail } from '@shared/types/sku-import';

export function TaskListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const expandParam = searchParams.get('expand');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(expandParam);
  const [details, setDetails] = useState<Record<string, SkuImportTaskDetail>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { tasks, executingTaskId, refreshTasks, loadTaskDetail, executeTask, deleteTask } =
    useSkuImportTasks();

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      await refreshTasks();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setLoadError(text);
      logRenderer('error', 'tasks', 'list tasks failed', { error: text });
    }
  }, [refreshTasks]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (expandParam) {
      setExpandedTaskId(expandParam);
      if (!details[expandParam]) {
        void loadTaskDetail(expandParam)
          .then((detail) => {
            setDetails((prev) => ({ ...prev, [expandParam]: detail }));
          })
          .catch((err) => {
            const text = err instanceof Error ? err.message : String(err);
            setMessage(`加载任务失败：${text}`);
          });
      }
    }
  }, [expandParam, details, loadTaskDetail]);

  const handleToggle = async (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setSearchParams({});
      return;
    }

    setExpandedTaskId(taskId);
    setSearchParams({ expand: taskId });
    if (!details[taskId]) {
      try {
        const detail = await loadTaskDetail(taskId);
        setDetails((prev) => ({ ...prev, [taskId]: detail }));
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        setMessage(`加载任务失败：${text}`);
      }
    }
  };

  const handleExecute = async (taskId: string) => {
    setMessage(null);
    try {
      const detail = await executeTask(taskId);
      setDetails((prev) => ({ ...prev, [taskId]: detail }));
      setMessage(
        `执行完成：成功 ${detail.executeResult?.succeededCount ?? 0}，失败 ${detail.executeResult?.failedCount ?? 0}，跳过 ${detail.executeResult?.skippedCount ?? 0}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage(`执行失败：${text}`);
      try {
        const detail = await loadTaskDetail(taskId);
        setDetails((prev) => ({ ...prev, [taskId]: detail }));
      } catch {
        // ignore reload failure
      }
    }
  };

  const handleDelete = async (taskId: string) => {
    setMessage(null);
    try {
      await deleteTask(taskId);
      setDetails((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      if (expandedTaskId === taskId) {
        setExpandedTaskId(null);
        setSearchParams({});
      }
      setMessage('任务已删除');
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage(`删除失败：${text}`);
    }
  };

  return (
    <PageSurface>
      <PagePanelBody className="flex min-h-0 flex-1 flex-col gap-4">
        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription className="flex items-center gap-3">
              <span>{loadError}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void reload()}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            暂无任务，请在工作台导入 Excel 并预演
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
            {tasks.map((task) => {
              const isExpanded = expandedTaskId === task.taskId;
              const isExecuting = executingTaskId === task.taskId || task.status === 'executing';
              const canExecute = task.status === 'previewed' && task.readyCount > 0 && !isExecuting;

              return (
                <div key={task.taskId} className="rounded-lg border bg-card">
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                      onClick={() => void handleToggle(task.taskId)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">{task.fileName}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={taskStatusBadgeVariant(task.status)}>
                            {taskStatusLabel(task.status)}
                          </Badge>
                          <ChevronDown
                            className={cn(
                              'size-4 text-muted-foreground transition-transform',
                              isExpanded && 'rotate-180',
                            )}
                          />
                        </div>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{task.filePath}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTaskTime(task.createdAt)} · 可执行 {task.readyCount} / 共{' '}
                        {task.totalRows}
                        {task.status === 'completed' && ` · 成功 ${task.succeededCount ?? 0}`}
                      </p>
                      {(task.failureMessage || task.verifyFailedCount) && (
                        <p className="line-clamp-2 text-xs text-destructive">
                          {[task.failureMessage, task.verifyFailedCount ? `验证未通过 ${task.verifyFailedCount} 条` : '']
                            .filter(Boolean)
                            .join('；')}
                        </p>
                      )}
                    </button>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canExecute}
                        onClick={() => void handleExecute(task.taskId)}
                      >
                        <Play />
                        {isExecuting ? '执行中…' : '执行'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isExecuting}
                        onClick={() => void handleDelete(task.taskId)}
                      >
                        <Trash2 />
                        删除
                      </Button>
                    </div>
                  </div>
                  {isExpanded && details[task.taskId] && (
                    <div className="border-t p-4">
                      <TaskDetailPanel detail={details[task.taskId]} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </PagePanelBody>
    </PageSurface>
  );
}
