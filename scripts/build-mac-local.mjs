import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const { signAsync } = require('@electron/osx-sign');
const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

const productName = packageJson.productName ?? packageJson.name;
const version = packageJson.version;
const arch = process.env.MAC_ARCH ?? 'arm64';
const appDir = path.join(rootDir, 'out', 'make', `mac-${arch}`);
const appPath = path.join(appDir, `${productName}.app`);
const dmgRoot = path.join(rootDir, 'out', 'make', `local-dmg-${arch}`);
const dmgPath = path.join(rootDir, 'out', 'make', `${productName}-${version}-${arch}-local.dmg`);

function run(command, args, options = {}) {
  console.log(`\n> ${[command, ...args].join(' ')}`);
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options,
  });
}

if (process.platform !== 'darwin') {
  console.error('macOS local packaging must run on macOS.');
  process.exit(1);
}

run('node', ['scripts/build-app.mjs']);

run('pnpm', [
  'exec',
  'electron-builder',
  '--mac',
  'dir',
  `--${arch}`,
  '--publish',
  'never',
  '--config.mac.identity=null',
  '--config.mac.forceCodeSigning=false',
  '--config.mac.notarize=false',
]);

if (!existsSync(appPath)) {
  console.error(`Expected app bundle was not found: ${appPath}`);
  process.exit(1);
}

console.log(`\n> ad-hoc sign ${appPath}`);
await signAsync({
  app: appPath,
  identity: '-',
  identityValidation: false,
  hardenedRuntime: false,
  optionsForFile: () => ({
    hardenedRuntime: false,
  }),
  preAutoEntitlements: false,
  preEmbedProvisioningProfile: false,
  platform: 'darwin',
});

run('codesign', ['--verify', '--deep', '--strict', '--verbose=4', appPath]);

rmSync(dmgRoot, { recursive: true, force: true });
rmSync(dmgPath, { force: true });
mkdirSync(dmgRoot, { recursive: true });
run('ditto', [appPath, path.join(dmgRoot, `${productName}.app`)]);
symlinkSync('/Applications', path.join(dmgRoot, 'Applications'));

run('hdiutil', [
  'create',
  '-volname',
  `${productName} ${version}`,
  '-srcfolder',
  dmgRoot,
  '-ov',
  '-format',
  'UDZO',
  dmgPath,
]);

run('hdiutil', ['verify', dmgPath]);

console.log(`\nLocal macOS DMG created: ${dmgPath}`);
console.log('This build is ad-hoc signed but not notarized. Recipients may need to right-click Open or allow it in System Settings.');
