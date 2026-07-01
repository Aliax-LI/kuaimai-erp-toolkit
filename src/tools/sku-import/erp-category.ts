import type { ErpWebClient } from '../../core/erp-web-client';

export interface ErpSysCategory {
  id: string;
  name: string;
}

function pushCategory(
  result: ErpSysCategory[],
  seen: Set<string>,
  name: string,
  cid: unknown,
): void {
  const normalizedName = name.trim();
  const id = String(cid ?? '').trim();
  if (!normalizedName || !id) {
    return;
  }
  const key = `${id}:${normalizedName}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  result.push({ id, name: normalizedName });
}

function flattenCategoryNode(
  node: unknown,
  parentPath: string,
  result: ErpSysCategory[],
  seen: Set<string>,
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const record = node as Record<string, unknown>;
  const name = String(record.name ?? '').trim();
  const cid = record.cid ?? record.id;
  const fullName = parentPath && name ? `${parentPath}/${name}` : name || parentPath;

  if (name) {
    pushCategory(result, seen, name, cid);
    if (fullName !== name) {
      pushCategory(result, seen, fullName, cid);
    }
  }

  const children = record.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      flattenCategoryNode(child, fullName || name, result, seen);
    }
  }
}

function extractCategoryRoots(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    const roots: unknown[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const record = entry as Record<string, unknown>;
      if (record.sellerCats && typeof record.sellerCats === 'object') {
        roots.push(...Object.values(record.sellerCats as Record<string, unknown>));
        continue;
      }
      roots.push(entry);
    }
    return roots;
  }

  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const body = raw as Record<string, unknown>;
  if (body.sellerCats && typeof body.sellerCats === 'object') {
    return Object.values(body.sellerCats as Record<string, unknown>);
  }

  for (const key of ['list', 'data', 'categoryList', 'catList', 'rows']) {
    const value = body[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (nested.sellerCats && typeof nested.sellerCats === 'object') {
        return Object.values(nested.sellerCats as Record<string, unknown>);
      }
    }
  }

  return [];
}

export async function listErpSysCategories(client: ErpWebClient): Promise<ErpSysCategory[]> {
  const raw = await client.listSysCategories();
  const roots = extractCategoryRoots(raw);
  const result: ErpSysCategory[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    flattenCategoryNode(root, '', result, seen);
  }

  return result;
}

function pickCategoryId(categories: ErpSysCategory[], categoryName: string): string | undefined {
  const normalized = categoryName.trim();
  if (!normalized) {
    return undefined;
  }

  const exact = categories.find((item) => item.name === normalized);
  if (exact) {
    return exact.id;
  }

  const startsWith = categories.find((item) => item.name.startsWith(normalized));
  if (startsWith) {
    return startsWith.id;
  }

  const includes = categories.find((item) => item.name.includes(normalized));
  if (includes) {
    return includes.id;
  }

  const suffix = categories.find(
    (item) => item.name.endsWith(`/${normalized}`) || item.name.endsWith(normalized),
  );
  if (suffix) {
    return suffix.id;
  }

  return undefined;
}

export async function resolveErpCategoryId(
  client: ErpWebClient,
  categoryName: string,
): Promise<string> {
  const categories = await listErpSysCategories(client);
  const id = pickCategoryId(categories, categoryName.trim());
  if (!id) {
    throw new Error(`未在 ERP 分类列表中找到「${categoryName}」`);
  }
  return id;
}
