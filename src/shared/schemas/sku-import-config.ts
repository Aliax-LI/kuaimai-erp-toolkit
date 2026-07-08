import { z } from 'zod';

export const brandConfigSchema = z.object({
  name: z.string().trim().min(1, '品牌名称不能为空'),
  code: z.string().trim().min(1, '品牌编码不能为空'),
  shortName: z.string().trim().default(''),
  enabled: z.boolean().default(true),
});

export const accessoryConfigSchema = z.object({
  name: z.string().trim().min(1, '配件名称不能为空'),
  skuCode: z.string().trim().min(1, '配件 SKU 编码不能为空'),
  brand: z.string().trim().default(''),
  enabled: z.boolean().default(true),
});

export const skuImportRulesSchema = z.object({
  skuCodePrefix: z.string().trim().default(''),
  bundleCategoryName: z.string().trim().default(''),
  stickerUnitName: z.string().trim().default(''),
});

export type BrandConfig = z.infer<typeof brandConfigSchema>;
export type AccessoryConfig = z.infer<typeof accessoryConfigSchema>;
export type SkuImportRules = z.infer<typeof skuImportRulesSchema>;

export const DEFAULT_SKU_IMPORT_RULES: SkuImportRules = {
  skuCodePrefix: '69',
  bundleCategoryName: '家居清洗类（组合装）',
  stickerUnitName: '张',
};

export function resolveSkuImportRules(
  config: { rules?: Partial<SkuImportRules> },
): SkuImportRules {
  const rules = config.rules ?? {};
  return {
    skuCodePrefix:
      rules.skuCodePrefix !== undefined
        ? rules.skuCodePrefix
        : DEFAULT_SKU_IMPORT_RULES.skuCodePrefix,
    bundleCategoryName:
      rules.bundleCategoryName !== undefined
        ? rules.bundleCategoryName
        : DEFAULT_SKU_IMPORT_RULES.bundleCategoryName,
    stickerUnitName:
      rules.stickerUnitName !== undefined
        ? rules.stickerUnitName
        : DEFAULT_SKU_IMPORT_RULES.stickerUnitName,
  };
}

export const skuImportConfigSchema = z
  .object({
    brands: z.array(brandConfigSchema).default([]),
    accessories: z.array(accessoryConfigSchema).default([]),
    rules: skuImportRulesSchema.partial().default({}),
  })
  .transform((data) => ({
    brands: data.brands,
    accessories: data.accessories,
    rules: resolveSkuImportRules(data),
  }));

export type SkuImportConfig = z.infer<typeof skuImportConfigSchema>;

export const DEFAULT_SKU_IMPORT_CONFIG: SkuImportConfig = {
  brands: [
    { name: 'KJM', code: '04', shortName: '', enabled: true },
    { name: 'TIGERRUN', code: '05', shortName: '', enabled: true },
    { name: 'farienne', code: '10', shortName: '', enabled: true },
    { name: 'LOORSAN', code: '13', shortName: '', enabled: true },
    { name: 'WATE', code: '15', shortName: '', enabled: true },
    { name: 'vvland', code: '26', shortName: '', enabled: true },
    { name: 'ifubo', code: '35', shortName: '', enabled: true },
    { name: 'BINOO', code: '36', shortName: '', enabled: true },
    { name: 'jokjok', code: '37', shortName: '', enabled: true },
    { name: 'WKAU', code: '39', shortName: '', enabled: true },
    { name: 'FAELUTE', code: '42', shortName: '', enabled: true },
    { name: 'shanrrow', code: '43', shortName: '', enabled: true },
    { name: 'kineshinex', code: '44', shortName: '', enabled: true },
    { name: 'AGDP', code: '45', shortName: '', enabled: true },
    { name: 'Svayshiin', code: '46', shortName: '', enabled: true },
    { name: 'SARKALMAN', code: '47', shortName: '', enabled: true },
  ],
  accessories: [
    { name: '面膜刷', skuCode: 'PJ-MMS01', brand: '', enabled: true },
    { name: '自粘袋', skuCode: 'PJ-ZND01', brand: '', enabled: true },
    { name: '说明书', skuCode: 'PJ-SHMS01', brand: '', enabled: true },
  ],
  rules: { ...DEFAULT_SKU_IMPORT_RULES },
};
