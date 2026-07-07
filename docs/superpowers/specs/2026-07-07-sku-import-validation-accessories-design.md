# 建货号校验增强与配件导入导出设计

**日期：** 2026-07-07  
**状态：** 待评审  
**范围：** 建货号预演/执行校验、执行标准默认值、配置管理配件 Tab 导入导出

---

## 1. 已确认决策

| # | 议题 | 决策 |
|---|------|------|
| 1 | 套装货号已存在 | **硬阻断**：`preview_blocked`，不允许进入创建 |
| 2 | 贴纸编码已存在、套装不存在 | **允许导入**：执行时复用贴纸，仅新建套装 |
| 3 | 执行标准 | 不读 Excel；系统默认 `Capacity:{容量}`（无空格，如 `Capacity:60ml`） |
| 4 | 配件导入合并 | **按名称合并**：同名更新 SKU 与状态；新名称追加；未出现在文件中的现有配件保留 |
| 5 | 配件导出格式 | 与模板一致三列：`配件名称`、`SKU编码`、`状态（默认启用）` |
| 6 | 配件导入后保存 | **自动保存**到 `userData/config/sku-import/config.json` |
| 7 | 状态列解析 | 简单二元：空/启用/是/true/1 → 启用；禁用/否/false/0 → 禁用；无法识别默认启用 |
| 8 | 实现方案 | **方案 A**：最小增量改动，不引入新依赖 |

---

## 2. 目标与非目标

### 目标

- 套装货号在 ERP 已存在时，预演阶段即拦截，避免误跳过或重复操作。
- 贴纸单品已存在时，仅补建套装，不重复创建贴纸。
- 执行标准由容量自动生成，简化 Excel 模板。
- 配件配置支持 Excel 批量维护：下载模板、导入合并、导出备份。

### 非目标

- 不改造建货号 workbook 解析为通用 xlsx 框架（不抽取 `core/xlsx-reader`）。
- 不引入 exceljs 等新依赖。
- 配件导入不支持 `品牌` 列（保留现有 `brand` 字段不变）。
- 配件导入不做预览确认弹窗（导入后直接保存）。
- 不修改 ERP 侧已存在套装的编辑/更新能力。

---

## 3. 建货号导入校验

### 3.1 货号查询语义

| 概念 | 来源 | 说明 |
|------|------|------|
| 套装货号 | `proposedSkuCode` | Excel `商品SKU货号` 有值则用该值，否则按 `{前缀}-{品牌编码}-{产品名首字母}-{贴纸编码}` 生成 |
| 贴纸货号 | `贴纸编码` 列 | 直接作为 ERP `outerId`，**不是** `{套装货号}-ST` |

### 3.2 预演状态机（变更后）

```
validateImportRow 失败           → preview_blocked
品牌未匹配                       → preview_blocked
产品原品不存在                   → preview_blocked
套装货号已存在                   → preview_blocked  （原 skipped_existing，已变更）
配件未匹配                       → preview_blocked
贴纸已存在、套装不存在           → pending（提示：执行时将复用贴纸）
两者均不存在                     → pending
```

### 3.3 执行阶段

- `preview_blocked` 行不进入执行（与现逻辑一致）。
- `pending` 行：`resolveStickerBridgeEntry` 查询贴纸 `outerId`，存在则复用并可选更新图片；不存在则 `createSticker`。
- 删除 executor 中「套装已存在 → skipped_existing」分支（预演已拦截，作为防御性代码可保留单测覆盖的 fail-safe 或移除）。

### 3.4 阻断文案

- 套装已存在：`ERP 中已存在套装货号，不允许导入`
- 贴纸复用提示（非阻断）：`贴纸货号 {outerId} 已存在，执行时将复用`

### 3.5 影响文件

- `src/tools/sku-import/preview.ts`
- `src/tools/sku-import/executor.ts`（可选清理 skipped_existing 兜底）
- `src/renderer/tools/sku-import/task-status-labels.ts`（文案与统计）
- `tests/sku-import-preview.test.ts`

---

## 4. 执行标准默认值

### 4.1 规则

- Excel **不读取** `执行标准` 列；列存在时忽略，不报错（兼容旧文件）。
- 新增 `buildExecutionStandard(capacity: string): string`，返回 `Capacity:${capacity.trim()}`。
- `capacity` 为空时返回 `Capacity:`（与校验「缺少容量」配合：有容量的行才会进入创建）。

### 4.2 使用点

- `executor.ts` 调用 `createPureSuite` 时传入 `standard: buildExecutionStandard(normalized.capacity)`。
- `domain.ts` 的 `normalizeImportRowValues` 移除对 `执行标准` 的映射（或保留字段但恒为空，推荐移除未使用字段）。

### 4.3 影响文件

- `src/tools/sku-import/domain.ts`
- `src/tools/sku-import/executor.ts`
- `tests/sku-import-domain.test.ts`
- `tests/sku-import-workbook.test.ts`（移除对执行标准列的依赖断言）

