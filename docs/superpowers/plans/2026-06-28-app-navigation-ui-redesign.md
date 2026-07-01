# 应用导航与 UI 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面应用重构为三页导航（工作台 / 任务列表 / 设置），拆分建货号 UI、统一 ERP 凭证至 store.json，并修复窗口缩放布局问题。

**Architecture:** 后端 IPC 与任务落盘不变；扩展 `app.erpBaseUrl` 与 `getErpWebConfig`；从 `sku-import.tsx` 抽取共享组件与 `useSkuImportTasks` hook；新建 `workbench.tsx`（轻量）与 `tasks.tsx`（手风琴详情）；侧栏三项导航，顶栏移除设置齿轮。

**Tech Stack:** Electron 28+、React 19、React Router、Tailwind CSS 4、shadcn/ui、Vitest、现有 `kuaimai.skuImport` IPC

**Spec:** `docs/superpowers/specs/2026-06-28-app-navigation-ui-redesign-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/shared/schemas/store.ts` | `app.erpBaseUrl` 字段 |
| `tests/store-schema.test.ts` | erpBaseUrl 默认与校验 |
| `tests/erp-web-config.test.ts` | **新建** getErpWebConfig 单测 |
| `src/main/services/erp-web.ts` | 从 store 读 baseUrl |
| `src/main/services/erp-oss.ts` | STS API 用 store baseUrl |
| `src/renderer/pages/settings.tsx` | 精简：ERP 三项 + 外观 |
| `src/renderer/tools/sku-import/task-status-labels.ts` | **新建** 状态文案/badge |
| `src/renderer/tools/sku-import/preview-row.tsx` | **新建** 预演行渲染 |
| `src/renderer/tools/sku-import/task-detail-panel.tsx` | **新建** 展开详情体 |
| `src/renderer/tools/sku-import/task-summary-card.tsx` | **新建** 工作台摘要卡 |
| `src/renderer/hooks/use-sku-import-tasks.ts` | **新建** 任务 CRUD hook |
| `src/renderer/pages/workbench.tsx` | **重写** 导入 + 最新任务 |
| `src/renderer/pages/tasks.tsx` | **新建** 手风琴任务列表 |
| `src/renderer/components/layout/app-sidebar.tsx` | 三项导航 |
| `src/renderer/components/layout/page-header/PageHeader.tsx` | 移除 Settings 齿轮 |
| `src/renderer/routes/index.tsx` | 新路由 + 重定向 |
| `src/renderer/pages/sku-import.tsx` | **删除** |

---

### Task 1: 扩展 store schema（erpBaseUrl）

**Files:**
- Modify: `src/shared/schemas/store.ts`
- Modify: `tests/store-schema.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/store-schema.test.ts` 追加：

```typescript
import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';

it('defaults erpBaseUrl to production ERP host', () => {
  const store = createDefaultStore();
  expect(store.app.erpBaseUrl).toBe(DEFAULT_ERP_BASE_URL);
});

it('rejects invalid erpBaseUrl', () => {
  const store = createDefaultStore();
  expect(() =>
    appStoreSchema.parse({
      ...store,
      app: { ...store.app, erpBaseUrl: 'not-a-url' },
    }),
  ).toThrow();
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `pnpm exec vitest run tests/store-schema.test.ts`
Expected: FAIL — `erpBaseUrl` 不存在

- [ ] **Step 3: 扩展 schema**

`src/shared/schemas/store.ts`：

```typescript
import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';

export const appSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  locale: z.literal('zh-CN').default('zh-CN'),
  erpBaseUrl: z.string().url().default(DEFAULT_ERP_BASE_URL),
});
```

- [ ] **Step 4: 运行测试确认 PASS**

Run: `pnpm exec vitest run tests/store-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/schemas/store.ts tests/store-schema.test.ts
git commit -m "feat(store): add erpBaseUrl to app settings schema"
```

---

### Task 2: getErpWebConfig 读 store baseUrl

**Files:**
- Modify: `src/main/services/erp-web.ts`
- Modify: `src/main/services/erp-oss.ts`
- Create: `tests/erp-web-config.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `tests/erp-web-config.test.ts`（mock store 模块）：

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/main/services/store', () => ({
  getSecret: vi.fn(),
  getAppSettings: vi.fn(),
}));

