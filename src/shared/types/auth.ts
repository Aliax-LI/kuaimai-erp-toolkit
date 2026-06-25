export interface ErpLoginParams {
  companyName: string;
  userName: string;
  /** 明文密码，主进程加密后提交 */
  password: string;
  validationCode?: string;
  phoneVerifyCode?: string;
  /** 默认 https://erp.superboss.cc */
  baseUrl?: string;
}

export interface ErpLoginResult {
  success: boolean;
  message?: string;
  /** 需填写手机验证码后再次登录 */
  needsPhoneVerify?: boolean;
}
