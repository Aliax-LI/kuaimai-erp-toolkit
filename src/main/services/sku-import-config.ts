import { app } from 'electron';

import {
  loadSkuImportConfigFile,
  resolvePackagedSkuImportConfigPath,
  resolveSkuImportConfigPath,
  writeSkuImportConfigFile,
} from '../../core/sku-import-config-storage';
import { skuImportConfigSchema, type SkuImportConfig } from '@shared/schemas/sku-import-config';

function getSkuImportConfigFilePath(): string {
  if (app.isPackaged) {
    return resolvePackagedSkuImportConfigPath(process.resourcesPath);
  }
  return resolveSkuImportConfigPath(app.getAppPath());
}

export function getSkuImportConfig(): SkuImportConfig {
  return loadSkuImportConfigFile(getSkuImportConfigFilePath());
}

export function setSkuImportConfig(next: SkuImportConfig): SkuImportConfig {
  const config = skuImportConfigSchema.parse(next);
  return writeSkuImportConfigFile(getSkuImportConfigFilePath(), config);
}
