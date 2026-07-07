# 建货号校验增强与配件导入导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 套装货号已存在时预演硬阻断、执行标准由容量自动生成、配置管理配件 Tab 支持 Excel 模板下载/导入合并/导出。

**Architecture:** 在现有 `tools/sku-import` 纯 TS 层小改 `preview.ts` / `domain.ts` / `executor.ts`；新增 `accessories-merge.ts` 与 `accessories-workbook.ts` 处理配件 xlsx；主进程 `sku-import-config` service 负责 dialog 与持久化；渲染进程 `config.tsx` 增加三个按钮。不引入新依赖。

**Tech Stack:** Electron 34、TypeScript 5、Vitest、jszip、fast-xml-parser、现有 IPC 分层（shared → tools → main/services → preload → renderer）

**Spec:** `docs/superpowers/specs/2026-07-07-sku-import-validation-accessories-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/tools/sku-import/domain.ts` | `buildExecutionStandard`；移除 Excel `执行标准` 映射 |
| `src/tools/sku-import/preview.ts` | 套装已存在 → `preview_blocked` |
| `src/tools/sku-import/executor.ts` | 使用 `buildExecutionStandard`；移除套装 `skipped_existing` 兜底 |
| `src/tools/sku-import/accessories-merge.ts` | **新建** `parseAccessoryStatus`、`mergeAccessoriesByName` |
| `src/tools/sku-import/accessories-workbook.ts` | **新建** `parseAccessoryWorkbook`、`buildAccessoryWorkbook` |
| `src/shared/types/sku-import.ts` | **新增** `AccessoryImportResult` |
| `src/shared/ipc-channels.ts` | 三个新 IPC 通道 |
| `src/main/services/sku-import-config.ts` | 模板路径解析、导入/导出/下载 |
| `src/main/ipc/tools/sku-import.ts` | 注册新 handler |
| `src/preload/apis/sku-import.ts` | 暴露三个 API |
| `src/renderer/pages/config.tsx` | 配件 Tab 工具栏按钮 |
| `src/renderer/tools/sku-import/task-status-labels.ts` | 套装阻断文案 |
| `resources/templates/配件导入模板.xlsx` | **新建**（自根目录迁入） |
| `tests/accessories-merge.test.ts` | **新建** |
| `tests/accessories-workbook.test.ts` | **新建** |
| `tests/sku-import-domain.test.ts` | 执行标准测试 |
| `tests/sku-import-preview.test.ts` | 套装阻断 + 贴纸复用 |
| `tests/preview-row-labels.test.ts` | 文案更新 |

---

### Task 1: 执行标准默认值（domain）

**Files:**
- Modify: `src/tools/sku-import/domain.ts`
- Test: `tests/sku-import-domain.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/sku-import-domain.test.ts` 追加：

```typescript
import { buildExecutionStandard } from '../src/tools/sku-import/domain';

// 在 describe 内追加：
it('buildExecutionStandard 应由容量生成 Capacity 前缀', () => {
  expect(buildExecutionStandard('60ml')).toBe('Capacity:60ml');
  expect(buildExecutionStandard(' 60ml ')).toBe('Capacity:60ml');
  expect(buildExecutionStandard('')).toBe('Capacity:');
});

it('normalizeImportRowValues 不再映射执行标准列', () => {
  const row = normalizeImportRowValues({
    品牌: 'WKAU',
    产品名: '除味剂',
    容量: '60ml',
    执行标准: 'Capacity:ignored',
  });
  expect(row).not.toHaveProperty('standard');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/sku-import-domain.test.ts -t "buildExecutionStandard|不再映射执行标准"`
Expected: FAIL — `buildExecutionStandard` not exported

- [ ] **Step 3: 实现 domain 变更**

在 `src/tools/sku-import/domain.ts`：

1. 新增并导出：

```typescript
export function buildExecutionStandard(capacity: string): string {
  return `Capacity:${capacity.trim()}`;
}
```

