import { describe, expect, it } from 'vitest';

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
});
