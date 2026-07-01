import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import {
  type AppSettings,
  type AppStore,
  type SecretsRecord,
  appStoreSchema,
  createDefaultStore,
} from '@shared/schemas/store';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const seed = `${app.getName()}:${app.getPath('userData')}:kuaimai-erp-toolkit`;
  return createHash('sha256').update(seed).digest();
}

function encryptSecrets(secrets: SecretsRecord): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(secrets), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, payload]).toString('base64');
}

function decryptSecrets(payload: string): SecretsRecord {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buffer.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted) as SecretsRecord;
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'store.json');
}

function backupCorruptedStore(storePath: string): void {
  if (fs.existsSync(storePath)) {
    fs.copyFileSync(storePath, `${storePath}.bak`);
  }
}

let cachedStore: AppStore | null = null;

function readRawStore(): AppStore {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    return createDefaultStore();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(storePath, 'utf8')) as Record<string, unknown>;
    const secretsPayload = raw.secretsEncrypted as string | undefined;
    const secrets =
      typeof secretsPayload === 'string' ? decryptSecrets(secretsPayload) : (raw.secrets as SecretsRecord) ?? {};

    const parsed = appStoreSchema.parse({
      schemaVersion: raw.schemaVersion,
      updatedAt: raw.updatedAt,
      app: raw.app,
      secrets,
    });
    return parsed;
  } catch {
    backupCorruptedStore(storePath);
    return createDefaultStore();
  }
}

function writeStore(store: AppStore): void {
  const storePath = getStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.tmp`;
  const payload = {
    schemaVersion: store.schemaVersion,
    updatedAt: store.updatedAt,
    app: store.app,
    secretsEncrypted: encryptSecrets(store.secrets),
  };
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tempPath, storePath);
  cachedStore = store;
}

function getStore(): AppStore {
  if (!cachedStore) {
    cachedStore = readRawStore();
  }
  return cachedStore;
}

export function getAppSettings(): AppSettings {
  return { ...getStore().app };
}

export function setAppSettings(partial: Partial<AppSettings>): AppSettings {
  const store = getStore();
  store.app = { ...store.app, ...partial };
  store.updatedAt = new Date().toISOString();
  writeStore(store);
  return { ...store.app };
}

export function getSecretsMeta(): Record<string, boolean> {
  const secrets = getStore().secrets;
  return Object.fromEntries(Object.keys(secrets).map((key) => [key, true]));
}

/** 主进程内部读取敏感项（不暴露给渲染进程） */
export function getSecret(key: string): string | undefined {
  return getStore().secrets[key];
}

export function setSecrets(partial: SecretsRecord): Record<string, boolean> {
  const store = getStore();
  store.secrets = { ...store.secrets, ...partial };
  store.updatedAt = new Date().toISOString();
  writeStore(store);
  return getSecretsMeta();
}

export function ensureUserDataDirs(): void {
  const userData = app.getPath('userData');
  for (const dir of ['config', 'jobs', 'logs', 'cache']) {
    fs.mkdirSync(path.join(userData, dir), { recursive: true });
  }
}

function getToolConfigPath(toolId: string): string {
  return path.join(app.getPath('userData'), 'config', toolId, 'config.json');
}

export function writeToolConfig(toolId: string, data: Record<string, unknown>): void {
  const filePath = getToolConfigPath(toolId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const envelope = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    data,
  };
  fs.writeFileSync(tempPath, JSON.stringify(envelope, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function readToolConfig(toolId: string): Record<string, unknown> | null {
  const filePath = getToolConfigPath(toolId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { data?: Record<string, unknown> };
    return raw.data ?? null;
  } catch {
    return null;
  }
}
