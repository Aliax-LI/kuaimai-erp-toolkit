import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';

import { normalizeErpBaseUrl } from '../../core/erp-login';
import type { ErpWebConfig } from '../../core/erp-web-client';

export function loadErpWebConfigFromEnv(): ErpWebConfig {
  const cookie = process.env.ERP_COOKIE?.trim();
  if (!cookie) {
    throw new Error('请设置环境变量 ERP_COOKIE（scripts/.env 或根目录 .env）');
  }

  const companyId = process.env.ERP_COMPANY_ID?.trim();
  if (!companyId) {
    throw new Error('请设置环境变量 ERP_COMPANY_ID（浏览器 Network 请求头 companyid）');
  }

  const baseUrl = normalizeErpBaseUrl(process.env.ERP_BASE_URL ?? DEFAULT_ERP_BASE_URL);

  return {
    baseUrl,
    cookie,
    companyId,
    accessToken: process.env.ERP_ACCESS_TOKEN?.trim() || undefined,
  };
}
