# my-app UI 迁移设计

**日期：** 2026-06-30  
**状态：** 已实现  
**背景：** 抛弃当前 shadcn/ui 暗色设计体系，从 Kimi Agent 工作台改版 `my-app` 静态构建产物反推 UI，严格复刻暖色浅色视觉与交互；保留 Electron main/preload/core/tools IPC 架构不变。

**参考素材：**

- `/home/hayreal/文档/.../Kimi_Agent_工作台功能改版/my-app/`（HTML/CSS 构建产物）
- `my-app/tailwind.config.ts`（色板与 spacing）
- `my-app/../tech-spec.md`（组件与动画清单，仅作辅助）

**取代文档：** `2026-06-28-app-navigation-ui-redesign-design.md`（旧三页暗色导航规范作废，由本文档替代）

---

## 1. 已确认决策

| # | 议题 | 决策 |
|---|------|------|
| 1 | 参考来源 | 仅静态 HTML 反推，**无 React 源码** |
| 2 | 实现路线 | **方案 1**：渲染层整体替换，删除 shadcn/ui |
| 3 | 侧栏导航 | **三项**：工作台、历史记录、配置管理 |
| 4 | 删除页面 | 内嵌快麦、旧设置页、旧任务列表页 |
| 5 | 工作台步骤 | **3 步**：导入 Excel → 批量创建 → 创建结果 |
| 6 | 删除步骤 | 数据预览、编码预览（后端仍预演，UI 不单独展示） |
| 7 | 预演时机 | 选文件后**自动预演**；成功进入第 2 步 |
| 8 | 配置管理 | ERP 连接 Tab **可保存**；品牌/配件/编码规则/分类 Tab **UI 外壳** |
| 9 | ERP 凭证入口 | 配置管理 → ERP 连接 Tab |
| 10 | 顶栏连接状态 | **只读**胶囊；点击跳转 `/config?tab=erp` |
| 11 | 主题 | **仅浅色暖色**；移除暗色、跟随系统、`ThemeProvider` |
| 12 | 动效 | 引入 `framer-motion`，还原 HTML 关键动画 |
| 13 | 业务接线 | 工作台 + 历史记录接真实 IPC；配置仅 ERP Tab 接 IPC |
| 14 | Tailwind | **保持 v4**；`@theme` 映射 my-app 色板 |

---

## 2. 目标与非目标

### 目标

- 渲染进程 UI 完全替换为 my-app 暖色设计：顶栏 + 188px 侧栏 + 主内容区。
- 从 HTML/CSS 反推共享组件（手风琴、步骤条、拖拽区、表格等），不保留 shadcn/ui。
- 工作台 3 步手风琴承载建货号主流程；历史记录展示任务列表；配置管理承载 ERP 凭证。
- 保留 `window.kuaimai` IPC 边界；`hooks/use-sku-import-tasks` 等业务 hook 复用。

### 非目标（本期不做）

- 内嵌快麦 iframe 页面。
- 配置管理品牌/配件/编码规则/分类的 CRUD 后端与 IPC。
- 暗色主题与主题切换。
- main/preload/core/tools 业务逻辑重构、任务 JSON 格式变更。
- 结果 Excel 导出（UI 保留按钮，无 IPC 时 disabled）。
- 历史记录时间范围筛选（UI 保留，逻辑 Phase 2）。
- CLI 脚本改为读 `userData/store.json`。

---

## 3. 架构

```
Renderer（新 UI）→ preload → Main → core / tools
```

- 渲染进程仅经 `window.kuaimai` 访问特权能力。
- 不新增 IPC channel（ERP 沿用 `config:*`，建货号沿用 `sku-import:*`）。

### 依赖变更（renderer）

| 操作 | 包 |
|------|-----|
| 新增 | `framer-motion`、`@fontsource/noto-sans-sc` |
| 移除 | shadcn 相关 `@radix-ui/*`、`class-variance-authority`（无其他引用时） |
| 保留 | `tailwindcss` v4、`lucide-react`、`react-router-dom`、`zod` |

---

## 4. 导航与路由

### 侧栏

| 项 | 路由 | 图标 |
|----|------|------|
| 工作台 | `/workbench` | `LayoutDashboard` |
| 历史记录 | `/history` | `History` |
| 配置管理 | `/config` | `Settings` |

### 布局壳（AppLayout）

