import fs from 'node:fs/promises';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
  ACCESSORY_WORKBOOK_HEADERS,
  buildAccessoryWorkbook,
  parseAccessoryWorkbook,
} from '../src/tools/sku-import/accessories-workbook';

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'resources/templates/配件导入模板.xlsx',
);

async function createAccessoryFixtureWorkbook(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="配件" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
  );

  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="8" uniqueCount="8">
  <si><t>配件名称</t></si>
  <si><t>SKU编码</t></si>
  <si><t>状态（默认启用）</t></si>
  <si><t>自粘袋</t></si>
  <si><t>PJ-ZND01</t></si>
  <si><t>启用</t></si>
  <si><t>说明书</t></si>
  <si><t>PJ-SMS01</t></si>
</sst>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:C3"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>3</v></c>
      <c r="B2" t="s"><v>4</v></c>
      <c r="C2" t="s"><v>5</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>6</v></c>
      <c r="B3" t="s"><v>7</v></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

async function createMissingColumnFixtureWorkbook(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
  );

  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
  <si><t>配件名称</t></si>
  <si><t>状态（默认启用）</t></si>
</sst>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:B1"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
    </row>
  </sheetData>
</worksheet>`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('accessories-workbook', () => {
  it('parseAccessoryWorkbook 应解析真实模板（0 数据行）', async () => {
    const buffer = await fs.readFile(TEMPLATE_PATH);
    const rows = await parseAccessoryWorkbook(buffer);

    expect(rows).toEqual([]);
  });

  it('parseAccessoryWorkbook 应解析 fixture 两行数据', async () => {
    const workbook = await createAccessoryFixtureWorkbook();
    const rows = await parseAccessoryWorkbook(workbook);

    expect(rows).toEqual([
      { name: '自粘袋', skuCode: 'PJ-ZND01', statusRaw: '启用' },
      { name: '说明书', skuCode: 'PJ-SMS01', statusRaw: '' },
    ]);
  });

  it('缺列时应抛出缺少必需列错误', async () => {
    const workbook = await createMissingColumnFixtureWorkbook();

    await expect(parseAccessoryWorkbook(workbook)).rejects.toThrow('缺少必需列: SKU编码');
  });

  it('buildAccessoryWorkbook 空列表应仅含表头', async () => {
    const buffer = await buildAccessoryWorkbook([]);
    const rows = await parseAccessoryWorkbook(buffer);

    expect(rows).toEqual([]);
    expect(ACCESSORY_WORKBOOK_HEADERS).toEqual(['配件名称', 'SKU编码', '状态（默认启用）']);
  });

  it('buildAccessoryWorkbook 导出后 parseAccessoryWorkbook round-trip', async () => {
    const buffer = await buildAccessoryWorkbook([
      { name: '自粘袋', skuCode: 'PJ-ZND01', enabled: true },
      { name: '说明书', skuCode: 'PJ-SMS01', enabled: false },
    ]);
    const rows = await parseAccessoryWorkbook(buffer);

    expect(rows).toEqual([
      { name: '自粘袋', skuCode: 'PJ-ZND01', statusRaw: '启用' },
      { name: '说明书', skuCode: 'PJ-SMS01', statusRaw: '禁用' },
    ]);
  });
});
