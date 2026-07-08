import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_SKU_IMPORT_CONFIG,
  skuImportConfigSchema,
  type SkuImportConfig,
} from '@shared/schemas/sku-import-config';

export const SKU_IMPORT_CONFIG_RELATIVE_PATH = 'resources/defaults/sku-import-config.json';

export function resolveSkuImportConfigPath(appRoot: string): string {
  return path.join(appRoot, SKU_IMPORT_CONFIG_RELATIVE_PATH);
}

export function resolvePackagedSkuImportConfigPath(resourcesPath: string): string {
  return path.join(resourcesPath, 'app.asar.unpacked', SKU_IMPORT_CONFIG_RELATIVE_PATH);
}

function mergeDefaultsByKey<T extends { name: string }>(
  existing: T[],
  defaults: T[],
): T[] {
  const seen = new Set(existing.map((item) => item.name.trim().toLowerCase()));
  return [
    ...existing,
    ...defaults.filter((item) => !seen.has(item.name.trim().toLowerCase())),
  ];
}

export function normalizeSkuImportConfigWithDefaults(config: SkuImportConfig): SkuImportConfig {
  return skuImportConfigSchema.parse({
    ...config,
    brands: mergeDefaultsByKey(config.brands, DEFAULT_SKU_IMPORT_CONFIG.brands),
    accessories: mergeDefaultsByKey(config.accessories, DEFAULT_SKU_IMPORT_CONFIG.accessories),
    rules: {
      ...DEFAULT_SKU_IMPORT_CONFIG.rules,
      ...config.rules,
    },
  });
}

export function readSkuImportConfigFile(filePath: string): SkuImportConfig | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const parsed = skuImportConfigSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeSkuImportConfigFile(filePath: string, config: SkuImportConfig): SkuImportConfig {
  const parsed = skuImportConfigSchema.parse(config);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
  return parsed;
}

/** 仅用于从旧版/残缺配置首次迁移时补全默认品牌与配件 */
export function bootstrapSkuImportConfigFromLegacy(config: SkuImportConfig): SkuImportConfig {
  return normalizeSkuImportConfigWithDefaults(config);
}

export function loadSkuImportConfigFile(filePath: string): SkuImportConfig {
  const existing = readSkuImportConfigFile(filePath);
  if (existing) {
    return existing;
  }
  return writeSkuImportConfigFile(filePath, DEFAULT_SKU_IMPORT_CONFIG);
}

export function loadDefaultSkuImportConfigFile(defaultsPath: string): SkuImportConfig {
  return readSkuImportConfigFile(defaultsPath) ?? DEFAULT_SKU_IMPORT_CONFIG;
}

export function applyDefaultBrands(
  current: SkuImportConfig,
  defaults: Pick<SkuImportConfig, 'brands'>,
): SkuImportConfig {
  return skuImportConfigSchema.parse({
    ...current,
    brands: defaults.brands,
  });
}
