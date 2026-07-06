export const APP_ROUTES = {
  WORKBENCH: '/workbench',
  HISTORY: '/history',
  CONFIG: '/config',
} as const;

export const CONFIG_TABS = ['erp', 'brands', 'accessories', 'rules'] as const;
export type ConfigTab = (typeof CONFIG_TABS)[number];

export const LEGACY_REDIRECTS: Record<string, string> = {
  '/tasks': APP_ROUTES.HISTORY,
  '/settings': `${APP_ROUTES.CONFIG}?tab=erp`,
  '/tools/sku-import': APP_ROUTES.WORKBENCH,
};

export function resolveLegacyRedirect(pathname: string): string | null {
  return LEGACY_REDIRECTS[pathname] ?? null;
}

export function parseConfigTab(value: string | null): ConfigTab {
  if (value === 'categories') {
    return 'rules';
  }
  if (value && (CONFIG_TABS as readonly string[]).includes(value)) {
    return value as ConfigTab;
  }
  return 'erp';
}

export const WORKBENCH_STEPS = ['import', 'create', 'result'] as const;
export type WorkbenchStep = (typeof WORKBENCH_STEPS)[number];

export const WORKBENCH_STEP_LABELS: Record<WorkbenchStep, string> = {
  import: '导入 Excel',
  create: '批量创建',
  result: '创建结果',
};
