import { History, LayoutDashboard, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { APP_ROUTES } from '@shared/constants/navigation';

const NAV_ITEMS = [
  { to: APP_ROUTES.WORKBENCH, label: '工作台', icon: LayoutDashboard },
  { to: APP_ROUTES.HISTORY, label: '历史记录', icon: History },
  { to: APP_ROUTES.CONFIG, label: '配置管理', icon: Settings },
] as const;

export function Sidebar() {
  return (
    <aside className="flex h-full w-sidebar shrink-0 flex-col border-r border-beige bg-cream-warm">
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-charcoal text-cream'
                  : 'text-charcoal hover:bg-cream-light',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-beige p-3">
        <div className="px-4 py-2 text-xs text-brown-soft">
          <p>v2.0</p>
          <p className="mt-0.5">快麦开放平台</p>
        </div>
      </div>
    </aside>
  );
}
