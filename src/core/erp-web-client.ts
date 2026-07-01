import {
  DEFAULT_ERP_BASE_URL,
  ERP_DEFAULT_MODULE_PATH,
  ERP_DEFAULT_USER_AGENT,
  ERP_ITEM_ADD_PATH,
  ERP_ITEM_ADD_PURE_SUITE_PATH,
  ERP_ITEM_BASE_UNIT_LIST_PATH,
  ERP_ITEM_CAT_SYS_LIST_PATH,
  ERP_ITEM_GET_DETAIL_PATH,
  ERP_ITEM_QUERY_LIST_V2_PATH,
  ERP_ITEM_QUERY_SINGLE_PATH,
  ERP_ITEM_SAVE_PATH,
} from '@shared/constants/erp';

import { normalizeErpBaseUrl } from './erp-login';

export interface ErpWebConfig {
  baseUrl: string;
  cookie: string;
  companyId: string;
  trackId?: string;
  modulePath?: string;
  /** 部分环境/脚本用；浏览器网页请求通常不需要 */
  accessToken?: string;
}

export interface ErpWebRequestOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  form?: Record<string, string | number | boolean | undefined>;
  json?: Record<string, unknown>;
}

export class ErpWebError extends Error {
  constructor(
    message: string,
    readonly resultCode?: number,
  ) {
    super(message);
    this.name = 'ErpWebError';
  }
}

const ACCESS_TOKEN_COOKIE_NAMES = ['accessToken', 'access_token', 'ACCESS_TOKEN'] as const;

export function parseCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    if (trimmed.slice(0, eq).trim() === name) {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return undefined;
}

export function resolveErpAccessToken(cookie: string, explicitToken?: string): string | undefined {
  const direct = explicitToken?.trim();
  if (direct) {
    return direct;
  }
  for (const name of ACCESS_TOKEN_COOKIE_NAMES) {
    const fromCookie = parseCookieValue(cookie, name);
    if (fromCookie) {
      return fromCookie;
    }
  }
  return undefined;
}

export function generateErpTrackId(now = Date.now()): string {
  const suffix = Math.floor(Math.random() * 100_000);
  return `trackid${now}_${suffix}`;
}

function buildErpWebHeaders(config: ErpWebConfig, contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    cookie: config.cookie,
    companyid: config.companyId,
    trackid: config.trackId ?? generateErpTrackId(),
    'module-path': config.modulePath ?? ERP_DEFAULT_MODULE_PATH,
    origin: normalizeErpBaseUrl(config.baseUrl || DEFAULT_ERP_BASE_URL),
    referer: `${normalizeErpBaseUrl(config.baseUrl || DEFAULT_ERP_BASE_URL)}/index.html`,
    'user-agent': ERP_DEFAULT_USER_AGENT,
    'bx-v': '2.5.11',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
  };
  if (contentType) {
    headers['content-type'] = contentType;
  }
  const accessToken = resolveErpAccessToken(config.cookie, config.accessToken);
  if (accessToken) {
    headers.accessToken = accessToken;
  }
  return headers;
}

function buildQueryString(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

function buildFormBody(form: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.set(key, String(value));
  }
  return params.toString();
}

function parseResultCode(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function assertErpBusinessSuccess(body: Record<string, unknown>, action: string): unknown {
  const result = parseResultCode(body.result);
  if (result === 1) {
    return body.data;
  }

  const message =
    (typeof body.message === 'string' && body.message) ||
    (typeof body.msg === 'string' && body.msg) ||
    `${action}失败（result=${String(result ?? 'unknown')}）`;

  if (result === 901) {
    throw new ErpWebError(
      `${message}。请确认 ERP Cookie 与 companyId 有效，必要时重新登录或从浏览器 Network 复制`,
      result,
    );
  }

  throw new ErpWebError(message, result);
}

export async function erpWebRequest<T = unknown>(
  config: ErpWebConfig,
  options: ErpWebRequestOptions,
): Promise<T> {
  const baseUrl = normalizeErpBaseUrl(config.baseUrl || DEFAULT_ERP_BASE_URL);
  const query = options.query ?? {};
  const url = `${baseUrl}${options.path}${buildQueryString(query)}`;

  let body: string | undefined;
  let contentType: string | undefined;

  if (options.form) {
    body = buildFormBody(options.form);
    contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
  } else if (options.json) {
    body = JSON.stringify(options.json);
    contentType = 'application/json;charset=UTF-8';
  }

  const response = await fetch(url, {
    method: options.method,
    headers: buildErpWebHeaders(config, contentType),
    body,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new ErpWebError(`ERP 请求失败 HTTP ${response.status}: ${responseText.slice(0, 300)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new ErpWebError(`ERP 响应无法解析为 JSON: ${responseText.slice(0, 300)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ErpWebError('ERP 响应格式异常');
  }

  const data = assertErpBusinessSuccess(parsed as Record<string, unknown>, options.path);
  return data as T;
}

export function createErpWebClient(config: ErpWebConfig) {
  return {
    queryListV2(form: Record<string, string | number | boolean | undefined>) {
      return erpWebRequest<Record<string, unknown>>(config, {
        method: 'POST',
        path: ERP_ITEM_QUERY_LIST_V2_PATH,
        form,
      });
    },
    querySingle(query: Record<string, string | number | boolean | undefined>) {
      return erpWebRequest<unknown>(config, {
        method: 'GET',
        path: ERP_ITEM_QUERY_SINGLE_PATH,
        query,
      });
    },
    listSysCategories() {
      return erpWebRequest<unknown>(config, {
        method: 'GET',
        path: ERP_ITEM_CAT_SYS_LIST_PATH,
        query: { api_name: 'item_cat_sys_list' },
      });
    },
    getItemDetail(sysItemId: number) {
      return erpWebRequest<unknown>(config, {
        method: 'GET',
        path: ERP_ITEM_GET_DETAIL_PATH,
        query: { sysItemId },
      });
    },
    saveItem(body: Record<string, unknown>) {
      return erpWebRequest<Record<string, unknown>>(config, {
        method: 'POST',
        path: ERP_ITEM_SAVE_PATH,
        json: body,
      });
    },
    addItem(body: Record<string, unknown>) {
      return erpWebRequest<Record<string, unknown>>(config, {
        method: 'POST',
        path: ERP_ITEM_ADD_PATH,
        json: { ...body, api_name: body.api_name ?? 'item_add' },
      });
    },
    addPureSuite(body: Record<string, unknown>) {
      return erpWebRequest<Record<string, unknown>>(config, {
        method: 'POST',
        path: ERP_ITEM_ADD_PURE_SUITE_PATH,
        json: { ...body, api_name: body.api_name ?? 'item_addPureSuite' },
      });
    },
    listBaseUnits(query: Record<string, string | number | boolean | undefined> = {}) {
      return erpWebRequest<Record<string, unknown>>(config, {
        method: 'GET',
        path: ERP_ITEM_BASE_UNIT_LIST_PATH,
        query: {
          pageNo: 1,
          pageSize: 30,
          api_name: 'item_base_unit_list',
          ...query,
        },
      });
    },
  };
}

export type ErpWebClient = ReturnType<typeof createErpWebClient>;
