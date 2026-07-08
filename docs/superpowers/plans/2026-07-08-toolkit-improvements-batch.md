# 小工具体验改进批次 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复子 SKU 货号 ERP 匹配失败；工作台侧栏切换会话内保活；配件配置支持批量删除；品牌配置移除名称简写；Windows 安装包快捷方式使用应用 logo。

**Architecture:** ERP 查找在 `erp-catalog.ts` 保留 `queryListV2` 主路径，对未命中 ID fallback `querySingle(content=outerId)` 并增强 `normalizeListItem` 解析 `skus`/`skuERP`。工作台在 `AppLayout` 常驻挂载三页，路由 pathname 控制 `hidden`。配置页 UI 增量；图标脚本生成多尺寸 ICO + `package.json` NSIS 显式配置。

**Tech Stack:** Electron 34、React 19、TypeScript 5、Vitest、Tailwind 4、electron-builder NSIS、sharp、png-to-ico

**Spec:** `docs/superpowers/specs/2026-07-08-toolkit-improvements-batch-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/tools/sku-import/erp-catalog.ts` | `normalizeListItem` 增强；`querySingleByOuterId`；`getItemsByOuterIds` fallback |
| `tests/erp-catalog-lookup.test.ts` | **新建** fallback 与 normalize 单测 |
| `tests/erp-catalog-find-item.test.ts` | 保留现有 `findCatalogItemByOuterId` 测试 |
| `src/renderer/components/layout/app-layout.tsx` | 三页常驻保活 |
| `src/renderer/routes/index.tsx` | 路由子元素改为 `null`（页面由 Layout 渲染） |
| `src/renderer/pages/config.tsx` | 配件批量删除；品牌去掉简写 |
| `scripts/generate-app-icons.mjs` | 多尺寸 ICO 生成 |
| `package.json` | `build.nsis` 图标与快捷方式配置 |
| `resources/icon.ico` | 重新生成产物 |
| `resources/defaults/sku-import-config.json` | 可选：去掉 `shortName` 字段 |

---

### Task 1: 增强 normalizeListItem 解析子 SKU 数组

**Files:**
- Modify: `src/tools/sku-import/erp-catalog.ts`
- Test: `tests/erp-catalog-lookup.test.ts`（新建）

- [ ] **Step 1: 写失败测试**

创建 `tests/erp-catalog-lookup.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';

import { normalizeListItemForTest } from '../src/tools/sku-import/erp-catalog';

describe('normalizeListItem sku arrays', () => {
  it('应从 skus 数组映射多个子货号', () => {
    const item = normalizeListItemForTest({
      outerId: 'YP-ZBQXJ01',
      title: '珠宝清洗剂',
      sysItemId: 5658398639519744,
      skus: [
        {
          outerId: 'YP-ZBQXJ01-03',
          skuOuterId: 'YP-ZBQXJ01-03',
          sysSkuId: 713113192169984,
          propertiesName: '50ml柠檬味',
        },
      ],
    });

    expect(item).toEqual({
      outerId: 'YP-ZBQXJ01',
      title: '珠宝清洗剂',
      sysItemId: 5658398639519744,
      type: undefined,
      skus: [
        {
          skuOuterId: 'YP-ZBQXJ01-03',
          sysSkuId: 713113192169984,
          title: '50ml柠檬味',
        },
      ],
    });
  });

  it('应从 skuERP 数组映射子货号', () => {
    const item = normalizeListItemForTest({
      outerId: 'YP-ZBQXJ01',
      title: '珠宝清洗剂',
      skuERP: [{ outerId: 'YP-ZBQXJ01-03', sysSkuId: 1 }],
    });

    expect(item?.skus?.[0]?.skuOuterId).toBe('YP-ZBQXJ01-03');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/erp-catalog-lookup.test.ts -t "normalizeListItem"`
Expected: FAIL — `normalizeListItemForTest` not exported

- [ ] **Step 3: 实现 normalizeListItem 增强**

在 `src/tools/sku-import/erp-catalog.ts`，将 `normalizeListItem` 改为：

