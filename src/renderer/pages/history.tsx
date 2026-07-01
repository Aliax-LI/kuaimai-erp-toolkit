import { Fragment, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, Search } from 'lucide-react';

import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSkuImportTasks } from '@/hooks/use-sku-import-tasks';
import { SkuImportTaskDetailPanel } from '@/tools/sku-import/task-detail-panel';
import {
  formatTaskTime,
  taskStatusLabel,
} from '@/tools/sku-import/task-status-labels';
import type { SkuImportTaskDetail, SkuImportTaskSummary } from '@shared/types/sku-import';

function taskStatusTone(status: SkuImportTaskSummary['status']) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'failed':
      return 'danger' as const;
    case 'executing':
      return 'progress' as const;
    default:
      return 'neutral' as const;
  }
}

export function HistoryPage() {
  const { toast } = useToast();
  const { tasks, refreshTasks, loadTaskDetail } = useSkuImportTasks();
  const [query, setQuery] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, SkuImportTaskDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return tasks;
    }
    return tasks.filter(
      (task) => task.fileName.toLowerCase().includes(q) || task.taskId.toLowerCase().includes(q),
    );
  }, [query, tasks]);

  const handleToggleView = async (task: SkuImportTaskSummary) => {
    if (expandedTaskId === task.taskId) {
      setExpandedTaskId(null);
      return;
    }

    setExpandedTaskId(task.taskId);
    if (detailById[task.taskId]) {
      return;
    }

    setLoadingDetailId(task.taskId);
    try {
      const detail = await loadTaskDetail(task.taskId);
      setDetailById((prev) => ({ ...prev, [task.taskId]: detail }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(message);
      setExpandedTaskId(null);
    } finally {
      setLoadingDetailId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-medium text-charcoal">历史记录</h2>
        <p className="mt-1 text-sm text-brown-soft">查看所有操作历史</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-soft" />
          <Input
            className="pl-9"
            placeholder="搜索文件名..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button variant="secondary" className="px-3 py-2" onClick={() => toast('即将支持')}>
          <Calendar className="h-4 w-4 text-brown-soft" />
          时间范围
          <ChevronDown className="h-3.5 w-3.5 text-brown-soft" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-beige bg-cream-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="px-4 py-3 text-left font-medium text-brown-soft">时间</th>
                <th className="px-4 py-3 text-left font-medium text-brown-soft">文件名</th>
                <th className="px-4 py-3 text-left font-medium text-brown-soft">操作</th>
                <th className="px-4 py-3 text-left font-medium text-brown-soft">行数</th>
                <th className="px-4 py-3 text-left font-medium text-brown-soft">成功</th>
                <th className="px-4 py-3 text-left font-medium text-brown-soft">失败</th>
                <th className="px-4 py-3 text-left font-medium text-brown-soft">状态</th>
                <th className="px-4 py-3 text-left font-medium text-brown-soft">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <Fragment key={task.taskId}>
                  <tr className="border-b border-beige/50 hover:bg-cream-warm/30">
                    <td className="px-4 py-3">{formatTaskTime(task.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{task.fileName}</td>
                    <td className="px-4 py-3">导入</td>
                    <td className="px-4 py-3">{task.totalRows}</td>
                    <td className="px-4 py-3">{task.succeededCount ?? '—'}</td>
                    <td className="px-4 py-3">{task.failedCount ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={taskStatusTone(task.status)}>
                        {taskStatusLabel(task.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-sm text-amber transition-colors hover:text-amber-dark"
                        onClick={() => void handleToggleView(task)}
                      >
                        {expandedTaskId === task.taskId ? '收起' : '查看'}
                      </button>
                    </td>
                  </tr>
                  {expandedTaskId === task.taskId && (
                    <tr className="border-b border-beige/50 bg-cream/30">
                      <td colSpan={8} className="px-0 py-0">
                        {loadingDetailId === task.taskId ? (
                          <div className="py-8 text-center text-sm text-brown-soft">加载中…</div>
                        ) : detailById[task.taskId] ? (
                          <SkuImportTaskDetailPanel detail={detailById[task.taskId]} />
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-brown-soft">暂无历史记录</div>
        )}
      </div>
    </div>
  );
}
