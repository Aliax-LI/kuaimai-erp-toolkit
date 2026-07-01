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

export const skuImportConfigSchema = z.object({
  brands: z.array(brandConfigSchema).default([]),
  accessories: z.array(accessoryConfigSchema).default([]),
});

export type BrandConfig = z.infer<typeof brandConfigSchema>;
export type AccessoryConfig = z.infer<typeof accessoryConfigSchema>;
export type SkuImportConfig = z.infer<typeof skuImportConfigSchema>;

export const DEFAULT_SKU_IMPORT_CONFIG: SkuImportConfig = {
  brands: [
    { name: 'wkau', code: '39', shortName: 'W', enabled: true },
    { name: 'lovi', code: '42', shortName: 'L', enabled: true },
    { name: 'nimi', code: '51', shortName: 'N', enabled: true },
  ],
  accessories: [
    { name: '补色膏', skuCode: 'YP-BSG01', brand: 'wkau', enabled: true },
    { name: '固色剂', skuCode: 'GSJ02', brand: 'wkau', enabled: true },
    { name: '护理液', skuCode: 'HLY03', brand: 'lovi', enabled: true },
    { name: '自粘袋', skuCode: 'PJ-ZND01', brand: '', enabled: true },
    { name: '说明书', skuCode: 'PJ-SHMS01', brand: '', enabled: true },
  ],
};
