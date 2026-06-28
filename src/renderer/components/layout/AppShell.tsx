import { Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { PageHeader } from '@/components/layout/page-header/PageHeader';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { SIDEBAR_WIDTH } from '@shared/constants/app';

interface AppShellProps {
  title: string;
  description?: string;
  headerActions?: ReactNode;
}

export function AppShell({ title, description, headerActions }: AppShellProps) {
  return (
    <SidebarProvider
      className="flex h-svh w-full overflow-hidden"
      style={{ '--sidebar-width': SIDEBAR_WIDTH } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden">
        <PageHeader title={title} description={description} actions={headerActions} />
        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
