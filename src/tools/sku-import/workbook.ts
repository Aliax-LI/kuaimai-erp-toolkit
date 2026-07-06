import path from 'node:path';

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import { isSkuImportDataRow } from './domain';

export interface WorkbookEmbeddedImage {
  columnIndex: number;
  rowIndex: number;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

export interface ParsedSkuImportWorkbookRow {
  rowNumber: number;
  values: Record<string, string>;
  images: WorkbookEmbeddedImage[];
}

export interface ParsedSkuImportWorkbook {
  sheetName: string;
  headers: string[];
  rows: ParsedSkuImportWorkbookRow[];
  workbookBuffer: Buffer;
}

export interface WorkbookWritebackRow {
  rowNumber: number;
  skuCode: string;
  status: string;
  failureReason: string;
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

function readCellValue(
  cell: Record<string, unknown>,
  sharedStrings: string[],
): string {
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

async function resolveWorkbookParts(
  zip: JSZip,
  sheetName: string,
): Promise<{
  sheetPath: string;
  sheetDisplayName: string;
  sharedStringsPath?: string;
}> {
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
  const targetSheet =
    sheetName.trim().toLowerCase() === 'sheet1'
      ? sheets[0]
      : sheets.find((sheet) => sheet['@_name'] === sheetName);
  if (!targetSheet) {
    throw new Error(`未找到工作表: ${sheetName}`);
  }

  const relationships = asArray(workbookRels.Relationships?.Relationship);
  const sheetRel = relationships.find((rel) => rel['@_Id'] === targetSheet['@_r:id']);
  if (!sheetRel?.['@_Target']) {
    throw new Error(`未找到工作表关系: ${sheetName}`);
  }

  const sharedStringsRel = relationships.find((rel) =>
    String(rel['@_Type'] ?? '').endsWith('/sharedStrings'),
  );

  return {
    sheetPath: normalizeZipPath(sheetRel['@_Target'], 'xl/workbook.xml'),
    sheetDisplayName: targetSheet['@_name'] || sheetName,
    sharedStringsPath: sharedStringsRel?.['@_Target']
      ? normalizeZipPath(sharedStringsRel['@_Target'], 'xl/workbook.xml')
      : undefined,
  };
}

async function getSheetImages(
  zip: JSZip,
  sheetPath: string,
): Promise<Map<number, WorkbookEmbeddedImage[]>> {
  const sheetRelsPath = path.posix.join(
    path.posix.dirname(sheetPath),
    '_rels',
    `${path.posix.basename(sheetPath)}.rels`,
  );
  const sheetRelsXml = await zip.file(sheetRelsPath)?.async('string');
  if (!sheetRelsXml) {
    return new Map();
  }

  const sheetRels = xmlParser.parse(sheetRelsXml) as {
    Relationships?: {
      Relationship?: Array<Record<string, string>> | Record<string, string>;
    };
  };
  const drawingRel = asArray(sheetRels.Relationships?.Relationship).find((rel) =>
    String(rel['@_Type'] ?? '').endsWith('/drawing'),
  );
  if (!drawingRel?.['@_Target']) {
    return new Map();
  }

  const drawingPath = normalizeZipPath(drawingRel['@_Target'], sheetPath);
  const drawingXml = await zip.file(drawingPath)?.async('string');
  if (!drawingXml) {
    return new Map();
  }

  const drawingRelsPath = path.posix.join(
    path.posix.dirname(drawingPath),
    '_rels',
    `${path.posix.basename(drawingPath)}.rels`,
  );
  const drawingRelsXml = await zip.file(drawingRelsPath)?.async('string');
  if (!drawingRelsXml) {
    return new Map();
  }

  const drawingRels = xmlParser.parse(drawingRelsXml) as {
    Relationships?: {
      Relationship?: Array<Record<string, string>> | Record<string, string>;
    };
  };
  const drawingRelationshipMap = new Map(
    asArray(drawingRels.Relationships?.Relationship).map((rel) => [rel['@_Id'], rel['@_Target']]),
  );

  const contentTypesXml = await zip.file('[Content_Types].xml')?.async('string');
  const contentTypes = contentTypesXml
    ? (xmlParser.parse(contentTypesXml) as {
        Types?: { Default?: Array<Record<string, string>> | Record<string, string> };
      })
    : undefined;
  const defaults = new Map(
    asArray(contentTypes?.Types?.Default).map((entry) => [
      String(entry['@_Extension'] ?? '').toLowerCase(),
      String(entry['@_ContentType'] ?? 'application/octet-stream'),
    ]),
  );

  const drawing = xmlParser.parse(drawingXml) as Record<string, unknown>;
  const wsDr =
    (drawing['xdr:wsDr'] as Record<string, unknown> | undefined) ??
    (drawing.wsDr as Record<string, unknown> | undefined);
  if (!wsDr) {
    return new Map();
  }

  const anchors = [
    ...asArray(wsDr['xdr:oneCellAnchor'] as Record<string, unknown> | Array<Record<string, unknown>> | undefined),
    ...asArray(wsDr['xdr:twoCellAnchor'] as Record<string, unknown> | Array<Record<string, unknown>> | undefined),
  ];

  const imagesByRow = new Map<number, WorkbookEmbeddedImage[]>();
  for (const anchor of anchors) {
    const from =
      (anchor['xdr:from'] as Record<string, unknown> | undefined) ??
      (anchor.from as Record<string, unknown> | undefined);
    const pic =
      (anchor['xdr:pic'] as Record<string, unknown> | undefined) ??
      (anchor.pic as Record<string, unknown> | undefined);
    if (!from || !pic) {
      continue;
    }

    const rowIndex = Number(from['xdr:row'] ?? from.row ?? 0);
    const columnIndex = Number(from['xdr:col'] ?? from.col ?? 0);
    const blipFill =
      (pic['xdr:blipFill'] as Record<string, unknown> | undefined) ??
      (pic.blipFill as Record<string, unknown> | undefined);
    const blip =
      (blipFill?.['a:blip'] as Record<string, string> | undefined) ??
      (blipFill?.blip as Record<string, string> | undefined);
    const embedId = blip?.['@_r:embed'] ?? blip?.['@_embed'];
    const target = embedId ? drawingRelationshipMap.get(embedId) : undefined;
    if (!target) {
      continue;
    }

    const imagePath = normalizeZipPath(target, drawingPath);
    const buffer = await zip.file(imagePath)?.async('nodebuffer');
    if (!buffer) {
      continue;
    }

    const ext = path.posix.extname(imagePath).replace(/^\./, '').toLowerCase();
    const contentType = defaults.get(ext) ?? 'application/octet-stream';
    const fileName = path.posix.basename(imagePath);
    const image: WorkbookEmbeddedImage = {
      columnIndex,
      rowIndex,
      fileName,
      contentType,
      buffer,
    };

    const existing = imagesByRow.get(rowIndex) ?? [];
    existing.push(image);
    imagesByRow.set(rowIndex, existing);
  }

  return imagesByRow;
}

function setDimensionRef(
  worksheet: Record<string, unknown>,
  maxRowNumber: number,
  maxColumnIndex: number,
): void {
  worksheet.dimension = {
    '@_ref': `A1:${columnIndexToName(maxColumnIndex)}${maxRowNumber}`,
  };
}

function ensureSharedString(strings: string[], value: string): number {
  const existingIndex = strings.indexOf(value);
  if (existingIndex >= 0) {
    return existingIndex;
  }
  strings.push(value);
  return strings.length - 1;
}

function setRowCellValue(
  row: Record<string, unknown>,
  rowNumber: number,
  columnIndex: number,
  value: string,
  sharedStrings: string[],
): void {
  const cellRef = `${columnIndexToName(columnIndex)}${rowNumber}`;
  const cells = asArray(row.c as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
  const nextSharedIndex = ensureSharedString(sharedStrings, value);

  const existing = cells.find((cell) => String(cell['@_r'] ?? '') === cellRef);
  if (existing) {
    existing['@_t'] = 's';
    existing.v = String(nextSharedIndex);
  } else {
    cells.push({
      '@_r': cellRef,
      '@_t': 's',
      v: String(nextSharedIndex),
    });
  }

  cells.sort((left, right) => {
    const leftRef = String(left['@_r'] ?? '');
    const rightRef = String(right['@_r'] ?? '');
    return cellRefToColumnIndex(leftRef) - cellRefToColumnIndex(rightRef);
  });
  row.c = cells;
}

export async function parseSkuImportWorkbook(
  workbookBuffer: Buffer,
  sheetName = 'sheet1',
): Promise<ParsedSkuImportWorkbook> {
  const zip = await JSZip.loadAsync(workbookBuffer);
  const { sheetPath, sheetDisplayName, sharedStringsPath } = await resolveWorkbookParts(zip, sheetName);
  const sheetXml = await zip.file(sheetPath)?.async('string');
  if (!sheetXml) {
    throw new Error(`未找到工作表内容: ${sheetName}`);
  }

  const sharedStrings = getSharedStrings(
    sharedStringsPath ? await zip.file(sharedStringsPath)?.async('string') : undefined,
  );
  const worksheet = xmlParser.parse(sheetXml) as {
    worksheet?: {
      sheetData?: {
        row?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    };
  };
  const rows = asArray(worksheet.worksheet?.sheetData?.row);
  if (rows.length === 0) {
    return { sheetName: sheetDisplayName, headers: [], rows: [], workbookBuffer };
  }

  const headerRow = rows[0];
  const headerCells = asArray(headerRow.c as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
  const headers = headerCells
    .sort((left, right) => cellRefToColumnIndex(String(left['@_r'])) - cellRefToColumnIndex(String(right['@_r'])))
    .map((cell) => readCellValue(cell, sharedStrings));

  const imagesByRow = await getSheetImages(zip, sheetPath);
  const parsedRows: ParsedSkuImportWorkbookRow[] = rows
    .slice(1)
    .map((row) => {
      const rowNumber = Number(row['@_r'] ?? 0);
      const rowCells = asArray(row.c as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
      const values: Record<string, string> = {};

      for (const cell of rowCells) {
        const ref = String(cell['@_r'] ?? '');
        const columnIndex = cellRefToColumnIndex(ref);
        const header = headers[columnIndex];
        if (!header) {
          continue;
        }
        values[header] = readCellValue(cell, sharedStrings);
      }

      return {
        rowNumber,
        values,
        images: imagesByRow.get(rowNumber - 1) ?? [],
      };
    })
    .filter((row) => isSkuImportDataRow(row.values));

  return {
    sheetName: sheetDisplayName,
    headers,
    rows: parsedRows,
    workbookBuffer,
  };
}

export async function clearSkuImportWorkbookResults(
  workbookBuffer: Buffer,
  sheetName: string,
  rowNumbers: number[],
): Promise<Buffer> {
  return applySkuImportWorkbookResults(
    workbookBuffer,
    sheetName,
    rowNumbers.map((rowNumber) => ({
      rowNumber,
      skuCode: '',
      status: '',
      failureReason: '',
    })),
  );
}

export async function applySkuImportWorkbookResults(
  workbookBuffer: Buffer,
  sheetName: string,
  results: WorkbookWritebackRow[],
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(workbookBuffer);
  const { sheetPath, sharedStringsPath } = await resolveWorkbookParts(zip, sheetName);
  const sheetXml = await zip.file(sheetPath)?.async('string');
  if (!sheetXml) {
    throw new Error(`未找到工作表内容: ${sheetName}`);
  }

  const worksheetDoc = xmlParser.parse(sheetXml) as {
    worksheet?: Record<string, unknown> & {
      sheetData?: {
        row?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    };
  };
  const worksheet = worksheetDoc.worksheet;
  if (!worksheet) {
    throw new Error(`工作表结构无效: ${sheetName}`);
  }

  const sheetData = worksheet.sheetData as { row?: Array<Record<string, unknown>> | Record<string, unknown> };
  const rows = asArray(sheetData.row);
  if (rows.length === 0) {
    throw new Error(`工作表为空: ${sheetName}`);
  }

  const sharedStringsPathFinal = sharedStringsPath ?? 'xl/sharedStrings.xml';
  const sharedStrings = getSharedStrings(await zip.file(sharedStringsPathFinal)?.async('string'));

  const headerRow = rows[0];
  const headerCells = asArray(headerRow.c as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
  const headerByName = new Map<string, number>();
  let maxColumnIndex = 0;

  for (const cell of headerCells) {
    const ref = String(cell['@_r'] ?? '');
    const columnIndex = cellRefToColumnIndex(ref);
    maxColumnIndex = Math.max(maxColumnIndex, columnIndex);
    headerByName.set(readCellValue(cell, sharedStrings), columnIndex);
  }

  for (const headerName of ['商品SKU货号', '创建状态', '失败原因']) {
    if (!headerByName.has(headerName)) {
      maxColumnIndex += 1;
      headerByName.set(headerName, maxColumnIndex);
      setRowCellValue(headerRow, 1, maxColumnIndex, headerName, sharedStrings);
    }
  }

  const rowMap = new Map(rows.map((row) => [Number(row['@_r'] ?? 0), row]));
  for (const result of results) {
    const row = rowMap.get(result.rowNumber);
    if (!row) {
      continue;
    }

    setRowCellValue(row, result.rowNumber, headerByName.get('商品SKU货号')!, result.skuCode, sharedStrings);
    setRowCellValue(row, result.rowNumber, headerByName.get('创建状态')!, result.status, sharedStrings);
    setRowCellValue(
      row,
      result.rowNumber,
      headerByName.get('失败原因')!,
      result.failureReason,
      sharedStrings,
    );
  }

  sheetData.row = rows;
  worksheet.sheetData = sheetData;
  setDimensionRef(worksheet, Math.max(...rows.map((row) => Number(row['@_r'] ?? 1))), maxColumnIndex);
  worksheetDoc.worksheet = worksheet;

  zip.file(
    sheetPath,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xmlBuilder.build(worksheetDoc)}`,
  );
  zip.file(sharedStringsPathFinal, buildSharedStringsXml(sharedStrings));

  return zip.generateAsync({ type: 'nodebuffer' });
}

/** 清除非数据行上的回写列（历史执行误写入的空行） */
export async function sweepGhostRowWritebacks(
  workbookBuffer: Buffer,
  sheetName: string,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(workbookBuffer);
  const { sheetPath, sharedStringsPath } = await resolveWorkbookParts(zip, sheetName);
  const sheetXml = await zip.file(sheetPath)?.async('string');
  if (!sheetXml) {
    return workbookBuffer;
  }

  const sharedStrings = getSharedStrings(
    sharedStringsPath ? await zip.file(sharedStringsPath)?.async('string') : undefined,
  );
  const worksheet = xmlParser.parse(sheetXml) as {
    worksheet?: {
      sheetData?: {
        row?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    };
  };
  const rows = asArray(worksheet.worksheet?.sheetData?.row);
  if (rows.length <= 1) {
    return workbookBuffer;
  }

  const headerRow = rows[0];
  const headerCells = asArray(headerRow.c as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
  const headers = headerCells
    .sort((left, right) => cellRefToColumnIndex(String(left['@_r'])) - cellRefToColumnIndex(String(right['@_r'])))
    .map((cell) => readCellValue(cell, sharedStrings));

  const clears: WorkbookWritebackRow[] = [];
  for (const row of rows.slice(1)) {
    const rowNumber = Number(row['@_r'] ?? 0);
    const rowCells = asArray(row.c as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
    const values: Record<string, string> = {};

    for (const cell of rowCells) {
      const ref = String(cell['@_r'] ?? '');
      const columnIndex = cellRefToColumnIndex(ref);
      const header = headers[columnIndex];
      if (!header) {
        continue;
      }
      values[header] = readCellValue(cell, sharedStrings);
    }

    if (isSkuImportDataRow(values)) {
      continue;
    }

    const hasWriteback = Boolean(
      values['创建状态']?.trim() || values['失败原因']?.trim() || values['商品SKU货号']?.trim(),
    );
    if (hasWriteback) {
      clears.push({ rowNumber, skuCode: '', status: '', failureReason: '' });
    }
  }

  if (clears.length === 0) {
    return workbookBuffer;
  }

  return applySkuImportWorkbookResults(workbookBuffer, sheetName, clears);
}
