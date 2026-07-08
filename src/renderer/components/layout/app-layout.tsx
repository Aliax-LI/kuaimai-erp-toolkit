import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

import { ConfigPage } from '@/pages/config';
import { HistoryPage } from '@/pages/history';
import { WorkbenchPage } from '@/pages/workbench';
import { DURATIONS } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { APP_ROUTES } from '@shared/constants/navigation';

import { Header } from './header';
import { Sidebar } from './sidebar';

function resolveActivePage(pathname: string): 'workbench' | 'history' | 'config' {
  if (pathname === APP_ROUTES.HISTORY) return 'history';
  if (pathname === APP_ROUTES.CONFIG) return 'config';
  return 'workbench';
}

export function AppLayout() {
  const { pathname } = useLocation();
  const active = resolveActivePage(pathname);

  return (
    <div className="flex h-screen flex-col bg-cream">
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto bg-cream p-6 scrollbar-thin">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATIONS.pageEnter }}
            className="mx-auto w-full min-w-0 max-w-6xl"
          >
            <div className={cn(active !== 'workbench' && 'hidden')}>
              <WorkbenchPage />
            </div>
            <div className={cn(active !== 'history' && 'hidden')}>
              <HistoryPage />
            </div>
            <div className={cn(active !== 'config' && 'hidden')}>
              <ConfigPage />
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
