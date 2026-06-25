import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { redactForLog } from '../../core/log-redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let initialized = false;
let logDir = '';
let minLevel: LogLevel = 'debug';

function resolveMinLevel(): LogLevel {
  const fromEnv = process.env.KUAIMAI_LOG_LEVEL?.toLowerCase();
  if (fromEnv === 'info' || fromEnv === 'warn' || fromEnv === 'error' || fromEnv === 'debug') {
    return fromEnv;
  }
  return app.isPackaged ? 'info' : 'debug';
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function getDailyLogPath(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `${date}.jsonl`);
}

function writeLine(record: LogRecord): void {
  if (!initialized) {
    return;
  }

  try {
    fs.appendFileSync(getDailyLogPath(), `${JSON.stringify(record)}\n`, 'utf8');
  } catch {
    // 避免日志失败影响业务
  }
}

function formatConsoleLine(record: LogRecord): string {
  const dataText =
    record.data === undefined ? '' : ` ${JSON.stringify(redactForLog(record.data))}`;
  return `[${record.ts}] [${record.level}] [${record.scope}] ${record.message}${dataText}`;
}

function emit(level: LogLevel, scope: string, message: string, data?: unknown): void {
  if (!shouldEmit(level)) {
    return;
  }

  const record: LogRecord = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    data: data === undefined ? undefined : redactForLog(data),
  };

  writeLine(record);

  const line = formatConsoleLine(record);
  switch (level) {
    case 'error':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    default:
      console.log(line);
      break;
  }
}

export function initLogger(): void {
  logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  minLevel = resolveMinLevel();
  initialized = true;

  emit('info', 'logger', 'initialized', {
    logDir,
    minLevel,
    packaged: app.isPackaged,
  });
}

export function getLogDir(): string {
  return logDir;
}

export const logger = {
  debug(scope: string, message: string, data?: unknown): void {
    emit('debug', scope, message, data);
  },
  info(scope: string, message: string, data?: unknown): void {
    emit('info', scope, message, data);
  },
  warn(scope: string, message: string, data?: unknown): void {
    emit('warn', scope, message, data);
  },
  error(scope: string, message: string, data?: unknown): void {
    emit('error', scope, message, data);
  },
};
