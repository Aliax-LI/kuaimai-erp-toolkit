import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { DURATIONS } from '@/lib/animations';

interface AccordionStepProps {
  stepNumber: number;
  title: string;
  expanded: boolean;
  active?: boolean;
  completed?: boolean;
  inProgress?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function AccordionStep({
  stepNumber,
  title,
  expanded,
  active,
  completed,
  inProgress,
  disabled,
  onToggle,
  children,
}: AccordionStepProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-cream-white transition-all duration-200',
        active ? 'border-amber shadow-sm' : 'border-beige',
        disabled && 'opacity-70',
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4"
        onClick={onToggle}
        disabled={disabled}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
              active || inProgress
                ? 'bg-amber text-white'
                : completed
                  ? 'bg-charcoal text-cream'
                  : 'bg-beige text-brown-soft',
            )}
          >
            {stepNumber}
          </div>
          <span
            className={cn(
              'text-sm font-medium',
              active || completed ? 'text-charcoal' : 'text-brown-soft',
            )}
          >
            {title}
          </span>
          {inProgress && (
            <span className="rounded-full bg-amber/10 px-2 py-0.5 text-xs text-amber">进行中</span>
          )}
        </div>
        <ChevronUp
          className={cn(
            'h-4 w-4 text-brown-soft transition-transform',
            !expanded && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATIONS.accordion }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
