import { describe, expect, it } from 'vitest';

import {
  buildObjectKey,
  buildPublicUrl,
  parseStsResponse,
} from '../src/core/erp-oss-uploader';

describe('erp-oss-uploader', () => {
  it('buildObjectKey 应生成 timestamp/文件名 格式', () => {
    expect(buildObjectKey('test.png', 1700000000000)).toBe('1700000000000/test.png');
  });

  it('buildPublicUrl 应对路径分段编码', () => {
    const url = buildPublicUrl('1700000000000/hello world.png');
    expect(url).toBe(
      'https://erp-storage-img.oss-cn-hangzhou.aliyuncs.com/1700000000000/hello%20world.png',
    );
  });

  it('parseStsResponse 应解析 credentials 包装', () => {
    const parsed = parseStsResponse(
      JSON.stringify({
        credentials: {
          accessKeyId: 'STS.TEST',
          accessKeySecret: 'secret',
          securityToken: 'token',
          expiration: '2026-06-25T12:33:26Z',
        },
      }),
    );

    expect(parsed.accessKeyId).toBe('STS.TEST');
    expect(parsed.accessKeySecret).toBe('secret');
    expect(parsed.stsToken).toBe('token');
    expect(parsed.expiration).toBe('2026-06-25T12:33:26Z');
  });

  it('parseStsResponse 应解析 data 字符串包装', () => {
    const parsed = parseStsResponse({
      data: JSON.stringify({
        credentials: {
          accessKeyId: 'A',
          accessKeySecret: 'B',
          securityToken: 'C',
        },
      }),
    });

    expect(parsed.stsToken).toBe('C');
  });
});