import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';
import { getErpWebConfig } from '../src/main/services/erp-web';
import { getAppSettings, getSecret } from '../src/main/services/store';

describe('getErpWebConfig', () => {
  beforeEach(() => {
    vi.mocked(getSecret).mockImplementation((key: string) => {
      if (key === 'erpCookie') return 'cookie=abc';
      if (key === 'erpCompanyId') return '140109';
      return undefined;
    });
    vi.mocked(getAppSettings).mockReturnValue({
      theme: 'dark',
      locale: 'zh-CN',
      erpBaseUrl: 'https://erp.example.com',
    });
  });

  it('uses erpBaseUrl from app settings', () => {
    const config = getErpWebConfig();
    expect(config.baseUrl).toBe('https://erp.example.com');
    expect(config.cookie).toBe('cookie=abc');
    expect(config.companyId).toBe('140109');
  });

  it('falls back to DEFAULT_ERP_BASE_URL when erpBaseUrl missing', () => {
    vi.mocked(getAppSettings).mockReturnValue({
      theme: 'dark',
      locale: 'zh-CN',
      erpBaseUrl: DEFAULT_ERP_BASE_URL,
    });
    expect(getErpWebConfig().baseUrl).toBe(DEFAULT_ERP_BASE_URL);
  });

  it('throws when cookie missing', () => {
    vi.mocked(getSecret).mockReturnValue(undefined);
    expect(() => getErpWebConfig()).toThrow(/Cookie/);
  });
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `pnpm exec vitest run tests/erp-web-config.test.ts`
Expected: FAIL — baseUrl 仍为硬编码 DEFAULT

- [ ] **Step 3: 修改 erp-web.ts**

```typescript
import { getAppSettings, getSecret } from './store';

export function getErpWebConfig(): ErpWebConfig {
  const cookie = getSecret('erpCookie')?.trim();
  if (!cookie) {
    throw new Error('请先在设置页配置 ERP Cookie');
  }
  const companyId = getSecret('erpCompanyId')?.trim();
  if (!companyId) {
    throw new Error('缺少 companyId。请在设置页填写（例如 140109）');
  }
  const { erpBaseUrl } = getAppSettings();
  return {
    baseUrl: normalizeErpBaseUrl(erpBaseUrl || DEFAULT_ERP_BASE_URL),
    cookie,
    companyId,
    accessToken: getSecret('erpAccessToken')?.trim() || undefined,
  };
}
```

- [ ] **Step 4: 修改 erp-oss.ts**

```typescript
import { getAppSettings, getSecret } from './store';

export function getErpOssConfig(): ErpOssConfig {
  const cookie = getSecret('erpCookie')?.trim();
  if (!cookie) {
    throw new Error('请先在设置页配置 ERP Cookie');
  }
  const { erpBaseUrl } = getAppSettings();
  const baseUrl = normalizeErpBaseUrl(erpBaseUrl || DEFAULT_ERP_BASE_URL);
  return {
    ...DEFAULT_ERP_OSS_CONFIG,
    cookie,
    stsTokenApi: `${baseUrl}${ERP_STS_TOKEN_PATH}`,
  };
}
```

- [ ] **Step 5: 运行测试 + typecheck**

Run: `pnpm exec vitest run tests/erp-web-config.test.ts && pnpm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/services/erp-web.ts src/main/services/erp-oss.ts tests/erp-web-config.test.ts
git commit -m "feat(erp): read baseUrl from app settings in web and oss config"
```

---

### Task 3: 精简设置页（ERP 三项 + 外观）

**Files:**
- Modify: `src/renderer/pages/settings.tsx`

- [ ] **Step 1: 加载 app 设置与默认值**

在 `SettingsPage` 增加 state：

```typescript
const [erpBaseUrl, setErpBaseUrl] = useState(DEFAULT_ERP_BASE_URL);

useEffect(() => {
  void kuaimai.config.getApp().then((app) => {
    setErpBaseUrl(app.erpBaseUrl || DEFAULT_ERP_BASE_URL);
  });
  void kuaimai.config.getSecretsMeta().then((meta) => {
    setErpCookieSet(Boolean(meta.erpCookie));
    setErpCompanyIdSet(Boolean(meta.erpCompanyId));
  });
}, []);
```

- [ ] **Step 2: 重写 credentials section**

移除：`companyName` / `userName` / `password` / `phoneVerifyCode` / `handleErpLogin` / `handleTestUpload` / 账号登录 Alert 与表单 / OSS 按钮。

保留并调整 ERP 连接区：

```tsx
<Field>
  <FieldLabel htmlFor="erp-cookie">ERP Cookie</FieldLabel>
  <Input id="erp-cookie" type="password" placeholder={erpCookieSet ? '已保存，输入新值可覆盖' : '从浏览器复制 Cookie'} ... />
</Field>
<Field>
  <FieldLabel htmlFor="erp-company-id">companyId</FieldLabel>
  <Input id="erp-company-id" placeholder={erpCompanyIdSet ? '已保存' : '140109'} ... />
</Field>
<Field>
  <FieldLabel htmlFor="erp-base-url">ERP 地址</FieldLabel>
  <Input id="erp-base-url" value={erpBaseUrl} onChange={(e) => setErpBaseUrl(e.target.value)} />
  <FieldDescription>默认 https://erp.superboss.cc</FieldDescription>
</Field>
```

- [ ] **Step 3: 统一保存 handler**

```typescript
const handleSave = async () => {
  setSaving(true);
  setMessage(null);
  try {
    const secretPatch: Record<string, string> = {};
    if (erpCookie.trim()) secretPatch.erpCookie = erpCookie.trim();
    if (erpCompanyId.trim()) secretPatch.erpCompanyId = erpCompanyId.trim();
    if (Object.keys(secretPatch).length > 0) {
      await kuaimai.config.setSecrets(secretPatch);
      if (secretPatch.erpCookie) { setErpCookie(''); setErpCookieSet(true); }
      if (secretPatch.erpCompanyId) { setErpCompanyId(''); setErpCompanyIdSet(true); }
    }
    await kuaimai.config.setApp({ erpBaseUrl: erpBaseUrl.trim() || DEFAULT_ERP_BASE_URL });
    setMessage('已保存');
  } finally {
    setSaving(false);
  }
};
```

保存按钮：`disabled={saving}`（允许只改 baseUrl）。

- [ ] **Step 4: 简化 sections 数组**

仅两项：`erp`（凭证）与 `appearance`（主题）。`defaultSectionId="erp"`。

- [ ] **Step 5: 手动验证**

Run: `pnpm start` → 设置页填写三项 → 保存 → 重启应用 → 值仍生效。

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pages/settings.tsx
git commit -m "refactor(settings): simplify to ERP credentials and appearance"
```

---

### Task 4: 抽取共享 sku-import UI 组件

**Files:**
- Create: `src/renderer/tools/sku-import/task-status-labels.ts`
- Create: `src/renderer/tools/sku-import/preview-row.tsx`
- Create: `src/renderer/tools/sku-import/task-detail-panel.tsx`
- Modify: `src/renderer/pages/sku-import.tsx`（临时：改为 import 共享组件，验证无回归）

- [ ] **Step 1: 创建 task-status-labels.ts**

从 `sku-import.tsx` 迁移：

```typescript
import type { SkuImportPreviewRow, SkuImportTaskStatus } from '@shared/types/sku-import';

export function rowStatusLabel(status: SkuImportPreviewRow['status']): string { /* 原实现 */ }
export function rowStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' { /* 原实现 */ }
export function taskStatusLabel(status: SkuImportTaskStatus): string { /* 原实现 */ }
export function taskStatusBadgeVariant(status: SkuImportTaskStatus): 'default' | 'secondary' | 'destructive' | 'outline' { /* 原实现 */ }
export function formatTaskTime(iso: string): string { /* 原 formatTime */ }
```

- [ ] **Step 2: 创建 preview-row.tsx**

导出 `PreviewRow` 组件，含原 `renderPreviewRow`  JSX；grid 类改为：

```tsx
className="grid gap-3 border-b px-4 py-3 text-sm last:border-b-0 xl:grid-cols-[72px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_96px]"
```

`< xl` 时字段纵向堆叠（去掉固定 6 列依赖）。

- [ ] **Step 3: 创建 task-detail-panel.tsx**

Props:

```typescript
interface TaskDetailPanelProps {
  detail: SkuImportTaskDetail;
}
```

包含：统计四卡片、可执行记录（`overflow-auto` 无固定高度）、其他记录、执行结果 + verifySteps。从 `sku-import.tsx` 右侧 JSX 原样迁移。

- [ ] **Step 4: 更新 sku-import.tsx 使用共享组件**

替换 inline 函数为 import；`ScrollArea` 去掉 `h-[420px]` / `h-[280px]`，改为 `className="max-h-none"` 或父级 `flex-1 min-h-0 overflow-auto`。

- [ ] **Step 5: typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/tools/sku-import/ src/renderer/pages/sku-import.tsx
git commit -m "refactor(ui): extract shared sku-import presentation components"
```

---

### Task 5: useSkuImportTasks hook

**Files:**
- Create: `src/renderer/hooks/use-sku-import-tasks.ts`

- [ ] **Step 1: 实现 hook**

```typescript
import { useCallback, useState } from 'react';
import { kuaimai, logRenderer } from '@/lib/kuaimai-client';
import type { SkuImportTaskDetail, SkuImportTaskSummary } from '@shared/types/sku-import';

export function useSkuImportTasks() {
  const [tasks, setTasks] = useState<SkuImportTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    const list = await kuaimai.skuImport.listTasks();
    setTasks(list);
    return list;
  }, []);

  const getLatestTask = useCallback(async (): Promise<SkuImportTaskSummary | null> => {
    const list = tasks.length > 0 ? tasks : await refreshTasks();
    return list[0] ?? null;
  }, [tasks, refreshTasks]);

  const loadTaskDetail = useCallback(async (taskId: string): Promise<SkuImportTaskDetail> => {
    return kuaimai.skuImport.getTask(taskId);
  }, []);

  const executeTask = useCallback(async (taskId: string) => {
    setExecutingTaskId(taskId);
    try {
      const detail = await kuaimai.skuImport.execute(taskId);
      await refreshTasks();
      return detail;
    } finally {
      setExecutingTaskId(null);
    }
  }, [refreshTasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    await kuaimai.skuImport.deleteTask(taskId);
    return refreshTasks();
  }, [refreshTasks]);

  const previewFile = useCallback(async (filePath: string) => {
    setLoading(true);
    try {
      const detail = await kuaimai.skuImport.preview(filePath);
      await refreshTasks();
      return detail;
    } finally {
      setLoading(false);
    }
  }, [refreshTasks]);

  return {
    tasks,
    loading,
    executingTaskId,
    refreshTasks,
    getLatestTask,
    loadTaskDetail,
    executeTask,
    deleteTask,
    previewFile,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/hooks/use-sku-import-tasks.ts
git commit -m "feat(ui): add useSkuImportTasks hook for task operations"
```

---

### Task 6: 重写工作台页面

**Files:**
- Create: `src/renderer/tools/sku-import/task-summary-card.tsx`
- Modify: `src/renderer/pages/workbench.tsx`

- [ ] **Step 1: 创建 TaskSummaryCard**

Props:

```typescript
interface TaskSummaryCardProps {
  task: SkuImportTaskSummary;
  executing: boolean;
  onExecute: () => void;
  onViewDetails: () => void;
}
```

展示：fileName、formatTaskTime(createdAt)、taskStatusLabel、ready/blocked/skipped/total 统计；按钮「执行」（`status === 'previewed' && readyCount > 0`）与「查看详情」。

- [ ] **Step 2: 重写 workbench.tsx**

结构：

```tsx
export function WorkbenchPage() {
  const navigate = useNavigate();
  const { tasks, loading, executingTaskId, refreshTasks, executeTask, previewFile } = useSkuImportTasks();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latestTask = tasks[0] ?? null;

  useEffect(() => { void refreshTasks(); }, [refreshTasks]);

  // handlePickFile → kuaimai.skuImport.pickFile()
  // handlePreview → previewFile(filePath)
  // handleExecute → executeTask(latestTask.taskId)
  // handleViewDetails → navigate(`/tasks?expand=${latestTask.taskId}`)

  return (
    <PageSurface>
      <PagePanelBody className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {/* 导入 Excel Card — 无 PagePanelHeader */}
        {/* latestTask ? TaskSummaryCard : EmptyState */}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </PagePanelBody>
    </PageSurface>
  );
}
```

错误文案含「前往设置」时用 `<Link to="/settings">`。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/pages/workbench.tsx src/renderer/tools/sku-import/task-summary-card.tsx
git commit -m "feat(workbench): replace placeholder with sku import entry and latest task card"
```

---

### Task 7: 新建任务列表页（手风琴）

**Files:**
- Create: `src/renderer/pages/tasks.tsx`

- [ ] **Step 1: 页面骨架**

```tsx
export function TaskListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const expandParam = searchParams.get('expand');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(expandParam);
  const [details, setDetails] = useState<Record<string, SkuImportTaskDetail>>({});
  const { tasks, executingTaskId, refreshTasks, loadTaskDetail, executeTask, deleteTask } = useSkuImportTasks();

  useEffect(() => { void refreshTasks(); }, [refreshTasks]);

  useEffect(() => {
    if (expandParam) setExpandedTaskId(expandParam);
  }, [expandParam]);

  const handleToggle = async (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setSearchParams({});
      return;
    }
    setExpandedTaskId(taskId);
    setSearchParams({ expand: taskId });
    if (!details[taskId]) {
      const detail = await loadTaskDetail(taskId);
      setDetails((prev) => ({ ...prev, [taskId]: detail }));
    }
  };
  // ...
}
```

- [ ] **Step 2: 手风琴项 UI**

每项结构：

```tsx
<div className="rounded-lg border">
  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void handleToggle(task.taskId)}>
      {/* 摘要：文件名、Badge、时间、统计、failureMessage */}
    </button>
    <div className="flex shrink-0 gap-2">
      <Button size="sm" disabled={!canExecute} onClick={() => void executeTask(...)}>执行</Button>
      <Button size="sm" variant="outline" onClick={() => void deleteTask(...)}>删除</Button>
    </div>
  </div>
  {expandedTaskId === task.taskId && details[task.taskId] && (
    <div className="border-t p-4">
      <TaskDetailPanel detail={details[task.taskId]} />
    </div>
  )}
