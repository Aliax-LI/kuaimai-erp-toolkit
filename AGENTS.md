# 快麦 ERP 桌面小工具

> 定义 **技术框架、目录、UI 布局、数据存储、配置** 五类规范。业务细节见各工具 PRD 与 `docs/superpowers/specs/`。

---

## 1. 技术框架

### 架构

```
Renderer（React）→ preload（contextBridge）→ Main（Node）→ Core / Tools（纯 TS）
```

- 三进程：`main` / `preload` / `renderer` 分离编译（Vite + Forge）。
- 渲染进程：`contextIsolation: true`，`nodeIntegration: false`，`sandbox: true`。
- 特权能力（文件、网络、存储）仅主进程；渲染进程经 preload 窄接口 IPC 访问。

### 技术选型

| 类别 | 选型 |
|---|---|
| 桌面 | Electron 34+、Electron Forge（Vite 模板） |
| 前端 | React 19、TypeScript 5 |
| 样式 | Tailwind CSS 4、framer-motion、lucide-react、Noto Sans SC |
| 校验 | Zod |
| 持久化 | `store.json`（`main/services/store.ts`，敏感字段 AES 加密） |
| 测试 | Vitest |
| 包管理 | **pnpm**（Node 22，见 `.nvmrc`） |

### 命令

```bash
pnpm install && pnpm start          # 开发
pnpm run typecheck && pnpm run test # 校验
pnpm run package                    # 本地打包（未做安装包）
pnpm run make                       # 生成本机平台安装包
```

---

## 2. 目录规范

```
kuaimai-erp-toolkit/
├── forge.config.ts、electron.vite.config.ts、package.json、tsconfig.json
├── resources/           # 应用图标（icon.svg → premake 生成 ico/icns/png）
├── docs/、scripts/、tests/
└── src/
    ├── main/          index.ts、ipc/、services/、windows/
    ├── preload/       index.ts、api.d.ts、apis/
    ├── renderer/      pages/、routes/、components/、hooks/、tools/<tool-id>/
    ├── shared/        types/、constants/、schemas/、ipc-channels.ts
    ├── core/          通用纯 TS
    └── tools/<tool-id>/  单工具逻辑
```

| 规则 | 说明 |
|---|---|
| 文件名 | kebab-case |
| 组件 | PascalCase |
| 工具 ID | kebab-case（如 `sku-import`） |
| IPC channel | `domain:action`，定义于 `shared/ipc-channels.ts` |
| 新增工具 | 扩展 `tools/`、`renderer/tools/`、`main/ipc/tools/`、`preload/apis/`，不复制整套 main/preload |

### 后端逻辑封装（IPC / API）

```
Renderer  →  window.kuaimai.*  →  preload/apis/  →  main/ipc/  →  main/services/  →  core/ | tools/
```

| 层 | 目录 | 职责 |
|---|---|---|
| 契约 | `shared/ipc-channels.ts`、`shared/types/` | 通道名、入参/出参类型 |
| 业务 | `core/`、`tools/<tool-id>/` | 纯 TS，无 Electron |
| 服务 | `main/services/` | 主进程能力：读写 store、对话框、调 core |
| 入口 | `main/ipc/` | 薄 handler，仅注册 IPC 并转发 service |
| 桥接 | `preload/apis/<domain>.ts` | `ipcRenderer.invoke` 封装 |
| 暴露 | `preload/index.ts` | 唯一 `contextBridge.exposeInMainWorld('kuaimai', …)` |

新增能力按域拆分：先 `shared` 定 channel 与类型 → `core` / `tools` 写逻辑 → `main/services` + `main/ipc` → `preload/apis` → `build-api.ts` 汇总。渲染进程只调 `window.kuaimai`，禁止直接 fs/网络/读 secrets。

**示例（建货号）**：`tools/sku-import/*` → `main/services/sku-import.ts` → `main/ipc/tools/sku-import.ts` → `preload/apis/sku-import.ts`。

**示例（OSS 上传）**：`core/erp-oss-uploader.ts` → `main/services/upload.ts` → `main/ipc/upload.ts` → `preload/apis/upload.ts`。

---

## 3. UI 布局规范

### 设计体系

- 组件：自定义 primitives + `components/shared/`（从 my-app 暖色 UI 反推）；图标：lucide-react；字体：**Noto Sans SC**。
- **仅浅色暖色主题**（cream / amber / charcoal）；无暗色切换。
- **无登录页**：启动直达工作台；侧栏无用户头像、登录/退出。

### 应用骨架（强制：顶栏 + 侧栏 + 主区）

```
┌─────────────────────────────────────────────────────────────┐
│ Logo + 标题                              [连接状态 · 只读]   │  Header h-14
├──────────┬──────────────────────────────────────────────────┤
│ ● 工作台 │                                                  │
│ ● 历史记录│           PageContent（max-w-6xl 居中）            │
│ ● 配置管理│                                                  │
│ v2.0     │                                                  │
└──────────┴──────────────────────────────────────────────────┘
  Sidebar（188px）          Main（flex-1，overflow-y-auto）
```

