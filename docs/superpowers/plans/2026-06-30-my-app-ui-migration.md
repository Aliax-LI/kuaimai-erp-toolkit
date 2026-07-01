# my-app UI 迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Electron 渲染层 UI 完全替换为 my-app 暖色浅色设计（从静态 HTML 反推），三页导航（工作台 / 历史记录 / 配置管理），工作台 3 步手风琴接真实 IPC。

**Architecture:** 删除 shadcn/ui 与旧 layout；新建 AppLayout（顶栏 + 188px 侧栏）+ shared 组件 + 三页面；业务逻辑复用 `useSkuImportTasks` 与现有 `kuaimai.*` IPC；可测试逻辑抽到 `src/shared/constants/navigation.ts` 与 `src/renderer/lib/*`。

**Tech Stack:** Electron Forge + Vite、React 19、React Router 7、Tailwind CSS 4、framer-motion、lucide-react、Vitest

**Spec:** `docs/superpowers/specs/2026-06-30-my-app-ui-migration-design.md`

**参考 HTML：** `/home/hayreal/文档/xwechat_files/wxid_ci85g8k9nv0622_a021/msg/file/2026-06/Kimi_Agent_工作台功能改版/my-app/index.html`（及 `DashboardPage.html`、`HistoryPage.html`、`ConfigPage.html`）

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/shared/constants/navigation.ts` | 路由常量、侧栏项、legacy 重定向、ConfigTab 类型 |
| `tests/navigation.test.ts` | 导航常量与纯函数单测 |
| `src/renderer/lib/connection-status.ts` | `isErpConnected(secretsMeta)` |
| `src/renderer/lib/workbench-step.ts` | 任务 → 工作台步骤 (1/2/3) |
| `tests/workbench-step.test.ts` | 步骤解析单测 |
| `src/renderer/lib/animations.ts` | EASINGS / DURATIONS |
| `src/renderer/styles/globals.css` | cream 色板、`@theme`、`scrollbar-thin` |
| `src/renderer/components/ui/button.tsx` | 轻量 Button |
| `src/renderer/components/ui/input.tsx` | 轻量 Input |
| `src/renderer/components/shared/*.tsx` | StepIndicator、AccordionStep、DragDropZone 等 |
| `src/renderer/components/layout/app-layout.tsx` | 整体布局壳 |
| `src/renderer/components/layout/header.tsx` | 顶栏 + 连接胶囊 |
| `src/renderer/components/layout/sidebar.tsx` | 侧栏导航 |
| `src/renderer/hooks/use-connection-status.ts` | 轮询/刷新 secrets meta |
| `src/renderer/hooks/use-toast.tsx` | 简单 toast（配置 mock 按钮用） |
| `src/renderer/pages/workbench.tsx` | 3 步手风琴 + IPC |
| `src/renderer/pages/history.tsx` | 任务历史表格 |
| `src/renderer/pages/config.tsx` | 5 Tab（ERP 可保存 + mock） |
| `src/renderer/routes/index.tsx` | 新路由表 |
| `src/renderer/app.tsx` | 移除 ThemeProvider |
| `src/renderer/main.tsx` | 引入 Noto 字体 |
| `package.json` | 增 framer-motion、@fontsource/noto-sans-sc；删 radix/cva |

**删除（Task 10）：** 旧 `components/ui/*`（shadcn）、旧 layout、settings.tsx、tasks.tsx、use-theme.tsx、task-summary-card.tsx 等。

---

### Task 1: 导航常量与纯函数（TDD）

**Files:**
- Create: `src/shared/constants/navigation.ts`
- Create: `tests/navigation.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/navigation.test.ts
import { describe, expect, it } from 'vitest';

import {
  APP_ROUTES,
  CONFIG_TABS,
  LEGACY_REDIRECTS,
  resolveLegacyRedirect,
} from '@shared/constants/navigation';

describe('navigation constants', () => {
  it('defines three primary routes', () => {
    expect(APP_ROUTES.WORKBENCH).toBe('/workbench');
    expect(APP_ROUTES.HISTORY).toBe('/history');
    expect(APP_ROUTES.CONFIG).toBe('/config');
  });

  it('redirects legacy paths', () => {
    expect(resolveLegacyRedirect('/tasks')).toBe('/history');
    expect(resolveLegacyRedirect('/settings')).toBe('/config?tab=erp');
    expect(resolveLegacyRedirect('/tools/sku-import')).toBe('/workbench');
    expect(resolveLegacyRedirect('/workbench')).toBeNull();
  });

  it('lists config tabs including erp first', () => {
    expect(CONFIG_TABS[0]).toBe('erp');
    expect(CONFIG_TABS).toContain('brands');
  });
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `pnpm exec vitest run tests/navigation.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: 实现 navigation.ts**

```typescript
// src/shared/constants/navigation.ts
export const APP_ROUTES = {
  WORKBENCH: '/workbench',
  HISTORY: '/history',
  CONFIG: '/config',
} as const;

export const CONFIG_TABS = ['erp', 'brands', 'accessories', 'rules', 'categories'] as const;
export type ConfigTab = (typeof CONFIG_TABS)[number];

export const LEGACY_REDIRECTS: Record<string, string> = {
  '/tasks': APP_ROUTES.HISTORY,
  '/settings': `${APP_ROUTES.CONFIG}?tab=erp`,
  '/tools/sku-import': APP_ROUTES.WORKBENCH,
};

export function resolveLegacyRedirect(pathname: string): string | null {
  return LEGACY_REDIRECTS[pathname] ?? null;
}

export function parseConfigTab(value: string | null): ConfigTab {
  if (value && (CONFIG_TABS as readonly string[]).includes(value)) {
    return value as ConfigTab;
  }
  return 'erp';
}

export const WORKBENCH_STEPS = ['import', 'create', 'result'] as const;
export type WorkbenchStep = (typeof WORKBENCH_STEPS)[number];

export const WORKBENCH_STEP_LABELS: Record<WorkbenchStep, string> = {
  import: '导入Excel',
  create: '批量创建',
  result: '创建结果',
};
```

- [ ] **Step 4: 运行测试确认 PASS**

Run: `pnpm exec vitest run tests/navigation.test.ts`  
Expected: PASS

---

### Task 2: 连接状态与工作台步骤纯函数（TDD）

**Files:**
- Create: `src/renderer/lib/connection-status.ts`
- Create: `src/renderer/lib/workbench-step.ts`
- Create: `tests/workbench-step.test.ts`
- Modify: `vitest.config.ts`（添加 `@` alias 若需从 tests 引用 renderer lib — 优先把纯函数放 `@shared` 或 tests 只测 workbench-step 通过相对 import）

将 `workbench-step.ts` 放在 **`src/shared/workbench-step.ts`** 以便 vitest 测试（与 navigation 同层）。

- [ ] **Step 1: 写失败测试**

```typescript
// tests/workbench-step.test.ts
import { describe, expect, it } from 'vitest';

import { isErpConnected } from '../src/renderer/lib/connection-status';
import {
  resolveWorkbenchStepFromSummary,
  resolveWorkbenchStepIndex,
} from '../src/shared/workbench-step';
import type { SkuImportTaskSummary } from '../src/shared/types/sku-import';

describe('isErpConnected', () => {
  it('returns true when cookie and companyId configured', () => {
    expect(isErpConnected({ erpCookie: true, erpCompanyId: true })).toBe(true);
  });

  it('returns false when either missing', () => {
    expect(isErpConnected({ erpCookie: true, erpCompanyId: false })).toBe(false);
  });
});

describe('resolveWorkbenchStepFromSummary', () => {
  const base: SkuImportTaskSummary = {
    taskId: 't1',
    filePath: '/a.xlsx',
    fileName: 'a.xlsx',
    status: 'previewed',
    createdAt: '',
    updatedAt: '',
    totalRows: 1,
    readyCount: 1,
    blockedCount: 0,
    skippedCount: 0,
  };

  it('returns create for previewed task', () => {
    expect(resolveWorkbenchStepFromSummary(base)).toBe('create');
  });

  it('returns result for completed task', () => {
    expect(
      resolveWorkbenchStepFromSummary({ ...base, status: 'completed', succeededCount: 1 }),
    ).toBe('result');
  });

  it('maps step to 1-based index', () => {
    expect(resolveWorkbenchStepIndex('import')).toBe(1);
    expect(resolveWorkbenchStepIndex('result')).toBe(3);
  });
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `pnpm exec vitest run tests/workbench-step.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现**

```typescript
// src/renderer/lib/connection-status.ts
export interface SecretsMeta {
  erpCookie?: boolean;
  erpCompanyId?: boolean;
}

export function isErpConnected(meta: SecretsMeta): boolean {
  return Boolean(meta.erpCookie && meta.erpCompanyId);
}
```

```typescript
// src/shared/workbench-step.ts
import type { WorkbenchStep } from '@shared/constants/navigation';
import type { SkuImportTaskSummary } from '@shared/types/sku-import';

export function resolveWorkbenchStepFromSummary(task: SkuImportTaskSummary): WorkbenchStep {
  if (task.status === 'completed' || task.status === 'failed') {
    return 'result';
  }
  if (task.status === 'previewed' || task.status === 'executing') {
    return task.status === 'executing' ? 'create' : 'create';
  }
  return 'import';
}

export function resolveWorkbenchStepIndex(step: WorkbenchStep): number {
  const map: Record<WorkbenchStep, number> = { import: 1, create: 2, result: 3 };
  return map[step];
}
```

- [ ] **Step 4: 运行测试确认 PASS**

Run: `pnpm exec vitest run tests/workbench-step.test.ts`  
Expected: PASS

---

### Task 3: 依赖与设计令牌

**Files:**
- Modify: `package.json`
- Create: `src/renderer/lib/animations.ts`
- Rewrite: `src/renderer/styles/globals.css`
- Modify: `src/renderer/main.tsx`

- [ ] **Step 1: 安装依赖**

```bash
pnpm add framer-motion @fontsource/noto-sans-sc
pnpm remove @radix-ui/react-label @radix-ui/react-slot @radix-ui/react-switch radix-ui class-variance-authority
```

（移除后若 typecheck 报错，在 Task 10 删旧组件后应消除；`clsx` + `tailwind-merge` 保留给 `cn()`）

- [ ] **Step 2: 创建 animations.ts**

```typescript
// src/renderer/lib/animations.ts
export const EASINGS = {
  smooth: [0.215, 0.61, 0.355, 1] as const,
  easeOut: [0.165, 0.84, 0.44, 1] as const,
  spring: [0.175, 0.885, 0.32, 1.275] as const,
};

export const DURATIONS = {
  pageEnter: 0.4,
  contentSwitch: 0.3,
  accordion: 0.2,
  buttonHover: 0.15,
} as const;
```

- [ ] **Step 3: 重写 globals.css**

```css
@import 'tailwindcss';
@import '@fontsource/noto-sans-sc/400.css';
@import '@fontsource/noto-sans-sc/500.css';

@theme inline {
  --font-sans: 'Noto Sans SC', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --color-cream: #fbf7ef;
  --color-cream-warm: #f7efe1;
  --color-cream-light: #f5e9d3;
  --color-cream-white: #fdfbf5;
  --color-charcoal: #1d1d1d;
  --color-amber: #ff825b;
  --color-amber-dark: #e87652;
  --color-beige: #e9dccf;
  --color-brown-soft: #a18d7c;
  --color-warmgray: #9b9b9b;
  --color-status-success: #4caf50;
  --color-status-warning: #ff9800;
  --color-status-danger: #f44336;
  --color-status-info: #2196f3;
  --spacing-sidebar: 188px;
}

@layer base {
  body {
    @apply bg-cream font-sans text-charcoal antialiased;
    margin: 0;
  }

  #root {
    min-height: 100vh;
  }
}

@utility scrollbar-thin {
  scrollbar-width: thin;
}
```

- [ ] **Step 4: main.tsx 确认仍 import globals.css**

- [ ] **Step 5: 验证**

Run: `pnpm run typecheck`（允许旧 shadcn 文件暂存报错，Task 10 后须全绿）

---

### Task 4: UI Primitives（Button / Input）

**Files:**
- Create: `src/renderer/components/ui/button.tsx`
- Create: `src/renderer/components/ui/input.tsx`

- [ ] **Step 1: Button**（对照 HTML class：`bg-amber hover:bg-amber-dark text-white rounded-lg` / `bg-charcoal text-cream` / `border border-beige`）

```tsx
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-amber hover:bg-amber-dark text-white shadow-sm',
  secondary: 'bg-cream-white border border-beige text-charcoal hover:bg-cream-warm',
  ghost: 'text-brown-soft hover:text-charcoal',
  dark: 'bg-charcoal text-cream hover:bg-charcoal/90',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  ),
);
Button.displayName = 'Button';
```

- [ ] **Step 2: Input**（对照 ConfigPage search input class）

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-lg border border-beige bg-cream-white px-3 text-sm text-charcoal',
        'focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/20',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

---

### Task 5: 共享组件（shared/）

**Files:**
- Create: `src/renderer/components/shared/step-indicator.tsx`
- Create: `src/renderer/components/shared/accordion-step.tsx`
- Create: `src/renderer/components/shared/drag-drop-zone.tsx`
- Create: `src/renderer/components/shared/status-badge.tsx`
- Create: `src/renderer/components/shared/segmented-control.tsx`
- Create: `src/renderer/components/shared/stat-card.tsx`

- [ ] **Step 1: StepIndicator** — props: `steps: string[]`, `currentIndex: number`（1-based），对照 `DashboardPage.html` 圆点 + 连接线

- [ ] **Step 2: AccordionStep** — props: `stepNumber`, `title`, `active`, `completed`, `inProgress?`, `expanded`, `onToggle`, `children`；`framer-motion` 展开 `AnimatePresence` + `motion.div` height

- [ ] **Step 3: DragDropZone** — props: `onPick`, `loading?`, `fileName?`；点击调 `onPick`；Electron 首期可不做真实 drag-drop 文件路径（无 web File path），UI 仍展示拖拽样式

- [ ] **Step 4: StatusBadge / SegmentedControl / StatCard** — 从结果区 HTML 提取 class

---

### Task 6: 布局壳（AppLayout / Header / Sidebar）

**Files:**
- Create: `src/renderer/components/layout/app-layout.tsx`
- Create: `src/renderer/components/layout/header.tsx`
- Create: `src/renderer/components/layout/sidebar.tsx`
- Create: `src/renderer/hooks/use-connection-status.ts`

- [ ] **Step 1: use-connection-status.ts**

```typescript
import { useCallback, useEffect, useState } from 'react';

import { isErpConnected, type SecretsMeta } from '@/lib/connection-status';
import { kuaimai } from '@/lib/kuaimai-client';

export function useConnectionStatus() {
  const [meta, setMeta] = useState<SecretsMeta>({});

  const refresh = useCallback(async () => {
    const next = await kuaimai.config.getSecretsMeta();
    setMeta(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { connected: isErpConnected(meta), refresh };
}
```

- [ ] **Step 2: Header** — 标题「快麦ERP批量建货号工具」；Database 图标方块；连接胶囊点击 `navigate('/config?tab=erp')`

- [ ] **Step 3: Sidebar** — 三项 `NavLink`；`useLocation` 高亮；底部 v2.0 文案

- [ ] **Step 4: AppLayout**

```tsx
export function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-cream">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

### Task 7: 路由与 App 入口

**Files:**
- Rewrite: `src/renderer/routes/index.tsx`
- Modify: `src/renderer/app.tsx`

- [ ] **Step 1: routes/index.tsx**

```tsx
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { ConfigPage } from '@/pages/config';
import { HistoryPage } from '@/pages/history';
import { WorkbenchPage } from '@/pages/workbench';
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
        <Route path={APP_ROUTES.WORKBENCH} element={<WorkbenchPage />} />
        <Route path={APP_ROUTES.HISTORY} element={<HistoryPage />} />
        <Route path={APP_ROUTES.CONFIG} element={<ConfigPage />} />
      </Route>
      <Route path="/tasks" element={<LegacyRedirect />} />
      <Route path="/settings" element={<LegacyRedirect />} />
      <Route path="/tools/sku-import" element={<LegacyRedirect />} />
      <Route path="*" element={<Navigate to={APP_ROUTES.WORKBENCH} replace />} />
    </Routes>
  );
}
```

- [ ] **Step 2: app.tsx 移除 ThemeProvider**

```tsx
import { HashRouter } from 'react-router-dom';

import { AppRoutes } from '@/routes';

export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
```

---

### Task 8: 配置管理页

**Files:**
- Create: `src/renderer/pages/config.tsx`
- Create: `src/renderer/hooks/use-toast.tsx`（或 `components/shared/toast-host.tsx`）

- [ ] **Step 1: URL tab 同步** — `useSearchParams` + `parseConfigTab`；切换 Tab 更新 `?tab=`

- [ ] **Step 2: ERP Tab** — 迁移现 `settings.tsx` 表单逻辑；保存调 `kuaimai.config.setSecrets` + `setApp`；保存后 `window.dispatchEvent(new Event('kuaimai:secrets-updated'))` 供 Header refresh（或在 AppLayout 用 context）

- [ ] **Step 3: Mock Tabs** — 品牌/配件/分类：静态 mock 表格（wkau/lovi/nimi）；工具栏按钮 `onClick` → toast「即将支持」

- [ ] **Step 4: 编码规则 Tab** — 只读展示 `@shared` 或 re-export `SKU_CODE_PREFIX` 等常量（可在 renderer 建 `lib/sku-import-display-constants.ts` 映射 tools 常量）

- [ ] **Step 5: 页头保存按钮** — 仅 `tab === 'erp'` 可见

---

### Task 9: 历史记录页

**Files:**
- Create: `src/renderer/pages/history.tsx`

- [ ] **Step 1: 列表** — `useSkuImportTasks` + `refreshTasks` on mount

- [ ] **Step 2: 搜索** — `useState` filter `fileName` / `taskId`

- [ ] **Step 3: 表格列** — 时间（`formatTaskTime` from task-status-labels）、文件名、操作（固定「导入」）、行数、成功/失败、状态 badge

- [ ] **Step 4: 查看按钮** — `navigate(\`/workbench?taskId=${id}\`)`

- [ ] **Step 5: 时间范围按钮** — 渲染即可，点击 toast「即将支持」

---

### Task 10: 工作台页（核心）

**Files:**
- Rewrite: `src/renderer/pages/workbench.tsx`

- [ ] **Step 1: URL 参数** — `taskId` from searchParams；mount 时若有 taskId 则 `loadTaskDetail` 并 `resolveWorkbenchStepFromSummary` 设 activeStep

- [ ] **Step 2: 状态** — `activeStep: WorkbenchStep`, `expandedStep`, `currentTaskId`, `taskDetail`, `error`, `filePath`

- [ ] **Step 3: 导入流程**

```typescript
const handlePick = async () => {
  setError(null);
  const picked = await kuaimai.skuImport.pickFile();
  if (!picked) return;
  setFilePath(picked);
  try {
    const detail = await previewFile(picked);
    setCurrentTaskId(detail.taskId /* 或 preview 返回结构中的 id */);
    setTaskDetail(detail);
    setExpandedStep('create');
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
    setExpandedStep('import');
  }
};
```

（注：`previewFile` 返回 `SkuImportTaskDetail`，含 `taskId`）

- [ ] **Step 4: 执行流程** — `executeTask(currentTaskId)` → 刷新 detail → `setExpandedStep('result')`

- [ ] **Step 5: 结果区** — 从 `taskDetail.executeResult` 渲染 StatCard + 表格（成功/失败 Tab 过滤 `executeResult.rows`）

- [ ] **Step 6: 导出/重试按钮** — `disabled title="即将支持"`

- [ ] **Step 7: 凭证引导** — error 含 Cookie/设置 → `Link to="/config?tab=erp"`

- [ ] **Step 8: 渲染结构** — `StepIndicator` + 3× `AccordionStep`

---

### Task 11: 删除旧 UI 与清理依赖

**Files:**
- Delete: 见 Spec §7 删除清单
- Modify: `src/shared/constants/app.ts` — 更新 `SIDEBAR_WIDTH` 为 `188px` 或删除若不再引用
- Modify: `AGENTS.md` §3

- [ ] **Step 1: 删除旧文件**

```bash
rm -rf src/renderer/components/ui/alert.tsx src/renderer/components/ui/badge.tsx \
  src/renderer/components/ui/card.tsx src/renderer/components/ui/field.tsx \
  src/renderer/components/ui/label.tsx src/renderer/components/ui/scroll-area.tsx \
  src/renderer/components/ui/separator.tsx src/renderer/components/ui/sheet.tsx \
  src/renderer/components/ui/sidebar.tsx src/renderer/components/ui/skeleton.tsx \
  src/renderer/components/ui/switch.tsx src/renderer/components/ui/tooltip.tsx
