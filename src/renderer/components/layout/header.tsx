import { Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useConnectionStatus } from '@/hooks/use-connection-status';
import { cn } from '@/lib/utils';
import { APP_ROUTES } from '@shared/constants/navigation';

export function Header() {
  const navigate = useNavigate();
  const { connected } = useConnectionStatus();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-beige bg-cream px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-charcoal">
          <Database className="h-4 w-4 text-cream" />
        </div>
        <h1 className="text-lg font-medium tracking-tight text-charcoal">快麦ERP批量建货号工具</h1>
      </div>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-beige bg-cream-warm px-3 py-1.5 transition-colors hover:bg-cream-light"
        onClick={() => navigate(`${APP_ROUTES.CONFIG}?tab=erp`)}
      >
        <span
          className={cn('h-2 w-2 rounded-full', connected ? 'bg-status-success' : 'bg-warmgray')}
        />
        <span className="text-sm text-charcoal">{connected ? '已连接' : '未连接'}</span>
      </button>
    </header>
  );
}
