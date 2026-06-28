import { useCallback, useState } from 'react';

import { kuaimai } from '@/lib/kuaimai-client';
import type { SkuImportTaskDetail, SkuImportTaskSummary } from '@shared/types/sku-import';

export function useSkuImportTasks() {
  const [tasks, setTasks] = useState<SkuImportTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    const list = await kuaimai.skuImport.listTasks();
    setTasks(list);
    return list;
  }, []);

  const loadTaskDetail = useCallback(async (taskId: string): Promise<SkuImportTaskDetail> => {
    return kuaimai.skuImport.getTask(taskId);
  }, []);

  const executeTask = useCallback(
    async (taskId: string) => {
      setExecutingTaskId(taskId);
      try {
        const detail = await kuaimai.skuImport.execute(taskId);
        await refreshTasks();
        return detail;
      } finally {
        setExecutingTaskId(null);
      }
    },
    [refreshTasks],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await kuaimai.skuImport.deleteTask(taskId);
      return refreshTasks();
    },
    [refreshTasks],
  );

  const previewFile = useCallback(
    async (filePath: string) => {
      setLoading(true);
      try {
        const detail = await kuaimai.skuImport.preview(filePath);
        await refreshTasks();
        return detail;
      } finally {
        setLoading(false);
      }
    },
    [refreshTasks],
  );

  return {
    tasks,
    loading,
    executingTaskId,
    refreshTasks,
    loadTaskDetail,
    executeTask,
    deleteTask,
    previewFile,
  };
}
