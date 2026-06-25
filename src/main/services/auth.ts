import { ErpLoginError, loginToErp } from '../../core/erp-login';
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

    setSecrets({ erpCookie: session.cookieHeader });
    logger.info('auth', 'erp login success, cookie saved');

    return {
      success: true,
      message: session.message ?? '登录成功，Cookie 已保存',
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
