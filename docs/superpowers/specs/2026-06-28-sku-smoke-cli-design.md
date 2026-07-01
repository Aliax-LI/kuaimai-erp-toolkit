# SKU 冒烟 CLI 设计规格

**日期：** 2026-06-28  
**状态：** 已批准  
**目标：** 跳过 Excel/UI，用固定 fixture 跑通 ERP 建货号全链路并做结构验证。

---

## 背景

主流程（Excel 导入 → 预演 → 任务 → 执行 → 写回）问题较多，需先隔离验证 ERP 核心能力：

- 配件匹配
- OSS 图片上传
- 贴纸创建（`type=0`）
- 套装创建（`type=2`，`suiteBridgeList`）
- 创建后查询确认

## 已冻结决策

| 项 | 选择 |
|---|---|
| 交付形态 | 独立 CLI：`scripts/run-sku-smoke.mjs` |
| 凭证 | `scripts/.env`：`ERP_COOKIE`、`ERP_COMPANY_ID` |
| 测试数据 | `tests/上品测试/上品记录.txt` + 同目录 PNG |
| 图片 | 必传；默认同目录第一个 `.png` |
| 运行模式 | 默认创建+验证；`--verify-only` 仅复查 |
| 成功标准 | D2：货号存在 + 套装 `suiteBridgeList` 含贴纸 + 全部配件 |

## 架构

```
scripts/run-sku-smoke.mjs
  → parse-import-txt.ts       # 解析 TSV
  → resolve-fixture-image.ts  # 定位 PNG
  → load-erp-config-from-env.ts
  → preview.ts                # 配件匹配、拟建货号（复用）
  → executor.ts               # 创建贴纸+套装（复用，含幂等）
  → verify-created-items.ts   # D2 结构验证（新增）
```

不经过 Electron IPC、不写回 Excel、不创建内存任务。

## 输入

**`tests/上品测试/上品记录.txt`**

- 第 1 行 Tab 分隔表头，第 2 行数据
- 忽略 `产品白底图-1` 列中的 `=DISPIMG(...)` 公式
- `商品SKU货号` 优先作为套装 `outerId`（当前：`test-69-WKAU-BYMPGXJ0001`）
- 贴纸货号规则：`{套装货号}-ST`

**图片**

- 默认：`tests/上品测试/` 下第一个 `.png`（当前 `e0223ff8-5956-4f45-9c09-784b0f617605.png`）
- 覆盖：`--image <path>`

## CLI 接口

```bash
pnpm run smoke:sku                                    # 创建 + 验证
pnpm run smoke:sku -- --verify-only                   # 仅验证
pnpm run smoke:sku -- --fixture tests/上品测试        # 指定 fixture 目录
pnpm run smoke:sku -- --image path/to.png             # 指定图片
```

## 环境变量（`scripts/.env`）

```env
ERP_COOKIE=...
ERP_COMPANY_ID=140109
ERP_BASE_URL=https://erp.superboss.cc   # 可选
```

## 执行流程（默认模式）

1. 加载 `.env`，校验 `ERP_COOKIE` + `ERP_COMPANY_ID`
2. 解析 `上品记录.txt` → 单行 `values`
3. 读取 PNG → 嵌入 `ParsedSkuImportWorkbookRow.images`
4. `buildSkuImportPreview`：ERP 全量目录、配件匹配、货号分配
5. `executeSkuImportRows`：上传 OSS → 建贴纸（已存在则复用）→ 建套装（已存在则跳过）
6. `verifyCreatedItems`：D2 结构验证
7. 终端逐步输出 ✓/✗，非零退出码表示失败

## D2 验证规则

| 检查项 | 接口 | 通过条件 |
|---|---|---|
| 贴纸存在 | `queryListV2(outerId={sku}-ST)` | 1 条，`type=0` |
| 套装存在 | `queryListV2(outerId={sku})` | 1 条，`type=2` |
| 配件存在 | `queryListV2(outerId=配件码)` | 每条 1 条 |
| 套装结构 | `getItemDetail(sysItemId)` | `suiteBridgeList` 含贴纸 `sysSkuId` + 各配件 `sysSkuId`，共 1+配件数 项 |

失败时打印：缺失项、实际 bridge 内容、ERP 错误信息。

## 幂等与错误处理

| 场景 | 行为 |
|---|---|
| 贴纸已存在 | 复用 `executor` 逻辑，`getItemsByOuterIds` 取 ID |
| 套装已存在 | 跳过 `saveItem`，验证仍执行 |
| Cookie 失效 (`result=901`) | 提示更新 `.env` |
| 配件未匹配 | 创建前失败，列出缺失名 |
| 同目录无 PNG 且无 `--image` | 明确报错退出 |

## 刻意不做（YAGNI）

- 不写回 Excel
- 不走 IPC / 渲染进程
- 不支持多行批量（fixture 当前仅 1 条）
- 不纳入 CI 真实 ERP 调用

## 测试策略

| 层级 | 内容 |
|---|---|
| 单元测试 | `parse-import-txt`、`verify-created-items`（mock ERP 响应） |
| 手动冒烟 | `pnpm run smoke:sku`（需有效 `.env`） |

## 与主流程关系

冒烟通过后，确认 `preview` / `executor` / `erp-catalog` 在真实环境可用；主应用 Excel/任务/UI 问题可并行修复。可选将 D2 验证接入执行完成后的 UI 反馈。
