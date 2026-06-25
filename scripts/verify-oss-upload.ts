#!/usr/bin/env node
/**
 * 快麦 ERP OSS 上传验证脚本
 *
 * 用法:
 *   1. 复制 .env.example 为 .env，填入 ERP_COOKIE
 *   2. npm install
 *   3. npm run verify:oss -- [图片路径]
 *
 * 示例:
 *   npm run verify:oss -- ./test.png
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildObjectKey,
  fetchStsCredentials,
  loadConfigFromEnv,
  parseStsResponse,
  uploadToErpOss,
} from '../src/core/erp-oss-uploader.js';

const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function resolveFileArg(): { buffer: Buffer; fileName: string } {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log('未指定图片，使用 1x1 测试 PNG');
    return { buffer: MINIMAL_PNG, fileName: `verify-${Date.now()}.png` };
  }

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`文件不存在: ${abs}`);
  }

  return {
    buffer: fs.readFileSync(abs),
    fileName: path.basename(abs),
  };
}

async function stepParseStsSample(): Promise<void> {
  const sample = JSON.stringify({
    credentials: {
      accessKeyId: 'STS.TEST',
      accessKeySecret: 'secret',
      securityToken: 'token',
      expiration: '2026-06-25T12:33:26Z',
    },
    requestId: 'test',
  });

  const parsed = parseStsResponse(sample);
  console.log('✓ STS 解析逻辑正常');
  console.log(`  accessKeyId: ${parsed.accessKeyId}`);
}

async function stepFetchSts(config: ReturnType<typeof loadConfigFromEnv>): Promise<void> {
  console.log('\n--- 步骤 1: 获取 STS Token ---');
  console.log(`接口: ${config.stsTokenApi}`);

  const sts = await fetchStsCredentials(config);
  console.log('✓ STS 获取成功');
  console.log(`  accessKeyId: ${sts.accessKeyId}`);
  console.log(`  expiration:  ${sts.expiration ?? '(无)'}`);
}

async function stepUpload(
  config: ReturnType<typeof loadConfigFromEnv>,
  file: { buffer: Buffer; fileName: string },
): Promise<void> {
  console.log('\n--- 步骤 2: 上传文件到 OSS ---');
  console.log(`bucket: erp-storage-img`);
  console.log(`文件名: ${file.fileName}`);

  const objectKey = buildObjectKey(file.fileName);
  console.log(`objectKey: ${objectKey}`);

  const result = await uploadToErpOss(file.buffer, file.fileName, config);
  console.log('✓ 上传成功');
  console.log(`  objectKey: ${result.objectKey}`);
  console.log(`  url:       ${result.url}`);
  if (result.etag) {
    console.log(`  etag:      ${result.etag}`);
  }

  if (!result.url.startsWith('https://erp-storage-img.oss-cn-hangzhou.aliyuncs.com/')) {
    throw new Error(`URL 域名不符合预期: ${result.url}`);
  }
  console.log('✓ URL 格式校验通过');
}

async function main(): Promise<void> {
  console.log('快麦 ERP OSS 上传验证\n');

  await stepParseStsSample();

  const config = loadConfigFromEnv();
  const file = resolveFileArg();

  await stepFetchSts(config);
  await stepUpload(config, file);

  console.log('\n全部验证通过 🎉');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('\n✗ 验证失败:', message);

  if (message.includes('ERP_COOKIE')) {
    console.error('\n提示: 在已登录 ERP 的浏览器中，F12 → Network → 复制 Cookie 到 .env 文件');
  } else if (message.includes('STS 请求失败') || message.includes('credentials')) {
    console.error('\n提示: Cookie 可能已过期，或缺少 bx-ua 等风控参数');
    console.error('      可在 ERP 页面控制台直接测试，或使用 Puppeteer 方案');
  }

  process.exit(1);
});
