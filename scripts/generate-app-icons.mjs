#!/usr/bin/env node
/**
 * 从 resources/icon.svg 生成各平台应用图标（png / ico / icns）
 * 在 make 前自动执行；CI 可在任意平台运行（需 sharp）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pngToIco from 'png-to-ico';
import png2icons from 'png2icons';
import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resourcesDir = path.join(rootDir, 'resources');
const svgPath = path.join(resourcesDir, 'icon.svg');
const pngPath = path.join(resourcesDir, 'icon.png');
const icoPath = path.join(resourcesDir, 'icon.ico');
const icnsPath = path.join(resourcesDir, 'icon.icns');

if (!fs.existsSync(svgPath)) {
  console.error('缺少 resources/icon.svg');
  process.exit(1);
}

const pngBuffer = await sharp(svgPath).resize(512, 512).png().toBuffer();
fs.writeFileSync(pngPath, pngBuffer);

const icoSizes = [16, 32, 48, 64, 128, 256];
const icoBuffers = await Promise.all(
  icoSizes.map((size) => sharp(svgPath).resize(size, size).png().toBuffer()),
);
const icoBuffer = await pngToIco(icoBuffers);
fs.writeFileSync(icoPath, icoBuffer);

const icnsBuffer = png2icons.createICNS(pngBuffer, png2icons.BILINEAR, 0);
if (!icnsBuffer) {
  console.error('生成 icon.icns 失败');
  process.exit(1);
}
fs.writeFileSync(icnsPath, icnsBuffer);

console.log('已生成:', path.relative(rootDir, pngPath));
console.log('已生成:', path.relative(rootDir, icoPath));
console.log('已生成:', path.relative(rootDir, icnsPath));
