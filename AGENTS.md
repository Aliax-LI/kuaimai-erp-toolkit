# 快麦 ERP 桌面小工具

> 定义 **技术框架、目录、UI 布局、数据存储、配置、打包** 六类规范。业务细节见各工具 PRD 与 `docs/superpowers/specs/`。

---

## 1. 技术框架

### 架构

```text
Renderer（React）→ preload（contextBridge）→ Main（Node）→ Core / Tools（纯 TS）
```

- 三进程：`main` / `preload` / `renderer` 分离编译。
- 构建：Vite 分别使用 `vite.main.config.ts`、`vite.preload.config.ts`、`vite.renderer.config.ts`。
- 安装包：`electron-builder`，配置位于 `package.json` 的 `build` 字段。
- 渲染进程：`contextIsolation: true`，`nodeIntegration: false`，`sandbox: true`。
- 特权能力（文件、网络、存储）仅主进程；渲染进程经 preload 窄接口 IPC 访问。

### 技术选型

| 类别 | 选型 |
|---|---|
| 桌面 | Electron 34+、electron-builder |
| 前端 | React 19、TypeScript 5、Vite |
| 样式 | Tailwind CSS 4、framer-motion、lucide-react、Noto Sans SC |
| 校验 | Zod |
| 持久化 | `store.json`（`main/services/store.ts`，敏感字段 AES 加密） |
| 测试 | Vitest |
| 包管理 | **pnpm**（Node 22，见 `.nvmrc`） |

### 命令

```bash
pnpm install
pnpm start                    # 开发预览：先构建，再启动 Electron
pnpm run typecheck
pnpm run test
pnpm run package              # 仅生成目录版应用，不生成安装包
pnpm run make                 # 生成当前平台安装包
pnpm run make:win             # Windows NSIS 安装包
pnpm run make:mac             # macOS arm64 dmg + zip，必须在 macOS 上执行
pnpm run make:mac:x64         # macOS x64 dmg + zip
pnpm run make:mac:universal   # macOS universal dmg + zip
pnpm run make:linux           # Linux deb + rpm
```

---

## 2. 目录规范

```text
kuaimai-erp-toolkit/
├── package.json、pnpm-workspace.yaml、tsconfig.json
├── vite.main.config.ts、vite.preload.config.ts、vite.renderer.config.ts
├── resources/           # 应用图标（icon.svg → png / ico / icns）
├── docs/、scripts/、tests/
└── src/
    ├── main/            index.ts、ipc/、services/、windows/
    ├── preload/         index.ts、api.d.ts、apis/
    ├── renderer/        pages/、routes/、components/、hooks/、tools/<tool-id>/
    ├── shared/          types/、constants/、schemas/、ipc-channels.ts
    ├── core/            通用纯 TS
    └── tools/<tool-id>/ 工具业务逻辑
```

| 规则 | 说明 |
|---|---|
| 文件名 | kebab-case |
| 组件 | PascalCase |
| 工具 ID | kebab-case（如 `sku-import`） |
| IPC channel | `domain:action`，定义于 `shared/ipc-channels.ts` |
| 新增工具 | 扩展 `tools/`、`renderer/tools/`、`main/ipc/tools/`、`preload/apis/`，不复制整套 main/preload |

### 后端逻辑封装（IPC / API）

```text
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

---

## 3. UI 布局规范

### 设计体系

- 组件：自定义 primitives + `components/shared/`；图标：lucide-react；字体：**Noto Sans SC**。
- **仅浅色暖色主题**（cream / amber / charcoal）；无暗色切换。
- **无登录页**：启动直达工作台；侧栏无用户头像、登录/退出。

### 应用骨架（强制：顶栏 + 侧栏 + 主区）

```text
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
| `/tasks` | - | 重定向 `/history` |
| `/settings` | - | 重定向 `/config?tab=erp` |
| `/tools/sku-import` | - | 重定向 `/workbench` |

---

## 4. 数据存储规范

根路径：`app.getPath('userData')`，禁止写入安装目录或源码目录。

```text
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
| 构建 | `package.json` 的 `build` 字段、Vite 配置 | 改源码 |
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
- Electron 运行时不读根目录 `.env`；`.env` 只供 CLI / smoke 脚本使用。

---

## 6. 打包与图标

- 图标源文件：`resources/icon.svg`。
- `pnpm run icons:generate` 或 `scripts/build-app.mjs` 会生成 `resources/icon.png`、`resources/icon.ico`、`resources/icon.icns`。
- `package.json` 的 `build` 字段是安装包唯一配置源。
- 构建输出：
  - `.vite/build/`：main / preload 产物。
  - `.vite/renderer/main_window/`：renderer 产物。
  - `out/make/`：`electron-builder` 打包产物。
- 平台建议：
  - **Windows NSIS**：Windows CI。
  - **macOS dmg / zip**：macOS CI；对外分发建议配置 Developer ID 签名与 notarization。
  - **Linux deb / rpm**：Linux CI。
- 项目代码由 Vite 打包进产物。除非明确需要运行时动态加载包，否则不要把业务依赖移回 `dependencies`；新增动态运行时依赖时必须同步检查 `electron-builder` 的 `files` 配置。