</div>
```

列表容器：`flex min-h-0 flex-1 flex-col gap-3 overflow-auto`。

- [ ] **Step 3: 空状态与加载失败**

无任务：居中提示。`refreshTasks` catch → Alert + 重试按钮。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/tasks.tsx
git commit -m "feat(tasks): add accordion task list page with expandable details"
```

---

### Task 8: 导航、路由、顶栏

**Files:**
- Modify: `src/renderer/components/layout/app-sidebar.tsx`
- Modify: `src/renderer/components/layout/page-header/PageHeader.tsx`
- Modify: `src/renderer/routes/index.tsx`
- Delete: `src/renderer/pages/sku-import.tsx`

- [ ] **Step 1: 更新 app-sidebar.tsx**

```typescript
import { LayoutDashboard, ListTodo, Settings } from 'lucide-react';

const navItems = [
  { to: '/workbench', icon: LayoutDashboard, label: '工作台' },
  { to: '/tasks', icon: ListTodo, label: '任务列表' },
  { to: '/settings', icon: Settings, label: '设置' },
] as const;
```

移除 `SidebarGroupLabel`「应用」或改为无分组（三项平铺）。

侧栏激活匹配：`location.pathname === item.to`（settings 精确匹配）。

- [ ] **Step 2: 移除 PageHeader 设置齿轮**

