import { useCallback, useEffect, useState } from 'react';

import { kuaimai } from '@/lib/kuaimai-client';
import { logRenderer } from '@/lib/kuaimai-client';
import {
  DEFAULT_SKU_IMPORT_CONFIG,
  type AccessoryConfig,
  type BrandConfig,
  type SkuImportConfig,
  type SkuImportRules,
} from '@shared/schemas/sku-import-config';

export function useSkuImportConfig() {
  const [config, setConfig] = useState<SkuImportConfig>(DEFAULT_SKU_IMPORT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await kuaimai.skuImport.getConfig();
      setConfig(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch((err) => {
      logRenderer('error', 'config', 'load sku-import config failed', { error: String(err) });
    });
  }, [refresh]);

  const persist = useCallback(async (next: SkuImportConfig) => {
    setSaving(true);
    try {
      const saved = await kuaimai.skuImport.setConfig(next);
      setConfig(saved);
      return saved;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveBrands = useCallback(
    (brands: BrandConfig[]) => persist({ ...config, brands }),
    [config, persist],
  );

  const saveAccessories = useCallback(
    (accessories: AccessoryConfig[]) => persist({ ...config, accessories }),
    [config, persist],
  );

  const saveRules = useCallback(
    (rules: SkuImportRules) => persist({ ...config, rules }),
    [config, persist],
  );

  return { config, loading, saving, refresh, saveBrands, saveAccessories, saveRules };
}