rm -rf src/renderer/components/layout/app-sidebar.tsx \
  src/renderer/components/layout/AppShell.tsx \
  src/renderer/components/layout/page-header \
  src/renderer/components/layout/page-canvas \
  src/renderer/components/layout/settings-layout \
  src/renderer/components/layout/sidebar
rm -f src/renderer/hooks/use-theme.tsx \
  src/renderer/hooks/use-mobile.ts \
  src/renderer/pages/settings.tsx \
  src/renderer/pages/tasks.tsx \
  src/renderer/tools/sku-import/task-summary-card.tsx \
  src/renderer/tools/sku-import/preview-row.tsx \
  src/renderer/tools/sku-import/task-detail-panel.tsx
```

（保留 `task-status-labels.ts`；`task-detail-panel` 若 history 不用可删）

- [ ] **Step 2: 更新 AGENTS.md** — 导航三项、顶栏 Header、暖色主题、路由表、移除 shadcn 描述

- [ ] **Step 3: 更新 spec 状态** — `2026-06-30-my-app-ui-migration-design.md` 状态改为「已实现」

---

### Task 12: 全量验证

- [ ] **Step 1: typecheck**

Run: `pnpm run typecheck`  
Expected: 0 errors

- [ ] **Step 2: test**

Run: `pnpm run test`  
Expected: all pass（含 navigation + workbench-step 新测）

- [ ] **Step 3: 手动冒烟**

Run: `pnpm start`  
按 Spec §9 手动验收清单逐项勾选

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| 3 项导航 | Task 6, 7 |
| 顶栏连接胶囊只读 | Task 6 |
| 工作台 3 步 + 自动预演 | Task 10 |
| 历史记录 + 查看跳转 | Task 9 |
| 配置 ERP 可保存 + mock Tab | Task 8 |
| 暖色主题 / 无暗色 | Task 3, 11 |
| framer-motion | Task 4, 5 |
| legacy 路由重定向 | Task 1, 7 |
| 删除 shadcn | Task 11 |
| AGENTS.md 更新 | Task 11 |

## Self-Review Notes

- 纯函数已拆至 `@shared` / `renderer/lib` 并附 vitest，避免引入 RTL。
- Electron 拖拽文件路径：首期 UI 展示拖拽区，实际选文件走 `pickFile` IPC（与现逻辑一致）。
- `theme` 字段保留在 store schema 以免破坏现有 store 测试；UI 不再暴露切换。
- Header 刷新 secrets：推荐 `useConnectionStatus` + 自定义事件 `kuaimai:secrets-updated`（Task 8 保存后 dispatch）。

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-30-my-app-ui-migration.md`.**

两种执行方式：

1. **Subagent-Driven（推荐）** — 每个 Task 派发独立 subagent，任务间你做 review，迭代快  
2. **Inline Execution** — 在本会话按 Task 顺序直接实现，批次间设检查点

你选哪种？