2. 从 `normalizeImportRowValues` 的返回类型与实现中删除 `standard` 字段及对 `values['执行标准']` 的读取。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/sku-import-domain.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/sku-import/domain.ts tests/sku-import-domain.test.ts
git commit -m "feat(sku-import): derive execution standard from capacity"
```

---

### Task 2: executor 使用执行标准构建函数

**Files:**
- Modify: `src/tools/sku-import/executor.ts`

- [ ] **Step 1: 修改 executor**

在 `src/tools/sku-import/executor.ts`：

```typescript
import { buildExecutionStandard, isSkuImportDataRow, normalizeImportRowValues } from './domain';
```

将 `createPureSuite` 调用处的：

```typescript
standard: normalized.standard,
```

改为：

```typescript
standard: buildExecutionStandard(normalized.capacity),
```

- [ ] **Step 2: 运行 typecheck**

Run: `pnpm run typecheck`
Expected: PASS（无 `normalized.standard` 引用残留）

- [ ] **Step 3: Commit**

```bash
git add src/tools/sku-import/executor.ts
git commit -m "feat(sku-import): apply capacity-based execution standard on create"
```

---

### Task 3: 套装已存在 → preview_blocked

**Files:**
- Modify: `src/tools/sku-import/preview.ts`
- Test: `tests/sku-import-preview.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/sku-import-preview.test.ts` 追加：

```typescript
it('套装货号已存在时应 preview_blocked', async () => {
  const bundleId = '69-39-T-test0628';
  const catalog = mockCatalog({
    getItemsByOuterIds: vi.fn().mockImplementation(async (ids: string[]) => {
      if (ids.includes('YP-BYMPGXJ01')) {
        return [{ outerId: 'YP-BYMPGXJ01', sysItemId: 50, title: '原品' }];
      }
      if (ids.includes(bundleId)) {
        return [{ outerId: bundleId, sysItemId: 99, title: '已有套装' }];
      }
      return [];
    }),
  });

  const result = await buildSkuImportPreview(
    's1',
    '/tmp/x.xlsx',
    baseParsed,
    catalog,
    testConfig,
  );

  expect(result.rows[0]?.status).toBe('preview_blocked');
  expect(result.rows[0]?.blockedReason).toBe('ERP 中已存在套装货号，不允许导入');
  expect(result.skippedCount).toBe(0);
  expect(result.blockedCount).toBe(1);
});

