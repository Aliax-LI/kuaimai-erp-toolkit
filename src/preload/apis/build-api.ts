import { authApi, type AuthApi } from './auth';
import { configApi, type ConfigApi } from './config';
import { debugApi, type DebugApi } from './debug';
import { skuImportApi, type SkuImportApi } from './sku-import';
import { uploadApi, type UploadApi } from './upload';

export interface KuaimaiApi {
  auth: AuthApi;
  config: ConfigApi;
  debug: DebugApi;
  upload: UploadApi;
  skuImport: SkuImportApi;
}

export function buildKuaimaiApi(): KuaimaiApi {
  return {
    auth: authApi,
    config: configApi,
    debug: debugApi,
    upload: uploadApi,
    skuImport: skuImportApi,
  };
}
