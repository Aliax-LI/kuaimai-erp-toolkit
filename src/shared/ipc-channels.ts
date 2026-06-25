export const IPC_CHANNELS = {
  CONFIG_GET_APP: 'config:get-app',
  CONFIG_SET_APP: 'config:set-app',
  CONFIG_GET_SECRETS_META: 'config:get-secrets-meta',
  CONFIG_SET_SECRETS: 'config:set-secrets',
  UPLOAD_PICK_FILE: 'upload:pick-file',
  UPLOAD_ERP_OSS: 'upload:erp-oss',
  AUTH_ERP_LOGIN: 'auth:erp-login',
  DEBUG_LOG: 'debug:log',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
