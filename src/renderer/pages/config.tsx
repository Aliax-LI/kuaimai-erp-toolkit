import { useEffect, useMemo, useState } from 'react';
import { Hash, Package, Pen, Plus, PlugZap, Save, Search, Tag, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Modal } from '@/components/shared/modal';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SECRETS_UPDATED_EVENT } from '@/hooks/use-connection-status';
import { useSkuImportConfig } from '@/hooks/use-sku-import-config';
import { useToast } from '@/hooks/use-toast';
import { kuaimai } from '@/lib/kuaimai-client';
import {
  BUNDLE_CATEGORY_NAME,
  SKU_CODE_PREFIX,
  SKU_CODE_TEST_PREFIX,
  STICKER_CATEGORY_NAME,
  STICKER_UNIT_NAME,
} from '@/lib/sku-import-display-constants';
import { cn } from '@/lib/utils';
import { CONFIG_TABS, parseConfigTab, type ConfigTab } from '@shared/constants/navigation';
import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';
import type { AccessoryConfig, BrandConfig } from '@shared/schemas/sku-import-config';
import type { ErpConnectionTestResult } from '@shared/types/erp-connection';

const TAB_META: Record<ConfigTab, { label: string; icon: typeof Tag; description: string }> = {
  erp: { label: 'ERP 连接', icon: Tag, description: 'Cookie 与 ERP 地址' },
  brands: { label: '品牌配置', icon: Tag, description: '管理品牌编码与简写' },
  accessories: { label: '配件配置', icon: Package, description: '管理配件 SKU 编码' },
  rules: { label: '编码规则', icon: Hash, description: '货号生成规则' },
  categories: { label: '分类配置', icon: Tag, description: '贴纸与套装分类' },
};

const EMPTY_BRAND: BrandConfig = { name: '', code: '', shortName: '', enabled: true };
const EMPTY_ACCESSORY: AccessoryConfig = { name: '', skuCode: '', brand: '', enabled: true };

