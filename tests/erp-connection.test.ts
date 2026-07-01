import { describe, expect, it, vi } from 'vitest';

import { testErpConnection } from '../src/main/services/erp-connection';

vi.mock('../src/main/services/store', () => ({
  getAppSettings: () => ({ erpBaseUrl: 'https://erp.superboss.cc' }),
  getSecret: (key: string) => (key === 'erpCookie' ? 'cookie=test' : undefined),
}));

describe('testErpConnection', () => {
  it('缺少 companyId 时应返回失败', async () => {
    const result = await testErpConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('companyId');
  });

  it('传入表单 companyId 时应使用表单值', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: 1, data: { list: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await testErpConnection({ erpCompanyId: '140109' });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('成功');
  });
});
