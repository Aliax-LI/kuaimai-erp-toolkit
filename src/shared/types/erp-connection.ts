export interface ErpConnectionTestInput {
  erpCookie?: string;
  erpCompanyId?: string;
  erpBaseUrl?: string;
}

export interface ErpConnectionTestResult {
  ok: boolean;
  message: string;
}
