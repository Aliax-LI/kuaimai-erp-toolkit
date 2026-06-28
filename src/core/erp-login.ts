import { createHash, randomBytes } from 'node:crypto';

import {
  DEFAULT_ERP_BASE_URL,
  ERP_DEFAULT_USER_AGENT,
  ERP_DEVICE_COOKIE_NAME,
  ERP_DEVICE_ID_PREFIX,
  ERP_LOGIN_PAGE_PATH,
  ERP_LOGIN_PATH,
} from '@shared/constants/erp';

export interface ErpLoginCredentials {
  companyName: string;
  userName: string;
  password: string;
  validationCode?: string;
  phoneVerifyCode?: string;
  baseUrl?: string;
}

export interface ErpLoginSession {
  cookieHeader: string;
  accessToken?: string;
  message?: string;
}

export class ErpLoginError extends Error {
  constructor(
    message: string,
    readonly needsPhoneVerify = false,
  ) {
    super(message);
    this.name = 'ErpLoginError';
  }
}

type CookieJar = Map<string, string>;

const DEVICE_FINGERPRINT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** 与快麦 ERP 登录页一致：MD5(明文).toUpperCase()（salt 仅随表单提交，不参与本地加密） */
export function hashErpLoginPassword(plainPassword: string): string {
  return createHash('md5').update(plainPassword, 'utf8').digest('hex').toUpperCase();
}

export function generateDeviceFingerprint(length = 64): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += DEVICE_FINGERPRINT_ALPHABET[bytes[i] % DEVICE_FINGERPRINT_ALPHABET.length];
  }
  return result;
}

export function normalizeErpBaseUrl(baseUrl = DEFAULT_ERP_BASE_URL): string {
  return baseUrl.replace(/\/$/, '');
}

export function serializeCookieJar(jar: CookieJar): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

export function resolveErpAccessTokenFromCookie(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const name = trimmed.slice(0, eq).trim();
    if (name === 'accessToken' || name === 'access_token') {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return undefined;
}

export function parseSetCookieHeader(setCookie: string): { name: string; value: string } | null {
  const pair = setCookie.split(';')[0]?.trim();
  if (!pair) {
    return null;
  }
  const eq = pair.indexOf('=');
  if (eq <= 0) {
    return null;
  }
  return {
    name: pair.slice(0, eq).trim(),
    value: pair.slice(eq + 1).trim(),
  };
}

export function mergeSetCookies(jar: CookieJar, setCookies: string[]): void {
  for (const raw of setCookies) {
    const parsed = parseSetCookieHeader(raw);
    if (parsed) {
      jar.set(parsed.name, parsed.value);
    }
  }
}

export function extractSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function resolveDeviceFingerprint(jar: CookieJar): string {
  const fromNamedCookie = jar.get(ERP_DEVICE_COOKIE_NAME);
  if (fromNamedCookie) {
    return fromNamedCookie;
  }

  for (const [name, value] of jar.entries()) {
    if (name !== 'JSESSIONID' && value.length >= 32) {
      return value;
    }
  }

  const generated = generateDeviceFingerprint();
  jar.set(ERP_DEVICE_COOKIE_NAME, generated);
  return generated;
}

function buildLoginHeaders(baseUrl: string, cookieHeader: string): Record<string, string> {
  return {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'zh-CN,zh;q=0.9',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    cookie: cookieHeader,
    origin: baseUrl,
    referer: `${baseUrl}${ERP_LOGIN_PAGE_PATH}`,
    'user-agent': ERP_DEFAULT_USER_AGENT,
    'x-requested-with': 'XMLHttpRequest',
  };
}

function encodeFormBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

function parseLoginResponse(raw: string): {
  success: boolean;
  message?: string;
  needsPhoneVerify?: boolean;
  accessToken?: string;
} {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const payload =
      data.data && typeof data.data === 'object'
        ? (data.data as Record<string, unknown>)
        : undefined;
    const status = typeof payload?.status === 'string' ? payload.status : undefined;
    const message = typeof data.message === 'string' ? data.message : undefined;
    const accessToken =
      (typeof payload?.accessToken === 'string' && payload.accessToken) ||
      (typeof data.accessToken === 'string' && data.accessToken) ||
      undefined;

    if (status === 'login_verify_random') {
      return {
        success: false,
        needsPhoneVerify: true,
        message: '触发异地/设备安全验证，请填写手机验证码后重试，或在浏览器登录后手动粘贴 Cookie',
      };
    }

    if (status && status !== 'success' && status !== 'login_success') {
      return {
        success: false,
        message: message ?? `登录未完成（status=${status}）`,
      };
    }

    const result = data.result;

    if (result === 1 || result === '1' || result === true) {
      return { success: true, message, accessToken };
    }

    return {
      success: false,
      message: message ?? `登录失败（result=${String(result ?? 'unknown')}）`,
    };
  } catch {
    if (/登录成功|success/i.test(raw)) {
      return { success: true };
    }
    return { success: false, message: raw.slice(0, 300) || '登录响应无法解析' };
  }
}

export async function loginToErp(credentials: ErpLoginCredentials): Promise<ErpLoginSession> {
  const baseUrl = normalizeErpBaseUrl(credentials.baseUrl);
  const jar: CookieJar = new Map();

  const warmup = await fetch(`${baseUrl}${ERP_LOGIN_PAGE_PATH}`, {
    method: 'GET',
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': ERP_DEFAULT_USER_AGENT,
    },
    redirect: 'follow',
  });

  mergeSetCookies(jar, extractSetCookies(warmup));

  const deviceFingerprint = resolveDeviceFingerprint(jar);
  const salt = Date.now().toString();
  const passwordHash = hashErpLoginPassword(credentials.password);

  const body = encodeFormBody({
    companyName: credentials.companyName,
    userName: credentials.userName,
    password: passwordHash,
    salt,
    validationCode: credentials.validationCode ?? '',
    phoneVerifyCode: credentials.phoneVerifyCode ?? '',
    deviceId: `${ERP_DEVICE_ID_PREFIX}${deviceFingerprint}`,
  });

  const loginRes = await fetch(`${baseUrl}${ERP_LOGIN_PATH}`, {
    method: 'POST',
    headers: buildLoginHeaders(baseUrl, serializeCookieJar(jar)),
    body,
    redirect: 'manual',
  });

  mergeSetCookies(jar, extractSetCookies(loginRes));

  const responseText = await loginRes.text();
  const parsed = parseLoginResponse(responseText);

  if (!parsed.success) {
    throw new ErpLoginError(
      parsed.message ?? `登录失败 HTTP ${loginRes.status}`,
      parsed.needsPhoneVerify,
    );
  }

  if (!jar.has('JSESSIONID')) {
    throw new ErpLoginError(
      '未获取到 JSESSIONID 会话。请在浏览器完成登录后手动粘贴 Cookie，或填写手机验证码后重试',
      true,
    );
  }

  return {
    cookieHeader: serializeCookieJar(jar),
    accessToken: parsed.accessToken ?? resolveErpAccessTokenFromCookie(serializeCookieJar(jar)),
    message: parsed.message,
  };
}
