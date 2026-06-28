import type { ErpOssConfig } from '../../core/erp-oss-uploader';
import { normalizeErpBaseUrl } from '../../core/erp-login';
import { DEFAULT_ERP_BASE_URL, ERP_STS_TOKEN_PATH } from '@shared/constants/erp';

import { getAppSettings, getSecret } from './store';

const DEFAULT_ERP_OSS_CONFIG: Omit<ErpOssConfig, 'cookie' | 'stsTokenApi'> = {
  region: 'oss-cn-hangzhou',
  bucket: 'erp-storage-img',
  baseUrl: 'https://erp-storage-img.oss-cn-hangzhou.aliyuncs.com',
};

export function getErpOssConfig(): ErpOssConfig {
  const cookie = getSecret('erpCookie')?.trim();
  if (!cookie) {
    throw new Error('请先在设置页配置 ERP Cookie');
  }

  const { erpBaseUrl } = getAppSettings();
  const baseUrl = normalizeErpBaseUrl(erpBaseUrl || DEFAULT_ERP_BASE_URL);

  return {
    ...DEFAULT_ERP_OSS_CONFIG,
    cookie,
    stsTokenApi: `${baseUrl}${ERP_STS_TOKEN_PATH}`,
  };
}
