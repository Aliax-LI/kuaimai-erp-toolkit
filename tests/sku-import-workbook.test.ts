import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
  applySkuImportWorkbookResults,
  parseSkuImportWorkbook,
  sweepGhostRowWritebacks,
} from '../src/tools/sku-import/workbook';

const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907724de0000000c49444154789c63606060000000040001f61738550000000049454e44ae426082',
  'hex',
);

async function createFixtureWorkbook(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
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
    <sheet name="不是固定名称" sheetId="1" r:id="rId1"/>
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
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="14" uniqueCount="14">
  <si><t>日期</t></si>
  <si><t>产品原品编码</t></si>
  <si><t>品牌</t></si>
  <si><t>产品名</t></si>
  <si><t>容量</t></si>
  <si><t>贴纸编码</t></si>
  <si><t>产品白底图-1</t></si>
  <si><t>商品SKU货号</t></si>
  <si><t>2026/06/23</t></si>
  <si><t>YP-CJJ01-01</t></si>
  <si><t>WKAU</t></si>
  <si><t>强力除胶剂</t></si>
  <si><t>50ml</t></si>
  <si><t>07460088</t></si>
</sst>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:H3"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
      <c r="F1" t="s"><v>5</v></c>
      <c r="G1" t="s"><v>6</v></c>
      <c r="H1" t="s"><v>7</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>8</v></c>
      <c r="B2" t="s"><v>9</v></c>
      <c r="C2" t="s"><v>10</v></c>
      <c r="D2" t="s"><v>11</v></c>
      <c r="E2" t="s"><v>12</v></c>
      <c r="F2" t="s"><v>13</v></c>
    </row>
    <row r="3"/>
  </sheetData>
  <drawing r:id="rId1"/>
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`,
  );

  zip.file(
    'xl/drawings/drawing1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>6</xdr:col>
      <xdr:colOff>0</xdr:colOff>
      <xdr:row>1</xdr:row>
      <xdr:rowOff>0</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="9525" cy="9525"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="1" name="image1.png"/>
        <xdr:cNvPicPr/>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="rId1"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr/>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`,
  );

  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`,
  );

  zip.file('xl/media/image1.png', PNG_BYTES);

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('sku-import workbook', () => {
  it('parseSkuImportWorkbook 应解析表头、行数据与嵌入图片', async () => {
    const workbook = await createFixtureWorkbook();
    const parsed = await parseSkuImportWorkbook(workbook, 'sheet1');

    expect(parsed.sheetName).toBe('不是固定名称');
    expect(parsed.headers.slice(0, 8)).toEqual([
      '日期',
      '产品原品编码',
      '品牌',
      '产品名',
      '容量',
      '贴纸编码',
      '产品白底图-1',
      '商品SKU货号',
    ]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 2,
      values: {
        日期: '2026/06/23',
        产品原品编码: 'YP-CJJ01-01',
        品牌: 'WKAU',
        产品名: '强力除胶剂',
        容量: '50ml',
        贴纸编码: '07460088',
      },
    });
    expect(parsed.rows[0].images).toHaveLength(1);
    expect(parsed.rows[0].images[0]).toMatchObject({
      columnIndex: 6,
      contentType: 'image/png',
      fileName: 'image1.png',
    });
    expect(parsed.rows[0].images[0]?.buffer.equals(PNG_BYTES)).toBe(true);
  });

  it('applySkuImportWorkbookResults 应保留图片并回写结果列', async () => {
    const workbook = await createFixtureWorkbook();
    const updated = await applySkuImportWorkbookResults(workbook, 'sheet1', [
      {
        rowNumber: 2,
        skuCode: '69-WKAU-CJJ001',
        status: 'succeeded',
        failureReason: '',
      },
    ]);

    const reparsed = await parseSkuImportWorkbook(updated, 'sheet1');
    expect(reparsed.rows[0]?.values['商品SKU货号']).toBe('69-WKAU-CJJ001');
    expect(reparsed.rows[0]?.values['创建状态']).toBe('succeeded');
    expect(reparsed.rows[0]?.values['失败原因']).toBe('');
    expect(reparsed.rows[0]?.images[0]?.buffer.equals(PNG_BYTES)).toBe(true);

    const zip = await JSZip.loadAsync(updated);
    const image = await zip.file('xl/media/image1.png')?.async('nodebuffer');
    expect(image?.equals(PNG_BYTES)).toBe(true);
  });

  it('sweepGhostRowWritebacks 应清除非数据行上的回写列', async () => {
    const workbook = await createFixtureWorkbook();
    const withGhost = await applySkuImportWorkbookResults(workbook, 'sheet1', [
      { rowNumber: 2, skuCode: '69-WKAU-CJJ001', status: 'succeeded', failureReason: '' },
      { rowNumber: 3, skuCode: 'test-69-BRAND-ITEM001', status: 'preview_blocked', failureReason: '缺少品牌' },
    ]);

    const swept = await sweepGhostRowWritebacks(withGhost, 'sheet1');
    const reparsed = await parseSkuImportWorkbook(swept, 'sheet1');
    expect(reparsed.rows).toHaveLength(1);
    expect(reparsed.rows[0]?.values['商品SKU货号']).toBe('69-WKAU-CJJ001');
    expect(reparsed.rows[0]?.values['创建状态']).toBe('succeeded');
  });
});
