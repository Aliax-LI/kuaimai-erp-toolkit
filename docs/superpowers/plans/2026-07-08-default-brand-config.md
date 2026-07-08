# 默认品牌配置更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将建货号工具的默认品牌列表替换为用户提供的 16 个品牌（保留原始大小写与前导零编码），同步 JSON 默认文件与 schema 常量。

**Architecture:** 沿用现有双文件同步模式：更新 `DEFAULT_SKU_IMPORT_CONFIG.brands` 常量与 `resources/defaults/sku-import-config.json` 的 `brands` 段；配件与规则不变；不迁移已有用户配置。

**Tech Stack:** TypeScript 5、Zod、Vitest、pnpm

**Spec:** `docs/superpowers/specs/2026-07-08-default-brand-config-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/shared/schemas/sku-import-config.ts` | `DEFAULT_SKU_IMPORT_CONFIG.brands` 常量（16 条） |
| `resources/defaults/sku-import-config.json` | 打包默认 JSON，与常量保持一致 |
| `tests/sku-import-config-schema.test.ts` | 断言默认品牌数量与编码格式 |
| `tests/sku-import-config-storage.test.ts` | 修正 bootstrap 测试中的品牌名断言 |

---

## Shared Brand Data

以下数组在两处完全一致使用（`shortName` 统一为空字符串）：

```typescript
const DEFAULT_BRANDS = [
  { name: 'KJM', code: '04', shortName: '', enabled: true },
  { name: 'TIGERRUN', code: '05', shortName: '', enabled: true },
  { name: 'farienne', code: '10', shortName: '', enabled: true },
  { name: 'LOORSAN', code: '13', shortName: '', enabled: true },
  { name: 'WATE', code: '15', shortName: '', enabled: true },
  { name: 'vvland', code: '26', shortName: '', enabled: true },
  { name: 'ifubo', code: '35', shortName: '', enabled: true },
  { name: 'BINOO', code: '36', shortName: '', enabled: true },
  { name: 'jokjok', code: '37', shortName: '', enabled: true },
  { name: 'WKAU', code: '39', shortName: '', enabled: true },
  { name: 'FAELUTE', code: '42', shortName: '', enabled: true },
  { name: 'shanrrow', code: '43', shortName: '', enabled: true },
  { name: 'kineshinex', code: '44', shortName: '', enabled: true },
  { name: 'AGDP', code: '45', shortName: '', enabled: true },
  { name: 'Svayshiin', code: '46', shortName: '', enabled: true },
  { name: 'SARKALMAN', code: '47', shortName: '', enabled: true },
] as const;
```

---

### Task 1: 更新 schema 默认品牌常量

**Files:**
- Modify: `src/shared/schemas/sku-import-config.ts:67-72`
- Test: `tests/sku-import-config-schema.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/sku-import-config-schema.test.ts` 的 `describe('skuImportConfigSchema')` 内追加：

```typescript
  it('default config has 16 brands with leading-zero codes', () => {
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands).toHaveLength(16);
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands[0]).toEqual({
      name: 'KJM',
      code: '04',
      shortName: '',
      enabled: true,
    });
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands.find((b) => b.name === 'WKAU')?.code).toBe('39');
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands.find((b) => b.name === 'FAELUTE')?.code).toBe('42');
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands.some((b) => b.name === 'lovi')).toBe(false);
    expect(DEFAULT_SKU_IMPORT_CONFIG.brands.some((b) => b.name === 'nimi')).toBe(false);
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/sku-import-config-schema.test.ts -t "default config has 16 brands"`

Expected: FAIL — `toHaveLength(16)` 收到 `3`

- [ ] **Step 3: 更新 DEFAULT_SKU_IMPORT_CONFIG.brands**

将 `src/shared/schemas/sku-import-config.ts` 中 `DEFAULT_SKU_IMPORT_CONFIG` 的 `brands` 数组替换为：

