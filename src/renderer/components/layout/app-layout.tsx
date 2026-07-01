import { motion } from 'framer-motion';
import { Outlet } from 'react-router-dom';

import { DURATIONS } from '@/lib/animations';

import { Header } from './header';
import { Sidebar } from './sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-cream">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATIONS.pageEnter }}
            className="mx-auto max-w-6xl"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
