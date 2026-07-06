import { createErpWebClient, type ErpWebConfig } from '../../core/erp-web-client';
import { normalizeErpBaseUrl } from '../../core/erp-login';
import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';
import type {
  ErpConnectionTestInput,
  ErpConnectionTestResult,
} from '@shared/types/erp-connection';

import { getAppSettings, getSecret } from './store';

function resolveTestConfig(
  input: ErpConnectionTestInput = {},
): { error: string } | { config: ErpWebConfig } {
  const cookie = input.erpCookie?.trim() || getSecret('erpCookie')?.trim();
  if (!cookie) {
    return { error: '请先填写或保存 ERP Cookie' };
  }

  const companyId = input.erpCompanyId?.trim() || getSecret('erpCompanyId')?.trim();
  if (!companyId) {
    return { error: '请先填写或保存公司ID' };
  }

  const { erpBaseUrl } = getAppSettings();
  const baseUrl = normalizeErpBaseUrl(
    input.erpBaseUrl?.trim() || erpBaseUrl || DEFAULT_ERP_BASE_URL,
  );

  return {
    config: {
      baseUrl,
      cookie,
      companyId,
      accessToken: getSecret('erpAccessToken')?.trim() || undefined,
    },
  };
}

export async function testErpConnection(
  input: ErpConnectionTestInput = {},
): Promise<ErpConnectionTestResult> {
  const resolved = resolveTestConfig(input);
  if ('error' in resolved) {
    return { ok: false, message: resolved.error };
  }

  try {
    const client = createErpWebClient(resolved.config);
    await client.listBaseUnits({ pageNo: 1, pageSize: 1 });
    return { ok: true, message: 'ERP 连接成功' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
