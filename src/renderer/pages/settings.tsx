import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Monitor, Moon, Palette } from 'lucide-react';

import { SettingsLayout } from '@/components/layout/settings-layout/SettingsLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/hooks/use-theme';
import { kuaimai } from '@/lib/kuaimai-client';
import { DEFAULT_ERP_BASE_URL } from '@shared/constants/erp';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [erpCookieSet, setErpCookieSet] = useState(false);
  const [erpCompanyIdSet, setErpCompanyIdSet] = useState(false);
  const [erpCookie, setErpCookie] = useState('');
  const [erpCompanyId, setErpCompanyId] = useState('');
  const [erpBaseUrl, setErpBaseUrl] = useState(DEFAULT_ERP_BASE_URL);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void kuaimai.config.getApp().then((app) => {
      setErpBaseUrl(app.erpBaseUrl || DEFAULT_ERP_BASE_URL);
    });
    void kuaimai.config.getSecretsMeta().then((meta) => {
      setErpCookieSet(Boolean(meta.erpCookie));
      setErpCompanyIdSet(Boolean(meta.erpCompanyId));
    });
  }, []);

  const systemThemeEnabled = theme === 'system';

  const handleSave = async () => {
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
    } finally {
      setSaving(false);
    }
  };

  const sections = useMemo(
    () => [
      {
        id: 'erp',
        label: 'ERP 连接',
        description: 'Cookie 与地址',
        icon: KeyRound,
        header: {
          title: '快麦 ERP 连接',
          description: '从浏览器复制 Cookie 与 companyId，敏感项加密存储',
          action: (
            <div className="flex gap-2">
              <Badge variant={erpCookieSet ? 'default' : 'secondary'}>
                Cookie {erpCookieSet ? '已配置' : '未配置'}
              </Badge>
              <Badge variant={erpCompanyIdSet ? 'default' : 'secondary'}>
                companyId {erpCompanyIdSet ? '已配置' : '未配置'}
              </Badge>
            </div>
          ),
        },
        body: (
          <FieldSet>
            <FieldLegend variant="label" className="sr-only">
              ERP 连接设置
            </FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="erp-cookie">ERP Cookie</FieldLabel>
                <Input
                  id="erp-cookie"
                  type="password"
                  placeholder={erpCookieSet ? '已保存，输入新值可覆盖' : '从浏览器复制登录 Cookie'}
                  value={erpCookie}
                  onChange={(e) => setErpCookie(e.target.value)}
                  autoComplete="off"
                />
                <FieldDescription>仅保存在本机 userData 目录，不会上传到云端</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="erp-company-id">companyId</FieldLabel>
                <Input
                  id="erp-company-id"
                  value={erpCompanyId}
                  onChange={(e) => setErpCompanyId(e.target.value)}
                  autoComplete="off"
                  placeholder={
                    erpCompanyIdSet ? '已保存，输入新值可覆盖' : '140109（Network 请求头 companyid）'
                  }
                />
                <FieldDescription>
                  F12 → Network → 任意 /item/ 请求 → Request Headers → companyid
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="erp-base-url">ERP 地址</FieldLabel>
                <Input
                  id="erp-base-url"
                  value={erpBaseUrl}
                  onChange={(e) => setErpBaseUrl(e.target.value)}
                  autoComplete="off"
                />
                <FieldDescription>默认 {DEFAULT_ERP_BASE_URL}</FieldDescription>
              </Field>
            </FieldGroup>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </FieldSet>
        ),
        footer: (
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        ),
      },
      {
        id: 'appearance',
        label: '外观',
        description: '主题与显示',
        icon: Palette,
        header: {
          title: '外观',
          description: '自定义应用主题，设置会同步保存到本地配置',
        },
        body: (
          <FieldSet>
            <FieldLegend variant="label" className="sr-only">
              外观设置
            </FieldLegend>
            <FieldGroup>
              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="dark-mode" className="flex items-center gap-2">
                    <Moon />
                    暗色模式
                  </FieldLabel>
                  <FieldDescription>使用深色界面，适合长时间操作</FieldDescription>
                </FieldContent>
                <Switch
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => void setTheme(checked ? 'dark' : 'light')}
                  disabled={systemThemeEnabled}
                />
              </Field>
              <Separator />
              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="system-theme" className="flex items-center gap-2">
                    <Monitor />
                    跟随系统
                  </FieldLabel>
                  <FieldDescription>自动匹配操作系统的外观偏好</FieldDescription>
                </FieldContent>
                <Switch
                  id="system-theme"
                  checked={theme === 'system'}
                  onCheckedChange={(checked) => {
                    void setTheme(checked ? 'system' : theme === 'system' ? 'dark' : theme);
                  }}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        ),
      },
    ],
    [
      erpBaseUrl,
      erpCompanyId,
      erpCompanyIdSet,
      erpCookie,
      erpCookieSet,
      message,
      saving,
      systemThemeEnabled,
      theme,
      setTheme,
    ],
  );

  return <SettingsLayout sections={sections} defaultSectionId="erp" />;
}
