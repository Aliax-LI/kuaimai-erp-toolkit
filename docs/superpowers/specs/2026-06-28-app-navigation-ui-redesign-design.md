# 应用导航与 UI 重构设计

**日期：** 2026-06-28  
**状态：** 已评审  
**背景：** 建货号功能已集成至桌面应用；现需简化信息架构（三页导航）、拆分工作台与任务列表、统一 ERP 凭证配置来源，并修复窗口缩放时布局不自适应的问题。

---

## 1. 已确认决策

| # | 议题 | 决策 |
|---|------|------|
| 1 | 侧栏导航 | **三项**：工作台、任务列表、设置 |
| 2 | 工作台任务范围 | **始终展示全局最新预演任务**（`createdAt` 降序第一条） |
| 3 | 工作台信息量 | **摘要卡片**：统计 + 执行 +「查看详情」跳转任务列表 |
| 4 | 任务列表交互 | **手风琴内联展开**；**同时只展开一项** |
| 5 | 执行入口 | 工作台（最新任务）+ 任务列表（每条均可执行/删除） |
| 6 | 顶栏设置 | **移除齿轮**；设置仅从侧栏进入；顶栏保留主题切换 |
| 7 | 设置页内容 | **ERP 三项 + 外观**；移除账号登录、OSS 测试 |
| 8 | `.env` 范围 | **仅桌面应用不读**；CLI 脚本（如 `run-sku-smoke.mjs`）仍可用 `.env` |
| 9 | 实现路线 | **方案 1**：拆页面 + 抽共享组件；删除 `/tools/sku-import` |

---

## 2. 目标与非目标

### 目标

- 侧栏三分法导航，用户路径清晰：导入/预演 → 工作台执行 → 任务列表查详情。
- 工作台专注轻量操作；任务列表承载行级预演、执行结果与 D2 验证详情。
- ERP 凭证（Cookie、companyId、baseUrl）统一由设置页写入 `store.json`；应用运行时不再依赖根目录 `.env`。
- 主内容区随窗口放大缩小自适应，去除固定像素高度导致的挤压。

### 非目标（本版不做）

- 新增后端 IPC 或任务存储格式变更。
- 任务列表多项同时展开。
- CLI / 冒烟脚本改为读 `userData/store.json`。
- 设置页账号登录、OSS 上传测试能力。
- 多工具并存时的通用任务中心（当前仅建货号任务）。

---

## 3. 导航与路由

### 侧栏

| 项 | 路由 | 图标（建议） |
|----|------|--------------|
| 工作台 | `/workbench` | `LayoutDashboard` |
| 任务列表 | `/tasks` | `ListTodo` |
| 设置 | `/settings` | `Settings` |

### 顶栏（PageHeader）

- 保留：`SidebarTrigger`、页面标题/描述、主题切换（日/月）。
- 移除：设置齿轮 `NavLink`。

### 路由变更

```
/                    → redirect /workbench
/workbench           → WorkbenchPage（新建货号入口）
/tasks               → TaskListPage（手风琴任务列表）
/settings            → SettingsPage（精简）
/tools/sku-import    → redirect /workbench（兼容旧链接）
*                    → redirect /workbench
```

### 与 AGENTS.md 的差异

原规范要求设置入口在 PageHeader 右上角。本设计按产品决策将设置移入侧栏第三项，顶栏不再重复入口。

---

## 4. 页面设计

### 4.1 工作台（`/workbench`）

**职责：** 导入 Excel → 预演 → 对最新任务快速执行。

**布局（单栏纵向，`flex min-h-0 flex-1`）：**

```
┌──────────────────────────────────────────┐
│ 导入 Excel                                │
│  文件路径 / 选择 Excel / 开始预演          │
├──────────────────────────────────────────┤
│ 最新任务（空状态：引导导入并预演）          │
│  文件名 · 时间 · 状态徽章                  │
│  可执行 N · 阻断 N · 跳过 N · 共 M         │
│  [执行]  [查看详情]                        │
└──────────────────────────────────────────┘
```

**行为：**

