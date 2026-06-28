import { useEffect, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PagePanelBody, PageSurface } from '@/components/layout/page-canvas/PageCanvas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSkuImportTasks } from '@/hooks/use-sku-import-tasks';
import { kuaimai, logRenderer } from '@/lib/kuaimai-client';
import { TaskSummaryCard } from '@/tools/sku-import/task-summary-card';

export function WorkbenchPage() {
  const { tasks, loading, executingTaskId, refreshTasks, executeTask, previewFile } =
    useSkuImportTasks();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const latestTask = tasks[0] ?? null;

  useEffect(() => {
    void refreshTasks().catch((err) => {
      logRenderer('error', 'workbench', 'list tasks failed', { error: String(err) });
    });
  }, [refreshTasks]);

  const handlePickFile = async () => {
    setMessage(null);
    const picked = await kuaimai.skuImport.pickFile();
    if (!picked) {
      return;
    }
    setFilePath(picked);
  };

  const handlePreview = async () => {
    if (!filePath) {
      setMessage('请先选择 Excel 文件');
      return;
    }

    setMessage(null);
    try {
      const detail = await previewFile(filePath);
      setMessage(`已创建预演任务，可执行 ${detail.readyCount} 条`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      logRenderer('error', 'workbench', 'preview failed', { error: text });
      setMessage(`预演失败：${text}`);
    }
  };

  const handleExecute = async () => {
    if (!latestTask) {
      return;
    }
    setMessage(null);
    try {
      const detail = await executeTask(latestTask.taskId);
      setMessage(
        `执行完成：成功 ${detail.executeResult?.succeededCount ?? 0}，失败 ${detail.executeResult?.failedCount ?? 0}，跳过 ${detail.executeResult?.skippedCount ?? 0}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage(`执行失败：${text}`);
    }
  };

  const showSettingsHint = message?.includes('设置') || message?.includes('Cookie');

  return (
    <PageSurface>
      <PagePanelBody className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">导入 Excel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-sm">{filePath ?? '尚未选择文件'}</p>
              <p className="text-xs text-muted-foreground">支持工作表「待创建货号记录」</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handlePickFile()}>
                <Upload />
                选择 Excel
              </Button>
              <Button
                type="button"
                disabled={!filePath || loading}
                onClick={() => void handlePreview()}
              >
                <FileSpreadsheet />
                {loading ? '预演中…' : '开始预演'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {latestTask ? (
          <TaskSummaryCard
            task={latestTask}
            executing={executingTaskId === latestTask.taskId || latestTask.status === 'executing'}
            onExecute={() => void handleExecute()}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              暂无任务，导入 Excel 并预演后将在此显示最新任务
            </CardContent>
          </Card>
        )}

        {message && (
          <Alert>
            <AlertTitle>{message.includes('失败') ? '提示' : '完成'}</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{message}</span>
              {showSettingsHint && (
                <Link to="/settings" className="text-primary underline-offset-4 hover:underline">
                  前往设置
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}
      </PagePanelBody>
    </PageSurface>
  );
}
