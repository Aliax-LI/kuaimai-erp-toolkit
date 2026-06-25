import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { SHELL_HEADER_HEIGHT_CLASS } from '@shared/constants/app';

interface PageSurfaceProps {
  children: ReactNode;
  className?: string;
}

/** 铺满主区的平面容器（无圆角/阴影/外边框） */
export function PageSurface({ children, className }: PageSurfaceProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-background',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PagePanelHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PagePanelHeader({ title, description, action }: PagePanelHeaderProps) {
  return (
    <div
      className={cn(
        SHELL_HEADER_HEIGHT_CLASS,
        'flex items-center justify-between gap-4 border-b px-6',
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="truncate text-base font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

interface PagePanelBodyProps {
  children: ReactNode;
  className?: string;
}

export function PagePanelBody({ children, className }: PagePanelBodyProps) {
  return <div className={cn('flex min-h-0 flex-1 flex-col overflow-auto p-6', className)}>{children}</div>;
}

interface PagePanelFooterProps {
  children: ReactNode;
  className?: string;
}

export function PagePanelFooter({ children, className }: PagePanelFooterProps) {
  return (
    <div className={cn('mt-auto shrink-0 border-t px-6 py-4', className)}>{children}</div>
  );
}

/** 面板内分栏顶栏（与 PagePanelHeader 同高，用于左侧导航对齐） */
export function PagePanelAsideHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        SHELL_HEADER_HEIGHT_CLASS,
        'flex items-center border-b px-4 lg:px-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
