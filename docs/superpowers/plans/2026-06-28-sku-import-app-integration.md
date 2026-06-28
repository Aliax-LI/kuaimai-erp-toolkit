# 建货号桌面应用集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将冒烟已验证的建货号 ERP 流程（`/item/add` + `/item/addPureSuite`）完整对齐到 Electron 建货号页：预演硬阻断、配件 SKU 展示、任务落盘、执行后 D2 验证、增量 UI。

**Architecture:** 扩展 `shared/types` 与 `preview.ts`；新增 `sku-import-jobs.ts` 负责 `userData/jobs/sku-import/` 原子读写；`sku-import.ts` 在 execute 后调用 `verifyCreatedSkuImportRow`；`sku-import.tsx` 增量展示新字段与验证步骤。不改 IPC 通道。

**Tech Stack:** Electron、TypeScript、Vitest、现有 `tools/sku-import/*`、`erp-web-client`

**Spec:** `docs/superpowers/specs/2026-06-28-sku-import-app-integration-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/shared/types/sku-import.ts` | 新增 `MatchedAccessorySku`、`verifySteps` 等类型 |
| `src/tools/sku-import/preview.ts` | 硬阻断 + 配件 SKU 解析 |
| `src/tools/sku-import/constants.ts` | 分类常量（已有，preview 引用） |
| `src/main/services/sku-import-jobs.ts` | **新建** job 文件 CRUD |
| `src/main/services/sku-import.ts` | 改用 jobs；execute 后 D2 |
| `src/main/index.ts` | 启动时 `loadSkuImportJobs()` |
| `src/renderer/pages/sku-import.tsx` | 增量 UI |
| `tests/sku-import-preview.test.ts` | **新建** preview 单测 |
| `tests/sku-import-jobs.test.ts` | **新建** job 读写单测 |

---

### Task 1: 扩展共享类型

**Files:**
- Modify: `src/shared/types/sku-import.ts`
- Test: `tests/sku-import-preview.test.ts`（Task 2 创建）

- [ ] **Step 1: 在 `sku-import.ts` 增加类型**

```typescript
export interface MatchedAccessorySku {
  name: string;
  itemOuterId: string;
  skuOuterId: string;
  sysItemId?: number;
}

export interface SkuImportVerifyStep {
  label: string;
  ok: boolean;
  detail: string;
}
```

扩展 `SkuImportPreviewRow`：

```typescript
  stickerOuterId: string;
  matchedAccessorySkus: MatchedAccessorySku[];
  bundleCategory: string;
  stickerCategory: string;
```

扩展 `SkuImportExecuteRowResult`：

```typescript
  verifyOk?: boolean;
  verifySteps?: SkuImportVerifyStep[];
```

扩展 `SkuImportTaskSummary`：

```typescript
  verifyFailedCount?: number;
```

- [ ] **Step 2: 运行 typecheck**

Run: `pnpm run typecheck`  
Expected: 若干处 preview/UI 缺字段报错（Task 2/5 修复）

---

### Task 2: Preview 硬阻断 + 配件 SKU 解析

