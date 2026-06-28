import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { clearSkuImportWorkbookResults, parseSkuImportWorkbook, sweepGhostRowWritebacks } from '../src/tools/sku-import/workbook.ts';
import { SKU_IMPORT_SHEET_NAME } from '../src/shared/types/sku-import.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultExcel = path.join(root, '上品记录.xlsx');

async function clearExcelWriteback(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`跳过（文件不存在）: ${filePath}`);
    return false;
  }

  const workbookBuffer = fs.readFileSync(filePath);
  const parsed = await parseSkuImportWorkbook(workbookBuffer, SKU_IMPORT_SHEET_NAME);
  const rowNumbers = parsed.rows.map((row) => row.rowNumber);
  if (rowNumbers.length === 0) {
    console.log(`跳过（无数据行）: ${filePath}`);
    return false;
  }

  let updated = await clearSkuImportWorkbookResults(
    workbookBuffer,
    SKU_IMPORT_SHEET_NAME,
    rowNumbers,
  );
  updated = await sweepGhostRowWritebacks(updated, SKU_IMPORT_SHEET_NAME);
  fs.writeFileSync(filePath, updated);
  console.log(`已清除回写列: ${filePath}（${rowNumbers.length} 行）`);
  return true;
}

const targets = process.argv.slice(2);
const files = targets.length > 0 ? targets : [defaultExcel];

let cleared = 0;
for (const file of files) {
  if (await clearExcelWriteback(path.resolve(file))) {
    cleared += 1;
  }
}

console.log(`完成，共处理 ${cleared} 个 Excel 文件。预演任务为内存数据，重启应用后自动清空。`);
