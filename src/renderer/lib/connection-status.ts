export interface SecretsMeta {
  erpCookie?: boolean;
  erpCompanyId?: boolean;
}

export function isErpConnected(meta: SecretsMeta): boolean {
  return Boolean(meta.erpCookie && meta.erpCompanyId);
}
