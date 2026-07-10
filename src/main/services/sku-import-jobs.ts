import fs from 'node:fs';
import path from 'node:path';

import type {
  SkuImportExecuteResult,
  SkuImportPreviewResult,
  SkuImportTaskStatus,
} from '@shared/types/sku-import';

import type { ParsedSkuImportWorkbook } from '../../tools/sku-import/workbook';

export interface SkuImportJobRecord {
  id: string;
  filePath: string;
  resultFilePath?: string;
  parsed: Omit<ParsedSkuImportWorkbook, 'workbookBuffer'> & { workbookBuffer?: Buffer };
  preview: SkuImportPreviewResult;
  status: SkuImportTaskStatus;
  createdAt: string;
  updatedAt: string;
  executeResult?: SkuImportExecuteResult;
  failureMessage?: string;
}

const JOB_SCHEMA_VERSION = 1;

function jobPath(jobsDir: string, taskId: string): string {
  return path.join(jobsDir, `${taskId}.json`);
}

function stripWorkbookBuffer(parsed: ParsedSkuImportWorkbook): SkuImportJobRecord['parsed'] {
  const { workbookBuffer: _drop, ...rest } = parsed;
  return {
    ...rest,
    rows: rest.rows.map((row) => ({
      ...row,
      images: row.images.map((image) => ({
        columnIndex: image.columnIndex,
        rowIndex: image.rowIndex,
        fileName: image.fileName,
        contentType: image.contentType,
        buffer: Buffer.alloc(0),
      })),
    })),
  };
}

export function saveSkuImportJob(jobsDir: string, record: SkuImportJobRecord): void {
  fs.mkdirSync(jobsDir, { recursive: true });
  const payload = {
    schemaVersion: JOB_SCHEMA_VERSION,
    updatedAt: record.updatedAt,
    data: {
      ...record,
      parsed: stripWorkbookBuffer(record.parsed as ParsedSkuImportWorkbook),
    },
  };
  const target = jobPath(jobsDir, record.id);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

export function loadSkuImportJob(jobsDir: string, taskId: string): SkuImportJobRecord | null {
  const file = jobPath(jobsDir, taskId);
  if (!fs.existsSync(file)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { data: SkuImportJobRecord };
  return raw.data;
}

export function listSkuImportJobs(jobsDir: string): SkuImportJobRecord[] {
  if (!fs.existsSync(jobsDir)) {
    return [];
  }
  return fs
    .readdirSync(jobsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => loadSkuImportJob(jobsDir, name.replace(/\.json$/, '')))
    .filter((job): job is SkuImportJobRecord => job !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function deleteSkuImportJob(jobsDir: string, taskId: string): void {
  const file = jobPath(jobsDir, taskId);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

export function clearSkuImportJobs(jobsDir: string): number {
  if (!fs.existsSync(jobsDir)) {
    return 0;
  }
  const files = fs.readdirSync(jobsDir).filter((name) => name.endsWith('.json'));
  for (const file of files) {
    fs.unlinkSync(path.join(jobsDir, file));
  }
  return files.length;
}
