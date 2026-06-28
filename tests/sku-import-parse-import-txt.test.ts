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
