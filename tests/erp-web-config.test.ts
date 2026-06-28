import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/main/services/store', () => ({
  getSecret: vi.fn(),
  getAppSettings: vi.fn(),
}));

import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';
import { getErpWebConfig } from '../src/main/services/erp-web';
import { getAppSettings, getSecret } from '../src/main/services/store';

describe('getErpWebConfig', () => {
  beforeEach(() => {
    vi.mocked(getSecret).mockImplementation((key: string) => {
      if (key === 'erpCookie') return 'cookie=abc';
      if (key === 'erpCompanyId') return '140109';
      return undefined;
    });
    vi.mocked(getAppSettings).mockReturnValue({
      theme: 'dark',
      locale: 'zh-CN',
      erpBaseUrl: 'https://erp.example.com',
    });
  });

  it('uses erpBaseUrl from app settings', () => {
    const config = getErpWebConfig();
    expect(config.baseUrl).toBe('https://erp.example.com');
    expect(config.cookie).toBe('cookie=abc');
    expect(config.companyId).toBe('140109');
  });

  it('falls back to DEFAULT_ERP_BASE_URL when erpBaseUrl missing', () => {
    vi.mocked(getAppSettings).mockReturnValue({
      theme: 'dark',
      locale: 'zh-CN',
      erpBaseUrl: DEFAULT_ERP_BASE_URL,
    });
    expect(getErpWebConfig().baseUrl).toBe(DEFAULT_ERP_BASE_URL);
  });

  it('throws when cookie missing', () => {
    vi.mocked(getSecret).mockReturnValue(undefined);
    expect(() => getErpWebConfig()).toThrow(/Cookie/);
  });
});
