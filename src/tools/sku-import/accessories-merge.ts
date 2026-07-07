import type { AccessoryConfig } from '@shared/schemas/sku-import-config';

export interface AccessoryImportRow {
  name: string;
  skuCode: string;
  statusRaw: string;
}

export interface AccessoryMergeResult {
  accessories: AccessoryConfig[];
  added: number;
  updated: number;
  skipped: number;
}

const DISABLED_STATUS = new Set(['禁用', '否', 'false', '0']);

export function parseAccessoryStatus(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return true;
  if (DISABLED_STATUS.has(raw.trim()) || DISABLED_STATUS.has(value)) return false;
  return true;
}

export function mergeAccessoriesByName(
  existing: AccessoryConfig[],
  imported: AccessoryImportRow[],
): AccessoryMergeResult {
  const accessories = existing.map((item) => ({ ...item }));
  const indexByName = new Map(
    accessories.map((item, index) => [item.name.trim().toLowerCase(), index]),
  );
  const seenInFile = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of imported) {
    const name = row.name.trim();
    const skuCode = row.skuCode.trim();
    if (!name || !skuCode) {
      skipped += 1;
      continue;
    }
    const key = name.toLowerCase();
    if (seenInFile.has(key)) {
      skipped += 1;
      continue;
    }
    seenInFile.add(key);
    const enabled = parseAccessoryStatus(row.statusRaw);
    const existingIndex = indexByName.get(key);
    if (existingIndex !== undefined) {
      accessories[existingIndex] = {
        ...accessories[existingIndex],
        skuCode,
        enabled,
      };
      updated += 1;
      continue;
    }
    accessories.push({ name, skuCode, brand: '', enabled });
    indexByName.set(key, accessories.length - 1);
    added += 1;
  }

  return { accessories, added, updated, skipped };
}