| 层级 | 规范 |
|---|---|
| **Header** | 全宽顶栏；左：Logo + 应用标题；右：**ERP 连接状态胶囊**（只读，点击跳转配置管理 ERP Tab） |
| **Sidebar** | 188px；**工作台 / 历史记录 / 配置管理** 三项导航；底：版本文案 |
| **Main** | `p-6`；内容 `max-w-6xl mx-auto` |

**PageContent 常用模式**：

| 模式 | 结构 | 适用 |
|---|---|---|
| 三步手风琴 | StepIndicator + AccordionStep × 3 | 工作台 |
| 表格列表 | 搜索 + DataTable | 历史记录 |
| Tab 配置 | Segmented Tab + 表单/表格 | 配置管理 |

- 最小窗口 **1024 × 640**；侧栏始终可见，不得完全隐藏。

### 导航与路由（强制项）

| 路由 | 侧栏 | 说明 |
|---|---|---|
| `/workbench` | 工作台 | 3 步：导入 Excel → 批量创建 → 创建结果；导入后自动预演 |
| `/history` | 历史记录 | 任务历史表格；「查看」跳转工作台 |
| `/config` | 配置管理 | `?tab=erp\|brands\|…`；ERP Tab 可保存凭证 |
| `/tasks` | — | 重定向 `/history` |
| `/settings` | — | 重定向 `/config?tab=erp` |
| `/tools/sku-import` | — | 重定向 `/workbench` |

### 配置管理

- **ERP 连接**（`?tab=erp`）：Cookie、companyId、`erpBaseUrl`；敏感项加密，界面不回显明文。
- **品牌/配件/编码规则/分类**：首期 UI 外壳（mock / 只读）。
- 桌面应用运行时 **不读** 根目录 `.env`；CLI 脚本仍可用 `.env`。

### 视觉（暖色参考）

| 项 | 参考 |
|---|---|
| 页面底 | `#FBF7EF`（cream） |
| 侧栏 | `#F7EFE1`（cream-warm） |
| 卡片 | `#FDFBF5`（cream-white），边框 `#E9DCCF`（beige） |
| 文字 | 主 `#1D1D1D`（charcoal），次 `#A18D7C`（brown-soft） |
| 主按钮 | `#FF825B`（amber）填充 + 白字 |

### 布局组件目录

```
renderer/components/layout/
├── app-layout.tsx
├── header.tsx
└── sidebar.tsx

renderer/components/shared/
├── step-indicator.tsx
├── accordion-step.tsx
├── drag-drop-zone.tsx
└── …

renderer/pages/
├── workbench.tsx
├── history.tsx
└── config.tsx
```

---

## 4. 数据存储规范

根路径：`app.getPath('userData')`，禁止写入安装目录或源码目录。

```
userData/
├── store.json                    # 全局配置（敏感字段加密）
├── jobs/sku-import/<uuid>.json   # 建货号任务快照
├── config/<tool-id>/             # 工具业务配置 JSON
├── logs/                         # JSONL，按日滚动
└── cache/                        # 临时文件，可清理
```

| 分类 | 格式 | 说明 |
|---|---|---|
| 全局 / 敏感 | `store.json` | `app` + `secrets`（加密）；日志脱敏 |
| 工具任务 | JSON + `schemaVersion` | 原子写（临时文件 + rename） |
| 用户导出 | 用户自选路径 | 不由应用目录管理 |

---

## 5. 配置规范

| 层级 | 位置 | 修改方式 |
|---|---|---|
| 构建 | `forge.config.ts`、`electron.vite.config.ts` | 改源码 |
| 应用元数据 | `package.json` | 改源码 |
| 运行时全局 | `store.json` → `app` | 设置页 / IPC（含 `erpBaseUrl`） |
| 敏感项 | `store.json` → `secrets` | 设置页 / IPC（`erpCookie`、`erpCompanyId`） |
| 工具业务 | `config/<tool-id>/`、`jobs/` | 工具 IPC |
| 开发脚本 | 根目录 `.env` | **仅 CLI**；不入库、不进 Electron 运行时 |

```ts
interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  locale: 'zh-CN';
  erpBaseUrl: string; // 默认 https://erp.superboss.cc
}
```

- 读写统一经 `main/services/store.ts`；ERP 请求配置见 `main/services/erp-web.ts`（`getErpWebConfig`）。
- schema 定义于 `shared/schemas/store.ts`，损坏回退默认并 `.bak` 备份。

---

## 6. 打包与图标

- 图标源文件：`resources/icon.svg`；`pnpm run icons:generate` 或 `premake` 生成 png/ico/icns。
- `forge.config.ts`：`packagerConfig.icon` + 各 Maker 图标（Squirrel / DMG / deb / rpm）。
- 平台建议：**Linux deb** 本机可打；**Windows Setup.exe** 建议 Windows CI；**macOS dmg** 必须 macOS CI。
- 产物目录：`out/make/`。

---
