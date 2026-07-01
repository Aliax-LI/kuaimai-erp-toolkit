import { ErpLoginError, loginToErp, resolveErpAccessTokenFromCookie } from '../../core/erp-login';
import type { ErpLoginParams, ErpLoginResult } from '@shared/types/auth';

import { logger } from './logger';
import { setSecrets } from './store';

export async function loginErpAndSaveCookie(params: ErpLoginParams): Promise<ErpLoginResult> {
  logger.info('auth', 'erp login start', {
    companyName: params.companyName.trim(),
    userName: params.userName.trim(),
    hasPhoneVerifyCode: Boolean(params.phoneVerifyCode),
  });

  try {
    const session = await loginToErp({
      companyName: params.companyName.trim(),
      userName: params.userName.trim(),
      password: params.password,
      validationCode: params.validationCode,
      phoneVerifyCode: params.phoneVerifyCode,
      baseUrl: params.baseUrl,
    });

    const secrets: Record<string, string> = { erpCookie: session.cookieHeader };
    const accessToken =
      session.accessToken ?? resolveErpAccessTokenFromCookie(session.cookieHeader);
    if (accessToken) {
      secrets.erpAccessToken = accessToken;
    }
    setSecrets(secrets);
    logger.info('auth', 'erp login success, cookie saved', {
      hasAccessToken: Boolean(accessToken),
    });

    return {
      success: true,
      message:
        session.message ??
        (accessToken
          ? '登录成功，Cookie 与 accessToken 已保存'
          : '登录成功，Cookie 已保存。若建货号预演失败，请在设置页补充 accessToken'),
    };
  } catch (err) {
    if (err instanceof ErpLoginError) {
      logger.warn('auth', 'erp login pending or failed', {
        needsPhoneVerify: err.needsPhoneVerify,
        message: err.message,
      });
      return {
        success: false,
        needsPhoneVerify: err.needsPhoneVerify,
        message: err.message,
      };
    }
    logger.error('auth', 'erp login error', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
