import OSS from 'ali-oss';

export interface ErpOssConfig {
  region: string;
  bucket: string;
  baseUrl: string;
  stsTokenApi: string;
  cookie: string;
}

export interface StsCredentials {
  accessKeyId: string;
  accessKeySecret: string;
  stsToken: string;
  expiration?: string;
}

export interface UploadResult {
  objectKey: string;
  url: string;
  etag?: string;
}

const DEFAULT_CONFIG: Omit<ErpOssConfig, 'cookie'> = {
  region: 'oss-cn-hangzhou',
  bucket: 'erp-storage-img',
  baseUrl: 'https://erp-storage-img.oss-cn-hangzhou.aliyuncs.com',
  stsTokenApi: 'https://erp.superboss.cc/storage/oss/getStsToken',
};

/** 与快麦 ERP 前端 OSS 上传类保持一致的 objectKey 规则 */
export function buildObjectKey(fileName: string, timestamp = Date.now()): string {
  return `${timestamp}/${fileName}`;
}

/** 构建公网访问 URL（路径分段编码，与浏览器行为一致） */
export function buildPublicUrl(objectKey: string, baseUrl = DEFAULT_CONFIG.baseUrl): string {
  const encodedKey = objectKey.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${baseUrl}/${encodedKey}`;
}

/** 解析 getStsToken 响应（兼容字符串 / data 包装） */
export function parseStsResponse(raw: unknown): StsCredentials {
  let data: Record<string, unknown>;

  if (typeof raw === 'string') {
    data = JSON.parse(raw) as Record<string, unknown>;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.data === 'string') {
      data = JSON.parse(obj.data) as Record<string, unknown>;
    } else if (obj.data && typeof obj.data === 'object') {
      data = obj.data as Record<string, unknown>;
    } else if (obj.credentials) {
      data = obj;
    } else {
      throw new Error(`无法识别的 STS 响应: ${JSON.stringify(raw).slice(0, 200)}`);
    }
  } else {
    throw new Error('STS 响应为空');
  }

  const credentials = data.credentials as Record<string, string> | undefined;
  if (!credentials?.accessKeyId || !credentials.accessKeySecret || !credentials.securityToken) {
    throw new Error(`STS credentials 字段不完整: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return {
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    stsToken: credentials.securityToken,
    expiration: credentials.expiration,
  };
}

export async function fetchStsCredentials(config: ErpOssConfig): Promise<StsCredentials> {
  const res = await fetch(config.stsTokenApi, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
      'bx-v': '2.5.11',
      cookie: config.cookie,
      referer: `${config.stsTokenApi.replace('/storage/oss/getStsToken', '')}/index.html`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`STS 请求失败 HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const raw = contentType.includes('application/json') ? await res.json() : await res.text();
  return parseStsResponse(raw);
}

export function createOssClient(config: ErpOssConfig, sts: StsCredentials): OSS {
  return new OSS({
    region: config.region,
    bucket: config.bucket,
    accessKeyId: sts.accessKeyId,
    accessKeySecret: sts.accessKeySecret,
    stsToken: sts.stsToken,
    secure: true,
  });
}

export async function uploadToErpOss(
  fileBuffer: Buffer,
  fileName: string,
  config: ErpOssConfig,
  maxRetries = 3,
): Promise<UploadResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sts = await fetchStsCredentials(config);
      const client = createOssClient(config, sts);
      const objectKey = buildObjectKey(fileName);
      const result = await client.put(objectKey, fileBuffer);

      return {
        objectKey,
        url: buildPublicUrl(objectKey, config.baseUrl),
        etag: result.res.headers.etag as string | undefined,
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw lastError;
}

export function loadConfigFromEnv(): ErpOssConfig {
  const cookie = process.env.ERP_COOKIE?.trim();
  if (!cookie) {
    throw new Error('请设置环境变量 ERP_COOKIE（从浏览器复制登录 Cookie）');
  }

  const baseUrl = (process.env.ERP_BASE_URL ?? 'https://erp.superboss.cc').replace(/\/$/, '');

  return {
    ...DEFAULT_CONFIG,
    cookie,
    stsTokenApi: `${baseUrl}/storage/oss/getStsToken`,
  };
}
