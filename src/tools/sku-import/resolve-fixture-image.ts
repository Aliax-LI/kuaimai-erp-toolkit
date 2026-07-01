import fs from 'node:fs';
import path from 'node:path';

import type { WorkbookEmbeddedImage } from './workbook';

export function resolveFixtureImage(
  fixtureDir: string,
  explicitPath?: string,
): { filePath: string; image: WorkbookEmbeddedImage } {
  const imagePath = explicitPath
    ? path.resolve(explicitPath)
    : fs
        .readdirSync(fixtureDir)
        .filter((name) => name.toLowerCase().endsWith('.png'))
        .sort()
        .map((name) => path.join(fixtureDir, name))[0];

  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(
      explicitPath
        ? `图片不存在: ${explicitPath}`
        : `fixture 目录下未找到 .png: ${fixtureDir}`,
    );
  }

  const buffer = fs.readFileSync(imagePath);
  return {
    filePath: imagePath,
    image: {
      columnIndex: 7,
      rowIndex: 1,
      fileName: path.basename(imagePath),
      contentType: 'image/png',
      buffer,
    },
  };
}