```typescript
function mapSkuRecord(sku: Record<string, unknown>) {
  const skuOuterId = String(sku.outerId ?? sku.skuOuterId ?? '').trim();
  if (!skuOuterId) {
    return null;
  }
  return {
    skuOuterId,
    sysSkuId: typeof sku.sysSkuId === 'number' ? sku.sysSkuId : undefined,
    title: typeof sku.propertiesName === 'string' ? sku.propertiesName : undefined,
  };
}

function normalizeListItem(item: Record<string, unknown>): ErpCatalogItem | null {
  const outerId = String(item.outerId ?? item.skuOuterId ?? '').trim();
  const title = String(item.title ?? '').trim();
  const sysItemId = typeof item.sysItemId === 'number' ? item.sysItemId : undefined;
  const sysSkuId = typeof item.sysSkuId === 'number' ? item.sysSkuId : undefined;

  const nestedSkus = item.skus ?? item.skuERP;
  let skus: ErpCatalogItem['skus'];
  if (Array.isArray(nestedSkus) && nestedSkus.length > 0) {
    skus = nestedSkus
      .filter((sku): sku is Record<string, unknown> => Boolean(sku) && typeof sku === 'object')
      .map((sku) => mapSkuRecord(sku))
      .filter((sku): sku is NonNullable<typeof sku> => sku !== null);
  } else if (sysSkuId || outerId) {
    skus = [
      {
        skuOuterId: String(item.skuOuterId ?? outerId),
        sysSkuId,
        title: typeof item.propertiesName === 'string' ? item.propertiesName : undefined,
      },
    ];
  }

  if (!outerId && !title) {
    return null;
  }

  return {
    outerId,
    title,
    sysItemId,
    type: typeof item.type === 'string' ? item.type : undefined,
    skus: skus && skus.length > 0 ? skus : undefined,
  };
}

/** @internal 仅供单测 */
export function normalizeListItemForTest(item: Record<string, unknown>): ErpCatalogItem | null {
  return normalizeListItem(item);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/erp-catalog-lookup.test.ts -t "normalizeListItem"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/sku-import/erp-catalog.ts tests/erp-catalog-lookup.test.ts
git commit -m "fix(erp-catalog): normalize nested sku arrays from querySingle"
```

---

### Task 2: getItemsByOuterIds 增加 querySingle fallback

**Files:**
- Modify: `src/tools/sku-import/erp-catalog.ts`
- Test: `tests/erp-catalog-lookup.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/erp-catalog-lookup.test.ts` 追加：

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryListV2 = vi.fn();
const querySingle = vi.fn();

vi.mock('../src/core/erp-web-client', () => ({
  createErpWebClient: () => ({
    queryListV2,
    querySingle,
    getItemDetail: vi.fn(),
    addItem: vi.fn(),
    addPureSuite: vi.fn(),
    saveItem: vi.fn(),
    listBaseUnits: vi.fn(),
    listSysCategories: vi.fn(),
  }),
  ErpWebError: class ErpWebError extends Error {},
}));

import { createErpCatalogClient } from '../src/tools/sku-import/erp-catalog';
import { findCatalogItemByOuterId } from '../src/tools/sku-import/erp-catalog';

const config = {
  baseUrl: 'https://erp.superboss.cc',
  cookie: 'x=1',
  companyId: '140109',
};

