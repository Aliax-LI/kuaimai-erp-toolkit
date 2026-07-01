import type { ErpWebConfig } from '../../core/erp-web-client';
import { normalizeErpBaseUrl } from '../../core/erp-login';
import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';

import { getAppSettings, getSecret } from './store';

export function getErpWebConfig(): ErpWebConfig {
  const cookie = getSecret('erpCookie')?.trim();
  if (!cookie) {
    throw new Error('请先在设置页配置 ERP Cookie');
  }

  const companyId = getSecret('erpCompanyId')?.trim();
  if (!companyId) {
    throw new Error('缺少 companyId。请在设置页填写（例如 140109）');
  }

  const { erpBaseUrl } = getAppSettings();

  return {
    baseUrl: normalizeErpBaseUrl(erpBaseUrl || DEFAULT_ERP_BASE_URL),
    cookie,
    companyId,
    accessToken: getSecret('erpAccessToken')?.trim() || undefined,
  };
}
