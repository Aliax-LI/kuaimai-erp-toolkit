import { useCallback, useEffect, useState } from 'react';

import { kuaimai } from '@/lib/kuaimai-client';
import type {
  SkuImportExecuteProgress,
  SkuImportPreviewProgress,
  SkuImportTaskDetail,
  SkuImportTaskSummary,
} from '@shared/types/sku-import';

export function useSkuImportTasks() {
  const [tasks, setTasks] = useState<SkuImportTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState<SkuImportPreviewProgress | null>(null);
  const [executeProgress, setExecuteProgress] = useState<SkuImportExecuteProgress | null>(null);

  useEffect(() => {
    try {
      return kuaimai.skuImport.onPreviewProgress((progress) => {
        setPreviewProgress(progress);
      });
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    try {
      return kuaimai.skuImport.onExecuteProgress((progress) => {
        setExecuteProgress(progress);
      });
    } catch {
      return undefined;
    }
  }, []);

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
      setExecuteProgress({
        stage: 'preparing',
        taskId,
        percent: 1,
        message: '正在准备创建任务',
      });
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
      setPreviewProgress({
        filePath,
        stage: 'reading',
        percent: 1,
        message: '准备预演 Excel',
      });
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

  const exportResults = useCallback(async (taskId: string) => {
    return kuaimai.skuImport.exportResults(taskId);
  }, []);

  return {
    tasks,
    loading,
    previewProgress,
    executeProgress,
    executingTaskId,
    refreshTasks,
    loadTaskDetail,
    executeTask,
    deleteTask,
    previewFile,
    exportResults,
  };
}
