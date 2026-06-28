# 快麦 ERP 工具箱

快麦 ERP 桌面小工具集合。当前内置 **建货号**：从 Excel 导入待创建货号记录，预演校验后批量创建贴纸与套装，并回写 Excel。

## 环境要求

- Node.js **22**（推荐 [nvm](https://github.com/nvm-sh/nvm)，项目根目录有 `.nvmrc`）
- **pnpm**（不要使用 npm / yarn）

## 快速开始

```bash
nvm use
pnpm install
pnpm start
```

Linux 若 Electron 沙箱报错，可临时：

```bash
ELECTRON_DISABLE_SANDBOX=1 pnpm start
```

## 首次使用

1. 侧栏进入 **设置**
2. 填写 **ERP Cookie**、**companyId**（如 `140109`）、**ERP 地址**（默认 `https://erp.superboss.cc`）
3. 侧栏 **工作台** → 选择 Excel（工作表「待创建货号记录」）→ **开始预演** → **执行**
4. **任务列表** 查看每条任务的预演详情、执行结果与 D2 验证

凭证保存在本机 `userData/store.json`（加密），桌面应用 **不读取** 项目根目录 `.env`。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm start` | 开发模式 |
| `pnpm run typecheck` | TypeScript 检查 |
| `pnpm run test` | 单元测试 |
| `pnpm run package` | 打包应用（无安装包） |
| `pnpm run make` | 生成本机平台安装包 |
| `pnpm run icons:generate` | 从 `resources/icon.svg` 生成各平台图标 |
| `pnpm run smoke:sku` | CLI 冒烟（需根目录 `.env` 配置 `ERP_COOKIE` 等） |

### 分平台打包

```bash
# Linux deb（Ubuntu 推荐）
pnpm exec electron-forge make --platform=linux --arch=x64 --targets=@electron-forge/maker-deb

# Windows（建议在 Windows CI；Linux 可尝试 zip，耗时长）
pnpm run make:win

# macOS（必须在 macOS 上执行）
pnpm run make:mac
```

产物输出在 `out/make/`。安装后桌面快捷方式使用项目 Logo（`resources/icon.*`）。

## 项目结构

```
src/
├── main/       Electron 主进程、IPC、服务
├── preload/    contextBridge API
├── renderer/   React UI（工作台 / 任务列表 / 设置）
├── shared/     类型、IPC 通道、Schema
├── core/       通用 ERP 客户端、OSS 等
└── tools/      业务工具逻辑（如 sku-import）
```

架构与规范详见 [AGENTS.md](./AGENTS.md)。

## 开发说明

- 包管理：**pnpm** + `pnpm-workspace.yaml`
- 路由：`/workbench`、`/tasks`、`/settings`
- 任务落盘：`userData/jobs/sku-import/<uuid>.json`
- 设计文档：`docs/superpowers/specs/`、`docs/superpowers/plans/`

## 许可证

私有项目（`package.json` → `"private": true`）。