**Files:**
- Modify: `src/tools/sku-import/preview.ts`
- Modify: `src/tools/sku-import/constants.ts`（确认 `BUNDLE_CATEGORY_NAME`、`STICKER_CATEGORY_NAME` 已正确）
- Create: `tests/sku-import-preview.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/sku-import-preview.test.ts
import { describe, expect, it, vi } from 'vitest';
import { buildSkuImportPreview } from '../src/tools/sku-import/preview';
import type { ErpCatalogClient } from '../src/tools/sku-import/erp-catalog';
import type { ParsedSkuImportWorkbook } from '../src/tools/sku-import/workbook';

function mockCatalog(overrides: Partial<ErpCatalogClient>): ErpCatalogClient {
  return {
    listAllOuterIds: vi.fn().mockResolvedValue([]),
    listOuterIdsByPrefix: vi.fn().mockResolvedValue([]),
    listCatalogItems: vi.fn().mockResolvedValue([]),
    getItemsByOuterIds: vi.fn().mockResolvedValue([]),
    findItemsByTitleKeyword: vi.fn().mockResolvedValue([]),
    matchAccessoriesForImport: vi.fn().mockResolvedValue({ matched: [], missing: ['说明书'] }),
    getItemDetailRecord: vi.fn().mockResolvedValue({}),
    buildBridgeEntryForOuterId: vi.fn().mockResolvedValue(null),
    createSticker: vi.fn(),
    createPureSuite: vi.fn(),
    ...overrides,
  } as ErpCatalogClient;
}

const baseParsed: ParsedSkuImportWorkbook = {
  sheetName: '待创建货号记录',
  headers: [],
  rows: [
    {
      rowNumber: 2,
      values: {
        品牌: 'WKAU',
        产品名: 'test',
        容量: '30ml',
        配件: '自粘袋 说明书',
        产品原品编码: 'YP-X',
      },
      images: [],
    },
  ],
  workbookBuffer: Buffer.alloc(0),
};

describe('buildSkuImportPreview', () => {
  it('配件未完全匹配时应 preview_blocked', async () => {
    const catalog = mockCatalog({});
    const result = await buildSkuImportPreview('s1', '/tmp/x.xlsx', baseParsed, catalog);
    expect(result.rows[0].status).toBe('preview_blocked');
    expect(result.rows[0].blockedReason).toContain('说明书');
    expect(result.readyCount).toBe(0);
  });

  it('配件全匹配时应解析 matchedAccessorySkus', async () => {
    const catalog = mockCatalog({
      listOuterIdsByPrefix: vi.fn().mockResolvedValue([]),
      getItemsByOuterIds: vi.fn().mockResolvedValue([]),
      matchAccessoriesForImport: vi.fn().mockResolvedValue({
        matched: ['PJ-ZND01', 'PJ-SMS01'],
        missing: [],
      }),
      buildBridgeEntryForOuterId: vi.fn(async (outerId: string) => ({
        subItemId: outerId === 'PJ-ZND01' ? 100 : 200,
        outerId: outerId === 'PJ-ZND01' ? 'PJ-ZND01-02' : 'PJ-SMS01-01',
        title: outerId,
        ratio: 1,
      })),
    });
    const result = await buildSkuImportPreview('s1', '/tmp/x.xlsx', baseParsed, catalog);
    expect(result.rows[0].status).toBe('pending');
    expect(result.rows[0].matchedAccessorySkus).toHaveLength(2);
    expect(result.rows[0].matchedAccessorySkus[0].skuOuterId).toBe('PJ-ZND01-02');
  });
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `pnpm exec vitest run tests/sku-import-preview.test.ts`  
Expected: FAIL（字段缺失或逻辑未改）

- [ ] **Step 3: 实现 `preview.ts`**

在文件顶部增加：

```typescript
import {
  BUNDLE_CATEGORY_NAME,
  STICKER_CATEGORY_NAME,
} from './constants';
import type { MatchedAccessorySku } from '@shared/types/sku-import';
```

在 `matchAccessoriesForImport` 之后增加 helper：

```typescript
async function resolveMatchedAccessorySkus(
  catalog: ErpCatalogClient,
  accessoryNames: string[],
  matchedItemOuterIds: string[],
): Promise<MatchedAccessorySku[]> {
  const result: MatchedAccessorySku[] = [];
  for (let i = 0; i < accessoryNames.length; i++) {
    const name = accessoryNames[i];
    const itemOuterId = matchedItemOuterIds[i];
    if (!itemOuterId) continue;
    const bridge = await catalog.buildBridgeEntryForOuterId(itemOuterId);
    if (!bridge) {
      throw new Error(`无法解析配件 bridge: ${itemOuterId}`);
    }
    result.push({
      name,
      itemOuterId,
      skuOuterId: bridge.outerId,
      sysItemId: bridge.subItemId,
    });
  }
  return result;
}
```

每个 `rows.push` 分支补充字段：

```typescript
const stickerOuterId = buildStickerOuterId(proposedSkuCode);
// ...
matchedAccessorySkus: [], // blocked/skipped 可为空
stickerOuterId,
bundleCategory: BUNDLE_CATEGORY_NAME,
stickerCategory: STICKER_CATEGORY_NAME,
```

在 validation 通过且非 bundleExists 分支，**在 push pending 之前**：

```typescript
if (accessoryMatch.missing.length > 0) {
  rows.push({ /* ... */, status: 'preview_blocked', blockedReason: `未匹配配件: ${accessoryMatch.missing.join('、')}`, matchedAccessorySkus: [], ... });
  continue;
}