- 预演成功：调用 `listTasks()`，取最新一条刷新摘要卡片。
- 「执行」：对最新任务调用 `execute(taskId)`；执行中按钮 disabled。
- 「查看详情」：导航至 `/tasks?expand=<taskId>`，任务列表自动展开该项。
- 无任务：显示空状态文案，不展示执行按钮。
- 不包含：行级表格、删除、D2 步骤（均在任务列表）。

### 4.2 任务列表（`/tasks`）

**职责：** 浏览所有预演任务；展开查看完整详情；对任意任务执行/删除。

**布局：** 全宽可滚动单列；每项为 Collapsible 手风琴。

**折叠头（摘要）：**

- 文件名、状态徽章、创建时间
- 可执行 / 总条数；已完成时成功数
- 失败信息、验证未通过条数（若有）
- 操作：`执行`、`删除`（逻辑与现 `sku-import.tsx` 一致）

**展开体（详情）** — 自现有建货号页右侧迁移：

- 统计四卡片（总行、可执行、阻断、跳过）
- 可执行记录表（含 lg/xl grid，窄屏卡片堆叠）
- 其他记录（阻断 / 跳过）
- 执行结果列表 + 每行 `verifySteps`（D2）

**手风琴规则：**

- **同时只展开一项**；点击另一项时收起当前项。
- URL 查询参数 `expand=<taskId>`：进入页时自动展开对应任务（供工作台「查看详情」使用）。
- 展开时 lazy-load：若尚无 detail，调用 `getTask(taskId)`。

### 4.3 设置（`/settings`）

**分区 1 — ERP 连接**

| 字段 | UI | 存储 | 默认 |
|------|-----|------|------|
| ERP Cookie | 密码框，不回显明文 | `secrets.erpCookie`（加密） | 空 |
| companyId | 文本框 | `secrets.erpCompanyId`（加密） | 占位 `140109` |
| ERP 地址 | 文本框 | `app.erpBaseUrl`（明文） | `https://erp.superboss.cc` |

- 保存：一次性写入 store；Cookie/companyId 遵循现有掩码规则。
- 首次启动：UI 显示默认 baseUrl 与 companyId 占位；未保存 Cookie 时预演/执行报错并引导至设置。

**分区 2 — 外观**

- 暗色模式、跟随系统（保留现有 Switch 逻辑）。

**移除：**

- 账号登录表单（`kuaimai.auth.erpLogin` 入口从设置页删除；IPC 可保留供后续使用）。
- OSS 上传测试按钮。

---

## 5. 组件与文件结构

### 推荐目录

```
src/renderer/
├── pages/
│   ├── workbench.tsx          # 重写：导入 + 最新任务摘要
│   ├── tasks.tsx              # 新建：手风琴任务列表
│   └── settings.tsx           # 精简
├── tools/sku-import/          # 新建：共享 UI
│   ├── task-status-labels.ts  # status label / badge variant
│   ├── preview-row.tsx        # 单行预演渲染
│   ├── task-summary-card.tsx  # 工作台摘要卡片
│   ├── task-detail-panel.tsx  # 手风琴展开体
│   └── task-accordion-item.tsx
├── hooks/
│   └── use-sku-import-tasks.ts  # list / get / execute / delete 封装
└── components/layout/
    ├── app-sidebar.tsx        # 三项导航
    └── page-header/PageHeader.tsx  # 移除设置齿轮
```

### 删除 / 废弃

- `src/renderer/pages/sku-import.tsx` — 逻辑拆分至上述模块后删除。

---

## 6. 数据流与配置

### 任务 IPC（无变更）

```
Renderer → kuaimai.skuImport.pickFile / preview / listTasks / getTask / execute / deleteTask
         → main/services/sku-import.ts → userData/jobs/sku-import/*.json
```

### 配置 IPC（扩展）

| 能力 | 变更 |
|------|------|
| `config.getSecretsMeta` | 保持 |
| `config.setSecrets` | 保持（cookie、companyId） |
| `config.getApp` / `config.setApp` | 读写 `app.erpBaseUrl` |

### 主进程 `getErpWebConfig()`

