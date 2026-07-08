# 默认品牌配置更新设计

**日期：** 2026-07-08  
**状态：** 待评审  
**范围：** 将 16 个品牌写入建货号工具系统默认配置

---

## 1. 已确认决策

| # | 议题 | 决策 |
|---|------|------|
| 1 | 与现有默认品牌的关系 | **完全替换**：移除 `lovi`、`nimi`，仅保留新 16 品牌 |
| 2 | 品牌名称存储格式 | **保留原始大小写**（如 `KJM`、`farienne`、`LOORSAN`） |
| 3 | 品牌编码格式 | **保留前导零**（如 `"04"`、`"05"`、`"10"`） |
| 4 | 已有用户配置 | **不迁移**：仅更新默认源，不动 `userData` 中已保存配置 |
| 5 | 实现方案 | **方案 A**：双文件同步更新（JSON + schema 常量） |

---

## 2. 目标与非目标

### 目标

- 新安装或首次启动时，用户获得完整的 16 品牌默认配置。
- 开发/测试环境中的 `DEFAULT_SKU_IMPORT_CONFIG` 常量与 JSON 默认文件保持一致。

### 非目标

- 不对已有用户的 `config/sku-import/config.json` 执行迁移或强制重置。
- 不修改配件（`accessories`）与规则（`rules`）默认配置。
- 不引入 JSON 单源构建或运行时读取机制。
- 不从 schema 删除 `shortName` 字段（沿用现有兼容策略）。

---

## 3. 默认品牌列表

共 16 条，全部 `enabled: true`，`shortName: ""`：

| name | code |
|------|------|
| KJM | 04 |
| TIGERRUN | 05 |
| farienne | 10 |
| LOORSAN | 13 |
| WATE | 15 |
| vvland | 26 |
| ifubo | 35 |
| BINOO | 36 |
| jokjok | 37 |
| WKAU | 39 |
| FAELUTE | 42 |
| shanrrow | 43 |
| kineshinex | 44 |
| AGDP | 45 |
| Svayshiin | 46 |
| SARKALMAN | 47 |

替换前的默认品牌（将被移除）：

| name | code |
|------|------|
| wkau | 39 |
| lovi | 42 |
| nimi | 51 |

注：`WKAU(39)` 保留在新列表中，名称大小写从 `wkau` 更新为 `WKAU`。

---

## 4. 改动文件

| 文件 | 改动 |
|------|------|
| `resources/defaults/sku-import-config.json` | 替换 `brands` 数组为 16 条 |
| `src/shared/schemas/sku-import-config.ts` | 同步 `DEFAULT_SKU_IMPORT_CONFIG.brands` |
| `tests/sku-import-config-storage.test.ts` | 确认迁移补全测试仍有效（`wkau` → `WKAU` 大小写不敏感） |
| `tests/catalog-config.test.ts` | 更新依赖旧品牌名 `lovi` 的测试用例 |

`accessories` 与 `rules` 段保持不变。

---

## 5. 行为说明

### 5.1 新安装 / 首次启动

`loadSkuImportConfigFile` 在配置文件不存在时，将完整默认配置（含 16 品牌）写入 `userData/config/sku-import/config.json`。

### 5.2 已有用户配置

读取已保存配置时直接返回，不触发默认补全或覆盖。已有 `lovi`、`nimi` 的用户配置不受影响。

### 5.3 旧配置迁移补全

`bootstrapSkuImportConfigFromLegacy` 仍通过 `mergeDefaultsByKey` 按名称（大小写不敏感）追加缺失的默认品牌。不会删除用户已有的 `lovi`/`nimi`，也不会更新已有品牌的 `code`。

### 5.4 品牌匹配与货号生成

- 匹配：`findBrandInConfig` 大小写不敏感（`WKAU` ↔ `wkau`）。
- 货号生成：`buildBundleOuterId` 使用 `brand.code` 原样（保留前导零），如 `69-04-XX-...`。

---

## 6. 测试计划

1. `pnpm run test` — 全部通过。
2. 重点确认：
   - `sku-import-config-schema` 解析新默认配置
   - `sku-import-config-storage` 读写与 bootstrap 行为
   - `catalog-config` 品牌匹配（大小写不敏感）
3. 无需新增专项测试（数据替换，现有覆盖足够）。

---

## 7. 验收标准

- [ ] `resources/defaults/sku-import-config.json` 含 16 条品牌，编码带前导零
- [ ] `DEFAULT_SKU_IMPORT_CONFIG.brands` 与 JSON 文件内容一致
- [ ] `pnpm run test` 通过
- [ ] `pnpm run typecheck` 通过
