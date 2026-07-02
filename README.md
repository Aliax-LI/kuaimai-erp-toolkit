# 快麦 ERP 工具箱

快麦 ERP 工具箱是一个基于 Electron + React 的桌面小工具，首期聚焦「建货号 / SKU 导入」工作流：导入 Excel、预演数据、批量创建、查看任务历史，并在本机安全保存 ERP 连接配置。

## 技术栈

- Electron 34+
- React 19 + TypeScript 5 + Vite
- Tailwind CSS 4 + framer-motion + lucide-react
- Vitest
- pnpm 10（Node 22，见 `.nvmrc`）
- electron-builder

## 本地开发

```bash
pnpm install
pnpm start
```

常用校验：

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

`pnpm start` 会先运行 `scripts/build-app.mjs`，分别构建 main、preload、renderer，然后启动 Electron。

## 打包

```bash
pnpm run package              # 目录版应用，不生成安装器
pnpm run make                 # 当前平台安装包
pnpm run make:win             # Windows NSIS Setup.exe
pnpm run make:mac             # macOS arm64 dmg + zip
pnpm run make:mac:x64         # macOS x64 dmg + zip
pnpm run make:mac:universal   # macOS universal dmg + zip
pnpm run make:linux           # Linux deb + rpm
```

输出目录：

- `.vite/build/`：main / preload 构建产物。
- `.vite/renderer/main_window/`：renderer 构建产物。
- `out/make/`：`electron-builder` 安装包产物。

平台限制：

- macOS 安装包必须在 macOS 上构建。
- Windows 安装包建议在 Windows CI 上构建。
- 对外分发 macOS 应用时，建议配置 Apple Developer ID 签名与 notarization，否则用户仍可能遇到 Gatekeeper 安全拦截。

## GitHub Actions

桌面构建流水线位于 `.github/workflows/build-desktop.yml`：

- `test`：安装依赖、类型检查、运行测试。
- `build-windows`：生成 Windows NSIS 安装包。
- `build-macos`：生成 macOS arm64 dmg + zip。
- `release`：在 tag、`main` 或手动触发时发布预发布 / 正式 Release。

流水线使用 `pnpm/action-setup@v6`，pnpm 版本由 `package.json` 的 `packageManager` 字段统一指定，避免 GitHub Action 与项目声明版本不一致。

macOS 签名相关 secrets（可选）：

- `MACOS_CERTIFICATE_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_CODESIGN_IDENTITY`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

未配置证书时，CI 仍会构建未签名产物；未签名产物只适合内部测试。

## 项目结构

```text
src/
├── main/            Electron 主进程、IPC 注册、服务层
├── preload/         contextBridge 与渲染进程 API
├── renderer/        React 页面、布局、组件、工具 UI
├── shared/          IPC channel、类型、常量、schema
├── core/            无 Electron 依赖的通用逻辑
└── tools/           各业务工具的纯 TS 逻辑
```

运行时数据统一写入 `app.getPath('userData')`，不要写入安装目录或源码目录。根目录 `.env` 只供 CLI / smoke 脚本使用，不进入 Electron 运行时。

## 图标

图标源文件为 `resources/icon.svg`。

```bash
pnpm run icons:generate
```

该命令会生成 `resources/icon.png`、`resources/icon.ico`、`resources/icon.icns`。打包脚本也会在构建前自动执行图标生成。
