import fs from 'node:fs';
import path from 'node:path';

import { app, dialog, type BrowserWindow } from 'electron';

import type { AccessoryExportResult, AccessoryImportResult } from '@shared/types/sku-import';
import {
  bootstrapSkuImportConfigFromLegacy,
  loadSkuImportConfigFile,
  resolvePackagedSkuImportConfigPath,
  resolveSkuImportConfigPath,
  readSkuImportConfigFile,
  writeSkuImportConfigFile,
} from '../../core/sku-import-config-storage';
import { skuImportConfigSchema, type SkuImportConfig } from '@shared/schemas/sku-import-config';
import { mergeAccessoriesByName } from '../../tools/sku-import/accessories-merge';
import {
  buildAccessoryWorkbook,
  parseAccessoryWorkbook,
} from '../../tools/sku-import/accessories-workbook';

const ACCESSORY_TEMPLATE_RELATIVE = 'resources/templates/配件导入模板.xlsx';

function resolveAccessoryTemplatePath(): string {
  return path.join(app.getAppPath(), ACCESSORY_TEMPLATE_RELATIVE);
}

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
  if (fs.existsSync(target)) {
    return;
  }

  const legacy = readSkuImportConfigFile(getLegacySkuImportConfigFilePath());
  if (legacy) {
    writeSkuImportConfigFile(target, bootstrapSkuImportConfigFromLegacy(legacy));
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

export async function downloadAccessoryTemplate(
  win?: BrowserWindow | null,
): Promise<string | null> {
  const source = resolveAccessoryTemplatePath();
  if (!fs.existsSync(source)) {
    throw new Error('未找到配件导入模板');
  }
  const result = win
    ? await dialog.showSaveDialog(win, {
        defaultPath: '配件导入模板.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
    : await dialog.showSaveDialog({
        defaultPath: '配件导入模板.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
  if (result.canceled || !result.filePath) return null;
  fs.copyFileSync(source, result.filePath);
  return result.filePath;
}

export async function importAccessoriesFromFile(
  win?: BrowserWindow | null,
): Promise<AccessoryImportResult | null> {
  const pick = win
    ? await dialog.showOpenDialog(win, {
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      })
    : await dialog.showOpenDialog({
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      });
  if (pick.canceled || pick.filePaths.length === 0) return null;

  const buffer = fs.readFileSync(pick.filePaths[0]);
  const rows = await parseAccessoryWorkbook(buffer);
  const effectiveRows = rows.filter((row) => row.name.trim() || row.skuCode.trim());
  if (effectiveRows.length === 0) {
    throw new Error('未找到有效配件数据');
  }

  const current = getSkuImportConfig();
  const merged = mergeAccessoriesByName(
    current.accessories,
    effectiveRows.map((row) => ({
      name: row.name,
      skuCode: row.skuCode,
      statusRaw: row.statusRaw,
    })),
  );
  if (merged.added + merged.updated === 0 && merged.skipped === effectiveRows.length) {
    throw new Error('未找到有效配件数据');
  }

  setSkuImportConfig({ ...current, accessories: merged.accessories });
  return { added: merged.added, updated: merged.updated, skipped: merged.skipped };
}

export async function exportAccessoriesToFile(
  win?: BrowserWindow | null,
): Promise<AccessoryExportResult | null> {
  const current = getSkuImportConfig();
  const buffer = await buildAccessoryWorkbook(
    current.accessories.map((item) => ({
      name: item.name,
      skuCode: item.skuCode,
      enabled: item.enabled,
    })),
  );
  const result = win
    ? await dialog.showSaveDialog(win, {
        defaultPath: '配件配置导出.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
    : await dialog.showSaveDialog({
        defaultPath: '配件配置导出.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, buffer);
  return { filePath: result.filePath };
}