```ts
// 变更前：baseUrl 硬编码 DEFAULT_ERP_BASE_URL
// 变更后：
baseUrl: normalizeErpBaseUrl(getAppSetting('erpBaseUrl') ?? DEFAULT_ERP_BASE_URL)
cookie: getSecret('erpCookie')
companyId: getSecret('erpCompanyId')
```

同步更新 `main/services/erp-oss.ts` 等读取 baseUrl 的路径，统一走 store。

### Schema 扩展

```ts
// shared/schemas/store.ts — appSettingsSchema 新增：
erpBaseUrl: z.string().url().default('https://erp.superboss.cc')

// 可选：secrets 首次保存时 companyId 默认 '140109' 由 UI 预填，非 schema 强制默认
```

### `.env` 策略

| 运行环境 | ERP 凭证来源 |
|----------|--------------|
| Electron 桌面应用 | `store.json`（设置页） |
| CLI（`run-sku-smoke.mjs`、`load-erp-config-from-env.ts`） | 继续读 `.env` / 环境变量 |

桌面应用主进程、preload、renderer **不得**在运行时读取 `process.env.ERP_*`（开发脚本目录除外）。

---

## 7. 自适应布局

| 问题 | 方案 |
|------|------|
| `ScrollArea` 固定 `h-[420px]` / `h-[280px]` | 改为父级 `flex-1 min-h-0` + 子级 `overflow-auto` |
| 建货号页三栏 grid 窄屏挤压 | 工作台单栏；任务列表单列手风琴 |
| 预演行 6 列 grid | `xl:grid-cols-[...]`；`< xl` 每行变卡片纵向字段 |
| 双层 PagePanelHeader | 工作台/任务列表仅依赖 AppShell 顶栏标题 |
| 横向溢出 | 容器统一 `min-w-0`；长路径 `truncate` |

最小窗口建议维持 **1024 × 640**；侧栏 `collapsible="icon"` 已有。

---

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| 未配置 Cookie / companyId | 预演/执行 catch 错误；Alert + 链接「前往设置」 |
| 任务列表加载失败 | 页内 Alert + 重试按钮 |
| 执行失败 | 任务状态 `failed`；手风琴内展示 `failureMessage` |
| 删除执行中任务 | 按钮 disabled |
| 手风琴 expand 参数无效 | 忽略，默认全部折叠 |

---

## 9. 测试计划

### 自动化

- `getErpWebConfig` 单测：读 `app.erpBaseUrl` 与 secrets；缺 Cookie 抛错。
- `appStoreSchema` 单测：`erpBaseUrl` 默认值与校验。

### 手动验收

1. 侧栏三项导航；顶栏无设置齿轮；主题切换正常。
2. 工作台：选文件 → 预演 → 摘要更新 → 执行 → 状态变为已完成。
3. 「查看详情」跳转 `/tasks?expand=...` 并展开正确任务。
4. 任务列表：单项展开；另一项点击时收起前一项；执行/删除非最新任务。
5. 设置：保存 Cookie、companyId、baseUrl；重启应用后预演仍可用（不依赖 `.env`）。
6. 窗口从 1024×640 放大到全屏：无固定高度截断、无横向滚动条异常。

---

## 10. 迁移说明

- 已有 `userData/jobs/sku-import/*.json` 任务数据**无需迁移**，IPC 与落盘格式不变。
- 书签 `/tools/sku-import` 重定向至 `/workbench`。
- 用户若此前仅配置 `.env` 而未在设置页保存，升级后需重新在设置页填写凭证。

---

## 11. 实现顺序建议

1. Schema + `getErpWebConfig` / settings IPC（baseUrl）
2. 设置页精简 + ERP 三项
3. 抽共享 sku-import UI 组件与 hook
4. 新建 `tasks.tsx`；重写 `workbench.tsx`
5. 侧栏 / 路由 / PageHeader 调整；删除 `sku-import.tsx`
6. 自适应样式 pass + 手动验收

---

**评审记录：** 2026-06-28 用户批准全文；手风琴确认为同时只展开一项。
