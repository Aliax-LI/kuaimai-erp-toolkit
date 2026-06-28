import { describe, expect, it } from 'vitest';

import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';
import { appStoreSchema, createDefaultStore } from '@shared/schemas/store';

describe('appStoreSchema', () => {
  it('accepts default store shape', () => {
    const store = createDefaultStore();
    expect(appStoreSchema.parse(store)).toEqual(store);
  });

  it('defaults theme to dark', () => {
    const store = createDefaultStore();
    expect(store.app.theme).toBe('dark');
    expect(store.app.locale).toBe('zh-CN');
  });

  it('defaults erpBaseUrl to production ERP host', () => {
    const store = createDefaultStore();
    expect(store.app.erpBaseUrl).toBe(DEFAULT_ERP_BASE_URL);
  });

  it('rejects invalid erpBaseUrl', () => {
    const store = createDefaultStore();
    expect(() =>
      appStoreSchema.parse({
        ...store,
        app: { ...store.app, erpBaseUrl: 'not-a-url' },
      }),
    ).toThrow();
  });
});
