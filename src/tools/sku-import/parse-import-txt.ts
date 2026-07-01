export interface ParsedImportTxtRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedImportTxt {
  headers: string[];
  rows: ParsedImportTxtRow[];
}

export function parseImportTxt(content: string): ParsedImportTxt {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('上品记录.txt 至少需要表头行和一行数据');
  }

  const headers = lines[0]!.split('\t').map((h) => h.trim());
  const rows: ParsedImportTxtRow[] = lines.slice(1).map((line, index) => {
    const cells = line.split('\t');
    const values: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (!header) {
        continue;
      }
      values[header] = (cells[i] ?? '').trim();
    }
    return { rowNumber: index + 2, values };
  });

  return { headers, rows };
}
