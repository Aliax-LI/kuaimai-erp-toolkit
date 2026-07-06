import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: 'success' | 'danger' | 'neutral';
}

const toneClasses = {
  success: 'border-status-success/20 bg-status-success/5 text-status-success',
  danger: 'border-status-danger/20 bg-status-danger/5 text-status-danger',
  neutral: 'border-beige bg-cream-warm text-charcoal',
};

export function StatCard({ label, value, icon: Icon, tone = 'neutral' }: StatCardProps) {
  return (
    <div className={cn('min-w-0 border p-3', toneClasses[tone])}>
      {Icon && <Icon className="mb-1 h-5 w-5" />}
      <p className="text-xl font-medium">{value}</p>
      <p className="text-xs text-brown-soft">{label}</p>
    </div>
  );
}