it('贴纸已存在、套装不存在时应 pending 并提示复用', async () => {
  const catalog = mockCatalog({});
  mockProductOriginal(catalog);
  vi.mocked(catalog.getItemsByOuterIds).mockImplementation(async (ids: string[]) => {
    if (ids.includes('YP-BYMPGXJ01')) {
      return [{ outerId: 'YP-BYMPGXJ01', sysItemId: 50, title: '原品' }];
    }
    if (ids.includes('test0628')) {
      return [{ outerId: 'test0628', sysItemId: 10, title: '已有贴纸' }];
    }
    return [];
  });
  vi.mocked(catalog.buildBridgeEntryForOuterId).mockImplementation(async (outerId: string) => {
    if (outerId === 'PJ-ZND01' || outerId === 'PJ-SMS01') {
      return { outerId, subItemId: 1, ratio: 1, title: outerId };
    }
    return null;
  });

  const result = await buildSkuImportPreview(
    's1',
    '/tmp/x.xlsx',
    baseParsed,
    catalog,
    testConfig,
  );

  expect(result.rows[0]?.status).toBe('pending');
  expect(result.rows[0]?.blockedReason).toBe('贴纸货号 test0628 已存在，执行时将复用');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/sku-import-preview.test.ts -t "套装货号已存在|贴纸已存在"`
Expected: FAIL — status 为 `skipped_existing` 或 blockedReason 不匹配

- [ ] **Step 3: 修改 preview.ts**

在 `src/tools/sku-import/preview.ts`，将 `bundleExists` 分支：

```typescript
if (bundleExists) {
  rows.push({
    ...base,
    proposedSkuCode,
    existingSkuCode: proposedSkuCode,
    status: 'skipped_existing',
    blockedReason: 'ERP 中已存在套装货号，将跳过创建',
  });
```

改为：

```typescript
if (bundleExists) {
  rows.push({
    ...base,
    proposedSkuCode,
    existingSkuCode: proposedSkuCode,
    status: 'preview_blocked',
    blockedReason: 'ERP 中已存在套装货号，不允许导入',
  });
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/sku-import-preview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/sku-import/preview.ts tests/sku-import-preview.test.ts
git commit -m "fix(sku-import): block preview when bundle SKU already exists"
```

---

### Task 4: 移除 executor 套装跳过兜底

**Files:**
- Modify: `src/tools/sku-import/executor.ts`

- [ ] **Step 1: 删除套装已存在分支**

在 `executeSkuImportRows` 的 `try` 块内，删除以下整段（约 169–185 行）：

```typescript
const existingBundles = await options.catalog.getItemsByOuterIds([bundleOuterId]);
if (existingBundles.length > 0) {
  rowResults.push({ ... status: 'skipped_existing' ... });
  pushWriteback({ ... });
  emitRowProgress(index);
  continue;
}
```

保留 `previewRow.status === 'skipped_existing'` 顶部分支（类型上可能仍被其他路径使用，或后续可清理）。

- [ ] **Step 2: 运行全量测试**

Run: `pnpm exec vitest run tests/sku-import-execute-summary.test.ts tests/sku-import-preview.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tools/sku-import/executor.ts
git commit -m "refactor(sku-import): rely on preview to block existing bundles"
```

---

### Task 5: 预演 UI 文案

**Files:**
- Modify: `src/renderer/tools/sku-import/task-status-labels.ts`
- Test: `tests/preview-row-labels.test.ts`

- [ ] **Step 1: 更新失败测试**

在 `tests/preview-row-labels.test.ts`，将 `skipped_existing` 套装相关断言改为 `preview_blocked`：

```typescript
it('套装已存在预演阻断应显示不允许导入', () => {
  expect(
    previewRowReason({
      status: 'preview_blocked',
      blockedReason: 'ERP 中已存在套装货号，不允许导入',
    } as SkuImportPreviewRow),
  ).toBe('ERP 中已存在套装货号，不允许导入');
});
```

删除或改写原先期望 `skipped_existing` + `将跳过创建` 的用例。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/preview-row-labels.test.ts`
Expected: FAIL

- [ ] **Step 3: 修改 task-status-labels.ts**

在 `previewRowReason` 中删除 `skipped_existing` 的套装专用分支（或改为通用 `blockedReason` 回退）。`skipped_existing` 的 label 可保留给历史任务数据。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/preview-row-labels.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/tools/sku-import/task-status-labels.ts tests/preview-row-labels.test.ts
git commit -m "fix(ui): show bundle-exists as preview blocked reason"
```

---

### Task 6: 配件合并纯函数

**Files:**
- Create: `src/tools/sku-import/accessories-merge.ts`
- Test: `tests/accessories-merge.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/accessories-merge.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';

import type { AccessoryConfig } from '@shared/schemas/sku-import-config';
import {
  mergeAccessoriesByName,
  parseAccessoryStatus,
} from '../src/tools/sku-import/accessories-merge';

describe('parseAccessoryStatus', () => {
  it.each([
    ['', true],
    ['启用', true],
    ['是', true],
    ['true', true],
    ['1', true],
    ['禁用', false],
    ['否', false],
    ['false', false],
    ['0', false],
    ['未知', true],
  ])('"%s" → enabled=%s', (raw, expected) => {
    expect(parseAccessoryStatus(raw)).toBe(expected);
  });
});

describe('mergeAccessoriesByName', () => {
  const existing: AccessoryConfig[] = [
    { name: '自粘袋', skuCode: 'PJ-OLD', brand: 'WKAU', enabled: true },
    { name: '说明书', skuCode: 'PJ-SMS', brand: '', enabled: false },
  ];

  it('同名更新 sku 与状态并保留 brand', () => {
    const { accessories, added, updated, skipped } = mergeAccessoriesByName(existing, [
      { name: '自粘袋', skuCode: 'PJ-NEW', statusRaw: '禁用' },
    ]);
    expect(updated).toBe(1);
    expect(added).toBe(0);
    expect(skipped).toBe(0);
    expect(accessories.find((a) => a.name === '自粘袋')).toMatchObject({
      skuCode: 'PJ-NEW',
      brand: 'WKAU',
      enabled: false,
    });
    expect(accessories.find((a) => a.name === '说明书')).toBeTruthy();
  });

  it('新名称追加且 brand 为空', () => {
    const { accessories, added } = mergeAccessoriesByName(existing, [
      { name: '面膜刷', skuCode: 'PJ-MMS', statusRaw: '' },
    ]);
    expect(added).toBe(1);
    expect(accessories.at(-1)).toMatchObject({
      name: '面膜刷',
      skuCode: 'PJ-MMS',
      brand: '',
      enabled: true,
    });
  });

  it('空名称或空 SKU 计入 skipped', () => {
    const { skipped } = mergeAccessoriesByName(existing, [
      { name: '', skuCode: 'X', statusRaw: '' },
      { name: '新配件', skuCode: '', statusRaw: '' },
    ]);
    expect(skipped).toBe(2);
  });

  it('文件内重复名称第二行 skipped', () => {
    const { skipped, updated } = mergeAccessoriesByName(existing, [
      { name: '自粘袋', skuCode: 'PJ-A', statusRaw: '' },
      { name: '自粘袋', skuCode: 'PJ-B', statusRaw: '' },
    ]);
    expect(updated).toBe(1);
    expect(skipped).toBe(1);
    expect(
      accessoriesFindSku(
        mergeAccessoriesByName(existing, [
          { name: '自粘袋', skuCode: 'PJ-A', statusRaw: '' },
          { name: '自粘袋', skuCode: 'PJ-B', statusRaw: '' },
        ]).accessories,
        '自粘袋',
      ),
    ).toBe('PJ-A');
  });
});

function accessoriesFindSku(accessories: AccessoryConfig[], name: string): string | undefined {
  return accessories.find((a) => a.name === name)?.skuCode;
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/accessories-merge.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 accessories-merge.ts**

创建 `src/tools/sku-import/accessories-merge.ts`：

```typescript
import type { AccessoryConfig } from '@shared/schemas/sku-import-config';

export interface AccessoryImportRow {
  name: string;
  skuCode: string;
  statusRaw: string;
}

export interface AccessoryMergeResult {
  accessories: AccessoryConfig[];
  added: number;
  updated: number;
  skipped: number;
}

const DISABLED_STATUS = new Set(['禁用', '否', 'false', '0']);

export function parseAccessoryStatus(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return true;
  if (DISABLED_STATUS.has(raw.trim()) || DISABLED_STATUS.has(value)) return false;
  return true;
}

export function mergeAccessoriesByName(
  existing: AccessoryConfig[],
  imported: AccessoryImportRow[],
): AccessoryMergeResult {
  const accessories = existing.map((item) => ({ ...item }));
  const indexByName = new Map(
    accessories.map((item, index) => [item.name.trim().toLowerCase(), index]),
  );
  const seenInFile = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of imported) {
    const name = row.name.trim();
    const skuCode = row.skuCode.trim();
    if (!name || !skuCode) {
      skipped += 1;
      continue;
    }
    const key = name.toLowerCase();
    if (seenInFile.has(key)) {
      skipped += 1;
      continue;
    }
    seenInFile.add(key);
    const enabled = parseAccessoryStatus(row.statusRaw);
    const existingIndex = indexByName.get(key);
    if (existingIndex !== undefined) {
      accessories[existingIndex] = {
        ...accessories[existingIndex],
        skuCode,
        enabled,
      };
      updated += 1;
      continue;
    }
    accessories.push({ name, skuCode, brand: '', enabled });
    indexByName.set(key, accessories.length - 1);
    added += 1;
  }

  return { accessories, added, updated, skipped };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/accessories-merge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/sku-import/accessories-merge.ts tests/accessories-merge.test.ts
git commit -m "feat(sku-import): add accessory merge helpers"
```

---

### Task 7: 配件 workbook 解析与导出

**Files:**
- Create: `src/tools/sku-import/accessories-workbook.ts`
- Test: `tests/accessories-workbook.test.ts`
- Create: `resources/templates/配件导入模板.xlsx`（`git mv 配件导入模板.xlsx resources/templates/配件导入模板.xlsx`）

- [ ] **Step 1: 迁移模板文件**

```bash
mkdir -p resources/templates
git mv "配件导入模板.xlsx" resources/templates/配件导入模板.xlsx
```

- [ ] **Step 2: 写失败测试**

创建 `tests/accessories-workbook.test.ts`，包含：

1. `parseAccessoryWorkbook` 读取 `resources/templates/配件导入模板.xlsx`（表头正确、0 数据行）
2. 用内联 `createAccessoryFixtureWorkbook()` 辅助函数（参考 `tests/sku-import-workbook.test.ts` 的 JSZip 模式，3 列）解析两行数据
3. 缺列时抛 `缺少必需列: SKU编码`
4. `buildAccessoryWorkbook` 导出后 `parseAccessoryWorkbook` round-trip 列值与状态

fixture 数据行示例：

```typescript
{ name: '自粘袋', skuCode: 'PJ-ZND01', statusRaw: '启用' }
{ name: '说明书', skuCode: 'PJ-SMS01', statusRaw: '' }
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm exec vitest run tests/accessories-workbook.test.ts`
Expected: FAIL

- [ ] **Step 4: 实现 accessories-workbook.ts**

创建 `src/tools/sku-import/accessories-workbook.ts`，导出：

```typescript
export const ACCESSORY_WORKBOOK_HEADERS = [
  '配件名称',
  'SKU编码',
  '状态（默认启用）',
] as const;

export interface ParsedAccessoryWorkbookRow {
  name: string;
  skuCode: string;
  statusRaw: string;
}

export async function parseAccessoryWorkbook(
  workbookBuffer: Buffer,
): Promise<ParsedAccessoryWorkbookRow[]>

export async function buildAccessoryWorkbook(
  rows: Array<{ name: string; skuCode: string; enabled: boolean }>,
): Promise<Buffer>
```

实现要点：
- 使用 `JSZip` + `fast-xml-parser` 读第一个 worksheet（与 `workbook.ts` 相同模式：sharedStrings、header 行校验）
- `parseAccessoryWorkbook`：校验三列 header 完全一致；返回所有数据行（含空行，由 merge 层 skip）
- `buildAccessoryWorkbook`：生成最小合法 xlsx（表头 + 数据行）；`enabled` → `启用` / `禁用`；空列表仅表头
- 导出列宽可沿用模板或省略（Excel 可打开即可）

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm exec vitest run tests/accessories-workbook.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add resources/templates/配件导入模板.xlsx src/tools/sku-import/accessories-workbook.ts tests/accessories-workbook.test.ts
git commit -m "feat(sku-import): add accessory workbook parse and export"
```

---

### Task 8: 共享类型与 IPC 通道

**Files:**
- Modify: `src/shared/types/sku-import.ts`
- Modify: `src/shared/ipc-channels.ts`

- [ ] **Step 1: 添加类型**

在 `src/shared/types/sku-import.ts`：

```typescript
export interface AccessoryImportResult {
  added: number;
  updated: number;
  skipped: number;
}

export interface AccessoryExportResult {
  filePath: string;
}
```

- [ ] **Step 2: 添加 IPC 通道**

在 `src/shared/ipc-channels.ts` 的 `SKU_IMPORT_CONFIG_SET` 后追加：

```typescript
SKU_IMPORT_IMPORT_ACCESSORIES: 'sku-import:import-accessories',
SKU_IMPORT_EXPORT_ACCESSORIES: 'sku-import:export-accessories',
SKU_IMPORT_DOWNLOAD_ACCESSORY_TEMPLATE: 'sku-import:download-accessory-template',
```

- [ ] **Step 3: 运行 typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/sku-import.ts src/shared/ipc-channels.ts
git commit -m "feat(shared): add accessory import/export IPC channels"
```

---

### Task 9: 主进程 service 与 IPC handler

**Files:**
- Modify: `src/main/services/sku-import-config.ts`
- Modify: `src/main/ipc/tools/sku-import.ts`

- [ ] **Step 1: 实现 service 函数**

在 `src/main/services/sku-import-config.ts` 追加：

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, type BrowserWindow } from 'electron';

import type { AccessoryExportResult, AccessoryImportResult } from '@shared/types/sku-import';
import { mergeAccessoriesByName } from '../../tools/sku-import/accessories-merge';
import {
  buildAccessoryWorkbook,
  parseAccessoryWorkbook,
} from '../../tools/sku-import/accessories-workbook';

const ACCESSORY_TEMPLATE_RELATIVE = 'resources/templates/配件导入模板.xlsx';

function resolveAccessoryTemplatePath(): string {
  return path.join(app.getAppPath(), ACCESSORY_TEMPLATE_RELATIVE);
}

export async function downloadAccessoryTemplate(
  win?: BrowserWindow | null,
): Promise<string | null> {
  const source = resolveAccessoryTemplatePath();
  if (!fs.existsSync(source)) {
    throw new Error('未找到配件导入模板');
  }
  const result = win
    ? await dialog.showSaveDialog(win, {
        defaultPath: '配件导入模板.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
    : await dialog.showSaveDialog({
        defaultPath: '配件导入模板.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
  if (result.canceled || !result.filePath) return null;
  fs.copyFileSync(source, result.filePath);
  return result.filePath;
}

export async function importAccessoriesFromFile(
  win?: BrowserWindow | null,
): Promise<AccessoryImportResult | null> {
  const pick = win
    ? await dialog.showOpenDialog(win, {
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      })
    : await dialog.showOpenDialog({
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      });
  if (pick.canceled || pick.filePaths.length === 0) return null;

  const buffer = fs.readFileSync(pick.filePaths[0]);
  const rows = await parseAccessoryWorkbook(buffer);
  const effectiveRows = rows.filter((row) => row.name.trim() || row.skuCode.trim());
  if (effectiveRows.length === 0) {
    throw new Error('未找到有效配件数据');
  }

  const current = getSkuImportConfig();
  const merged = mergeAccessoriesByName(
    current.accessories,
    effectiveRows.map((row) => ({
      name: row.name,
      skuCode: row.skuCode,
      statusRaw: row.statusRaw,
    })),
  );
  if (merged.added + merged.updated === 0 && merged.skipped === effectiveRows.length) {
    throw new Error('未找到有效配件数据');
  }

  setSkuImportConfig({ ...current, accessories: merged.accessories });
  return { added: merged.added, updated: merged.updated, skipped: merged.skipped };
}

export async function exportAccessoriesToFile(
  win?: BrowserWindow | null,
): Promise<AccessoryExportResult | null> {
  const current = getSkuImportConfig();
  const buffer = await buildAccessoryWorkbook(
    current.accessories.map((item) => ({
      name: item.name,
      skuCode: item.skuCode,
      enabled: item.enabled,
    })),
  );
  const result = win
    ? await dialog.showSaveDialog(win, {
        defaultPath: '配件配置导出.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
    : await dialog.showSaveDialog({
        defaultPath: '配件配置导出.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, buffer);
  return { filePath: result.filePath };
}
```

`app.getAppPath()` 在开发与打包后均指向含 `resources/` 的应用根（asar 内），与 `package.json` 的 `files: ["resources/**/*"]` 一致。

- [ ] **Step 2: 注册 IPC handler**

在 `src/main/ipc/tools/sku-import.ts` 导入并注册三个 handler，模式同 `SKU_IMPORT_EXPORT_RESULTS`（传入 `BrowserWindow.fromWebContents`）。

- [ ] **Step 3: 运行 typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/services/sku-import-config.ts src/main/ipc/tools/sku-import.ts
git commit -m "feat(main): wire accessory import export and template download"
```

---

### Task 10: Preload API

**Files:**
- Modify: `src/preload/apis/sku-import.ts`

- [ ] **Step 1: 暴露 API**

```typescript
import type { AccessoryExportResult, AccessoryImportResult } from '@shared/types/sku-import';

// 在 skuImportApi 对象内追加：
importAccessories: (): Promise<AccessoryImportResult | null> =>
  ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_IMPORT_ACCESSORIES),
exportAccessories: (): Promise<AccessoryExportResult | null> =>
  ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_EXPORT_ACCESSORIES),
downloadAccessoryTemplate: (): Promise<string | null> =>
  ipcRenderer.invoke(IPC_CHANNELS.SKU_IMPORT_DOWNLOAD_ACCESSORY_TEMPLATE),
```

- [ ] **Step 2: 运行 typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/preload/apis/sku-import.ts
git commit -m "feat(preload): expose accessory workbook APIs"
```

---

### Task 11: 配置页 UI

**Files:**
- Modify: `src/renderer/pages/config.tsx`

- [ ] **Step 1: 添加 handler 与按钮**

在 `config.tsx`：

1. 从 `lucide-react` 增加 `Download`、`Upload`、`FileDown`（或 `FileUp`）图标
2. 在配件 Tab 搜索框与「新增配件」之间插入三个 `Button`（`variant="outline"`）：
   - 下载模板 → `kuaimai.skuImport.downloadAccessoryTemplate()` → toast `模板已保存` 或取消无 toast
   - 导入 → `importAccessories()` → toast `已导入：新增 X 条，更新 Y 条，跳过 Z 条无效行`；成功后 `setAccessories` + `setAccessoriesDirty(false)` + 调用 `useSkuImportConfig` 的 refresh（若有）或重新 `getConfig`
   - 导出 → `exportAccessories()` → toast `已导出至 {filePath}`
3. 错误用现有 `toast(err.message)` 模式

- [ ] **Step 2: 手动验证（开发环境）**

Run: `pnpm start`  
验证：配置管理 → 配件 → 下载模板 / 导入 / 导出 三个操作

- [ ] **Step 3: Commit**

```bash
git add src/renderer/pages/config.tsx
git commit -m "feat(ui): add accessory import export controls on config page"
```

---

### Task 12: 全量验证

**Files:**（仅运行命令，无代码变更）

- [ ] **Step 1: 运行全量测试**

Run: `pnpm run test`
Expected: ALL PASS

- [ ] **Step 2: 运行 typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: 检查 workbook 测试无执行标准强依赖**

若 `tests/sku-import-workbook.test.ts` 仍断言 `执行标准` 列存在于解析结果对象，删除对 `standard` 字段的断言（列可保留在 fixture 中，仅验证解析不报错）。

- [ ] **Step 4: 更新 spec 状态（可选）**

将 `docs/superpowers/specs/2026-07-07-sku-import-validation-accessories-design.md` 状态改为「已实现」——仅当团队惯例要求时执行。

---

## Spec Coverage Checklist

| Spec § | Task |
|--------|------|
| 3 套装阻断 | Task 3, 4, 5 |
| 3 贴纸复用 | Task 3（测试覆盖） |
| 4 执行标准 | Task 1, 2 |
| 5 配件 UI | Task 11 |
| 5 合并算法 | Task 6 |
| 5 workbook | Task 7 |
| 5 IPC/架构 | Task 8, 9, 10 |
| 6 错误处理 | Task 7, 9 |
| 7 打包模板 | Task 7 |
| 8 验收 | Task 12 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-07-sku-import-validation-accessories.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Task 派发独立 subagent，任务间做代码审查，迭代快  
2. **Inline Execution** — 在本会话用 executing-plans 按 Task 批量执行，检查点处暂停确认  

**Which approach?**
