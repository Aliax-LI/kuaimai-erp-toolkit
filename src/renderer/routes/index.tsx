import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { SettingsPage } from '@/pages/settings';
import { WorkbenchPage } from '@/pages/workbench';

const PAGE_META: Record<string, { title: string; description?: string }> = {
  '/workbench': { title: '工作台', description: '管理并运行快麦 ERP 桌面工具' },
  '/settings': { title: '设置', description: '外观与 ERP 凭证配置' },
};

export function AppRoutes() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? PAGE_META['/workbench'];

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/workbench" replace />} />
      <Route element={<AppShell title={meta.title} description={meta.description} />}>
        <Route path="/workbench" element={<WorkbenchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/workbench" replace />} />
    </Routes>
  );
}
