import { useCallback, useEffect, useState } from 'react';

import { isErpConnected, type SecretsMeta } from '@/lib/connection-status';
import { kuaimai } from '@/lib/kuaimai-client';

export const SECRETS_UPDATED_EVENT = 'kuaimai:secrets-updated';

export function useConnectionStatus() {
  const [meta, setMeta] = useState<SecretsMeta>({});

  const refresh = useCallback(async () => {
    const next = await kuaimai.config.getSecretsMeta();
    setMeta(next);
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => {
      void refresh();
    };
    window.addEventListener(SECRETS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(SECRETS_UPDATED_EVENT, handler);
  }, [refresh]);

  return { connected: isErpConnected(meta), refresh };
}
