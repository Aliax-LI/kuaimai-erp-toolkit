import { HashRouter } from 'react-router-dom';

import { ThemeProvider } from '@/hooks/use-theme';
import { AppRoutes } from '@/routes';

export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ThemeProvider>
  );
}