describe('getItemsByOuterIds fallback', () => {
  beforeEach(() => {
    queryListV2.mockReset();
    querySingle.mockReset();
  });

  it('queryListV2 无结果时应 fallback querySingle(content=outerId)', async () => {
    queryListV2.mockResolvedValue({ list: [] });
    querySingle.mockResolvedValue({
      list: [
        {
          outerId: 'YP-ZBQXJ01',
          title: '珠宝清洗剂',
          sysItemId: 1,
          skus: [{ outerId: 'YP-ZBQXJ01-03', sysSkuId: 2 }],
        },
      ],
    });

    const catalog = createErpCatalogClient(config);
    const items = await catalog.getItemsByOuterIds(['YP-ZBQXJ01-03']);

    expect(querySingle).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'YP-ZBQXJ01-03',
        content: 'outerId',
        api_name: 'item_querySingle',
      }),
    );
    expect(findCatalogItemByOuterId(items, 'YP-ZBQXJ01-03')?.outerId).toBe('YP-ZBQXJ01');
  });

  it('queryListV2 已命中时不应调用 querySingle', async () => {
    queryListV2.mockResolvedValue({
      list: [
        {
          outerId: 'PJ-ZND01',
          title: '自粘袋',
          sysItemId: 10,
        },
      ],
    });

    const catalog = createErpCatalogClient(config);
    await catalog.getItemsByOuterIds(['PJ-ZND01']);

    expect(querySingle).not.toHaveBeenCalled();
  });

  it('两者均无结果时返回空数组', async () => {
    queryListV2.mockResolvedValue({ list: [] });
    querySingle.mockResolvedValue({ list: [] });

    const catalog = createErpCatalogClient(config);
    const items = await catalog.getItemsByOuterIds(['YP-MISSING']);

    expect(items).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/erp-catalog-lookup.test.ts -t "getItemsByOuterIds"`
Expected: FAIL — `querySingle` 未被调用或仍返回空

- [ ] **Step 3: 实现 querySingleByOuterId 与 fallback**

在 `createErpCatalogClient` 内、`querySingleByTitle` 下方新增：

```typescript
async function querySingleByOuterId(text: string): Promise<ErpCatalogItem[]> {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const response = await client.querySingle({
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

  return extractQuerySingleList(response)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => normalizeListItem(item))
    .filter((item): item is ErpCatalogItem => item !== null);
}
```

将 `getItemsByOuterIds` 中 `mapWithConcurrency` 回调改为：

```typescript
const lookupResults = await mapWithConcurrency(unique, OUTER_ID_LOOKUP_CONCURRENCY, async (outerId) => {
  const responses = await Promise.all(
    (['outerId', 'skuOuterId'] as const).map((field) =>
      queryCatalogPage(1, 5, { [field]: outerId }),
    ),
  );
  const listHits = responses.flatMap((response) => normalizeListItems(response));

  if (findCatalogItemByOuterId(listHits, outerId)) {
    return listHits;
  }

  const singleHits = await querySingleByOuterId(outerId);
  return [...listHits, ...singleHits];
});
```

- [ ] **Step 4: 运行全部 ERP catalog 测试**

Run: `pnpm exec vitest run tests/erp-catalog-lookup.test.ts tests/erp-catalog-find-item.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/sku-import/erp-catalog.ts tests/erp-catalog-lookup.test.ts
git commit -m "fix(erp-catalog): fallback to querySingle for outerId lookup"
```

---

### Task 3: 工作台三页会话内保活

**Files:**
- Modify: `src/renderer/components/layout/app-layout.tsx`
- Modify: `src/renderer/routes/index.tsx`

- [ ] **Step 1: 改 routes 不再通过 Outlet 挂载页面**

`src/renderer/routes/index.tsx` 改为：

```tsx
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { APP_ROUTES, resolveLegacyRedirect } from '@shared/constants/navigation';

function LegacyRedirect() {
  const { pathname } = useLocation();
  const target = resolveLegacyRedirect(pathname);
  return <Navigate to={target ?? APP_ROUTES.WORKBENCH} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={APP_ROUTES.WORKBENCH} replace />} />
      <Route element={<AppLayout />}>
        <Route path={APP_ROUTES.WORKBENCH} element={null} />
        <Route path={APP_ROUTES.HISTORY} element={null} />
        <Route path={APP_ROUTES.CONFIG} element={null} />
      </Route>
      <Route path="/tasks" element={<LegacyRedirect />} />
      <Route path="/settings" element={<LegacyRedirect />} />
      <Route path="/tools/sku-import" element={<LegacyRedirect />} />
      <Route path="*" element={<Navigate to={APP_ROUTES.WORKBENCH} replace />} />
    </Routes>
  );
}
```

（删除 `WorkbenchPage` / `HistoryPage` / `ConfigPage` 的 route import。）

- [ ] **Step 2: 改 AppLayout 常驻渲染三页**

`src/renderer/components/layout/app-layout.tsx` 改为：

```tsx
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

import { ConfigPage } from '@/pages/config';
import { HistoryPage } from '@/pages/history';
import { WorkbenchPage } from '@/pages/workbench';
import { DURATIONS } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { APP_ROUTES } from '@shared/constants/navigation';

import { Header } from './header';
import { Sidebar } from './sidebar';

function resolveActivePage(pathname: string): 'workbench' | 'history' | 'config' {
  if (pathname === APP_ROUTES.HISTORY) return 'history';
  if (pathname === APP_ROUTES.CONFIG) return 'config';
  return 'workbench';
}

export function AppLayout() {
  const { pathname } = useLocation();
  const active = resolveActivePage(pathname);

  return (
    <div className="flex h-screen flex-col bg-cream">
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto bg-cream p-6 scrollbar-thin">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATIONS.pageEnter }}
            className="mx-auto w-full min-w-0 max-w-6xl"
          >
            <div className={cn(active !== 'workbench' && 'hidden')}>
              <WorkbenchPage />
            </div>
            <div className={cn(active !== 'history' && 'hidden')}>
              <HistoryPage />
            </div>
            <div className={cn(active !== 'config' && 'hidden')}>
              <ConfigPage />
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 类型检查**

Run: `pnpm run typecheck`
Expected: PASS，无未使用 import

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/layout/app-layout.tsx src/renderer/routes/index.tsx
git commit -m "feat(ui): keep workbench state alive during sidebar navigation"
```

---

### Task 4: 品牌配置移除名称简写

**Files:**
- Modify: `src/renderer/pages/config.tsx`
- Modify: `resources/defaults/sku-import-config.json`（可选）

- [ ] **Step 1: 更新 TAB 描述与表格列**

在 `config.tsx`：

1. `TAB_META.brands.description` 改为 `'品牌名称与编码'`
2. 品牌表头删除「名称简写」列；`table` 列宽调整为四列（名称 34%、编码 26%、状态 18%、操作 22%）
3. 删除 `<td>{brand.shortName || '—'}</td>` 行

- [ ] **Step 2: 删除品牌弹窗中的名称简写输入**

删除 `brandDraft` Modal 内整个「名称简写」`<label>` 块（约 849–861 行）。

`EMPTY_BRAND` 保持 `{ name: '', code: '', shortName: '', enabled: true }` 不变（schema 兼容）。

- [ ] **Step 3: 类型检查**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/config.tsx
git commit -m "refactor(config): remove unused brand shortName from UI"
```

---

### Task 5: 配件管理批量删除

**Files:**
- Modify: `src/renderer/pages/config.tsx`

- [ ] **Step 1: 增加选中状态与批量删除逻辑**

在 `ConfigPage` 组件 state 区追加：

```typescript
const [selectedAccessoryIndexes, setSelectedAccessoryIndexes] = useState<Set<number>>(new Set());
const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
```

追加 handler：

```typescript
const toggleAccessorySelection = (index: number) => {
  setSelectedAccessoryIndexes((prev) => {
    const next = new Set(prev);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    return next;
  });
};

const visibleAccessoryIndexes = useMemo(
  () => filteredAccessories.map(({ index }) => index),
  [filteredAccessories],
);

const allVisibleSelected =
  visibleAccessoryIndexes.length > 0 &&
  visibleAccessoryIndexes.every((index) => selectedAccessoryIndexes.has(index));

const toggleSelectAllVisibleAccessories = () => {
  setSelectedAccessoryIndexes((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) {
      for (const index of visibleAccessoryIndexes) {
        next.delete(index);
      }
    } else {
      for (const index of visibleAccessoryIndexes) {
        next.add(index);
      }
    }
    return next;
  });
};

const confirmBatchDeleteAccessories = async () => {
  if (selectedAccessoryIndexes.size === 0) {
    return;
  }
  const next = accessories.filter((_, index) => !selectedAccessoryIndexes.has(index));
  try {
    await saveAccessories(next);
    setAccessories(next);
    setAccessoriesDirty(false);
    setSelectedAccessoryIndexes(new Set());
    setBatchDeleteOpen(false);
    setSaveSuccess(true);
  } catch (err) {
    toast(err instanceof Error ? err.message : '保存失败');
  }
};
```

- [ ] **Step 2: 更新配件表格 UI**

1. 表头新增 checkbox 列（`w-[4%]`），`checked={allVisibleSelected}`，`onChange={toggleSelectAllVisibleAccessories}`
2. 每行新增 checkbox，`checked={selectedAccessoryIndexes.has(index)}`，`onChange={() => toggleAccessorySelection(index)}`
3. 工具栏「新增配件」前插入按钮：

```tsx
<Button
  type="button"
  variant="outline"
  className="px-3 py-2 text-status-danger hover:border-status-danger/30 hover:bg-status-danger/5 hover:text-status-danger"
  disabled={selectedAccessoryIndexes.size === 0}
  onClick={() => setBatchDeleteOpen(true)}
>
  <Trash2 className="h-4 w-4" />
  批量删除{selectedAccessoryIndexes.size > 0 ? `（${selectedAccessoryIndexes.size}）` : ''}
</Button>
```

4. 页面底部（与其他 Modal 并列）追加确认弹窗：

```tsx
<Modal
  open={batchDeleteOpen}
  title="批量删除配件"
  onClose={() => setBatchDeleteOpen(false)}
>
  <div className="space-y-4">
    <p className="text-sm text-charcoal">
      确定删除已选的 {selectedAccessoryIndexes.size} 条配件？此操作不可撤销。
    </p>
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={() => setBatchDeleteOpen(false)}>
        取消
      </Button>
      <Button
        className="bg-status-danger text-cream-white hover:bg-status-danger/90"
        onClick={() => void confirmBatchDeleteAccessories()}
        disabled={catalogSaving}
      >
        {catalogSaving ? '删除中…' : '确定删除'}
      </Button>
    </div>
  </div>
</Modal>
```

- [ ] **Step 3: 类型检查**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/config.tsx
git commit -m "feat(config): add batch delete for accessories with confirmation"
```

---

### Task 6: Windows 多尺寸 ICO 与 NSIS 配置

**Files:**
- Modify: `scripts/generate-app-icons.mjs`
- Modify: `package.json`
- Regenerate: `resources/icon.ico`

- [ ] **Step 1: 更新图标生成脚本**

`scripts/generate-app-icons.mjs` 在写入 `icon.png` 后改为：

```javascript
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoBuffers = await Promise.all(
  icoSizes.map((size) => sharp(svgPath).resize(size, size).png().toBuffer()),
);
const icoBuffer = await pngToIco(icoBuffers);
fs.writeFileSync(icoPath, icoBuffer);
```

删除原先单行 `const icoBuffer = await pngToIco(pngBuffer);`。

- [ ] **Step 2: 重新生成图标**

Run: `pnpm run icons:generate`
Expected: 控制台输出已生成 `resources/icon.ico`

- [ ] **Step 3: 更新 package.json nsis 段**

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

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-app-icons.mjs package.json resources/icon.ico resources/icon.png resources/icon.icns
git commit -m "fix(build): use multi-size ICO and explicit NSIS shortcut icons"
```

---

### Task 7: 全量验证

**Files:** （无新文件）

- [ ] **Step 1: 运行 typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 2: 运行测试**

Run: `pnpm run test`
Expected: 全部 PASS

- [ ] **Step 3: 手动验收清单**

| 项 | 操作 | 预期 |
|----|------|------|
| 产品编码 | 导入含 `YP-ZBQXJ01-03` 类子 SKU 的 Excel 并预演 | 不再报「产品原品在 ERP 中不存在」 |
| 工作台保活 | 预演后切配置再切回 | 步骤与预览数据保留 |
| 配件批量删除 | 多选 → 确认 → 删除 | 列表更新；取消不删除 |
| 品牌 UI | 打开品牌 Tab | 无「名称简写」列 |
| Windows 图标 | Windows 上 `pnpm run make:win` 安装 | exe / 桌面 / 开始菜单均为 logo |

---

## Spec Coverage Checklist

| Spec § | Task |
|--------|------|
| §3 配件批量删除 | Task 5 |
| §4 Windows 图标 | Task 6 |
| §5 工作台保活 | Task 3 |
| §6 品牌简写移除 | Task 4 |
| §7 产品编码修复 | Task 1 + Task 2 |
| §8 错误处理 | 各 Task 内 toast / disabled / fallback |
| §9 测试清单 | Task 7 |

## Placeholder Scan

无 TBD / TODO /「类似上文」省略步骤；每步含具体文件路径与代码片段。
