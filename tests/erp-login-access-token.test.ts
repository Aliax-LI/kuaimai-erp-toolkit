import { describe, expect, it } from 'vitest';

import { resolveErpAccessTokenFromCookie } from '../src/core/erp-login';

describe('erp-login accessToken', () => {
  it('resolveErpAccessTokenFromCookie 应从 Cookie 串提取 accessToken', () => {
    expect(resolveErpAccessTokenFromCookie('JSESSIONID=abc; accessToken=xyz')).toBe('xyz');
  });
});
