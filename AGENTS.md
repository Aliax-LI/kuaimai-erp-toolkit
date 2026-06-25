# 快麦 ERP 桌面小工具

> 定义 **技术框架、目录、UI 布局、数据存储、配置** 五类规范。业务细节见各工具 PRD。

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
| 桌面 | Electron 28+、Electron Forge（Vite 模板） |
| 前端 | React 19、TypeScript 5 |
| 样式 | Tailwind CSS 4、shadcn/ui、lucide-react |
| 校验 | Zod |
| 持久化 | electron-store |
| 测试 | Vitest |
| 包管理 | npm |

### 命令

```bash
npm install && npm start    # 开发
npm run typecheck && npm run test && npm run package
```

---

## 2. 目录规范

```
kuaimai-erp-toolkit/
├── forge.config.ts、electron.vite.config.ts、package.json、tsconfig.json
├── resources/、docs/、scripts/、tests/
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
| 工具 ID | kebab-case |
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

新增能力按域拆分（如 `upload`）：先 `shared` 定 channel 与类型 → `core` 写逻辑 → `main/services` + `main/ipc` → `preload/apis` 注册 → `build-api.ts` 汇总。渲染进程只调 `window.kuaimai`，禁止直接 fs/网络/读 secrets。

**示例（文件上传）**：`core/erp-oss-uploader.ts` → `main/services/upload.ts` → `main/ipc/upload.ts` → `preload/apis/upload.ts`。

**示例（账号登录）**：`core/erp-login.ts` → `main/services/auth.ts` → `main/ipc/auth.ts` → `preload/apis/auth.ts`。

---

## 3. UI 布局规范

### 设计体系

- 组件：shadcn/ui；图标：lucide-react；字体：系统 UI 栈。
- 默认 **暗色主题**，支持亮/暗切换（主区顶栏右侧日/月图标）。
- **无登录页**：启动直达工作台；侧栏无用户头像、登录/退出。

### 应用骨架（强制：侧栏 + 主区）

全应用共用 **左侧导航 + 右侧主区** 双层结构；主区内部布局由 **各页面自行组合**，不强制三栏或固定参数栏。

```
┌──────────┬──────────────────────────────────────────────┐
│ Logo     │  页面标题        [页面操作] [设置] [主题]      │  PageHeader
│ 应用名   ├──────────────────────────────────────────────┤
│ 副标题   │                                              │
│          │           PageContent（页面自定义）            │
│ ● 导航项 │   单栏 / 左右分栏 / 卡片堆叠，由页面决定       │
│   …      │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
  Sidebar                 Main（flex-1，内部滚动）
  固定宽度
```

| 层级 | 规范 |
|---|---|
| **Sidebar** | 始终可见；上：品牌区；中：导航列表（仅业务页） |
| **Main** | 占满剩余宽度；含 `PageHeader` + `PageContent` |
| **PageHeader** | 左：当前页标题；右：**设置**（齿轮图标）+ 主题切换 + 本页操作按钮；设置固定最右或紧邻主题切换 |
| **PageContent** | 页面自由布局，常用模式见下表 |

**PageContent 常用模式**（按需选用，非全局强制）：

| 模式 | 结构 | 适用 |
|---|---|---|
| 单栏 | 纵向卡片区块 | 设置、列表、表单 |
| 主 + 侧栏 | 内容区 + 右侧可折叠 Panel | 参数、预览、详情 |
| 主 + 底栏 | 内容区 + 底部固定操作条 | 批量任务、进度与主按钮 |

- 最小窗口建议 `1024 × 640`；窄屏时 Sidebar 可收窄为图标模式，**不得完全隐藏**。
- 禁止用顶栏 Tab 替代侧栏导航。

### 导航与设置（强制项）

| 入口 | 位置 | 说明 |
|---|---|---|
| 业务导航 | 侧栏 | 工作台等业务页；图标 + 文案，激活态浅灰底 |
| **设置** | **PageHeader 右上角** | 齿轮图标按钮，跳转 `/settings`；**不放侧栏** |
| `/workbench` | 侧栏 | 默认落地页 |
| `/settings` | 顶栏入口 | 独立页面，非 Dialog |

### 设置页

- 路由 `/settings`；进入后 PageHeader 标题为「设置」，右上角入口可显示为激活态。
- 无登录页；侧栏无用户头像、登录/退出；敏感项掩码输入，保存后不回显明文。

### 视觉

| 项 | 暗色参考 |
|---|---|
| 页面底 | `#0a0a0a` ~ `#111` |
| 侧栏 | 略深于主区 |
| 卡片 | `#141414` ~ `#1a1a1a`，细边框，圆角 8–12px |
| 文字 | 主 `#f5f5f5`，次 `#a3a3a3` |
| 主按钮 | 高对比填充 + 白字 + 图标 |

输入框深底细边框；开关用胶囊 Toggle；卡片轻边框无厚重阴影。

### 布局组件目录

```
renderer/components/layout/
├── AppShell.tsx       # Sidebar + Main 容器
├── sidebar/           # Sidebar、SidebarBrand、SidebarNav、SidebarNavItem
├── page-header/       # 页面顶栏（含设置、主题切换）
├── page-content/      # 主区滚动容器
└── panel/             # 可选右侧/底部 Panel（页面级引用）

renderer/pages/
├── workbench.tsx
├── settings.tsx       # 强制
└── …
```

---

## 4. 数据存储规范

根路径：`app.getPath('userData')`，禁止写入安装目录或源码目录。

```
userData/
├── store.json           # 全局配置（敏感字段加密）
├── config/<tool-id>/    # 工具业务配置 JSON
├── jobs/                # 任务快照
├── logs/                # JSONL，按日滚动
└── cache/               # 临时文件，可清理
```

| 分类 | 格式 | 说明 |
|---|---|---|
| 全局 / 敏感 | `store.json` | 敏感项 AES 加密；日志脱敏 |
| 工具配置 | JSON + `schemaVersion` | 原子写（临时文件 + rename） |
| 用户导出 | 用户自选路径 | 不由应用目录管理 |

```json
{ "schemaVersion": 1, "updatedAt": "…", "data": {} }
```

---

## 5. 配置规范

| 层级 | 位置 | 修改方式 |
|---|---|---|
| 构建 | `forge.config.ts`、`electron.vite.config.ts` | 改源码 |
| 应用元数据 | `package.json` | 改源码 |
| 运行时全局 | `store.json` → `app` | 设置页 / IPC |
| 敏感项 | `store.json` → `secrets`（加密） | 设置页 / IPC |
| 工具业务 | `config/<tool-id>/` | 设置或工具配置页 |
| 开发环境 | `.env`（仅 `scripts/`） | 不入库、不进运行时 |

```ts
interface AppStore {
  app: {
    theme: 'light' | 'dark' | 'system';
    locale: 'zh-CN';
    // 其他全局项由工具 PRD 扩展
  };
  secrets: {
    // 加密存储，界面不回显明文
  };
}
```

- 读写统一经 `main/services/store.ts`；渲染进程仅 IPC。
- `app` 与 `secrets` 分离；schema 定义于 `shared/schemas/`，启动校验，损坏回退默认并 `.bak` 备份。
- IPC 配置前缀 `config:`；preload 暴露 `kuaimai.config.*`，不暴露文件路径。

---