const matchedAccessorySkus = await resolveMatchedAccessorySkus(
  catalog,
  accessories,
  accessoryMatch.matched,
);
```

pending 行使用 `matchedAccessorySkus`；删除原 `blockedReason` 里「未匹配配件」的 pending 警告逻辑。

- [ ] **Step 4: 运行测试 PASS**

Run: `pnpm exec vitest run tests/sku-import-preview.test.ts`

- [ ] **Step 5: 全量测试**

Run: `pnpm test && pnpm run typecheck`

---

### Task 3: 任务落盘 `sku-import-jobs.ts`

**Files:**
- Create: `src/main/services/sku-import-jobs.ts`
- Modify: `src/main/services/sku-import.ts`
- Modify: `src/main/index.ts`
- Create: `tests/sku-import-jobs.test.ts`

- [ ] **Step 1: 写 job 读写测试**

```typescript
// tests/sku-import-jobs.test.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteSkuImportJob,
  listSkuImportJobs,
  loadSkuImportJob,
  saveSkuImportJob,
  type SkuImportJobRecord,
} from '../src/main/services/sku-import-jobs';

const tmpDirs: string[] = [];

function tempJobsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sku-jobs-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

const sampleJob: SkuImportJobRecord = {
  id: 'task-1',
  filePath: '/tmp/test.xlsx',
  parsed: {
    sheetName: '待创建货号记录',
    headers: ['品牌'],
    rows: [{ rowNumber: 2, values: { 品牌: 'WKAU' }, images: [] }],
    workbookBuffer: Buffer.alloc(0),
  },
  preview: {
    sessionId: 'task-1',
    filePath: '/tmp/test.xlsx',
    sheetName: '待创建货号记录',
    totalRows: 1,
    readyCount: 1,
    blockedCount: 0,
    skippedCount: 0,
    rows: [],
  },
  status: 'previewed',
  createdAt: '2026-06-28T00:00:00.000Z',
  updatedAt: '2026-06-28T00:00:00.000Z',
};

