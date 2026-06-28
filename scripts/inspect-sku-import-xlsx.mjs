import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSkuImportWorkbook } from '../src/tools/sku-import/workbook.ts';

const file = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '上品记录.xlsx');

const buf = fs.readFileSync(file);
const parsed = await parseSkuImportWorkbook(buf, '待创建货号记录');
console.log('file:', file);
console.log('headers:', parsed.headers);
console.log('row count:', parsed.rows.length);
for (const row of parsed.rows) {
  const brand = row.values['品牌']?.trim() ?? '';
  const code = row.values['产品原品编码']?.trim() ?? '';
  const name = row.values['产品名']?.trim() ?? '';
  const nonempty = Object.entries(row.values).filter(([, v]) => v?.trim());
  console.log(
    `row ${row.rowNumber}: brand=${brand || '-'} code=${code || '-'} name=${name || '-'} nonempty=${nonempty.map(([k,v])=>k+'='+v).join('|')} image=${row.images.length > 0}`,
  );
}
