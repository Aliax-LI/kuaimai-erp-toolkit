import { cn } from '@/lib/utils';

type StatusBadgeTone = 'success' | 'danger' | 'warning' | 'neutral' | 'progress';

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
}

const toneClasses: Record<StatusBadgeTone, string> = {
  success: 'border-status-success/20 bg-status-success/10 text-status-success',
  danger: 'border-status-danger/20 bg-status-danger/10 text-status-danger',
  warning: 'border-status-warning/25 bg-status-warning/10 text-status-warning',
  neutral: 'border-beige bg-cream-warm text-brown-soft',
  progress: 'border-amber/25 bg-amber/10 text-amber',
};

export function StatusBadge({ children, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs leading-none',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
