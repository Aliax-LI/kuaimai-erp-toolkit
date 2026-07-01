import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  steps: string[];
  currentIndex: number;
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center gap-0">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentIndex;
          const isCompleted = stepNumber < currentIndex;

          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium',
                    isActive || isCompleted
                      ? 'border-charcoal bg-charcoal text-cream'
                      : 'border-beige bg-cream-white text-brown-soft',
                  )}
                >
                  {stepNumber}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isActive ? 'text-charcoal' : isCompleted ? 'text-charcoal' : 'text-warmgray',
                  )}
                >
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="relative mx-3 mb-5 h-0.5 w-16 overflow-hidden rounded-full bg-beige">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-charcoal transition-all duration-300"
                    style={{ width: isCompleted ? '100%' : isActive ? '50%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