删除 `Settings` import、`isSettings`、`NavLink to="/settings"` 整块；保留 `SidebarTrigger` + 标题 + 主题切换。

- [ ] **Step 3: 更新 routes/index.tsx**

```typescript
import { TaskListPage } from '@/pages/tasks';

const PAGE_META = {
  '/workbench': { title: '工作台', description: '导入 Excel 预演并执行建货号任务' },
  '/tasks': { title: '任务列表', description: '查看预演与执行详情' },
  '/settings': { title: '设置', description: 'ERP 凭证与外观' },
};

<Route path="/workbench" element={<WorkbenchPage />} />
<Route path="/tasks" element={<TaskListPage />} />
<Route path="/settings" element={<SettingsPage />} />
<Route path="/tools/sku-import" element={<Navigate to="/workbench" replace />} />
```

- [ ] **Step 4: 删除 sku-import.tsx**

确认无其他 import 后删除文件。

- [ ] **Step 5: typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/layout/ src/renderer/routes/index.tsx
git rm src/renderer/pages/sku-import.tsx
git commit -m "refactor(nav): three-page sidebar, remove sku-import route and header settings"
```

---

### Task 9: 自适应布局收尾

**Files:**
- Modify: `src/renderer/tools/sku-import/preview-row.tsx`
- Modify: `src/renderer/tools/sku-import/task-detail-panel.tsx`
- Modify: `src/renderer/pages/workbench.tsx`
- Modify: `src/renderer/pages/tasks.tsx`

- [ ] **Step 1: 统一 flex 链**

确认链路：`AppShell` → `Outlet` wrapper `min-h-0 flex-1 overflow-hidden` → `PageSurface h-full` → `PagePanelBody flex-1 overflow-auto`。

- [ ] **Step 2: PreviewRow 窄屏**

`< xl` 使用 `flex flex-col gap-2`；`xl:` 前缀启用 grid 表头（表头放在 task-detail-panel 内，同样 `hidden xl:grid`）。

- [ ] **Step 3: 移除残余固定高度**

Grep 确认无 `h-[420px]`、`h-[280px]`、`max-h-[200px]` 在建货号相关 renderer 文件。

Run: `rg 'h-\[(420|280|200)px\]' src/renderer/`
Expected: 无匹配

- [ ] **Step 4: Commit**

```bash
git add src/renderer/
git commit -m "fix(ui): responsive flex layout for workbench and task list"
```

---

### Task 10: 全量验证

**Files:** （无新文件）

- [ ] **Step 1: 自动化**

Run: `pnpm run typecheck && pnpm run test`
Expected: 全部 PASS

- [ ] **Step 2: 手动验收清单**

1. 侧栏：工作台 / 任务列表 / 设置；顶栏无齿轮
2. 工作台：选文件 → 预演 → 摘要出现 → 执行 → 状态 completed
3. 「查看详情」→ `/tasks?expand=...` 自动展开
4. 任务列表：展开 A 再点 B，A 收起
5. 设置保存 Cookie + companyId + baseUrl，重启后预演成功（不依赖 `.env`）
6. 窗口 1024×640 ↔ 全屏：内容随高度扩展，无异常横向滚动

- [ ] **Step 3: 更新 AGENTS.md（可选小改）**

在导航规范处注明：设置入口在侧栏第三项（与现产品决策一致）。若团队希望保持 AGENTS 为唯一规范源，追加一句「本应用 v0.2 起设置移入侧栏」。

- [ ] **Step 4: Commit（若有 AGENTS 改动）**

```bash
git add AGENTS.md
git commit -m "docs: align AGENTS nav spec with sidebar settings entry"
```

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| 侧栏三项导航 | Task 8 |
| 工作台最新任务摘要 + 执行 | Task 6 |
| 任务列表手风琴单项展开 | Task 7 |
| 列表可执行/删除 | Task 7 |
| 设置 ERP 三项 + 外观 | Task 1–3 |
| 顶栏无设置齿轮 | Task 8 |
| getErpWebConfig 读 store | Task 2 |
| 删除 sku-import 页 | Task 8 |
| 自适应布局 | Task 4, 9 |
| `/tools/sku-import` 重定向 | Task 8 |
| CLI 仍用 .env | 无改动（符合 spec） |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-app-navigation-ui-redesign.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Task 派发独立 subagent，任务间 review，迭代快  
2. **Inline Execution** — 本会话按 Task 顺序直接实现，checkpoint 处暂停确认  

你想用哪种方式开始实现？