```
┌─────────────────────────────────────────────────────────────┐
│ Header h-14 │ Logo + 标题 + [连接状态胶囊 · 只读]              │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │ Main（flex-1, overflow-y-auto, p-6）              │
│ 188px    │ max-w-6xl mx-auto                                 │
│ 3 items  │                                                   │
│ footer   │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

- 整体：`h-screen flex flex-col bg-cream`
- 侧栏：`w-sidebar`（188px）、`bg-cream-warm`、`border-r border-beige`
- 导航激活：`bg-charcoal text-cream`；未激活：`text-charcoal hover:bg-cream-light`
- 侧栏底部：静态 `v2.0` / `快麦开放平台`
- 顶栏标题：`快麦ERP批量建货号工具`（与 my-app `index.html` 一致）

### 连接状态胶囊

- 数据源：`kuaimai.config.getSecretsMeta()`
- **已连接**：`erpCookie` 与 `erpCompanyId` 均为 true → 绿点 +「已连接」
- **未连接**：灰点 +「未连接」
- 点击：`navigate('/config?tab=erp')`，不可内联编辑

### 路由表

```
/                     → redirect /workbench
/workbench            → WorkbenchPage
/history              → HistoryPage
/config               → ConfigPage（?tab= 选 Tab）
/tasks                → redirect /history
/settings             → redirect /config?tab=erp
/tools/sku-import     → redirect /workbench
*                     → redirect /workbench
```

---

## 5. 设计系统

### 色板（Tailwind v4 `@theme`）

从 `my-app/tailwind.config.ts` 迁入：

| Token | 值 |
|-------|-----|
| `cream` | `#FBF7EF`（warm `#F7EFE1`, light `#F5E9D3`, white `#FDFBF5`） |
| `charcoal` | `#1D1D1D` |
| `amber` | `#FF825B`（dark `#E87652`） |
| `beige` | `#E9DCCF` |
| `brown-soft` | `#A18D7C` |
| `warmgray` | `#9B9B9B` |
| `status-success` | `#4CAF50` |
| `status-danger` | `#F44336` |
| `spacing.sidebar` | `188px` |

### 字体

- `@fontsource/noto-sans-sc`
- `font-sans`: Noto Sans SC + 系统中文栈

### 动画（`lib/animations.ts`）

```typescript
export const EASINGS = {
  smooth: [0.215, 0.61, 0.355, 1],
  easeOut: [0.165, 0.84, 0.44, 1],
  spring: [0.175, 0.885, 0.32, 1.275],
} as const;

export const DURATIONS = {
  pageEnter: 0.4,
  contentSwitch: 0.3,
  accordion: 0.2,
  buttonHover: 0.15,
} as const;
```

- 页面入场、手风琴 `height`/`opacity`、步骤指示器、按钮 `whileTap` 使用 `framer-motion`
- 表格行悬停：`transition-colors` CSS

### 共享组件（从 HTML 反推）

| 组件 | 用途 |
|------|------|
| `AppLayout` / `Header` / `Sidebar` / `SidebarNavItem` | 布局壳 |
| `StepIndicator` | 工作台 3 步进度条 |
| `AccordionStep` | 手风琴单步容器 |
| `DragDropZone` | Excel 上传区 |
| `DataTable` | 历史/结果/配置表格 |
| `StatusBadge` | 状态胶囊 |
| `SegmentedControl` | 成功/失败切换 |
| `StatCard` | 结果统计三格 |
| `Button` / `Input` | 轻量 primitives（非 shadcn） |

---

## 6. 页面设计

### 6.1 工作台（`/workbench`）

**职责：** 导入 Excel → 自动预演 → 批量创建 → 展示结果。

#### 步骤指示器

`导入Excel` → `批量创建` → `创建结果`（样式对照 HTML 5 步版，仅保留 3 步）

#### 状态机

```
idle → previewing → ready → executing → done
         ↓ fail       ↓ fail
      停留 step1    停留 step2
```

| 步骤 | UI | IPC |
|------|-----|-----|
| 1 导入 Excel | `DragDropZone`；点击或选文件后展示文件名 | `pickFile` → 立即 `preview` |
| 2 批量创建 | 摘要：文件名、`readyCount`；按钮「开始创建」 | `execute(taskId)` |
| 3 创建结果 | 成功/失败/总计 + Tab + 表格 + 导出/重试按钮 | 读 `executeResult` |

#### 手风琴规则

- 当前步：`border-amber` + `进行中` badge
- **同时只展开一步**
- 预演成功：自动展开 step 2，收起 step 1
- 执行成功：自动展开 step 3
- step 2 未预演成功时显示「请先导入 Excel」

#### 结果区按钮

| 按钮 | 首期行为 |
|------|----------|
| 导出结果 Excel | disabled + tooltip「即将支持」（无 IPC） |
| 重试全部失败 | 若后端无批量重试 IPC，disabled + tooltip「即将支持」 |

#### 错误与引导

- 错误信息内联展示于当前步骤
- 消息含 Cookie/设置/凭证 → 链接 `/config?tab=erp`
- 可选：进入工作台时 `getSecretsMeta()`，未连接显示顶部提示条

### 6.2 历史记录（`/history`）

**职责：** 展示全部建货号任务历史。

| 区域 | 行为 |
|------|------|
| 搜索框 | 按 `fileName` / `taskId` 客户端过滤 |
| 时间范围按钮 | UI 外壳，点击不筛选 |
| 表格列 | 时间、文件名、操作类型、行数、成功、失败、状态 |
| 空态 | 「暂无历史记录」 |
| 操作列「查看」 | 跳转 `/workbench`，加载该任务：已执行 → step 3；仅预演 → step 2 |

