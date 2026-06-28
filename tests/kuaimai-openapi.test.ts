import { describe, expect, it } from 'vitest';

import {
  buildKuaimaiOpenApiPayload,
  formatKuaimaiTimestamp,
  generateKuaimaiOpenApiSignature,
} from '../src/core/kuaimai-openapi';

describe('kuaimai-openapi', () => {
  it('formatKuaimaiTimestamp 应输出 GMT+8 的 yyyy-MM-dd HH:mm:ss', () => {
    expect(formatKuaimaiTimestamp(new Date('2020-09-21T01:30:40Z'))).toBe('2020-09-21 09:30:40');
  });

  it('generateKuaimaiOpenApiSignature 应支持 hmac-sha256 示例', () => {
    const signature = generateKuaimaiOpenApiSignature(
      {
        appKey: '123456',
        format: 'json',
        method: 'open.system.time.get',
        session: 'test',
        sign_method: 'hmac-sha256',
        timestamp: '2020-09-21 16:58:00',
        version: '1.0',
      },
      'helloworld',
      'hmac-sha256',
    );

    expect(signature).toBe('7905D5EF37CA177B9219DBFA603F773A7616F424D545E731AAFBB992408F6CEE');
  });

  it('buildKuaimaiOpenApiPayload 应构造公共参数并签名', () => {
    const payload = buildKuaimaiOpenApiPayload({
      appKey: 'demo-app',
      appSecret: 'demo-secret',
      session: 'demo-session',
      method: 'item.list.query',
      businessParams: {
        pageNo: '1',
        pageSize: '20',
      },
      timestamp: '2026-06-28 12:34:56',
    });

    expect(payload.method).toBe('item.list.query');
    expect(payload.appKey).toBe('demo-app');
    expect(payload.session).toBe('demo-session');
    expect(payload.pageNo).toBe('1');
    expect(payload.pageSize).toBe('20');
    expect(payload.sign_method).toBe('hmac');
    expect(payload.version).toBe('1.0');
    expect(payload.format).toBe('json');
    expect(payload.sign).toMatch(/^[A-F0-9]{32}$/);
  });
});
