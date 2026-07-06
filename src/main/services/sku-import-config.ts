import path from 'node:path';

import { app } from 'electron';

import {
  loadSkuImportConfigFile,
  resolvePackagedSkuImportConfigPath,
  resolveSkuImportConfigPath,
  readSkuImportConfigFile,
  writeSkuImportConfigFile,
} from '../../core/sku-import-config-storage';
import { skuImportConfigSchema, type SkuImportConfig } from '@shared/schemas/sku-import-config';

function getSkuImportConfigFilePath(): string {
  return path.join(app.getPath('userData'), 'config', 'sku-import', 'config.json');
}

function getLegacySkuImportConfigFilePath(): string {
  if (app.isPackaged) {
    return resolvePackagedSkuImportConfigPath(process.resourcesPath);
  }
  return resolveSkuImportConfigPath(app.getAppPath());
}

function ensureSkuImportConfigMigrated(): void {
  const target = getSkuImportConfigFilePath();
  const existing = readSkuImportConfigFile(target);
  if (existing) {
    writeSkuImportConfigFile(target, existing);
    return;
  }

  const legacy = readSkuImportConfigFile(getLegacySkuImportConfigFilePath());
  if (legacy) {
    writeSkuImportConfigFile(target, legacy);
  }
}

export function getSkuImportConfig(): SkuImportConfig {
  ensureSkuImportConfigMigrated();
  return loadSkuImportConfigFile(getSkuImportConfigFilePath());
}

export function setSkuImportConfig(next: SkuImportConfig): SkuImportConfig {
  const config = skuImportConfigSchema.parse(next);
  return writeSkuImportConfigFile(getSkuImportConfigFilePath(), config);
}
