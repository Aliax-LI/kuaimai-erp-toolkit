import { Fragment, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, FileSpreadsheet, Search, Trash2 } from 'lucide-react';

import { Modal } from '@/components/shared/modal';
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
  const { tasks, refreshTasks, loadTaskDetail, exportResults, deleteTask } = useSkuImportTasks();
  const [query, setQuery] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, SkuImportTaskDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<SkuImportTaskSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleExportResults = async (taskId: string) => {
    try {
      const filePath = await exportResults(taskId);
      if (filePath) {
        toast('结果 Excel 已导出');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '导出失败');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) {
      return;
    }
    const { taskId } = taskToDelete;
    setDeleting(true);
    try {
      await deleteTask(taskId);
      if (expandedTaskId === taskId) {
        setExpandedTaskId(null);
      }
      setDetailById((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      toast('已删除');
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
      setTaskToDelete(null);
    }
  };

  return (
    <div className="min-w-0 w-full space-y-5">
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

      <div className="overflow-hidden border border-beige bg-cream-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] table-fixed text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="w-[12%] px-4 py-3 text-left font-medium text-brown-soft">时间</th>
                <th className="w-[22%] px-4 py-3 text-left font-medium text-brown-soft">文件名</th>
                <th className="w-[8%] px-4 py-3 text-left font-medium text-brown-soft">操作</th>
                <th className="w-[8%] px-4 py-3 text-left font-medium text-brown-soft">行数</th>
                <th className="w-[8%] px-4 py-3 text-left font-medium text-brown-soft">成功</th>
                <th className="w-[8%] px-4 py-3 text-left font-medium text-brown-soft">失败</th>
                <th className="w-[12%] px-4 py-3 text-left font-medium text-brown-soft">状态</th>
                <th className="w-[14%] px-4 py-3 text-left font-medium text-brown-soft">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <Fragment key={task.taskId}>
                  <tr className="border-b border-beige/50 hover:bg-cream-warm/30">
                    <td className="px-4 py-3 whitespace-nowrap">{formatTaskTime(task.createdAt)}</td>
                    <td className="truncate px-4 py-3 font-medium" title={task.fileName}>
                      {task.fileName}
                    </td>
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
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-sm text-amber transition-colors hover:text-amber-dark"
                          onClick={() => void handleToggleView(task)}
                        >
                          {expandedTaskId === task.taskId ? '收起' : '查看'}
                        </button>
                        <button
                          type="button"
                          className="text-brown-soft transition-colors hover:text-status-danger"
                          title="删除"
                          onClick={() => setTaskToDelete(task)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedTaskId === task.taskId && (
                    <tr className="border-b border-beige/50 bg-cream/30">
                      <td colSpan={8} className="px-0 py-0">
                        {loadingDetailId === task.taskId ? (
                          <div className="py-8 text-center text-sm text-brown-soft">加载中…</div>
                        ) : detailById[task.taskId] ? (
                          <div className="space-y-3 p-4">
                            <SkuImportTaskDetailPanel detail={detailById[task.taskId]} />
                            {detailById[task.taskId].executeResult && (
                              <Button
                                type="button"
                                className="px-3 py-2"
                                onClick={() => void handleExportResults(task.taskId)}
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                                导出结果Excel
                              </Button>
                            )}
                          </div>
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

      <Modal
        open={taskToDelete !== null}
        title="删除记录"
        onClose={() => {
          if (!deleting) {
            setTaskToDelete(null);
          }
        }}
      >
        <p className="text-sm text-brown-soft">
          确定要删除「{taskToDelete?.fileName}」这条历史记录吗？此操作不可恢复。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={deleting}
            onClick={() => setTaskToDelete(null)}
          >
            取消
          </Button>
          <Button type="button" variant="dark" disabled={deleting} onClick={() => void handleDeleteConfirm()}>
            删除
          </Button>
        </div>
      </Modal>
    </div>
  );
}
