import { motion } from 'framer-motion';
import { Outlet } from 'react-router-dom';

import { DURATIONS } from '@/lib/animations';

import { Header } from './header';
import { Sidebar } from './sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-cream">
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto bg-cream p-6 scrollbar-thin">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATIONS.pageEnter }}
            className="mx-auto w-full min-w-0 max-w-6xl"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
