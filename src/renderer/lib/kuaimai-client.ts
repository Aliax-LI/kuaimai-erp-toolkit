import type { KuaimaiApi } from '../../preload/apis/build-api';

function getKuaimai(): KuaimaiApi {
  if (typeof window === 'undefined' || !window.kuaimai) {
    throw new Error('桌面 API 未就绪，请完全退出后重新启动应用');
  }
  return window.kuaimai;
}

export const kuaimai = {
  get auth() {
    const api = getKuaimai().auth;
    if (!api?.erpLogin) {
      throw new Error('登录 API 未加载，请完全退出后重新启动应用');
    }
    return api;
  },
  get config() {
    const api = getKuaimai().config;
    if (!api?.getApp) {
      throw new Error('配置 API 未加载，请完全退出后重新启动应用');
    }
    return api;
  },
  get upload() {
    const api = getKuaimai().upload;
    if (!api?.pickFile || !api?.erpOss) {
      throw new Error('上传 API 未加载，请完全退出后重新启动应用（需重建 preload）');
    }
    return api;
  },
  get debug() {
    const api = getKuaimai().debug;
    if (!api?.log) {
      throw new Error('调试 API 未加载，请完全退出后重新启动应用');
    }
    return api;
  },
  get skuImport() {
    const api = getKuaimai().skuImport;
    if (!api?.pickFile || !api?.preview || !api?.execute || !api?.listTasks || !api?.getTask) {
      throw new Error('建货号 API 未加载，请完全退出后重新启动应用');
    }
    return api;
  },
};

export function logRenderer(
  level: 'debug' | 'info' | 'warn' | 'error',
  scope: string,
  message: string,
  data?: unknown,
): void {
  try {
    void kuaimai.debug.log(level, scope, message, data);
  } catch {
    console[level === 'debug' ? 'log' : level](`[${scope}] ${message}`, data);
  }
}
