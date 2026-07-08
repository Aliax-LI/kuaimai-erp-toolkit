# 小工具体验改进批次设计

**日期：** 2026-07-08  
**状态：** 待评审  
**范围：** 配件批量删除、Windows 快捷方式图标、工作台会话保活、品牌配置简化、产品编码 ERP 匹配修复

---

## 1. 已确认决策

| # | 议题 | 决策 |
|---|------|------|
| 1 | 工作台切换后保留状态 | **仅当前会话**（应用未关闭期间）；关闭应用后不自动恢复 |
| 2 | 配件批量删除确认 | **需要二次确认**，弹窗显示将删除条数 |
| 3 | 快捷方式图标问题平台 | **仅 Windows**（桌面 / 开始菜单快捷方式） |
| 4 | 品牌名称简写 | **从 UI 移除**；schema 保留字段以兼容旧配置 |
| 5 | 产品编码匹配方案 | **queryListV2 未命中时 fallback querySingle(content=outerId)** |
| 6 | 实现策略 | **最小增量改动**，不引入新依赖 |

---

## 2. 目标与非目标

### 目标

- 配置管理 → 配件 Tab 支持多选批量删除，减少逐条操作成本。
- Windows 安装后，exe、安装器、桌面与开始菜单快捷方式均显示应用 logo。
- 侧栏切换（工作台 ↔ 配置管理等）不丢失工作台当前任务进度与预览结果。
- 品牌配置表单去掉无用的「名称简写」字段，降低维护负担。
- 修复子 SKU 货号（如 `YP-ZBQXJ01-03`）在 ERP 可查但预演报「不存在」的问题。

### 非目标

- 不实现工作台跨应用重启的自动恢复（不做 URL `taskId` 自动同步或「当前任务」持久标记）。
- 不改造 macOS / Linux 快捷方式（除非后续单独提出）。
- 不从 schema 删除 `shortName` 字段（避免配置迁移）。
- 不重构 ERP 客户端为全量 `querySingle` 查询。
- 配件批量删除不做软删除 / 回收站。

---

## 3. 配件管理 — 批量删除

### 3.1 UI

在 `src/renderer/pages/config.tsx` 配件 Tab 现有表格上扩展：

| 元素 | 行为 |
|------|------|
| 表头 checkbox | 全选 / 取消全选**当前可见行**（受搜索过滤影响） |
| 行 checkbox | 切换单行选中 |
| 工具栏「批量删除」按钮 | 有选中时启用；文案含 `已选 N 条` |
| 确认弹窗 | 「确定删除已选的 N 条配件？此操作不可撤销。」取消 / 确定 |

布局：checkbox 列置于「配件名称」左侧；「批量删除」按钮放在工具栏「新增配件」旁，使用 `variant="outline"` + 危险色 hover，与单行删除视觉区分。

### 3.2 逻辑

- 选中状态存于组件本地 `Set<number>`（配件在完整数组中的 index）。
- 确认后：`accessories.filter((_, i) => !selected.has(i))` → 调用现有 `saveAccessories`。
- 保存成功后：清空选中、toast 成功（沿用现有保存反馈）。
- 保存失败：toast 错误，保留选中状态。
- 搜索关键词变化时：不清空选中（index 仍指向原数组位置）；若选中项被过滤不可见，批量删除仍删除这些项。

### 3.3 接口

无新增 IPC。沿用 `sku-import:save-accessories`（或现有等价通道）。

---

## 4. Windows 快捷方式图标

### 4.1 根因分析

当前 `scripts/generate-app-icons.mjs` 仅用单张 512×512 PNG 生成 ICO；Windows 快捷方式与 exe 嵌入图标需要多尺寸 ICO（16 / 32 / 48 / 64 / 128 / 256）。`package.json` 的 `nsis` 段未显式指定 `installerIcon` / `uninstallerIcon`，可能导致安装器与快捷方式回退为默认 Electron 图标。

### 4.2 改动

**图标生成脚本**（`scripts/generate-app-icons.mjs`）：

- 从 `resources/icon.svg` 生成 16、32、48、64、128、256 六档 PNG。
- 用 `png-to-ico` 合成多尺寸 `resources/icon.ico`。
- `icon.png`（512）与 `icon.icns` 生成逻辑不变。

