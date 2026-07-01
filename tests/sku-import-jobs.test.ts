import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  clearSkuImportJobs,
  deleteSkuImportJob,
  listSkuImportJobs,
  loadSkuImportJob,
  saveSkuImportJob,
  type SkuImportJobRecord,
} from '../src/main/services/sku-import-jobs';

const tmpDirs: string[] = [];

function tempJobsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sku-jobs-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

const sampleJob: SkuImportJobRecord = {
  id: 'task-1',
  filePath: '/tmp/test.xlsx',
  parsed: {
    sheetName: '待创建货号记录',
    headers: ['品牌'],
    rows: [{ rowNumber: 2, values: { 品牌: 'WKAU' }, images: [] }],
    workbookBuffer: Buffer.alloc(0),
  },
  preview: {
    sessionId: 'task-1',
    filePath: '/tmp/test.xlsx',
    sheetName: '待创建货号记录',
    totalRows: 1,
    readyCount: 1,
    blockedCount: 0,
    skippedCount: 0,
    rows: [],
  },
  status: 'previewed',
  createdAt: '2026-06-28T00:00:00.000Z',
  updatedAt: '2026-06-28T00:00:00.000Z',
};

describe('sku-import-jobs', () => {
  it('save + load roundtrip', () => {
    const jobsDir = tempJobsDir();
    saveSkuImportJob(jobsDir, sampleJob);
    const loaded = loadSkuImportJob(jobsDir, 'task-1');
    expect(loaded?.id).toBe('task-1');
    expect(loaded?.parsed.rows[0].values['品牌']).toBe('WKAU');
    expect(loaded?.parsed.workbookBuffer).toBeUndefined();
  });

  it('list 按 updatedAt 降序', () => {
    const jobsDir = tempJobsDir();
    saveSkuImportJob(jobsDir, sampleJob);
    saveSkuImportJob(jobsDir, {
      ...sampleJob,
      id: 'task-2',
      updatedAt: '2026-06-28T01:00:00.000Z',
    });
    const ids = listSkuImportJobs(jobsDir).map((job) => job.id);
    expect(ids[0]).toBe('task-2');
  });

  it('delete 移除文件', () => {
    const jobsDir = tempJobsDir();
    saveSkuImportJob(jobsDir, sampleJob);
    deleteSkuImportJob(jobsDir, 'task-1');
    expect(loadSkuImportJob(jobsDir, 'task-1')).toBeNull();
  });

  it('clear 移除全部', () => {
    const jobsDir = tempJobsDir();
    saveSkuImportJob(jobsDir, sampleJob);
    saveSkuImportJob(jobsDir, { ...sampleJob, id: 'task-2' });
    expect(clearSkuImportJobs(jobsDir)).toBe(2);
    expect(listSkuImportJobs(jobsDir)).toHaveLength(0);
  });
});
