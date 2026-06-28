export const IPC_CHANNELS = {
  CONFIG_GET_APP: 'config:get-app',
  CONFIG_SET_APP: 'config:set-app',
  CONFIG_GET_SECRETS_META: 'config:get-secrets-meta',
  CONFIG_SET_SECRETS: 'config:set-secrets',
  UPLOAD_PICK_FILE: 'upload:pick-file',
  UPLOAD_ERP_OSS: 'upload:erp-oss',
  AUTH_ERP_LOGIN: 'auth:erp-login',
  DEBUG_LOG: 'debug:log',
  SKU_IMPORT_PICK_FILE: 'sku-import:pick-file',
  SKU_IMPORT_PREVIEW: 'sku-import:preview',
  SKU_IMPORT_LIST_TASKS: 'sku-import:list-tasks',
  SKU_IMPORT_GET_TASK: 'sku-import:get-task',
  SKU_IMPORT_DELETE_TASK: 'sku-import:delete-task',
  SKU_IMPORT_CLEAR_ALL_TASKS: 'sku-import:clear-all-tasks',
  SKU_IMPORT_EXECUTE: 'sku-import:execute',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