**electron-builder 配置**（`package.json` → `build`）：

```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "installerIcon": "resources/icon.ico",
  "uninstallerIcon": "resources/icon.ico",
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true
}
```

保持 `win.icon: resources/icon.ico`。

### 4.3 验收

在 Windows 执行 `pnpm run make:win` 安装后检查：

1. 安装目录下 `.exe` 文件图标为应用 logo。
2. 桌面快捷方式图标为应用 logo。
3. 开始菜单快捷方式图标为应用 logo。

---

## 5. 工作台会话内保活

### 5.1 现状

`AppLayout` 使用 React Router `<Outlet />`，路由切换时 `WorkbenchPage` 卸载，本地 state（`filePath`、`taskDetail`、`expandedStep`、`accessoryDrafts` 等）全部丢失。任务 JSON 虽写入 `userData/jobs/sku-import/`，但返回工作台时默认为空页面。

### 5.2 方案

改 `src/renderer/components/layout/app-layout.tsx`（及必要时 `src/renderer/routes/index.tsx`）：

- 三个主页面组件在 `AppLayout` 内**常驻挂载**：
  - `WorkbenchPage`
  - `HistoryPage`
  - `ConfigPage`
- 根据 `useLocation().pathname` 决定可见页面；非当前页使用 `hidden` class（`hidden` 在 Tailwind 中为 `display: none`，但组件保持挂载，state 不丢）。
- 仅对**当前可见页**应用 `motion.div` 入场动画，避免隐藏页重复触发。
- `WorkbenchPage` 内部逻辑不改；关闭应用后不保留状态（符合决策）。

### 5.3 路由

现有路由表不变（`/workbench`、`/history`、`/config`）。`Outlet` 可替换为条件渲染三个常驻页面，或保留 `Outlet` 同时在外层包裹保活容器——实现时选改动最小路径。

### 5.4 验收

手动测试：

1. 工作台导入 Excel 并完成预演（步骤 2 有数据）。
2. 切到「配置管理」，再切回「工作台」。
3. 预期：仍停留在原步骤，预览表格与文件路径完整保留。
4. 关闭并重新打开应用：工作台恢复为空（符合范围）。

---

## 6. 品牌配置 — 移除名称简写

### 6.1 改动

`src/renderer/pages/config.tsx` 品牌 Tab：

- 表格去掉「名称简写」列。
- 新增/编辑品牌弹窗去掉「名称简写」输入框。
- `EMPTY_BRAND` 初始化不再强调 `shortName`（可保留默认值 `''`）。

### 6.2 兼容

- `src/shared/schemas/sku-import-config.ts` 中 `shortName: z.string().trim().default('')` **保留**。
- 读取旧配置时忽略已有 `shortName` 值；保存时不主动写入（或写入 `''`）。
- `resources/defaults/sku-import-config.json` 可去掉各品牌的 `shortName` 字段（可选清理）。

### 6.3 业务影响

无。`shortName` 从未参与预演/执行逻辑（`catalog-config.ts` 仅用 `name` 与 `code`）。

---

## 7. 产品编码 ERP 匹配修复

### 7.1 根因

`getItemsByOuterIds`（`src/tools/sku-import/erp-catalog.ts`）仅通过 `queryListV2` 以 `outerId` 与 `skuOuterId` 参数查询。对于多规格商品的子 SKU（如 `YP-ZBQXJ01-03`，父货号 `YP-ZBQXJ01`），`queryListV2` 可能返回空或返回父项但列表响应中缺少完整 `skus` 数组。

ERP 网页使用 `item_querySingle` 且 `content=outerId` 可正确命中（用户提供的接口响应已验证）。

应用内 `querySingle` 目前仅用于 `content: 'title'` 的标题搜索，**未用于货号查找**。

### 7.2 修复

**新增** `querySingleByOuterId(text: string)`：

```ts
client.querySingle({
  text: normalized,
  filterSysItemId: '',
  content: 'outerId',
  isAccurate: 0,
  flag: 0,
  order: 'desc',
  purchasePriceScope: 0,
  onSale: '',
  pageSize: 50,
  pageNo: 1,
  api_name: 'item_querySingle',
});
```

