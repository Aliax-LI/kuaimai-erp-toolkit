import { HashRouter } from 'react-router-dom';

import { ToastProvider } from '@/hooks/use-toast';
import { AppRoutes } from '@/routes';

export function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ToastProvider>
  );
}