describe('sku-import-jobs', () => {
  it('save + load roundtrip', () => {
    const jobsDir = tempJobsDir();
    saveSkuImportJob(jobsDir, sampleJob);
    const loaded = loadSkuImportJob(jobsDir, 'task-1');
    expect(loaded?.id).toBe('task-1');
    expect(loaded?.parsed.rows[0].values['品牌']).toBe('WKAU');
    expect(loaded?.parsed.workbookBuffer).toBeUndefined();
  });

  it('list 按 updatedAt 降序', () => {
    const jobsDir = tempJobsDir();
    saveSkuImportJob(jobsDir, sampleJob);
    saveSkuImportJob(jobsDir, { ...sampleJob, id: 'task-2', updatedAt: '2026-06-28T01:00:00.000Z' });
    const ids = listSkuImportJobs(jobsDir).map((j) => j.id);
    expect(ids[0]).toBe('task-2');
  });

  it('delete 移除文件', () => {
    const jobsDir = tempJobsDir();
    saveSkuImportJob(jobsDir, sampleJob);
    deleteSkuImportJob(jobsDir, 'task-1');
    expect(loadSkuImportJob(jobsDir, 'task-1')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行 FAIL**

Run: `pnpm exec vitest run tests/sku-import-jobs.test.ts`

- [ ] **Step 3: 实现 `sku-import-jobs.ts`**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import type { SkuImportExecuteResult, SkuImportPreviewResult, SkuImportTaskStatus } from '@shared/types/sku-import';
import type { ParsedSkuImportWorkbook } from '../../tools/sku-import/workbook';

export interface SkuImportJobRecord {
  id: string;
  filePath: string;
  parsed: Omit<ParsedSkuImportWorkbook, 'workbookBuffer'> & { workbookBuffer?: Buffer };
  preview: SkuImportPreviewResult;
  status: SkuImportTaskStatus;
  createdAt: string;
  updatedAt: string;
  executeResult?: SkuImportExecuteResult;
  failureMessage?: string;
}

const JOB_SCHEMA_VERSION = 1;

function jobPath(jobsDir: string, taskId: string): string {
  return path.join(jobsDir, `${taskId}.json`);
}

function stripWorkbookBuffer(parsed: ParsedSkuImportWorkbook): SkuImportJobRecord['parsed'] {
  const { workbookBuffer: _drop, ...rest } = parsed;
  return rest;
}

export function saveSkuImportJob(jobsDir: string, record: SkuImportJobRecord): void {
  fs.mkdirSync(jobsDir, { recursive: true });
  const payload = {
    schemaVersion: JOB_SCHEMA_VERSION,
    updatedAt: record.updatedAt,
    data: {
      ...record,
      parsed: stripWorkbookBuffer(record.parsed as ParsedSkuImportWorkbook),
    },
  };
  const target = jobPath(jobsDir, record.id);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

export function loadSkuImportJob(jobsDir: string, taskId: string): SkuImportJobRecord | null {
  const file = jobPath(jobsDir, taskId);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { data: SkuImportJobRecord };
  return raw.data;
}

export function listSkuImportJobs(jobsDir: string): SkuImportJobRecord[] {
  if (!fs.existsSync(jobsDir)) return [];
  return fs
    .readdirSync(jobsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => loadSkuImportJob(jobsDir, name.replace(/\.json$/, '')))
    .filter((job): job is SkuImportJobRecord => job !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteSkuImportJob(jobsDir: string, taskId: string): void {
  const file = jobPath(jobsDir, taskId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
```

- [ ] **Step 4: 改造 `sku-import.ts`**

- 删除 `const tasks = new Map`；改为 `let jobsDir: string` + `initSkuImportJobs(dir)`。
- `previewSkuImportFile` / `execute` / `delete` / `list` / `clearAll` 每次变更后 `saveSkuImportJob`。
- `executeSkuImportTask` 执行前从 `filePath` 重新 `readFileSync` + `parseSkuImportWorkbook` 填充 `workbookBuffer`。
- `clearAllSkuImportTasks` 删除 jobs 目录下全部 json。

`main/index.ts` app ready 后：

```typescript
import { initSkuImportJobs } from './services/sku-import';
// ...
initSkuImportJobs(path.join(app.getPath('userData'), 'jobs', 'sku-import'));
```

- [ ] **Step 5: 测试 PASS + typecheck**

Run: `pnpm exec vitest run tests/sku-import-jobs.test.ts && pnpm run typecheck`

---

### Task 4: 执行后 D2 验证

**Files:**
- Modify: `src/main/services/sku-import.ts`
- Modify: `src/shared/types/sku-import.ts`（Task 1 已做）

- [ ] **Step 1: 在 execute 成功路径追加验证**

```typescript
import { createErpWebClient } from '../../core/erp-web-client';
import { verifyCreatedSkuImportRow } from '../../tools/sku-import/verify-created-items';
import { getErpWebConfig } from './erp-web';

// executeSkuImportTask try 块内，executeSkuImportRows 之后：
const client = createErpWebClient(getErpWebConfig());
const enrichedRows = [];

for (const rowResult of executeResult.rows) {
  if (rowResult.status !== 'succeeded' && rowResult.status !== 'skipped_existing') {
    enrichedRows.push(rowResult);
    continue;
  }
  const previewRow = task.preview.rows.find((r) => r.rowNumber === rowResult.rowNumber);
  if (!previewRow) {
    enrichedRows.push(rowResult);
    continue;
  }
  const verification = await verifyCreatedSkuImportRow(catalog, client, previewRow);
  enrichedRows.push({
    ...rowResult,
    verifyOk: verification.ok,
    verifySteps: verification.steps,
    failureReason:
      rowResult.failureReason ||
      (verification.ok ? '' : `结构验证未通过: ${verification.steps.filter((s) => !s.ok).map((s) => s.label).join('、')}`),
  });
}

task.executeResult = { ...executeResult, rows: enrichedRows };
```

- [ ] **Step 2: `toTaskSummary` 增加 `verifyFailedCount`**

```typescript
verifyFailedCount: task.executeResult?.rows.filter((r) => r.verifyOk === false).length,
```

- [ ] **Step 3: 手动/冒烟回归**

Run: `pnpm run smoke:sku -- --sku-code test-69-WKAU-BYMPGXJ0004`  
Expected: 全部验证通过

---

### Task 5: 前端增量 UI

**Files:**
- Modify: `src/renderer/pages/sku-import.tsx`

- [ ] **Step 1: 修贴纸货号展示**

将 `贴纸 {row.proposedSkuCode}-ST` 改为 `贴纸 {row.stickerOuterId}`。

- [ ] **Step 2: 扩展 `renderPreviewRow` 网格**

增加分类列；配件行改为：

```tsx
{row.matchedAccessorySkus.length > 0
  ? row.matchedAccessorySkus.map((a) => `${a.name} → ${a.skuOuterId}`).join('、')
  : row.matchedAccessoryCodes.join('、')}
```

- [ ] **Step 3: Alert 文案**

```tsx
<AlertDescription>
  贴纸经 item/add 创建（单位：张）；套装经 item/addPureSuite 创建。配件未匹配将阻断预演。
</AlertDescription>
```

- [ ] **Step 4: 执行结果 D2 展示**

在 `executeResult` Card 内，对 `executeResult.rows` 映射：

```tsx
{executeResult.rows.map((row) => (
  <div key={row.rowNumber} className="border-b py-2 last:border-b-0">
    <div className="flex items-center gap-2">
      <span>第 {row.rowNumber} 行 · {row.skuCode}</span>
      <Badge variant={row.verifyOk === false ? 'destructive' : 'default'}>
        {row.status}{row.verifyOk === false ? ' / 验证未通过' : row.verifyOk ? ' / 已验证' : ''}
      </Badge>
    </div>
    {row.verifySteps?.map((step) => (
      <p key={step.label} className={step.ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
        {step.ok ? '✓' : '✗'} {step.label}: {step.detail}
      </p>
    ))}
  </div>
))}
```

- [ ] **Step 5: 任务列表 verify 提示**

```tsx
{task.verifyFailedCount ? (
  <p className="text-xs text-destructive">验证未通过 {task.verifyFailedCount} 条</p>
) : null}
```

- [ ] **Step 6: 删除 pending 配件黄字警告**（硬阻断后不应出现）

移除 `showWarning` 相关 `配件未完全匹配` 文案。

- [ ] **Step 7: 手动 UI 验证**

Run: `pnpm start` → 建货号 → 导入测试 xlsx → 预演 → 执行

---

### Task 6: 最终验证

- [ ] **Step 1: 全量测试**

Run: `pnpm test && pnpm run typecheck`

- [ ] **Step 2: 重启持久化验证**

1. 预演创建任务  
2. 完全退出应用  
3. 重启 → 任务列表仍在  

- [ ] **Step 3: 阻断验证**

临时 mock 或改 fixture 使配件缺失 → 预演 `blockedCount > 0` 且不可执行

---

## Spec Coverage Check

| Spec 要求 | Task |
|-----------|------|
| 配件硬阻断 | Task 2 |
| 任务落盘 | Task 3 |
| D2 验证 | Task 4 |
| matchedAccessorySkus | Task 2 + 5 |
| UI 增量 | Task 5 |
| 测试 | Task 2, 3, 6 |

## Placeholder Scan

无 TBD / 相似任务省略。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-sku-import-app-integration.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 每 Task 派生子 agent，Task 间 review  
2. **Inline Execution** — 本会话按 Task 顺序直接改代码，检查点暂停

**Which approach?**
