import { Moon, Settings, Sun } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { SHELL_HEADER_HEIGHT_CLASS } from '@shared/constants/app';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const isSettings = location.pathname === '/settings';

  const toggleTheme = () => {
    void setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header
      className={cn(
        SHELL_HEADER_HEIGHT_CLASS,
        'flex items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6',
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="切换主题">
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <NavLink to="/settings">
          {({ isActive }) => (
            <Button
              variant={isActive || isSettings ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label="设置"
              className={cn((isActive || isSettings) && 'bg-accent')}
            >
              <Settings />
            </Button>
          )}
        </NavLink>
      </div>
    </header>
  );
}
