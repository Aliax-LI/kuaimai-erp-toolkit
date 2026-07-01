import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, Play, RotateCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { AccordionStep } from '@/components/shared/accordion-step';
import { DragDropZone } from '@/components/shared/drag-drop-zone';
import { StepIndicator } from '@/components/shared/step-indicator';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { useSkuImportTasks } from '@/hooks/use-sku-import-tasks';
import { SkuImportTaskDetailPanel } from '@/tools/sku-import/task-detail-panel';
import {
  previewRowReason,
  previewRowStatusTone,
  rowStatusLabel,
} from '@/tools/sku-import/task-status-labels';
import { kuaimai, logRenderer } from '@/lib/kuaimai-client';
import {
  WORKBENCH_STEP_LABELS,
  WORKBENCH_STEPS,
  type WorkbenchStep,
} from '@shared/constants/navigation';
import {
  resolveWorkbenchStepFromSummary,
  resolveWorkbenchStepIndex,
} from '@shared/workbench-step';
import type { SkuImportTaskDetail } from '@shared/types/sku-import';

function isCredentialError(message: string): boolean {
  return /cookie|凭证|设置|company/i.test(message);
}

export function WorkbenchPage() {
  const [searchParams] = useSearchParams();
  const taskIdParam = searchParams.get('taskId');

  const { loading, executingTaskId, previewFile, executeTask, loadTaskDetail } =
    useSkuImportTasks();

  const [expandedStep, setExpandedStep] = useState<WorkbenchStep>('import');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<SkuImportTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async (taskId: string) => {
    const detail = await loadTaskDetail(taskId);
    setTaskDetail(detail);
    setFilePath(detail.filePath);
    const step = resolveWorkbenchStepFromSummary(detail);
    setExpandedStep(step);
    return detail;
  }, [loadTaskDetail]);

  useEffect(() => {
    if (!taskIdParam) {
      return;
    }
    void loadTask(taskIdParam).catch((err) => {
      const text = err instanceof Error ? err.message : String(err);
      setError(text);
      logRenderer('error', 'workbench', 'load task failed', { error: text });
    });
  }, [loadTask, taskIdParam]);

  const importFile = async (picked: string) => {
    setFilePath(picked);
    try {
      const detail = await previewFile(picked);
      setTaskDetail(detail);
      setExpandedStep('create');
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setError(text);
      setExpandedStep('import');
      logRenderer('error', 'workbench', 'preview failed', { error: text });
    }
  };

  const handlePick = async () => {
    setError(null);
    const picked = await kuaimai.skuImport.pickFile();
    if (!picked) {
      return;
    }
    await importFile(picked);
  };

  const handleFilePath = async (path: string) => {
    setError(null);
    await importFile(path);
  };

  const handleExecute = async () => {
    if (!taskDetail) {
      return;
    }
    setError(null);
    try {
      const detail = await executeTask(taskDetail.taskId);
      setTaskDetail(detail);
      setExpandedStep('result');
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setError(text);
      setExpandedStep('create');
      logRenderer('error', 'workbench', 'execute failed', { error: text });
    }
  };

  const executeResult = taskDetail?.executeResult;
  const stepLabels = WORKBENCH_STEPS.map((step) => WORKBENCH_STEP_LABELS[step]);
  const currentStepIndex = taskDetail
    ? resolveWorkbenchStepIndex(resolveWorkbenchStepFromSummary(taskDetail))
    : resolveWorkbenchStepIndex(expandedStep);

  return (
    <div className="space-y-4">
      <StepIndicator steps={stepLabels} currentIndex={currentStepIndex} />

      <AccordionStep
        stepNumber={1}
        title={WORKBENCH_STEP_LABELS.import}
        expanded={expandedStep === 'import'}
        active={expandedStep === 'import'}
        inProgress={loading && expandedStep === 'import'}
        onToggle={() => setExpandedStep('import')}
      >
        <div className="space-y-4">
          <DragDropZone
            fileName={filePath ? filePath.split(/[/\\]/).pop() : null}
            loading={loading}
            onPick={() => void handlePick()}
            onFilePath={(path) => void handleFilePath(path)}
            resolvePathForFile={(file) => kuaimai.skuImport.getPathForFile(file)}
          />
          {error && expandedStep === 'import' && (
            <p className="text-sm text-status-danger">
              {error}
              {isCredentialError(error) && (
                <>
                  {' '}
                  <Link to="/config?tab=erp" className="text-amber underline-offset-4 hover:underline">
                    前往配置 ERP 连接
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </AccordionStep>

      <AccordionStep
        stepNumber={2}
        title={WORKBENCH_STEP_LABELS.create}
        expanded={expandedStep === 'create'}
        active={expandedStep === 'create'}
        inProgress={Boolean(executingTaskId)}
        disabled={!taskDetail}
        onToggle={() => taskDetail && setExpandedStep('create')}
      >
        {taskDetail ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-beige bg-cream p-4">
              <p className="font-medium text-charcoal">{taskDetail.fileName}</p>
              <p className="mt-1 text-sm text-brown-soft">
                可执行 {taskDetail.readyCount} 条
                {taskDetail.blockedCount > 0 && ` · 阻断 ${taskDetail.blockedCount} 条`}
                {taskDetail.skippedCount > 0 && ` · 跳过 ${taskDetail.skippedCount} 条`}
                {' · '}共 {taskDetail.totalRows} 行
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-beige bg-cream scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-beige bg-cream/50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">行</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">品牌</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">产品</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">状态</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {taskDetail.preview.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className="border-b border-beige/50 hover:bg-cream-warm/30"
                    >
                      <td className="px-3 py-2 text-brown-soft">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-medium">{row.brand || '—'}</td>
                      <td className="px-3 py-2">{row.productName || row.displayName || '—'}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={previewRowStatusTone(row.status)}>
                          {rowStatusLabel(row.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-xs text-brown-soft">{previewRowReason(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              type="button"
              onClick={() => void handleExecute()}
              disabled={Boolean(executingTaskId) || taskDetail.readyCount <= 0}
            >
              <Play className="h-4 w-4" />
              {executingTaskId ? '创建中…' : '开始创建'}
            </Button>
            {error && expandedStep === 'create' && (
              <p className="text-sm text-status-danger">{error}</p>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-brown-soft">请先完成 Excel 导入</p>
        )}
      </AccordionStep>

      <AccordionStep
        stepNumber={3}
        title={WORKBENCH_STEP_LABELS.result}
        expanded={expandedStep === 'result'}
        active={expandedStep === 'result'}
        disabled={!executeResult}
        onToggle={() => executeResult && setExpandedStep('result')}
      >
        {executeResult && taskDetail ? (
          <div className="space-y-4">
            <SkuImportTaskDetailPanel detail={taskDetail} />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" disabled title="即将支持">
                <FileSpreadsheet className="h-4 w-4" />
                导出结果Excel
              </Button>
              <Button type="button" variant="secondary" disabled title="即将支持">
                <RotateCcw className="h-4 w-4" />
                重试全部失败
              </Button>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-brown-soft">请先完成批量创建</p>
        )}
      </AccordionStep>
    </div>
  );
}
