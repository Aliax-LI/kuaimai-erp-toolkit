import {
  DEFAULT_SKU_IMPORT_CONFIG,
  skuImportConfigSchema,
  type SkuImportConfig,
} from '@shared/schemas/sku-import-config';

import { readToolConfig, writeToolConfig } from './store';

const TOOL_ID = 'sku-import';

export function getSkuImportConfig(): SkuImportConfig {
  const raw = readToolConfig(TOOL_ID);
  if (!raw) {
    return DEFAULT_SKU_IMPORT_CONFIG;
  }
  const parsed = skuImportConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_SKU_IMPORT_CONFIG;
}

export function setSkuImportConfig(next: SkuImportConfig): SkuImportConfig {
  const config = skuImportConfigSchema.parse(next);
  writeToolConfig(TOOL_ID, config);
  return config;
}
