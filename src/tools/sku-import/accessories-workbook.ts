import path from 'node:path';

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

export const ACCESSORY_WORKBOOK_HEADERS = ['配件名称', 'SKU编码', '状态（默认启用）'] as const;

export interface ParsedAccessoryWorkbookRow {
  name: string;
  skuCode: string;
  statusRaw: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: false,
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeZipPath(target: string, fromFile: string): string {
  const fromDir = path.posix.dirname(fromFile);
  const normalized = path.posix.normalize(path.posix.join(fromDir, target));
  return normalized.replace(/^\/+/, '');
}

function columnNameToIndex(columnName: string): number {
  let result = 0;
  for (const char of columnName.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result - 1;
}

function columnIndexToName(columnIndex: number): string {
  let value = columnIndex + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function cellRefToColumnIndex(cellRef: string): number {
  const match = /^([A-Z]+)\d+$/i.exec(cellRef);
  if (!match) {
    throw new Error(`无效的单元格引用: ${cellRef}`);
  }
  return columnNameToIndex(match[1]);
}

function getTextNodeValue(node: unknown): string {
  if (typeof node === 'string') {
    return node;
  }
  if (node && typeof node === 'object' && '#text' in node) {
    const text = (node as { '#text'?: unknown })['#text'];
    return typeof text === 'string' ? text : '';
  }
  return '';
}

function getSharedStrings(sharedStringsXml: string | undefined): string[] {
  if (!sharedStringsXml) {
    return [];
  }

  const parsed = xmlParser.parse(sharedStringsXml) as {
    sst?: {
      si?: Array<{ t?: unknown; r?: Array<{ t?: unknown }> | { t?: unknown } }> | { t?: unknown };
    };
  };

  return asArray(parsed.sst?.si).map((entry: { t?: unknown; r?: Array<{ t?: unknown }> | { t?: unknown } }) => {
    if (entry.t !== undefined) {
      return getTextNodeValue(entry.t);
    }

    return asArray(entry.r)
      .map((segment) => getTextNodeValue(segment.t))
      .join('');
  });
}

function buildSharedStringsXml(strings: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xmlBuilder.build({
    sst: {
      '@_xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      '@_count': strings.length,
      '@_uniqueCount': strings.length,
      si: strings.map((value) => ({ t: value })),
    },
  })}`;
}

function readCellValue(cell: Record<string, unknown>, sharedStrings: string[]): string {
  const cellType = typeof cell['@_t'] === 'string' ? (cell['@_t'] as string) : undefined;
  const rawValue = cell.v;

  if (cellType === 's') {
    const index = Number(rawValue);
    return Number.isInteger(index) ? sharedStrings[index] ?? '' : '';
  }

  if (cellType === 'inlineStr') {
    return getTextNodeValue((cell.is as { t?: unknown } | undefined)?.t);
  }

  if (rawValue === undefined || rawValue === null) {
    return '';
  }

  return String(rawValue);
}

async function resolveFirstSheetPath(zip: JSZip): Promise<string> {
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  const workbookRelsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!workbookXml || !workbookRelsXml) {
    throw new Error('无法解析工作簿结构');
  }

  const workbook = xmlParser.parse(workbookXml) as {
    workbook?: {
      sheets?: {
        sheet?: Array<Record<string, string>> | Record<string, string>;
      };
    };
  };
  const workbookRels = xmlParser.parse(workbookRelsXml) as {
    Relationships?: {
      Relationship?: Array<Record<string, string>> | Record<string, string>;
    };
  };

  const sheets = asArray(workbook.workbook?.sheets?.sheet);
  const firstSheet = sheets[0];
  if (!firstSheet) {
    throw new Error('未找到工作表');
  }

  const relationships = asArray(workbookRels.Relationships?.Relationship);
  const sheetRel = relationships.find((rel) => rel['@_Id'] === firstSheet['@_r:id']);
  if (!sheetRel?.['@_Target']) {
    throw new Error('未找到工作表关系');
  }

  return normalizeZipPath(sheetRel['@_Target'], 'xl/workbook.xml');
}

function validateHeaders(headers: string[]): void {
  for (const requiredHeader of ACCESSORY_WORKBOOK_HEADERS) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`缺少必需列: ${requiredHeader}`);
    }
  }
}

function ensureSharedString(strings: string[], value: string): number {
  const existingIndex = strings.indexOf(value);
  if (existingIndex >= 0) {
    return existingIndex;
  }
  strings.push(value);
  return strings.length - 1;
}

function buildSheetRowCells(
  rowNumber: number,
  values: string[],
  sharedStrings: string[],
): Record<string, unknown> {
  const cells = values.map((value, columnIndex) => ({
    '@_r': `${columnIndexToName(columnIndex)}${rowNumber}`,
    '@_t': 's',
    v: String(ensureSharedString(sharedStrings, value)),
  }));

  return {
    '@_r': String(rowNumber),
    c: cells,
  };
}

export async function parseAccessoryWorkbook(workbookBuffer: Buffer): Promise<ParsedAccessoryWorkbookRow[]> {
  const zip = await JSZip.loadAsync(workbookBuffer);
  const sheetPath = await resolveFirstSheetPath(zip);
  const sheetXml = await zip.file(sheetPath)?.async('string');
  if (!sheetXml) {
    throw new Error('未找到工作表内容');
  }

  const sharedStringsPath = 'xl/sharedStrings.xml';
  const sharedStrings = getSharedStrings(await zip.file(sharedStringsPath)?.async('string'));

  const worksheet = xmlParser.parse(sheetXml) as {
    worksheet?: {
      sheetData?: {
        row?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    };
  };
  const rows = asArray(worksheet.worksheet?.sheetData?.row);
  if (rows.length === 0) {
    throw new Error('缺少必需列: 配件名称');
  }

  const headerRow = rows[0];
  const headerCells = asArray(headerRow.c as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
  const headers = headerCells
    .sort((left, right) => cellRefToColumnIndex(String(left['@_r'])) - cellRefToColumnIndex(String(right['@_r'])))
    .map((cell) => readCellValue(cell, sharedStrings));

  validateHeaders(headers);

  const headerIndexByName = new Map<string, number>();
  for (const cell of headerCells) {
    const ref = String(cell['@_r'] ?? '');
    const columnIndex = cellRefToColumnIndex(ref);
    headerIndexByName.set(readCellValue(cell, sharedStrings), columnIndex);
  }

  const nameIndex = headerIndexByName.get('配件名称')!;
  const skuCodeIndex = headerIndexByName.get('SKU编码')!;
  const statusIndex = headerIndexByName.get('状态（默认启用）')!;

  return rows.slice(1).map((row) => {
    const rowCells = asArray(row.c as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
    const valuesByColumn = new Map<number, string>();

    for (const cell of rowCells) {
      const ref = String(cell['@_r'] ?? '');
      valuesByColumn.set(cellRefToColumnIndex(ref), readCellValue(cell, sharedStrings));
    }

    return {
      name: valuesByColumn.get(nameIndex) ?? '',
      skuCode: valuesByColumn.get(skuCodeIndex) ?? '',
      statusRaw: valuesByColumn.get(statusIndex) ?? '',
    };
  });
}

export async function buildAccessoryWorkbook(
  rows: Array<{ name: string; skuCode: string; enabled: boolean }>,
): Promise<Buffer> {
  const sharedStrings: string[] = [];
  const headerRow = buildSheetRowCells(1, [...ACCESSORY_WORKBOOK_HEADERS], sharedStrings);
  const dataRows = rows.map((row, index) =>
    buildSheetRowCells(
      index + 2,
      [row.name, row.skuCode, row.enabled ? '启用' : '禁用'],
      sharedStrings,
    ),
  );

  const allRows = [headerRow, ...dataRows];
  const maxColumnIndex = ACCESSORY_WORKBOOK_HEADERS.length - 1;
  const maxRowNumber = allRows.length;

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

  zip.file('xl/sharedStrings.xml', buildSharedStringsXml(sharedStrings));

  const worksheetDoc = {
    worksheet: {
      '@_xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      dimension: {
        '@_ref': `A1:${columnIndexToName(maxColumnIndex)}${maxRowNumber}`,
      },
      sheetData: {
        row: allRows,
      },
    },
  };

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xmlBuilder.build(worksheetDoc)}`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}
