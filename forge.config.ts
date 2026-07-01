import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const iconBase = path.join(rootDir, 'resources', 'icon');

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: '快麦 ERP 工具箱',
    executableName: 'kuaimai-erp-toolkit',
    appBundleId: 'com.kuaimai.erp-toolkit',
    icon: iconBase,
  },
  rebuildConfig: {},
  makers: [
    // Windows：Squirrel 安装包（Setup.exe，含桌面快捷方式图标）
    new MakerSquirrel({
      name: 'KuaimaiErpToolkit',
      authors: 'Kuaimai',
      description: '快麦 ERP 桌面小工具集合',
      setupIcon: `${iconBase}.ico`,
    }),
    // Windows 便携版 zip（Linux CI 无需 Wine 也可产出）
    new MakerZIP({}, ['win32']),
    // macOS：DMG 安装镜像 + zip
    new MakerDMG({
      icon: `${iconBase}.icns`,
    }),
    new MakerZIP({}, ['darwin']),
    // Linux
    new MakerRpm({
      options: {
        icon: `${iconBase}.png`,
      },
    }),
    new MakerDeb({
      options: {
        icon: `${iconBase}.png`,
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