**增强** `normalizeListItem`：

- 若 item 含 `skus` 或 `skuERP` 数组，映射为 `ErpCatalogItem.skus`（`skuOuterId` ← `sku.outerId ?? sku.skuOuterId`）。
- 保留现有单条 list 行逻辑作为 fallback。

**调整** `getItemsByOuterIds` 流程：

1. 对每个 outerId，先执行现有 `queryListV2`（`outerId` + `skuOuterId` 双查）。
2. 合并结果后，用 `findCatalogItemByOuterId(items, outerId)` 判断是否命中。
3. **未命中**的 ID 追加调用 `querySingleByOuterId`，结果经 `normalizeListItem` / `normalizeListItems` 合并。
4. 预览层 `createPreviewCatalogCache` 与 `findCatalogItemByOuterId` 无需改动（已支持子 SKU 匹配）。

### 7.3 影响范围

所有经 `getItemsByOuterIds` 的查找均受益：

- 产品原品编码（`产品原品「…」在 ERP 中不存在` 报错路径）
- 配件配置 SKU 编码解析
- 套装货号 / 贴纸编码存在性检查

### 7.4 测试

新增 `tests/erp-catalog-lookup.test.ts`（或扩展现有 `erp-catalog-find-item.test.ts`）：

| 用例 | 预期 |
|------|------|
| `queryListV2` 空 + `querySingle` 返回父项含 `skus: [{ outerId: 'YP-ZBQXJ01-03' }]` | `getItemsByOuterIds(['YP-ZBQXJ01-03'])` 命中 |
| `queryListV2` 已命中 | 不调用 `querySingle`（mock 验证调用次数） |
| 两者均无结果 | 返回空，预览仍报「不存在」 |

保留 `findCatalogItemByOuterId` 现有单测。

---

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| 批量删除保存失败 | toast 错误信息；保留选中状态 |
| 批量删除选中 0 条 | 按钮 disabled，不弹窗 |
| ERP `querySingle` fallback 网络失败 | 与现有 ERP 错误一致，向上抛出或记为未命中 |
| 工作台保活 | 无额外错误路径；组件卸载不再发生 |
| 图标生成失败 | 构建脚本 `process.exit(1)`，阻断 make |

---

## 9. 测试与验收清单

```bash
pnpm run typecheck
pnpm run test
```

| 项 | 类型 | 验收标准 |
|----|------|----------|
| 配件批量删除 | 手动 | 多选 → 确认 → 删除 → 列表更新；取消不删除 |
| 配件全选（有过滤） | 手动 | 搜索后全选仅作用于可见行 |
| 品牌 UI | 手动 | 无「名称简写」列与输入框；旧配置正常加载 |
| 工作台保活 | 手动 | 切换侧栏后状态完整 |
| 产品编码 | 自动 + 手动 | 新单测通过；`YP-ZBQXJ01-03` 类子 SKU 不再误报不存在 |
| Windows 图标 | 手动（Windows） | exe / 桌面 / 开始菜单均为 logo |

---

## 10. 文件变更预估

| 文件 | 变更 |
|------|------|
| `src/renderer/pages/config.tsx` | 配件批量删除 UI；品牌去掉简写 |
| `src/renderer/components/layout/app-layout.tsx` | 三页常驻保活 |
| `src/renderer/routes/index.tsx` | 可能微调路由渲染 |
| `src/tools/sku-import/erp-catalog.ts` | querySingle fallback + normalize 增强 |
| `scripts/generate-app-icons.mjs` | 多尺寸 ICO |
| `package.json` | nsis 图标配置 |
| `resources/icon.ico` | 重新生成 |
| `tests/erp-catalog-lookup.test.ts` | 新增 fallback 单测 |

---

## 11. 实现顺序建议

1. **产品编码匹配**（bug 修复，独立且高价值）
2. **工作台保活**（架构小改，独立）
3. **配件批量删除** + **品牌简写移除**（同文件，可一起做）
4. **Windows 图标**（构建配置，需 Windows 验收）
