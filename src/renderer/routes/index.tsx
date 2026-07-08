import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { APP_ROUTES, resolveLegacyRedirect } from '@shared/constants/navigation';

function LegacyRedirect() {
  const { pathname } = useLocation();
  const target = resolveLegacyRedirect(pathname);
  return <Navigate to={target ?? APP_ROUTES.WORKBENCH} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={APP_ROUTES.WORKBENCH} replace />} />
      <Route element={<AppLayout />}>
        <Route path={APP_ROUTES.WORKBENCH} element={null} />
        <Route path={APP_ROUTES.HISTORY} element={null} />
        <Route path={APP_ROUTES.CONFIG} element={null} />
      </Route>
      <Route path="/tasks" element={<LegacyRedirect />} />
      <Route path="/settings" element={<LegacyRedirect />} />
      <Route path="/tools/sku-import" element={<LegacyRedirect />} />
      <Route path="*" element={<Navigate to={APP_ROUTES.WORKBENCH} replace />} />
    </Routes>
  );
}
