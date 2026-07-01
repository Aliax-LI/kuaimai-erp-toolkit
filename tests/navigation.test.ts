import { describe, expect, it } from 'vitest';

import {
  APP_ROUTES,
  CONFIG_TABS,
  parseConfigTab,
  resolveLegacyRedirect,
} from '@shared/constants/navigation';

describe('navigation constants', () => {
  it('defines three primary routes', () => {
    expect(APP_ROUTES.WORKBENCH).toBe('/workbench');
    expect(APP_ROUTES.HISTORY).toBe('/history');
    expect(APP_ROUTES.CONFIG).toBe('/config');
  });

  it('redirects legacy paths', () => {
    expect(resolveLegacyRedirect('/tasks')).toBe('/history');
    expect(resolveLegacyRedirect('/settings')).toBe('/config?tab=erp');
    expect(resolveLegacyRedirect('/tools/sku-import')).toBe('/workbench');
    expect(resolveLegacyRedirect('/workbench')).toBeNull();
  });

  it('lists config tabs including erp first', () => {
    expect(CONFIG_TABS[0]).toBe('erp');
    expect(CONFIG_TABS).toContain('brands');
  });

  it('parseConfigTab defaults to erp', () => {
    expect(parseConfigTab(null)).toBe('erp');
    expect(parseConfigTab('invalid')).toBe('erp');
    expect(parseConfigTab('brands')).toBe('brands');
  });
});
