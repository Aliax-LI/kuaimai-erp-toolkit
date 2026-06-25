import { describe, expect, it } from 'vitest';

import { isSensitiveKey, redactForLog } from '../src/core/log-redact';

describe('log-redact', () => {
  it('应脱敏 password / cookie 字段', () => {
    const redacted = redactForLog({
      userName: 'demo',
      password: 'secret',
      erpCookie: 'JSESSIONID=abc',
    }) as Record<string, unknown>;

    expect(redacted.userName).toBe('demo');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.erpCookie).toBe('[REDACTED]');
  });

  it('isSensitiveKey 应识别常见敏感键名', () => {
    expect(isSensitiveKey('accessKeySecret')).toBe(true);
    expect(isSensitiveKey('companyName')).toBe(false);
  });
});
