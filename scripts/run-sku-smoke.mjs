#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const scriptsEnv = path.join(scriptDir, '.env');

if (fs.existsSync(scriptsEnv)) {
  const { config } = await import('dotenv');
  config({ path: scriptsEnv });
}
await import('dotenv/config');

import { loadConfigFromEnv } from '../src/core/erp-oss-uploader.ts';
import { createErpWebClient } from '../src/core/erp-web-client.ts';
import { SKU_IMPORT_SHEET_NAME } from '../src/shared/types/sku-import.ts';
import { DEFAULT_SKU_IMPORT_CONFIG } from '../src/shared/schemas/sku-import-config.ts';
import { createErpCatalogClient } from '../src/tools/sku-import/erp-catalog.ts';
import { executeSkuImportRows } from '../src/tools/sku-import/executor.ts';
import { loadErpWebConfigFromEnv } from '../src/tools/sku-import/load-erp-config-from-env.ts';
import { parseImportTxt } from '../src/tools/sku-import/parse-import-txt.ts';
import { buildSkuImportPreview } from '../src/tools/sku-import/preview.ts';
import { resolveFixtureImage } from '../src/tools/sku-import/resolve-fixture-image.ts';
import { verifyCreatedSkuImportRow } from '../src/tools/sku-import/verify-created-items.ts';

function parseArgs(argv) {
  let fixtureDir = path.join(rootDir, 'tests/上品测试');
  let imagePath;
  let verifyOnly = false;
  let skuCodeOverride;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--verify-only') {
      verifyOnly = true;
    } else if (arg === '--fixture') {
      fixtureDir = path.resolve(rootDir, argv[++i] ?? '');
    } else if (arg === '--image') {
      imagePath = argv[++i];
    } else if (arg === '--sku-code') {
      skuCodeOverride = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return { fixtureDir, imagePath, verifyOnly, skuCodeOverride };
}

function printHelp() {
  console.log(`用法: pnpm run smoke:sku -- [选项]

选项:
  --fixture <dir>   fixture 目录（默认 tests/上品测试）
  --image <path>    白底图路径（默认 fixture 下第一个 .png）
  --sku-code <id>   覆盖 txt 中的商品SKU货号（用于规避 ERP 残留编码）
  --verify-only     仅查询验证，不调用 saveItem
  -h, --help        显示帮助

环境变量（scripts/.env 或根目录 .env）:
  ERP_COOKIE        必填
  ERP_COMPANY_ID    必填
  ERP_BASE_URL      可选
`);
}

function logStep(index, total, label, ok, detail) {
  const mark = ok ? '✓' : '✗';
  console.log(`[${index}/${total}] ${label} ${mark} ${detail}`);
}

async function main() {
  const { fixtureDir, imagePath, verifyOnly, skuCodeOverride } = parseArgs(process.argv.slice(2));
  const txtPath = path.join(fixtureDir, '上品记录.txt');

  if (!fs.existsSync(txtPath)) {
    throw new Error(`未找到上品记录.txt: ${txtPath}`);
  }

  console.log('快麦建货号冒烟测试\n');
  console.log(`fixture: ${fixtureDir}`);
  console.log(`模式: ${verifyOnly ? '仅验证' : '创建 + 验证'}\n`);

  const parsedTxt = parseImportTxt(fs.readFileSync(txtPath, 'utf8'));
  if (parsedTxt.rows.length === 0) {
    throw new Error('上品记录.txt 无数据行');
  }
  if (parsedTxt.rows.length > 1) {
    console.log(`提示: 当前仅处理第一条（共 ${parsedTxt.rows.length} 条）`);
  }

  const dataRow = parsedTxt.rows[0];
  if (skuCodeOverride?.trim()) {
    dataRow.values['商品SKU货号'] = skuCodeOverride.trim();
  }
  const { filePath: resolvedImagePath, image } = resolveFixtureImage(fixtureDir, imagePath);

  const xlsxPath = path.join(fixtureDir, '上品记录.xlsx');
  const workbookBuffer = fs.existsSync(xlsxPath) ? fs.readFileSync(xlsxPath) : Buffer.alloc(0);

  const parsedWorkbook = {
    sheetName: SKU_IMPORT_SHEET_NAME,
    headers: parsedTxt.headers,
    rows: [
      {
        rowNumber: dataRow.rowNumber,
        values: dataRow.values,
        images: [image],
      },
    ],
    workbookBuffer,
  };

  const erpConfig = loadErpWebConfigFromEnv();
  const catalog = createErpCatalogClient(erpConfig);
  const client = createErpWebClient(erpConfig);

  logStep(1, 6, '解析 fixture', true, `品牌=${dataRow.values['品牌']} 货号=${dataRow.values['商品SKU货号']}`);
  logStep(2, 6, '白底图', true, resolvedImagePath);

  const preview = await buildSkuImportPreview(
    'smoke',
    txtPath,
    parsedWorkbook,
    catalog,
    DEFAULT_SKU_IMPORT_CONFIG,
  );
  const previewRow = preview.rows.find((row) => row.rowNumber === dataRow.rowNumber);
  if (!previewRow) {
    throw new Error('预演未生成对应行');
  }

  const accessoryDetail =
    previewRow.matchedAccessoryCodes.length > 0
      ? previewRow.matchedAccessoryCodes.join('、')
      : '(无)';
  const previewOk = previewRow.status === 'pending' || previewRow.status === 'skipped_existing';
  logStep(
    3,
    6,
    '配件匹配',
    previewOk && previewRow.missingAccessoryNames.length === 0,
    `${accessoryDetail}${previewRow.blockedReason ? `；${previewRow.blockedReason}` : ''}`,
  );

  if (previewRow.status === 'preview_blocked') {
    throw new Error(`预演阻断: ${previewRow.blockedReason ?? '未知原因'}`);
  }

  if (!verifyOnly) {
    if (previewRow.status !== 'pending' && previewRow.status !== 'skipped_existing') {
      throw new Error(`无法执行: status=${previewRow.status}`);
    }

    const ossConfig = loadConfigFromEnv();
    const { executeResult } = await executeSkuImportRows({
      sessionId: 'smoke',
      filePath: txtPath,
      parsed: parsedWorkbook,
      previewRows: preview.rows,
      catalog,
      ossConfig,
    });

    const rowResult = executeResult.rows.find((row) => row.rowNumber === dataRow.rowNumber);
    const createOk = rowResult?.status === 'succeeded' || rowResult?.status === 'skipped_existing';
    logStep(
      4,
      6,
      '创建贴纸+套装',
      Boolean(createOk),
      rowResult
        ? `${rowResult.status}${rowResult.failureReason ? ` — ${rowResult.failureReason}` : ''}`
        : '无结果',
    );

    if (!createOk) {
      process.exit(1);
    }
  } else {
    logStep(4, 6, '创建贴纸+套装', true, '跳过（--verify-only）');
  }

  const verification = await verifyCreatedSkuImportRow(catalog, client, previewRow);
  for (const step of verification.steps) {
    logStep(5, 6, step.label, step.ok, step.detail);
  }

  if (verification.ok) {
    logStep(6, 6, '总结', true, 'D2 结构验证通过');
    console.log('\n全部验证通过');
    process.exit(0);
  }

  logStep(6, 6, '总结', false, 'D2 结构验证失败');
  console.error('\n验证未通过');
  process.exit(1);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('\n✗ 冒烟失败:', message);
  if (message.includes('ERP_COOKIE') || message.includes('ERP_COMPANY_ID')) {
    console.error('\n提示: 复制 .env.example 为 scripts/.env 并填入 Cookie 与 companyId');
  }
  process.exit(1);
});
