import type { WorkbenchStep } from '@shared/constants/navigation';
import type { SkuImportTaskSummary } from '@shared/types/sku-import';

export function resolveWorkbenchStepFromSummary(task: SkuImportTaskSummary): WorkbenchStep {
  if (task.status === 'completed' || task.status === 'failed') {
    return 'result';
  }
  if (task.status === 'previewed' || task.status === 'executing') {
    return 'create';
  }
  return 'import';
}

export function resolveWorkbenchStepIndex(step: WorkbenchStep): number {
  const map: Record<WorkbenchStep, number> = { import: 1, create: 2, result: 3 };
  return map[step];
}
