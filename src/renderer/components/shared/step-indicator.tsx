import { cn } from '@/lib/utils';

export type StepIndicatorState =
  | 'upcoming'
  | 'available'
  | 'active'
  | 'complete'
  | 'progress'
  | 'blocked';

export interface StepIndicatorStep {
  label: string;
  description?: string;
  state?: StepIndicatorState;
  disabled?: boolean;
}

interface StepIndicatorProps {
  steps: Array<string | StepIndicatorStep>;
  currentIndex: number;
  onStepClick?: (index: number) => void;
}

function normalizeStep(step: string | StepIndicatorStep): StepIndicatorStep {
  return typeof step === 'string' ? { label: step } : step;
}

export function StepIndicator({ steps, currentIndex, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="工作台步骤" className="min-w-0 w-full border border-beige bg-cream-white">
      <ol className="grid grid-cols-3 divide-x divide-beige">
        {steps.map((rawStep, index) => {
          const step = normalizeStep(rawStep);
          const stepNumber = index + 1;
          const state =
            step.state ??
            (stepNumber === currentIndex
              ? 'active'
              : stepNumber < currentIndex
                ? 'complete'
                : 'upcoming');
          const isActive = state === 'active';
          const isComplete = state === 'complete';
          const isProgress = state === 'progress';
          const isBlocked = state === 'blocked';
          const isDisabled = step.disabled || state === 'upcoming' || !onStepClick;

          return (
            <li key={`${step.label}-${stepNumber}`} className="min-w-0">
              <button
                type="button"
                className={cn(
                  'relative flex h-full w-full min-w-0 items-start gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed',
                  isActive && 'bg-cream-warm/60',
                  !isDisabled && !isActive && 'hover:bg-cream-warm/40',
                )}
                onClick={() => onStepClick?.(stepNumber)}
                disabled={isDisabled}
                aria-current={isActive ? 'step' : undefined}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-medium transition-all duration-200',
                    isActive && 'border-amber bg-amber text-white',
                    isComplete && 'border-charcoal bg-charcoal text-cream',
                    isProgress && 'border-amber bg-cream-white text-amber',
                    isBlocked && 'border-status-danger bg-cream-white text-status-danger',
                    (state === 'available' || state === 'upcoming') &&
                      'border-beige bg-cream-white text-brown-soft',
                  )}
                >
                  {stepNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'truncate text-sm font-medium leading-5',
                      (isActive || isComplete) && 'text-charcoal',
                      isProgress && 'text-amber',
                      isBlocked && 'text-status-danger',
                      (state === 'available' || state === 'upcoming') && 'text-brown-soft',
                    )}
                  >
                    {step.label}
                  </div>
                  {step.description && (
                    <div className="truncate text-xs text-brown-soft">
                      {step.description}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'absolute bottom-0 left-0 h-0.5 w-full bg-transparent',
                    isActive && 'bg-amber',
                    isComplete && 'bg-charcoal',
                    isBlocked && 'bg-status-danger',
                    isProgress && 'bg-amber',
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
