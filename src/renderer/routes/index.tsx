import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { SettingsPage } from '@/pages/settings';
import { TaskListPage } from '@/pages/tasks';
import { WorkbenchPage } from '@/pages/workbench';

const PAGE_META: Record<string, { title: string; description?: string }> = {
  '/workbench': { title: '工作台', description: '导入 Excel 预演并执行建货号任务' },
  '/tasks': { title: '任务列表', description: '查看预演与执行详情' },
  '/settings': { title: '设置', description: 'ERP 凭证与外观' },
};

export function AppRoutes() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? PAGE_META['/workbench'];

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/workbench" replace />} />
      <Route element={<AppShell title={meta.title} description={meta.description} />}>
        <Route path="/workbench" element={<WorkbenchPage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/tools/sku-import" element={<Navigate to="/workbench" replace />} />
      <Route path="*" element={<Navigate to="/workbench" replace />} />
    </Routes>
  );
}
