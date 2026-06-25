import { describe, expect, it } from 'vitest';

import {
  hashErpLoginPassword,
  parseSetCookieHeader,
  serializeCookieJar,
} from '../src/core/erp-login';

// parseLoginResponse is not exported - test hash only for now

describe('erp-login', () => {
  it('hashErpLoginPassword 应为 MD5(明文).toUpperCase()', () => {
    expect(hashErpLoginPassword('cFd303A3')).toBe('A8EC14BFB82623BBD862CC9311983D42');
    expect(hashErpLoginPassword('test-password')).toMatch(/^[A-F0-9]{32}$/);
  });

  it('parseSetCookieHeader 应解析 name=value', () => {
    expect(parseSetCookieHeader('JSESSIONID=ABC; Path=/; HttpOnly')).toEqual({
      name: 'JSESSIONID',
      value: 'ABC',
    });
  });

  it('serializeCookieJar 应拼接 Cookie 头', () => {
    const jar = new Map([
      ['JSESSIONID', 'abc'],
      ['3AB9D23F7A4B3C9B', 'device'],
    ]);
    expect(serializeCookieJar(jar)).toBe('JSESSIONID=abc; 3AB9D23F7A4B3C9B=device');
  });
});
