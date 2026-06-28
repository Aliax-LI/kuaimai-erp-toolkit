#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
for (const envPath of [path.join(scriptDir, '.env'), path.join(rootDir, '.env')]) {
  if (fs.existsSync(envPath)) {
    const { config } = await import('dotenv');
    config({ path: envPath });
    break;
  }
}

import { createErpWebClient } from '../src/core/erp-web-client.ts';
import { createErpCatalogClient } from '../src/tools/sku-import/erp-catalog.ts';
import { loadErpWebConfigFromEnv } from '../src/tools/sku-import/load-erp-config-from-env.ts';

const targets = [
  'test-69-WKAU-BYMPGXJ0001-ST',
  'test-69-WKAU-BYMPGXJ0001',
  '69-04-DBQJP06',
];

const config = loadErpWebConfigFromEnv();
const catalog = createErpCatalogClient(config);
const client = createErpWebClient(config);

console.log('=== getItemsByOuterIds ===');
const items = await catalog.getItemsByOuterIds(targets);
for (const id of targets) {
  const hit = items.find((i) => i.outerId === id);
  console.log(JSON.stringify({ outerId: id, found: Boolean(hit), item: hit ?? null }));
}

console.log('\n=== queryListV2 per outerId ===');
for (const id of targets) {
  const res = await client.queryListV2({ pageNo: 1, pageSize: 5, outerId: id });
  const list = Array.isArray(res.list) ? res.list : [];
  console.log(
    JSON.stringify({
      outerId: id,
      total: res.total,
      count: list.length,
      first: list[0] ?? null,
    }),
  );
}

console.log('\n=== alternate outerIds ===');
for (const id of [
  '69-WKAU-BYMPGXJ0001-ST',
  'test-69-WKAU-BYMPGXJ0001-ST',
  '69-WKAU-BYMPGXJ0001',
  'test-69-WKAU-BYMPGXJ0001',
]) {
  const res = await client.queryListV2({ pageNo: 1, pageSize: 5, outerId: id });
  console.log(id, 'total', res.total);
}

console.log('\n=== title sticker/bundle ===');
for (const kw of ['布艺泡沫干洗剂30ml贴纸', 'WKAUtest0628', 'BYMPGXJ0001']) {
  const res = await client.queryListV2({ pageNo: 1, pageSize: 5, title: kw });
  const list = Array.isArray(res.list) ? res.list : [];
  console.log('kw', kw, 'total', res.total, 'hits', list.map((r) => r.outerId));
}

console.log('\n=== skuOuterId param ===');
for (const id of ['test-69-WKAU-BYMPGXJ0001-ST', 'test-69-WKAU-BYMPGXJ0001']) {
  const res = await client.queryListV2({ pageNo: 1, pageSize: 5, skuOuterId: id });
  console.log('skuOuterId', id, 'total', res.total, 'first', res.list?.[0]?.outerId);
}
