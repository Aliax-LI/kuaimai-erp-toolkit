import { cn } from '@/lib/utils';

type StatusBadgeTone = 'success' | 'danger' | 'warning' | 'neutral' | 'progress';

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
}

const toneClasses: Record<StatusBadgeTone, string> = {
  success: 'bg-status-success/10 text-status-success',
  danger: 'bg-status-danger/10 text-status-danger',
  warning: 'bg-status-warning/10 text-status-warning',
  neutral: 'bg-cream-warm text-brown-soft',
  progress: 'bg-amber/10 text-amber',
};

export function StatusBadge({ children, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