**数据：** `useSkuImportTasks` → `listTasks` / `getTask`

**不做：** 行内手风琴详情（旧 `/tasks` 交互废弃）

### 6.3 配置管理（`/config`）

URL：`?tab=erp|brands|accessories|rules|categories`（默认 `erp`）

#### Tab 列表

| Tab | 功能 |
|-----|------|
| ERP 连接 | Cookie、companyId、erpBaseUrl 表单；调用 `config:set-secrets` / `config:set-app` |
| 品牌配置 | **已接持久化**：增删改 + 启用切换 + 搜索；写入 `config/sku-import/config.json`（`sku-import:config-get/set`） |
| 配件配置 | **已接持久化**：同品牌，字段为名称 / SKU 编码 / 所属品牌 / 状态 |
| 编码规则 | 只读展示 `constants.ts` 当前值（如 `SKU_CODE_PREFIX`） |
| 分类配置 | 外壳 + mock |

> 更新（2026-07-01）：品牌 / 配件配置已从「UI 外壳」升级为本地持久化 CRUD，通过 `main/services/sku-import-config.ts` 读写 `userData/config/sku-import/config.json`，schema 见 `shared/schemas/sku-import-config.ts`。导入 / 导出仍未实现（Phase 2）。

#### 页头「保存配置」

- 仅 `tab=erp` 时显示且可用
- 其他 Tab 隐藏或 disabled

#### ERP Tab 字段（迁移自现 `settings.tsx`）

- Cookie（password，不回显明文）
- companyId
- erpBaseUrl（默认 `https://erp.superboss.cc`）
- 保存后刷新顶栏连接状态

---

## 7. 删除与迁移清单

### 删除

```
src/renderer/components/ui/*
src/renderer/components/layout/app-sidebar.tsx
src/renderer/components/layout/AppShell.tsx
src/renderer/components/layout/page-header/
src/renderer/components/layout/page-canvas/
src/renderer/components/layout/settings-layout/
src/renderer/components/layout/sidebar/
src/renderer/hooks/use-theme.tsx
src/renderer/pages/settings.tsx
src/renderer/pages/tasks.tsx
src/renderer/tools/sku-import/task-summary-card.tsx
src/renderer/tools/sku-import/preview-row.tsx（若无其他引用）
```

### 保留并复用

```
src/renderer/hooks/use-sku-import-tasks.ts
src/renderer/lib/kuaimai-client.ts
src/renderer/tools/sku-import/task-detail-panel.tsx（历史查看详情可 Phase 2 复用或删除）
src/renderer/tools/sku-import/task-status-labels.ts
```

### 新建

```
src/renderer/components/layout/app-layout.tsx
src/renderer/components/layout/header.tsx
src/renderer/components/layout/sidebar.tsx
src/renderer/components/shared/*
src/renderer/components/ui/button.tsx（新 primitives，非 shadcn）
src/renderer/pages/workbench.tsx（重写）
src/renderer/pages/history.tsx
src/renderer/pages/config.tsx
src/renderer/lib/animations.ts
src/renderer/styles/globals.css（重写）
```

---

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| `preview` / `execute` IPC 失败 | 步内错误文案 + `logRenderer` |
| 凭证未配置 | 顶栏灰点；工作台/预演错误引导至 ERP Tab |
| 配置 mock 按钮点击 | toast「即将支持」 |
| 窗口缩放 | `h-screen` + flex；Main `overflow-y-auto` |

---

## 9. 测试与验收

### 自动

- `pnpm run typecheck` 通过
- `pnpm run test` 通过（core/tools 未改，现有用例应绿）

### 手动验收清单

- [ ] 启动后落地 `/workbench`，暖色布局与 my-app 视觉一致
- [ ] 拖拽/选择 Excel → 自动预演 → 进入 step 2
- [ ] 批量创建 → step 3 展示统计与表格
- [ ] `/history` 列表与搜索过滤
- [ ] 「查看」跳转工作台对应步骤
- [ ] `/config?tab=erp` 保存凭证；顶栏状态更新
- [ ] mock 配置 Tab 按钮 disabled 或 toast
- [ ] `/tasks`、`/settings` 重定向正确
- [ ] 窗口缩放无布局挤压

### 文档

- 实现完成后更新 `AGENTS.md` §3（布局、导航、主题、路由表）

---

## 10. Phase 2（后续，不在本期）

- 配置管理 CRUD 后端（`config/sku-import/` + IPC）
- 结果 Excel 导出 IPC
- 历史记录时间范围筛选
- 批量重试失败项
- 历史记录行内详情展开

---

## 11. 与 AGENTS.md 的差异（实现后需同步）

| AGENTS.md 现行 | 本设计 |
|----------------|--------|
| 默认暗色 + 主题切换 | 仅浅色暖色，无切换 |
| 工作台 / 任务列表 / 设置 | 工作台 / 历史记录 / 配置管理 |
| 侧栏 12rem + PageHeader | 顶栏 Header + 侧栏 188px，无 PageHeader |
| shadcn/ui | 自定义 primitives + Tailwind |
