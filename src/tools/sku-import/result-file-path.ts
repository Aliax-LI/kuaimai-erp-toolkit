import path from 'node:path';

export const SKU_IMPORT_RESULT_SUFFIX = '-创建结果';

export function getSkuImportResultTaskDir(resultsDir: string, taskId: string): string {
  return path.join(resultsDir, taskId);
}

export function buildSkuImportResultFilePath(
  resultsDir: string,
  taskId: string,
  sourcePath: string,
): string {
  const source = path.parse(path.resolve(sourcePath));
  const ext = source.ext || '.xlsx';
  const fileName = `${source.name}${SKU_IMPORT_RESULT_SUFFIX}${ext}`;
  return path.join(getSkuImportResultTaskDir(resultsDir, taskId), fileName);
}

export function buildSkuImportResultExportDefaultPath(sourcePath: string): string {
  const source = path.parse(path.resolve(sourcePath));
  const ext = source.ext || '.xlsx';
  return path.join(source.dir, `${source.name}${SKU_IMPORT_RESULT_SUFFIX}${ext}`);
}