```typescript
export const DEFAULT_SKU_IMPORT_CONFIG: SkuImportConfig = {
  brands: [
    { name: 'KJM', code: '04', shortName: '', enabled: true },
    { name: 'TIGERRUN', code: '05', shortName: '', enabled: true },
    { name: 'farienne', code: '10', shortName: '', enabled: true },
    { name: 'LOORSAN', code: '13', shortName: '', enabled: true },
    { name: 'WATE', code: '15', shortName: '', enabled: true },
    { name: 'vvland', code: '26', shortName: '', enabled: true },
    { name: 'ifubo', code: '35', shortName: '', enabled: true },
    { name: 'BINOO', code: '36', shortName: '', enabled: true },
    { name: 'jokjok', code: '37', shortName: '', enabled: true },
    { name: 'WKAU', code: '39', shortName: '', enabled: true },
    { name: 'FAELUTE', code: '42', shortName: '', enabled: true },
    { name: 'shanrrow', code: '43', shortName: '', enabled: true },
    { name: 'kineshinex', code: '44', shortName: '', enabled: true },
    { name: 'AGDP', code: '45', shortName: '', enabled: true },
    { name: 'Svayshiin', code: '46', shortName: '', enabled: true },
    { name: 'SARKALMAN', code: '47', shortName: '', enabled: true },
  ],
  accessories: [
    { name: '面膜刷', skuCode: 'PJ-MMS01', brand: '', enabled: true },
    { name: '自粘袋', skuCode: 'PJ-ZND01', brand: '', enabled: true },
    { name: '说明书', skuCode: 'PJ-SHMS01', brand: '', enabled: true },
  ],
  rules: { ...DEFAULT_SKU_IMPORT_RULES },
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/sku-import-config-schema.test.ts`

Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add src/shared/schemas/sku-import-config.ts tests/sku-import-config-schema.test.ts
git commit -m "feat(config): replace default brands with 16-brand catalog"
```

---

### Task 2: 同步 JSON 默认文件

**Files:**
- Modify: `resources/defaults/sku-import-config.json:2-6`

- [ ] **Step 1: 替换 brands 数组**

将 `resources/defaults/sku-import-config.json` 的 `brands` 段替换为：

```json
  "brands": [
    { "name": "KJM", "code": "04", "shortName": "", "enabled": true },
    { "name": "TIGERRUN", "code": "05", "shortName": "", "enabled": true },
    { "name": "farienne", "code": "10", "shortName": "", "enabled": true },
    { "name": "LOORSAN", "code": "13", "shortName": "", "enabled": true },
    { "name": "WATE", "code": "15", "shortName": "", "enabled": true },
    { "name": "vvland", "code": "26", "shortName": "", "enabled": true },
    { "name": "ifubo", "code": "35", "shortName": "", "enabled": true },
    { "name": "BINOO", "code": "36", "shortName": "", "enabled": true },
    { "name": "jokjok", "code": "37", "shortName": "", "enabled": true },
    { "name": "WKAU", "code": "39", "shortName": "", "enabled": true },
    { "name": "FAELUTE", "code": "42", "shortName": "", "enabled": true },
    { "name": "shanrrow", "code": "43", "shortName": "", "enabled": true },
    { "name": "kineshinex", "code": "44", "shortName": "", "enabled": true },
    { "name": "AGDP", "code": "45", "shortName": "", "enabled": true },
    { "name": "Svayshiin", "code": "46", "shortName": "", "enabled": true },
    { "name": "SARKALMAN", "code": "47", "shortName": "", "enabled": true }
  ],
```

`accessories` 与 `rules` 段保持不变。

- [ ] **Step 2: 提交**

```bash
git add resources/defaults/sku-import-config.json
git commit -m "chore(defaults): sync sku-import default brands JSON"
```

---

### Task 3: 修正 storage bootstrap 测试断言

**Files:**
- Modify: `tests/sku-import-config-storage.test.ts:60`
- Test: `tests/sku-import-config-storage.test.ts`

- [ ] **Step 1: 写失败测试（修改现有断言）**

将 `tests/sku-import-config-storage.test.ts` 第 60 行：

```typescript
    expect(bootstrapped.brands.some((brand) => brand.name === 'wkau')).toBe(true);
```

改为：

```typescript
    expect(bootstrapped.brands.some((brand) => brand.name === 'WKAU')).toBe(true);
```

- [ ] **Step 2: 运行测试确认通过**

Run: `pnpm exec vitest run tests/sku-import-config-storage.test.ts`

Expected: 全部 PASS

- [ ] **Step 3: 提交**

```bash
git add tests/sku-import-config-storage.test.ts
git commit -m "test(config): update bootstrap brand name assertion to WKAU"
```

---

### Task 4: 全量验证

**Files:**（只读检查，无改动）

- [ ] **Step 1: 运行全量测试**

Run: `pnpm run test`

Expected: 全部 PASS

- [ ] **Step 2: 运行类型检查**

Run: `pnpm run typecheck`

Expected: 无错误

- [ ] **Step 3: 确认 catalog-config 测试仍通过**

Run: `pnpm exec vitest run tests/catalog-config.test.ts`

Expected: PASS（`findBrandInConfig('WKAU')` 与 `findBrandInConfig('wkau')` 均应返回 `code: '39'`）

---

## Spec Coverage Checklist

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 16 品牌完全替换旧 3 品牌 | Task 1 |
| 保留原始大小写 | Task 1、Task 2 |
| 编码保留前导零 | Task 1 测试断言 `code: '04'` |
| JSON 与常量同步 | Task 1 + Task 2 |
| 不迁移已有用户配置 | 无代码改动（设计决策） |
| accessories / rules 不变 | Task 1、Task 2 仅改 brands |
| `pnpm run test` 通过 | Task 4 |
| `pnpm run typecheck` 通过 | Task 4 |
