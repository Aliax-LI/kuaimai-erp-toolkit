import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  loadSkuImportConfigFile,
  readSkuImportConfigFile,
  resolveSkuImportConfigPath,
  writeSkuImportConfigFile,
} from '../src/core/sku-import-config-storage';
import { DEFAULT_SKU_IMPORT_CONFIG } from '@shared/schemas/sku-import-config';

describe('sku-import-config-storage', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempRoot(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sku-import-config-'));
    tempDirs.push(dir);
    return dir;
  }

  it('reads and writes the defaults json file', () => {
    const root = createTempRoot();
    const filePath = resolveSkuImportConfigPath(root);

    writeSkuImportConfigFile(filePath, DEFAULT_SKU_IMPORT_CONFIG);
    const loaded = readSkuImportConfigFile(filePath);

    expect(loaded).toEqual(DEFAULT_SKU_IMPORT_CONFIG);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual(DEFAULT_SKU_IMPORT_CONFIG);
  });

  it('bootstraps missing config from defaults', () => {
    const root = createTempRoot();
    const filePath = resolveSkuImportConfigPath(root);

    const loaded = loadSkuImportConfigFile(filePath);

    expect(loaded).toEqual(DEFAULT_SKU_IMPORT_CONFIG);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