---

## 5. 配件导入导出

### 5.1 UI 布局

配置管理 → 配件 Tab 工具栏（搜索框右侧）：

```text
[搜索…]  [下载模板]  [导入]  [导出]  …  [新增配件]  [保存配置]
```

| 操作 | 行为 |
|------|------|
| 下载模板 | `showSaveDialog`，将内置模板复制到用户选择路径 |
| 导入 | `showOpenDialog` 选 `.xlsx` → 解析合并 → 自动保存 → toast 汇总 |
| 导出 | `showSaveDialog` → 导出当前**全部**配件（不受搜索筛选影响） |

### 5.2 Excel 格式

**表头（第一行，列名须与下列字符串完全一致）：**

| 列名 | 必填 | 说明 |
|------|------|------|
| 配件名称 | 是 | 与建货号 Excel「配件」列名称一致 |
| SKU编码 | 是 | ERP 货号 |
| 状态（默认启用） | 否 | 见 §1 决策 #7 |

**模板文件位置：**

- 开发/打包：`resources/templates/配件导入模板.xlsx`
- 自仓库根目录 `配件导入模板.xlsx` 迁入（实现阶段执行）

### 5.3 合并算法

纯函数 `mergeAccessoriesByName(existing, imported)`：

1. 以 `name.trim().toLowerCase()` 为键建立现有索引。
2. 遍历导入行（按文件行序）：
   - 名称为空或 SKU 为空 → 计入 `skipped`，跳过。
   - 同名在**本文件**已处理过 → 计入 `skipped`（重复行），跳过。
   - 匹配现有配件 → 更新 `skuCode`、`enabled`；`brand` 不变；计入 `updated`。
   - 无匹配 → 追加 `{ name, skuCode, brand: '', enabled }`；计入 `added`。
3. 未出现在导入文件中的现有配件保留在结果末尾（原顺序）。

### 5.4 导入结果

toast 示例：`已导入：新增 5 条，更新 3 条，跳过 2 条无效行`

错误（不修改配置）：

- 文件无法解析
- 缺少必需列
- 0 条有效数据

### 5.5 导出

- 列顺序与模板一致。
- `enabled === true` → `启用`；`false` → `禁用`。
- 列表为空时仍输出仅含表头的 xlsx。

### 5.6 架构

```text
config.tsx
  → window.kuaimai.skuImport.importAccessories(filePath?)
  → window.kuaimai.skuImport.exportAccessories()
  → window.kuaimai.skuImport.downloadAccessoryTemplate()
preload/apis/sku-import.ts
main/ipc/tools/sku-import.ts（或 sku-import-config 域）
main/services/sku-import-config.ts
tools/sku-import/accessories-workbook.ts   # parseAccessoryWorkbook, buildAccessoryWorkbook
tools/sku-import/accessories-merge.ts      # mergeAccessoriesByName, parseAccessoryStatus
core/sku-import-config-storage.ts          # 已有读写
```

**IPC 通道（建议）：**

- `sku-import:import-accessories` → `{ added, updated, skipped }`
- `sku-import:export-accessories` → `{ filePath }`
- `sku-import:download-accessory-template` → `{ filePath }`

主进程负责 `dialog` 与读写字节；解析/合并/导出构建在 `tools/` 纯 TS。

### 5.7 xlsx 实现

- 复用 `jszip` + `fast-xml-parser`（与 `workbook.ts` 同栈），在 `accessories-workbook.ts` 实现轻量读写。
- 不修改 `workbook.ts` 建货号逻辑。

### 5.8 测试

- `tests/accessories-merge.test.ts`：合并、状态解析、重复行跳过
- `tests/accessories-workbook.test.ts`：表头校验、 round-trip 导出列

---

## 6. 错误处理汇总

| 场景 | 处理 |
|------|------|
| 建货号：套装已存在 | 该行 `preview_blocked` |
| 建货号：Excel 含执行标准列 | 忽略 |
| 配件：缺列/无表头 | 抛错，配置不变 |
| 配件：0 条有效行 | 抛错 `未找到有效配件数据` |
| 配件：导出列表为空 | 导出仅表头 |
| 模板下载：用户取消对话框 | 静默返回，不 toast 错误 |

---

## 7. 打包

- `resources/templates/配件导入模板.xlsx` 纳入 `buildResources` 或 `files`/`extraResources`，确保打包后 `process.resourcesPath` 可解析。
- 开发环境路径：`path.join(app.getAppPath(), 'resources/templates/配件导入模板.xlsx')`。

---

## 8. 验收标准

1. 预演：套装货号已在 ERP 存在的行显示为阻断，不可执行；贴纸已存在行可执行且仅建套装。
2. 创建套装的执行标准为 `Capacity:{容量}`，与 Excel 执行标准列无关。
3. 配件 Tab 可下载模板、导入合并、导出三列 xlsx；导入后配置立即持久化。
4. `pnpm run test` 与 `pnpm run typecheck` 通过。
