# SKU 冒烟 CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用独立 CLI 脚本读取 `tests/上品测试/上品记录.txt` + PNG，复用现有 sku-import 创建逻辑，调用真实 ERP 接口完成贴纸/套装创建并用 D2 规则验证。

**Architecture:** 新增 4 个纯 TS 模块（解析 txt、找图、读 .env 配置、D2 验证）+ 薄 CLI 入口；创建路径复用 `preview.ts` + `executor.ts`；验证路径用 `queryListV2` + `getItemDetail`。

**Tech Stack:** TypeScript、tsx、dotenv、现有 `erp-web-client` / `erp-oss-uploader` / `sku-import` 工具链、Vitest

**Spec:** `docs/superpowers/specs/2026-06-28-sku-smoke-cli-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/tools/sku-import/parse-import-txt.ts` | Create | TSV → headers + data rows |
| `src/tools/sku-import/resolve-fixture-image.ts` | Create | 同目录 PNG 或 `--image` |
| `src/tools/sku-import/load-erp-config-from-env.ts` | Create | `ERP_COOKIE` + `ERP_COMPANY_ID` → `ErpWebConfig` |
| `src/tools/sku-import/verify-created-items.ts` | Create | D2 结构验证 |
| `scripts/run-sku-smoke.mjs` | Create | CLI 入口 |
| `tests/sku-import-parse-import-txt.test.ts` | Create | 解析单测 |
| `tests/sku-import-verify-created-items.test.ts` | Create | 验证逻辑单测 |
| `.env.example` | Modify | 增加 `ERP_COMPANY_ID` |
| `package.json` | Modify | 增加 `smoke:sku` script |

---

### Task 1: 解析 TSV fixture

**Files:**
- Create: `src/tools/sku-import/parse-import-txt.ts`
- Create: `tests/sku-import-parse-import-txt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseImportTxt } from '../src/tools/sku-import/parse-import-txt';

describe('parseImportTxt', () => {
  it('应解析 Tab 分隔表头与数据行', () => {
    const fixture = path.join(process.cwd(), 'tests/上品测试/上品记录.txt');
    const parsed = parseImportTxt(fs.readFileSync(fixture, 'utf8'));
    expect(parsed.headers).toContain('品牌');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.values['品牌']).toBe('WKAU');
    expect(parsed.rows[0]?.values['商品SKU货号']).toBe('test-69-WKAU-BYMPGXJ0001');
    expect(parsed.rows[0]?.rowNumber).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/sku-import-parse-import-txt.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/tools/sku-import/parse-import-txt.ts
export interface ParsedImportTxtRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedImportTxt {
  headers: string[];
  rows: ParsedImportTxtRow[];
}

export function parseImportTxt(content: string): ParsedImportTxt {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('上品记录.txt 至少需要表头行和一行数据');
  }

  const headers = lines[0]!.split('\t').map((h) => h.trim());
  const rows: ParsedImportTxtRow[] = lines.slice(1).map((line, index) => {
    const cells = line.split('\t');
    const values: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (!header) continue;
      values[header] = (cells[i] ?? '').trim();
    }
    return { rowNumber: index + 2, values };
  });

  return { headers, rows };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/sku-import-parse-import-txt.test.ts`  
Expected: PASS

---

### Task 2: 解析 fixture 图片

**Files:**
- Create: `src/tools/sku-import/resolve-fixture-image.ts`
- Test: inline in Task 6 CLI dry-run

- [ ] **Step 1: Implement resolveFixtureImage**

```typescript
// src/tools/sku-import/resolve-fixture-image.ts
import fs from 'node:fs';
import path from 'node:path';

import type { WorkbookEmbeddedImage } from './workbook';

export function resolveFixtureImage(
  fixtureDir: string,
  explicitPath?: string,
): { filePath: string; image: WorkbookEmbeddedImage } {
  const imagePath = explicitPath
    ? path.resolve(explicitPath)
    : fs
        .readdirSync(fixtureDir)
        .filter((name) => name.toLowerCase().endsWith('.png'))
        .sort()
        .map((name) => path.join(fixtureDir, name))[0];

  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(
      explicitPath
        ? `图片不存在: ${explicitPath}`
        : `fixture 目录下未找到 .png: ${fixtureDir}`,
    );
  }

  const buffer = fs.readFileSync(imagePath);
  return {
    filePath: imagePath,
    image: {
      columnIndex: 7,
      rowIndex: 1,
      fileName: path.basename(imagePath),
      contentType: 'image/png',
      buffer,
    },
  };
}
```

---

### Task 3: 从 .env 加载 ERP 配置

**Files:**
- Create: `src/tools/sku-import/load-erp-config-from-env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add ERP_COMPANY_ID to .env.example**

```env
ERP_COMPANY_ID=140109
```

- [ ] **Step 2: Implement loadErpWebConfigFromEnv**

```typescript
// src/tools/sku-import/load-erp-config-from-env.ts
import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';
import type { ErpWebConfig } from '../../core/erp-web-client';
import { normalizeErpBaseUrl } from '../../core/erp-login';

