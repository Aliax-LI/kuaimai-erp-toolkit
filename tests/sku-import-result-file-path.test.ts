import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildSkuImportResultExportDefaultPath,
  buildSkuImportResultFilePath,
  getSkuImportResultTaskDir,
} from '../src/tools/sku-import/result-file-path';

const tmpDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sku-result-path-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe('buildSkuImportResultFilePath', () => {
  it('写入应用 results 目录下的任务子目录', () => {
    const resultsDir = path.join(tempDir(), 'results');
    const source = path.join(tempDir(), '上品记录.xlsx');

    expect(buildSkuImportResultFilePath(resultsDir, 'task-1', source)).toBe(
      path.join(resultsDir, 'task-1', '上品记录-创建结果.xlsx'),
    );
  });

  it('getSkuImportResultTaskDir 返回任务结果目录', () => {
    const resultsDir = path.join(tempDir(), 'results');
    expect(getSkuImportResultTaskDir(resultsDir, 'task-1')).toBe(
      path.join(resultsDir, 'task-1'),
    );
  });

  it('buildSkuImportResultExportDefaultPath 用于另存为默认文件名', () => {
    const source = path.join(tempDir(), '上品记录.xlsx');
    expect(buildSkuImportResultExportDefaultPath(source)).toBe(
      path.join(path.dirname(source), '上品记录-创建结果.xlsx'),
    );
  });
});
