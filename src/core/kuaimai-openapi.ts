import { createHash, createHmac } from 'node:crypto';

export type KuaimaiOpenApiSignMethod = 'hmac' | 'md5' | 'hmac-sha256';

export interface KuaimaiOpenApiPayloadOptions {
  appKey: string;
  appSecret: string;
  session: string;
  method: string;
  businessParams?: Record<string, string>;
  timestamp?: string;
  version?: '1.0';
  format?: 'json';
  signMethod?: KuaimaiOpenApiSignMethod;
}

export interface KuaimaiOpenApiCredentials {
  appKey: string;
  appSecret: string;
  session: string;
}

export interface KuaimaiOpenApiClientOptions extends KuaimaiOpenApiCredentials {
  gateway?: string;
  signMethod?: KuaimaiOpenApiSignMethod;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_KUAIMAI_OPENAPI_GATEWAY = 'https://gw.superboss.cc/router';

export class KuaimaiOpenApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly traceId?: string,
    readonly solution?: string,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'KuaimaiOpenApiError';
  }
}

function normalizeBusinessParams(
  businessParams?: Record<string, string>,
): Record<string, string> {
  if (!businessParams) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(businessParams).filter(
      ([, value]) => value !== undefined && value !== null,
    ) as Array<[string, string]>,
  );
}

export function formatKuaimaiTimestamp(date = new Date()): string {
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  const hours = String(local.getUTCHours()).padStart(2, '0');
  const minutes = String(local.getUTCMinutes()).padStart(2, '0');
  const seconds = String(local.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function generateKuaimaiOpenApiSignature(
  params: Record<string, string>,
  secret: string,
  signMethod: KuaimaiOpenApiSignMethod = 'hmac',
): string {
  const sortedPairs = Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right, 'en'));

  const source = sortedPairs.map(([key, value]) => `${key}${value}`).join('');

  switch (signMethod) {
    case 'md5':
      return createHash('md5')
        .update(`${secret}${source}${secret}`, 'utf8')
        .digest('hex')
        .toUpperCase();
    case 'hmac-sha256':
      return createHmac('sha256', secret).update(source, 'utf8').digest('hex').toUpperCase();
    case 'hmac':
    default:
      return createHmac('md5', secret).update(source, 'utf8').digest('hex').toUpperCase();
  }
}

export function buildKuaimaiOpenApiPayload(
  options: KuaimaiOpenApiPayloadOptions,
): Record<string, string> {
  const signMethod = options.signMethod ?? 'hmac';
  const payload = {
    appKey: options.appKey,
    format: options.format ?? 'json',
    method: options.method,
    session: options.session,
    sign_method: signMethod,
    timestamp: options.timestamp ?? formatKuaimaiTimestamp(),
    version: options.version ?? '1.0',
    ...normalizeBusinessParams(options.businessParams),
  };

  return {
    ...payload,
    sign: generateKuaimaiOpenApiSignature(payload, options.appSecret, signMethod),
  };
}

export function createKuaimaiOpenApiClient(options: KuaimaiOpenApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const gateway = options.gateway ?? DEFAULT_KUAIMAI_OPENAPI_GATEWAY;
  const signMethod = options.signMethod ?? 'hmac';

  return {
    async post(
      method: string,
      businessParams?: Record<string, string>,
    ): Promise<Record<string, unknown>> {
      const payload = buildKuaimaiOpenApiPayload({
        appKey: options.appKey,
        appSecret: options.appSecret,
        session: options.session,
        method,
        businessParams,
        signMethod,
      });

      const response = await fetchImpl(gateway, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: new URLSearchParams(payload).toString(),
      });

      const rawText = await response.text();
      const parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      const success = parsed.success;
      if (!response.ok || success === false) {
        throw new KuaimaiOpenApiError(
          typeof parsed.msg === 'string' ? parsed.msg : `快麦开放平台请求失败 HTTP ${response.status}`,
          typeof parsed.code === 'string' ? parsed.code : undefined,
          typeof parsed.traceId === 'string' ? parsed.traceId : undefined,
          typeof parsed.solution === 'string' ? parsed.solution : undefined,
          parsed,
        );
      }

      return parsed;
    },
  };
}