export function loadErpWebConfigFromEnv(): ErpWebConfig {
  const cookie = process.env.ERP_COOKIE?.trim();
  if (!cookie) {
    throw new Error('请设置环境变量 ERP_COOKIE（scripts/.env 或根目录 .env）');
  }

  const companyId = process.env.ERP_COMPANY_ID?.trim();
  if (!companyId) {
    throw new Error('请设置环境变量 ERP_COMPANY_ID（浏览器 Network 请求头 companyid）');
  }

  const baseUrl = normalizeErpBaseUrl(process.env.ERP_BASE_URL ?? DEFAULT_ERP_BASE_URL);

  return {
    baseUrl,
    cookie,
    companyId,
    accessToken: process.env.ERP_ACCESS_TOKEN?.trim() || undefined,
  };
}
```

---

### Task 4: D2 结构验证

**Files:**
- Create: `src/tools/sku-import/verify-created-items.ts`
- Create: `tests/sku-import-verify-created-items.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';

import { verifySuiteBridgeStructure } from '../src/tools/sku-import/verify-created-items';

describe('verifySuiteBridgeStructure', () => {
  it('应要求 bridge 含贴纸与全部配件 sysSkuId', () => {
    const result = verifySuiteBridgeStructure({
      expectedAccessorySkuIds: [101, 102],
      stickerSysSkuId: 200,
      bridgeList: [
        { sysSkuId: 101, ratio: 1 },
        { sysSkuId: 102, ratio: 1 },
        { sysSkuId: 200, ratio: 1 },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('缺少配件时应失败并说明', () => {
    const result = verifySuiteBridgeStructure({
      expectedAccessorySkuIds: [101, 102],
      stickerSysSkuId: 200,
      bridgeList: [{ sysSkuId: 200, ratio: 1 }],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('配件');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement verify-created-items.ts**

核心导出：

```typescript
export function verifySuiteBridgeStructure(options: {
  expectedAccessorySkuIds: number[];
  stickerSysSkuId: number;
  bridgeList: Array<{ sysSkuId?: number; ratio?: number }>;
}): { ok: boolean; message: string };

export async function verifyCreatedSkuImportRow(
  catalog: ErpCatalogClient,
  client: ErpWebClient,
  previewRow: SkuImportPreviewRow,
): Promise<{ ok: boolean; steps: Array<{ label: string; ok: boolean; detail: string }> }>;
```

`verifyCreatedSkuImportRow` 流程：

1. `getItemsByOuterIds([stickerCode, bundleCode, ...accessoryCodes])`
2. 校验贴纸 `type===0`、套装 `type===2`、配件均存在
3. `client.getItemDetail(bundle.sysItemId)` → 取 `suiteBridgeList`（兼容字段名 `suiteBridgeList` / `simpleSuiteBridgeModels`）
4. 调 `verifySuiteBridgeStructure`

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm exec vitest run tests/sku-import-verify-created-items.test.ts`

---

### Task 5: CLI 入口

**Files:**
- Create: `scripts/run-sku-smoke.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add package.json script**

```json
"smoke:sku": "tsx scripts/run-sku-smoke.mjs"
```

- [ ] **Step 2: Implement scripts/run-sku-smoke.mjs**

要点：

```javascript
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 优先 scripts/.env
const scriptsEnv = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
if (fs.existsSync(scriptsEnv)) {
  const { config } = await import('dotenv');
  config({ path: scriptsEnv });
}

import { loadConfigFromEnv, uploadToErpOss } from '../src/tools/sku-import/...'; // 实际路径见下
```

CLI 逻辑：

1. 解析 `--fixture`（默认 `tests/上品测试`）、`--image`、`--verify-only`
2. `parseImportTxt(fs.readFileSync(fixture/上品记录.txt))`
3. `resolveFixtureImage(fixtureDir, imageArg)`
4. `loadErpWebConfigFromEnv()` + `createErpCatalogClient()`
5. 构造 `ParsedSkuImportWorkbook`（单行 + image，`workbookBuffer: Buffer.alloc(0)`）
6. `buildSkuImportPreview('smoke', fixturePath, parsed, catalog)`
7. 若非 `--verify-only`：`executeSkuImportRows({...})`（不写盘）
8. `verifyCreatedSkuImportRow(catalog, client, previewRow)`
9. 打印逐步报告；`process.exit(verify.ok ? 0 : 1)`

注意：`executeSkuImportRows` 需要 `ossConfig` → 复用 `loadConfigFromEnv()` from `erp-oss-uploader`。

- [ ] **Step 3: Manual smoke test**

```bash
cp .env.example scripts/.env   # 填入真实 Cookie + companyId
pnpm run smoke:sku -- --verify-only   # 先看现状
pnpm run smoke:sku                    # 创建 + 验证
```

Expected: 终端 6 步全 ✓，退出码 0

---

### Task 6: 全量检查

- [ ] **Step 1: Run unit tests**

```bash
pnpm test && pnpm typecheck
```

Expected: all pass

- [ ] **Step 2: Document usage in spec** (already in design doc — no extra README unless user asks)

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|---|---|
| 独立 CLI | Task 5 |
| `.env` 凭证 | Task 3 |
| 读 txt + PNG | Task 1, 2 |
| 创建+验证 / `--verify-only` | Task 5 |
| D2 结构验证 | Task 4 |
| 复用 preview/executor | Task 5 |
| 幂等（贴纸复用、套装跳过） | 已有 executor，Task 5 直接调用 |
| 单元测试（非 CI ERP） | Task 1, 4 |

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-sku-smoke-cli.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — implement all tasks in this session with checkpoints

Which approach?