export function ConfigPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const tab = parseConfigTab(searchParams.get('tab'));

  const [erpCookieSet, setErpCookieSet] = useState(false);
  const [erpCompanyIdSet, setErpCompanyIdSet] = useState(false);
  const [erpCookie, setErpCookie] = useState('');
  const [erpCompanyId, setErpCompanyId] = useState('');
  const [erpBaseUrl, setErpBaseUrl] = useState(DEFAULT_ERP_BASE_URL);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ErpConnectionTestResult | null>(null);

  const { config, loading, saving: catalogSaving, saveBrands, saveAccessories } =
    useSkuImportConfig();
  const [brandSearch, setBrandSearch] = useState('');
  const [accessorySearch, setAccessorySearch] = useState('');

  const [brandDraft, setBrandDraft] = useState<{ index: number | null; value: BrandConfig } | null>(
    null,
  );
  const [accessoryDraft, setAccessoryDraft] = useState<{
    index: number | null;
    value: AccessoryConfig;
  } | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    void kuaimai.config.getApp().then((app) => {
      setErpBaseUrl(app.erpBaseUrl || DEFAULT_ERP_BASE_URL);
    });
    void kuaimai.config.getSecretsMeta().then((meta) => {
      setErpCookieSet(Boolean(meta.erpCookie));
      setErpCompanyIdSet(Boolean(meta.erpCompanyId));
    });
  }, []);

  const setTab = (next: ConfigTab) => {
    setSearchParams({ tab: next });
  };

  const handleTestErp = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await kuaimai.config.testErpConnection({
        erpCookie: erpCookie.trim() || undefined,
        erpCompanyId: erpCompanyId.trim() || undefined,
        erpBaseUrl: erpBaseUrl.trim() || undefined,
      });
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveErp = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const secretPatch: Record<string, string> = {};
      if (erpCookie.trim()) {
        secretPatch.erpCookie = erpCookie.trim();
      }
      if (erpCompanyId.trim()) {
        secretPatch.erpCompanyId = erpCompanyId.trim();
      }
      if (Object.keys(secretPatch).length > 0) {
        await kuaimai.config.setSecrets(secretPatch);
        if (secretPatch.erpCookie) {
          setErpCookie('');
          setErpCookieSet(true);
        }
        if (secretPatch.erpCompanyId) {
          setErpCompanyId('');
          setErpCompanyIdSet(true);
        }
      }
      await kuaimai.config.setApp({ erpBaseUrl: erpBaseUrl.trim() || DEFAULT_ERP_BASE_URL });
      setMessage('已保存，敏感项界面不会回显明文');
      window.dispatchEvent(new Event(SECRETS_UPDATED_EVENT));
    } finally {
      setSaving(false);
    }
  };

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return config.brands.map((brand, index) => ({ brand, index }));
    return config.brands
      .map((brand, index) => ({ brand, index }))
      .filter(
        ({ brand }) =>
          brand.name.toLowerCase().includes(q) || brand.code.toLowerCase().includes(q),
      );
  }, [brandSearch, config.brands]);

  const filteredAccessories = useMemo(() => {
    const q = accessorySearch.trim().toLowerCase();
    if (!q) return config.accessories.map((accessory, index) => ({ accessory, index }));
    return config.accessories
      .map((accessory, index) => ({ accessory, index }))
      .filter(
        ({ accessory }) =>
          accessory.name.toLowerCase().includes(q) ||
          accessory.skuCode.toLowerCase().includes(q) ||
          accessory.brand.toLowerCase().includes(q),
      );
  }, [accessorySearch, config.accessories]);

  const commitBrand = async () => {
    if (!brandDraft) return;
    const value = brandDraft.value;
    if (!value.name.trim() || !value.code.trim()) {
      setDraftError('品牌名称与编码不能为空');
      return;
    }
    const next = [...config.brands];
    if (brandDraft.index === null) {
      next.push(value);
    } else {
      next[brandDraft.index] = value;
    }
    try {
      await saveBrands(next);
      setBrandDraft(null);
      setDraftError(null);
      toast('品牌已保存');
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeBrand = async (index: number) => {
    const next = config.brands.filter((_, i) => i !== index);
    await saveBrands(next);
    toast('品牌已删除');
  };

  const toggleBrand = async (index: number) => {
    const next = config.brands.map((brand, i) =>
      i === index ? { ...brand, enabled: !brand.enabled } : brand,
    );
    await saveBrands(next);
  };

  const commitAccessory = async () => {
    if (!accessoryDraft) return;
    const value = accessoryDraft.value;
    if (!value.name.trim() || !value.skuCode.trim()) {
      setDraftError('配件名称与 SKU 编码不能为空');
      return;
    }
    const next = [...config.accessories];
    if (accessoryDraft.index === null) {
      next.push(value);
    } else {
      next[accessoryDraft.index] = value;
    }
    try {
      await saveAccessories(next);
      setAccessoryDraft(null);
      setDraftError(null);
      toast('配件已保存');
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeAccessory = async (index: number) => {
    const next = config.accessories.filter((_, i) => i !== index);
    await saveAccessories(next);
    toast('配件已删除');
  };

  const toggleAccessory = async (index: number) => {
    const next = config.accessories.map((accessory, i) =>
      i === index ? { ...accessory, enabled: !accessory.enabled } : accessory,
    );
    await saveAccessories(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-medium text-charcoal">配置管理</h2>
          <p className="mt-1 text-sm text-brown-soft">{TAB_META[tab].description}</p>
        </div>
        {tab === 'erp' && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleTestErp()}
              disabled={testing || saving}
            >
              <PlugZap className="h-4 w-4" />
              {testing ? '测试中…' : '测试'}
            </Button>
            <Button type="button" onClick={() => void handleSaveErp()} disabled={saving || testing}>
              <Save className="h-4 w-4" />
              {saving ? '保存中…' : '保存配置'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex w-fit items-center gap-1 rounded-lg bg-cream-warm p-0.5">
        {CONFIG_TABS.map((item) => {
          const meta = TAB_META[item];
          const Icon = meta.icon;
          return (
            <button
              key={item}
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                tab === item ? 'bg-charcoal text-cream' : 'text-brown-soft hover:text-charcoal',
              )}
              onClick={() => setTab(item)}
            >
              <Icon className="h-4 w-4" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {tab === 'erp' && (
        <div className="space-y-4 rounded-xl border border-beige bg-cream-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={erpCookieSet ? 'success' : 'neutral'}>
              Cookie {erpCookieSet ? '已配置' : '未配置'}
            </StatusBadge>
            <StatusBadge tone={erpCompanyIdSet ? 'success' : 'neutral'}>
              companyId {erpCompanyIdSet ? '已配置' : '未配置'}
            </StatusBadge>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-charcoal">ERP Cookie</span>
            <Input
              type="password"
              placeholder={erpCookieSet ? '已保存，输入新值可覆盖' : '从浏览器复制登录 Cookie'}
              value={erpCookie}
              onChange={(event) => setErpCookie(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-charcoal">companyId</span>
            <Input
              placeholder={
                erpCompanyIdSet ? '已保存，输入新值可覆盖' : '140109（Network 请求头 companyid）'
              }
              value={erpCompanyId}
              onChange={(event) => setErpCompanyId(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-charcoal">ERP 地址</span>
            <Input
              value={erpBaseUrl}
              onChange={(event) => setErpBaseUrl(event.target.value)}
              autoComplete="off"
            />
          </label>
          {message && <p className="text-sm text-brown-soft">{message}</p>}
          {testResult && (
            <p
              className={
                testResult.ok ? 'text-sm text-status-success' : 'text-sm text-status-danger'
              }
            >
              {testResult.message}
            </p>
          )}
        </div>
      )}

      {tab === 'brands' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-soft" />
              <Input
                className="pl-9"
                placeholder="搜索品牌..."
                value={brandSearch}
                onChange={(event) => setBrandSearch(event.target.value)}
              />
            </div>
            <Button
              variant="dark"
              className="px-3 py-2"
              onClick={() => {
                setDraftError(null);
                setBrandDraft({ index: null, value: { ...EMPTY_BRAND } });
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              新增品牌
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-beige bg-cream-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-cream/50">
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">品牌名称</th>
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">品牌编码</th>
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">名称简写</th>
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">状态</th>
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.map(({ brand, index }) => (
                  <tr key={index} className="border-b border-beige/50 hover:bg-cream-warm/30">
                    <td className="px-4 py-3 font-medium">{brand.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{brand.code}</td>
                    <td className="px-4 py-3">{brand.shortName || '—'}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => void toggleBrand(index)}>
                        <StatusBadge tone={brand.enabled ? 'success' : 'neutral'}>
                          {brand.enabled ? '启用' : '停用'}
                        </StatusBadge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-brown-soft transition-colors hover:text-amber"
                          onClick={() => {
                            setDraftError(null);
                            setBrandDraft({ index, value: { ...brand } });
                          }}
                        >
                          <Pen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="text-brown-soft transition-colors hover:text-status-danger"
                          onClick={() => void removeBrand(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filteredBrands.length === 0 && (
              <div className="py-12 text-center text-brown-soft">暂无品牌，点击「新增品牌」添加</div>
            )}
          </div>
        </div>
      )}

      {tab === 'accessories' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-soft" />
              <Input
                className="pl-9"
                placeholder="搜索配件..."
                value={accessorySearch}
                onChange={(event) => setAccessorySearch(event.target.value)}
              />
            </div>
            <Button
              variant="dark"
              className="px-3 py-2"
              onClick={() => {
                setDraftError(null);
                setAccessoryDraft({ index: null, value: { ...EMPTY_ACCESSORY } });
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              新增配件
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-beige bg-cream-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-cream/50">
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">配件名称</th>
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">SKU 编码</th>
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">所属品牌</th>
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">状态</th>
                  <th className="px-4 py-3 text-left font-medium text-brown-soft">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccessories.map(({ accessory, index }) => (
                  <tr key={index} className="border-b border-beige/50 hover:bg-cream-warm/30">
                    <td className="px-4 py-3 font-medium">{accessory.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{accessory.skuCode}</td>
                    <td className="px-4 py-3">{accessory.brand || '—'}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => void toggleAccessory(index)}>
                        <StatusBadge tone={accessory.enabled ? 'success' : 'neutral'}>
                          {accessory.enabled ? '启用' : '停用'}
                        </StatusBadge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-brown-soft transition-colors hover:text-amber"
                          onClick={() => {
                            setDraftError(null);
                            setAccessoryDraft({ index, value: { ...accessory } });
                          }}
                        >
                          <Pen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="text-brown-soft transition-colors hover:text-status-danger"
                          onClick={() => void removeAccessory(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filteredAccessories.length === 0 && (
              <div className="py-12 text-center text-brown-soft">暂无配件，点击「新增配件」添加</div>
            )}
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="grid gap-3 rounded-xl border border-beige bg-cream-white p-5 shadow-sm md:grid-cols-2">
          {[
            ['货号前缀', SKU_CODE_PREFIX],
            ['测试前缀', SKU_CODE_TEST_PREFIX],
            ['贴纸分类', STICKER_CATEGORY_NAME],
            ['套装分类', BUNDLE_CATEGORY_NAME],
            ['贴纸单位', STICKER_UNIT_NAME],
          ].map(([label, value]) => (
            <label key={label} className="space-y-1">
              <span className="text-sm text-brown-soft">{label}</span>
              <Input readOnly value={value} />
            </label>
          ))}
        </div>
      )}

      {tab === 'categories' && (
        <div className="rounded-xl border border-beige bg-cream-white p-12 text-center text-brown-soft">
          分类配置 UI 外壳
          <div className="mt-4">
            <Button variant="dark" onClick={() => toast('即将支持')}>
              新增分类
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={brandDraft !== null}
        title={brandDraft?.index === null ? '新增品牌' : '编辑品牌'}
        onClose={() => {
          setBrandDraft(null);
          setDraftError(null);
        }}
      >
        {brandDraft && (
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-charcoal">品牌名称</span>
              <Input
                value={brandDraft.value.name}
                onChange={(event) =>
                  setBrandDraft({
                    ...brandDraft,
                    value: { ...brandDraft.value, name: event.target.value },
                  })
                }
                placeholder="例如 wkau"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-charcoal">品牌编码</span>
              <Input
                value={brandDraft.value.code}
                onChange={(event) =>
                  setBrandDraft({
                    ...brandDraft,
                    value: { ...brandDraft.value, code: event.target.value },
                  })
                }
                placeholder="例如 39"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-charcoal">名称简写</span>
              <Input
                value={brandDraft.value.shortName}
                onChange={(event) =>
                  setBrandDraft({
                    ...brandDraft,
                    value: { ...brandDraft.value, shortName: event.target.value },
                  })
                }
                placeholder="例如 W"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={brandDraft.value.enabled}
                onChange={(event) =>
                  setBrandDraft({
                    ...brandDraft,
                    value: { ...brandDraft.value, enabled: event.target.checked },
                  })
                }
              />
              启用
            </label>
            {draftError && <p className="text-sm text-status-danger">{draftError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setBrandDraft(null);
                  setDraftError(null);
                }}
              >
                取消
              </Button>
              <Button onClick={() => void commitBrand()} disabled={catalogSaving}>
                {catalogSaving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={accessoryDraft !== null}
        title={accessoryDraft?.index === null ? '新增配件' : '编辑配件'}
        onClose={() => {
          setAccessoryDraft(null);
          setDraftError(null);
        }}
      >
        {accessoryDraft && (
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-charcoal">配件名称</span>
              <Input
                value={accessoryDraft.value.name}
                onChange={(event) =>
                  setAccessoryDraft({
                    ...accessoryDraft,
                    value: { ...accessoryDraft.value, name: event.target.value },
                  })
                }
                placeholder="例如 补色膏"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-charcoal">SKU 编码</span>
              <Input
                value={accessoryDraft.value.skuCode}
                onChange={(event) =>
                  setAccessoryDraft({
                    ...accessoryDraft,
                    value: { ...accessoryDraft.value, skuCode: event.target.value },
                  })
                }
                placeholder="例如 BSG01"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-charcoal">所属品牌</span>
              <Input
                value={accessoryDraft.value.brand}
                onChange={(event) =>
                  setAccessoryDraft({
                    ...accessoryDraft,
                    value: { ...accessoryDraft.value, brand: event.target.value },
                  })
                }
                placeholder="例如 wkau（可留空）"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={accessoryDraft.value.enabled}
                onChange={(event) =>
                  setAccessoryDraft({
                    ...accessoryDraft,
                    value: { ...accessoryDraft.value, enabled: event.target.checked },
                  })
                }
              />
              启用
            </label>
            {draftError && <p className="text-sm text-status-danger">{draftError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAccessoryDraft(null);
                  setDraftError(null);
                }}
              >
                取消
              </Button>
              <Button onClick={() => void commitAccessory()} disabled={catalogSaving}>
                {catalogSaving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
