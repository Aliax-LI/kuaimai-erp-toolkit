import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Play, Plus, RotateCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { DragDropZone } from '@/components/shared/drag-drop-zone';
import { Modal } from '@/components/shared/modal';
import { StepIndicator, type StepIndicatorStep } from '@/components/shared/step-indicator';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSkuImportTasks } from '@/hooks/use-sku-import-tasks';
import { useToast } from '@/hooks/use-toast';
import { SkuImportTaskDetailPanel } from '@/tools/sku-import/task-detail-panel';
import {
  previewRowBundleCode,
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
import { resolveWorkbenchStepFromSummary, resolveWorkbenchStepIndex } from '@shared/workbench-step';
import type { SkuImportTaskDetail } from '@shared/types/sku-import';

interface AccessoryDraftRow {
  name: string;
  skuCode: string;
}

function isCredentialError(message: string): boolean {
  return /cookie|凭证|设置|company|公司/i.test(message);
}

function normalizeAccessoryName(name: string): string {
  return name.replace(/（.*$/, '').trim();
}

function collectMissingAccessoryDrafts(
  detail: SkuImportTaskDetail | null,
  preferredName: string,
): AccessoryDraftRow[] {
  const normalizedPreferred = normalizeAccessoryName(preferredName);
  const names = new Map<string, string>();

  if (normalizedPreferred) {
    names.set(normalizedPreferred.toLowerCase(), normalizedPreferred);
  }

  for (const row of detail?.preview.rows ?? []) {
    for (const name of row.missingAccessoryNames) {
      const normalizedName = normalizeAccessoryName(name);
      if (normalizedName) {
        names.set(normalizedName.toLowerCase(), normalizedName);
      }
    }
  }

  return [...names.values()].map((name) => ({ name, skuCode: '' }));
}

function hasMissingAccessories(detail: SkuImportTaskDetail | null): boolean {
  return (detail?.preview.rows ?? []).some((row) => row.missingAccessoryNames.length > 0);
}

function stepHelpText(step: WorkbenchStep, detail: SkuImportTaskDetail | null): string {
  if (step === 'import') {
    return detail ? '已导入' : '拖入或选择文件';
  }
  if (step === 'create') {
    if (!detail) return '等待导入';
    if (detail.executeResult) return '已执行';
    if (detail.blockedCount > 0 && detail.readyCount > 0) {
      return `可创建 ${detail.readyCount} 行`;
    }
    if (detail.blockedCount > 0) return '有待修复项';
    return '检查完成';
  }
  if (!detail?.executeResult) {
    return '等待创建';
  }
  return '已生成结果';
}

function activeStepDescription(step: WorkbenchStep, detail: SkuImportTaskDetail | null): string {
  if (!detail) {
    return stepHelpText(step, detail);
  }
  if (step === 'create') {
    return `${detail.fileName} · 共 ${detail.totalRows} 行`;
  }
  if (step === 'result' && detail.executeResult) {
    return `${detail.fileName} · 成功 ${detail.executeResult.succeededCount} · 失败 ${detail.executeResult.failedCount}`;
  }
  if (step === 'import') {
    return detail.fileName;
  }
  return stepHelpText(step, detail);
}

function ProgressLine({
  percent,
  message,
}: {
  percent?: number | null;
  message?: string | null;
}) {
  const normalizedPercent = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
  return (
    <div className="border border-beige bg-cream px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-xs text-brown-soft">
        <span className="truncate">{message || '处理中…'}</span>
        <span className="shrink-0 font-mono">{normalizedPercent}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-beige/70">
        <div
          className="h-full bg-amber transition-all duration-300"
          style={{ width: `${Math.max(4, normalizedPercent)}%` }}
        />
      </div>
    </div>
  );
}

export function WorkbenchPage() {
  const [searchParams] = useSearchParams();
  const taskIdParam = searchParams.get('taskId');
  const { toast } = useToast();

  const {
    loading,
    previewProgress,
    executeProgress,
    executingTaskId,
    previewFile,
    executeTask,
    loadTaskDetail,
    exportResults,
  } = useSkuImportTasks();

  const [expandedStep, setExpandedStep] = useState<WorkbenchStep>('import');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<SkuImportTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessoryDrafts, setAccessoryDrafts] = useState<AccessoryDraftRow[] | null>(null);
  const [accessoryError, setAccessoryError] = useState<string | null>(null);
  const [savingAccessory, setSavingAccessory] = useState(false);

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
    setExpandedStep('result');
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

  const handleExportResults = async () => {
    if (!taskDetail?.executeResult) {
      return;
    }
    setError(null);
    try {
      await exportResults(taskDetail.taskId);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setError(text);
      logRenderer('error', 'workbench', 'export results failed', { error: text });
    }
  };

  const handleOpenAccessoryDraft = (name: string) => {
    setAccessoryDrafts(collectMissingAccessoryDrafts(taskDetail, name));
    setAccessoryError(null);
  };

  const handleSaveAccessory = async () => {
    if (!accessoryDrafts) {
      return;
    }
    const drafts = accessoryDrafts.map((draft) => ({
      name: draft.name.trim(),
      skuCode: draft.skuCode.trim(),
    }));
    const invalidDraft = drafts.find((draft) => !draft.name || !draft.skuCode);
    if (invalidDraft) {
      setAccessoryError('请填写所有配件名称与 SKU 编码');
      return;
    }

    setSavingAccessory(true);
    setAccessoryError(null);
    try {
      const config = await kuaimai.skuImport.getConfig();
      const accessories = [...config.accessories];

      for (const draft of drafts) {
        const nameKey = draft.name.toLowerCase();
        const existingIndex = accessories.findIndex(
          (accessory) => accessory.name.trim().toLowerCase() === nameKey,
        );
        if (existingIndex >= 0) {
          accessories[existingIndex] = {
            ...accessories[existingIndex],
            name: draft.name,
            skuCode: draft.skuCode,
            brand: '',
            enabled: true,
          };
        } else {
          accessories.push({
            name: draft.name,
            skuCode: draft.skuCode,
            brand: '',
            enabled: true,
          });
        }
      }

      await kuaimai.skuImport.setConfig({ ...config, accessories });
      setAccessoryDrafts(null);
      toast(`已保存 ${drafts.length} 个配件配置，正在重新检查…`);

      if (filePath) {
        const detail = await previewFile(filePath);
        setTaskDetail(detail);
        setExpandedStep('create');
      }
    } catch (err) {
      setAccessoryError(err instanceof Error ? err.message : '保存配件失败');
    } finally {
      setSavingAccessory(false);
    }
  };

  const executeResult = taskDetail?.executeResult;
  const activeStepIndex = resolveWorkbenchStepIndex(expandedStep);
  const progressStep = taskDetail ? resolveWorkbenchStepFromSummary(taskDetail) : 'import';
  const progressStepIndex = resolveWorkbenchStepIndex(progressStep);
  const stepItems: StepIndicatorStep[] = WORKBENCH_STEPS.map((step) => {
    const stepIndex = resolveWorkbenchStepIndex(step);
    const isActive = step === expandedStep;
    const canOpen =
      step === 'import' ||
      (step === 'create' && Boolean(taskDetail)) ||
      (step === 'result' && Boolean(executeResult));
    const hasBlockedRows = step === 'create' && Boolean(taskDetail?.blockedCount);
    const isComplete =
      stepIndex < progressStepIndex || (step === 'result' && Boolean(executeResult));
    return {
      label: WORKBENCH_STEP_LABELS[step],
      description: stepHelpText(step, taskDetail),
      disabled: !canOpen,
      state: isActive
        ? 'active'
        : executingTaskId && step === 'create'
          ? 'progress'
          : isComplete
            ? 'complete'
            : hasBlockedRows
              ? 'blocked'
              : canOpen
                ? 'available'
                : 'upcoming',
    };
  });

  const openStep = (stepNumber: number) => {
    const step = WORKBENCH_STEPS[stepNumber - 1];
    if (!step) {
      return;
    }
    if (step === 'create' && !taskDetail) {
      return;
    }
    if (step === 'result' && !executeResult) {
      return;
    }
    setExpandedStep(step);
  };

  const fileName = filePath ? filePath.split(/[/\\]/).pop() : null;
  const missingAccessories = useMemo(() => hasMissingAccessories(taskDetail), [taskDetail]);

  const renderTaskOverview = () => (
    <dl className="grid w-full border border-beige bg-cream text-sm sm:grid-cols-5">
      {[
        ['文件', fileName || '—', 'text-charcoal', !fileName ? '导入后显示文件名' : undefined],
        ['总行数', taskDetail?.totalRows ?? '—', 'text-charcoal', 'Excel 有效数据行'],
        ['可创建', taskDetail?.readyCount ?? '—', 'text-status-success', '检查通过，可提交 ERP'],
        ['待修复', taskDetail?.blockedCount ?? '—', 'text-status-danger', '需补全配置后重试'],
        ['将跳过', taskDetail?.skippedCount ?? '—', 'text-brown-soft', 'ERP 中已存在货号'],
      ].map(([label, value, valueClass, hint]) => (
        <div key={label} className="min-w-0 border-b border-beige px-3 py-2 sm:border-b-0 sm:border-r last:border-r-0">
          <dt className="text-xs text-brown-soft" title={typeof hint === 'string' ? hint : undefined}>{label}</dt>
          <dd className={`mt-0.5 truncate font-medium ${valueClass}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );

  const renderImportStep = () => (
    <div className="w-full space-y-3">
      <div className="w-full space-y-3">
        <DragDropZone
          fileName={fileName}
          loading={loading}
          progressPercent={previewProgress?.percent ?? null}
          progressText={previewProgress?.message ?? null}
          onPick={() => void handlePick()}
          onFilePath={(path) => void handleFilePath(path)}
          resolvePathForFile={(file) => kuaimai.skuImport.getPathForFile(file)}
        />
        {error && expandedStep === 'import' && (
          <p className="border border-status-danger/20 bg-status-danger/5 px-3 py-2 text-sm text-status-danger">
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
      {renderTaskOverview()}
    </div>
  );

  const renderCreateStep = () => {
    if (!taskDetail) {
      return <p className="py-8 text-center text-sm text-brown-soft">请先完成 Excel 导入</p>;
    }

    return (
      <div className="space-y-3">
        {taskDetail.blockedCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-amber/25 bg-amber/5 px-3 py-2.5">
            <p className="text-sm text-charcoal">
              {taskDetail.readyCount > 0 ? (
                <>
                  本批次有 <span className="font-medium text-status-danger">{taskDetail.blockedCount}</span> 行待修复，
                  <span className="font-medium text-status-success">{taskDetail.readyCount}</span> 行可创建。
                  「开始创建」仅处理可创建行。
                </>
              ) : (
                <>本批次 {taskDetail.blockedCount} 行均有待修复项，补全配置后可重新检查。</>
              )}
            </p>
            {missingAccessories && (
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => handleOpenAccessoryDraft('')}
                disabled={savingAccessory}
              >
                <Plus className="h-4 w-4" />
                补全配件编码
              </Button>
            )}
          </div>
        )}

        <div className="max-h-80 overflow-x-auto overflow-y-auto border border-beige bg-cream scrollbar-thin">
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="w-12 px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-brown-soft">行</th>
                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-brown-soft">品牌</th>
                <th className="w-[18%] px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-brown-soft">产品</th>
                <th className="w-[14%] px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-brown-soft">套装货号</th>
                <th className="w-[14%] px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-brown-soft">贴纸货号</th>
                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-brown-soft">状态</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">说明</th>
              </tr>
            </thead>
            <tbody>
              {taskDetail.preview.rows.map((row) => (
                <tr key={row.rowNumber} className="border-b border-beige/50 hover:bg-cream-warm/30">
                  <td className="px-3 py-2 text-brown-soft">{row.rowNumber}</td>
                  <td className="truncate px-3 py-2 font-medium">{row.brand || '—'}</td>
                  <td className="truncate px-3 py-2">{row.productName || row.displayName || '—'}</td>
                  <td className="truncate px-3 py-2 font-mono text-xs text-brown-soft">
                    {previewRowBundleCode(row)}
                  </td>
                  <td className="truncate px-3 py-2 font-mono text-xs text-brown-soft">
                    {row.stickerOuterId || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={previewRowStatusTone(row.status)}>
                      {rowStatusLabel(row.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-xs text-brown-soft">
                    {row.missingAccessoryNames.length > 0 ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="text-brown-soft">缺少编码：</span>
                        {row.missingAccessoryNames.map((name) => {
                          const normalizedName = normalizeAccessoryName(name);
                          return (
                            <button
                              key={`${row.rowNumber}-${name}`}
                              type="button"
                              className="inline-flex items-center gap-0.5 rounded border border-amber/30 bg-amber/10 px-1.5 py-0.5 text-amber transition-colors hover:border-amber hover:bg-amber/15 disabled:opacity-50"
                              onClick={() => handleOpenAccessoryDraft(normalizedName)}
                              disabled={savingAccessory}
                              title="点击补全配件编码"
                            >
                              <Plus className="h-3 w-3" />
                              {normalizedName}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="block truncate">{previewRowReason(row)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {executingTaskId === taskDetail.taskId && (
          <ProgressLine
            percent={executeProgress?.percent ?? 1}
            message={executeProgress?.message ?? '正在创建商品'}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void handleExecute()}
            disabled={Boolean(executingTaskId) || taskDetail.readyCount <= 0}
            title={
              taskDetail.readyCount <= 0
                ? '没有可创建的行，请先修复待处理项'
                : `将创建 ${taskDetail.readyCount} 行，跳过待修复与将跳过的行`
            }
          >
            <Play className="h-4 w-4" />
            {executingTaskId
              ? '创建中…'
              : taskDetail.readyCount > 0
                ? `开始创建（${taskDetail.readyCount} 行）`
                : '开始创建'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExpandedStep('import')}
            disabled={Boolean(executingTaskId)}
          >
            重新导入
          </Button>
          {taskDetail.readyCount <= 0 && taskDetail.blockedCount > 0 && (
            <span className="text-xs text-brown-soft">修复待处理项后可开始创建</span>
          )}
        </div>
        {error && expandedStep === 'create' && (
          <p className="border border-status-danger/20 bg-status-danger/5 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}
      </div>
    );
  };

  const renderResultStep = () => {
    if (
      taskDetail &&
      !executeResult &&
      (executingTaskId === taskDetail.taskId || executeProgress?.taskId === taskDetail.taskId)
    ) {
      return (
        <div className="space-y-3">
          <ProgressLine
            percent={executeProgress?.percent ?? 1}
            message={executeProgress?.message ?? '正在创建商品'}
          />
          <p className="text-sm text-brown-soft">
            正在处理 {taskDetail.fileName}，完成后会显示创建结果并可导出 Excel。
          </p>
        </div>
      );
    }

    if (!executeResult || !taskDetail) {
      return <p className="py-8 text-center text-sm text-brown-soft">请先完成批量创建</p>;
    }

    return (
      <div className="space-y-4">
        <SkuImportTaskDetailPanel detail={taskDetail} />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void handleExportResults()}>
            <FileSpreadsheet className="h-4 w-4" />
            导出结果Excel
          </Button>
          <Button type="button" variant="secondary" disabled title="即将支持">
            <RotateCcw className="h-4 w-4" />
            重试全部失败
          </Button>
        </div>
        {error && expandedStep === 'result' && (
          <p className="border border-status-danger/20 bg-status-danger/5 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}
      </div>
    );
  };

  const renderActiveStep = () => {
    if (expandedStep === 'import') return renderImportStep();
    if (expandedStep === 'create') return renderCreateStep();
    return renderResultStep();
  };

  return (
    <div className="min-w-0 w-full space-y-4">
      <StepIndicator steps={stepItems} currentIndex={activeStepIndex} onStepClick={openStep} />

      <section className="min-w-0 w-full border border-beige bg-cream-white">
        {expandedStep !== 'import' && (
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-beige px-3 py-2.5">
            <div>
              <h2 className="text-base font-medium text-charcoal">
                {WORKBENCH_STEP_LABELS[expandedStep]}
              </h2>
              <p className="mt-0.5 text-sm text-brown-soft">
                {activeStepDescription(expandedStep, taskDetail)}
              </p>
            </div>
            {taskDetail && expandedStep === 'create' && (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={taskDetail.readyCount > 0 ? 'success' : 'neutral'}>
                  可创建 {taskDetail.readyCount}
                </StatusBadge>
                {taskDetail.blockedCount > 0 && (
                  <StatusBadge tone="danger">待修复 {taskDetail.blockedCount}</StatusBadge>
                )}
                {taskDetail.skippedCount > 0 && (
                  <StatusBadge tone="warning">将跳过 {taskDetail.skippedCount}</StatusBadge>
                )}
              </div>
            )}
          </div>
        )}
        <div className="p-3">{renderActiveStep()}</div>
      </section>

      <Modal
        open={accessoryDrafts !== null}
        title="补全配件编码"
        onClose={() => {
          if (savingAccessory) {
            return;
          }
          setAccessoryDrafts(null);
          setAccessoryError(null);
        }}
      >
        {accessoryDrafts && (
          <div className="space-y-4">
            <p className="text-sm text-brown-soft">
              还有 {accessoryDrafts.length} 个配件缺少 SKU 编码，填写后保存并重新检查数据。
            </p>
            <div className="max-h-80 overflow-x-auto overflow-y-auto border border-beige scrollbar-thin">
              <table className="w-full min-w-[28rem] table-fixed text-sm">
                <thead>
                  <tr className="border-b border-beige bg-cream/50">
                    <th className="w-[40%] px-3 py-2 text-left text-xs font-medium text-brown-soft">配件名称</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-brown-soft">SKU 编码</th>
                  </tr>
                </thead>
                <tbody>
                  {accessoryDrafts.map((draft, index) => (
                    <tr key={`${draft.name}-${index}`} className="border-b border-beige/50 last:border-b-0">
                      <td className="px-3 py-2">
                        <Input
                          value={draft.name}
                          onChange={(event) => {
                            const next = [...accessoryDrafts];
                            next[index] = { ...draft, name: event.target.value };
                            setAccessoryDrafts(next);
                          }}
                          autoComplete="off"
                          aria-label={`配件名称 ${index + 1}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={draft.skuCode}
                          onChange={(event) => {
                            const next = [...accessoryDrafts];
                            next[index] = { ...draft, skuCode: event.target.value };
                            setAccessoryDrafts(next);
                          }}
                          placeholder="例如 PJ-YHM01"
                          autoComplete="off"
                          aria-label={`SKU 编码 ${index + 1}`}
                          autoFocus={index === 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {accessoryError && (
              <p className="border border-status-danger/20 bg-status-danger/5 px-3 py-2 text-sm text-status-danger">
                {accessoryError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={savingAccessory}
                onClick={() => {
                  setAccessoryDrafts(null);
                  setAccessoryError(null);
                }}
              >
                取消
              </Button>
              <Button type="button" disabled={savingAccessory} onClick={() => void handleSaveAccessory()}>
                {savingAccessory ? '保存中…' : '保存并重新检查'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
