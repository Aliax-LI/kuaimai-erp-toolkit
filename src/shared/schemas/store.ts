import { z } from 'zod';

import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';

export const appSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  locale: z.literal('zh-CN').default('zh-CN'),
  erpBaseUrl: z.string().url().default(DEFAULT_ERP_BASE_URL),
});

export const secretsSchema = z.record(z.string()).default({});

export const appStoreSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  app: appSettingsSchema,
  secrets: secretsSchema,
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type SecretsRecord = z.infer<typeof secretsSchema>;
export type AppStore = z.infer<typeof appStoreSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  locale: 'zh-CN',
  erpBaseUrl: DEFAULT_ERP_BASE_URL,
};

export function createDefaultStore(): AppStore {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    app: { ...DEFAULT_APP_SETTINGS },
    secrets: {},
  };
}

export const configEnvelopeSchema = z.object({
  schemaVersion: z.number(),
  updatedAt: z.string(),
  data: z.record(z.unknown()),
});

export type ConfigEnvelope = z.infer<typeof configEnvelopeSchema>;
