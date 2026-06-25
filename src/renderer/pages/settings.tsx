import { useEffect, useMemo, useState } from 'react';
import { Info, KeyRound, LogIn, Monitor, Moon, Palette, Upload } from 'lucide-react';

import { SettingsLayout } from '@/components/layout/settings-layout/SettingsLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { kuaimai, logRenderer } from '@/lib/kuaimai-client';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [erpCookieSet, setErpCookieSet] = useState(false);
  const [erpCookie, setErpCookie] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [phoneVerifyCode, setPhoneVerifyCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void kuaimai.config.getSecretsMeta().then((meta) => {
      setErpCookieSet(Boolean(meta.erpCookie));
    });
  }, []);

  const systemThemeEnabled = theme === 'system';

  const handleSaveSecrets = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (erpCookie.trim()) {
        await kuaimai.config.setSecrets({ erpCookie: erpCookie.trim() });
        setErpCookie('');
        setErpCookieSet(true);
        setMessage('已保存，界面不会回显明文');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleErpLogin = async () => {
    setLoggingIn(true);
    setMessage(null);
    try {
      const result = await kuaimai.auth.erpLogin({
        companyName,
        userName,
        password,
        phoneVerifyCode: phoneVerifyCode || undefined,
      });
      if (!result.success) {
        logRenderer('warn', 'settings', 'erp login failed', { message: result.message });
        setMessage(result.message ?? '登录失败');
        return;
      }
      setPassword('');
      setPhoneVerifyCode('');
      setErpCookieSet(true);
      setMessage(result.message ?? '登录成功，Cookie 已保存');
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      logRenderer('error', 'settings', 'erp login exception', { error: text });
      setMessage(`登录失败：${text}`);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleTestUpload = async () => {
    setUploading(true);
    setMessage(null);
    try {
      const filePath = await kuaimai.upload.pickFile();
      if (!filePath) {
        return;
      }
      const result = await kuaimai.upload.erpOss(filePath);
      setMessage(`OSS 上传成功：${result.url}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      logRenderer('error', 'settings', 'oss upload failed', { error: text });
      setMessage(`OSS 上传失败：${text}`);
    } finally {
      setUploading(false);
    }
  };

  const sections = useMemo(
    () => [
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
      {
        id: 'credentials',
        label: 'ERP 凭证',
        description: '登录 Cookie',
        icon: KeyRound,
        header: {
          title: '快麦 ERP 凭证',
          description: '账号登录或手动粘贴 Cookie，敏感项加密存储',
          action: (
            <Badge variant={erpCookieSet ? 'default' : 'secondary'}>
              {erpCookieSet ? '已配置' : '未配置'}
            </Badge>
          ),
        },
        body: (
          <div className="flex flex-col gap-6">
            <Alert>
              <Info />
              <AlertTitle>推荐：账号登录</AlertTitle>
              <AlertDescription>
                填写公司名、账号与密码登录。若触发异地验证，请填写手机验证码或在浏览器登录后手动粘贴
                Cookie。
              </AlertDescription>
            </Alert>

            <FieldSet>
              <FieldLegend variant="label">账号登录</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="erp-company">公司名</FieldLabel>
                  <Input
                    id="erp-company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    autoComplete="organization"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="erp-user">账号</FieldLabel>
                  <Input
                    id="erp-user"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    autoComplete="username"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="erp-password">密码</FieldLabel>
                  <Input
                    id="erp-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <FieldDescription>密码仅用于登录，不会保存明文</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="erp-phone-code">手机验证码（可选）</FieldLabel>
                  <Input
                    id="erp-phone-code"
                    value={phoneVerifyCode}
                    onChange={(e) => setPhoneVerifyCode(e.target.value)}
                    autoComplete="one-time-code"
                    placeholder="异地登录验证时填写"
                  />
                </Field>
                <Button
                  type="button"
                  disabled={loggingIn || !companyName.trim() || !userName.trim() || !password}
                  onClick={() => void handleErpLogin()}
                >
                  <LogIn />
                  {loggingIn ? '登录中…' : '登录并保存 Cookie'}
                </Button>
              </FieldGroup>
            </FieldSet>

            <Separator />

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="erp-cookie">手动粘贴 Cookie</FieldLabel>
                <Input
                  id="erp-cookie"
                  type="password"
                  placeholder={
                    erpCookieSet ? '已保存，输入新值可覆盖' : '从浏览器复制登录 Cookie'
                  }
                  value={erpCookie}
                  onChange={(e) => setErpCookie(e.target.value)}
                  autoComplete="off"
                />
                <FieldDescription>仅保存在本机 userData 目录，不会上传到云端</FieldDescription>
              </Field>
            </FieldGroup>

            {message && <p className="text-sm text-muted-foreground">{message}</p>}

            <Button
              type="button"
              variant="outline"
              disabled={!erpCookieSet || uploading}
              onClick={() => void handleTestUpload()}
            >
              <Upload />
              {uploading ? '上传中…' : '测试 OSS 上传'}
            </Button>
          </div>
        ),
        footer: (
          <Button onClick={() => void handleSaveSecrets()} disabled={saving || !erpCookie.trim()}>
            保存手动 Cookie
          </Button>
        ),
      },
    ],
    [
      companyName,
      erpCookie,
      erpCookieSet,
      loggingIn,
      message,
      password,
      phoneVerifyCode,
      saving,
      systemThemeEnabled,
      theme,
      uploading,
      userName,
      setTheme,
    ],
  );

  return <SettingsLayout sections={sections} defaultSectionId="appearance" />;
}
