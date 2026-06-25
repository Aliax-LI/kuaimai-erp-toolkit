const SENSITIVE_KEY_PATTERN =
  /password|cookie|secret|token|authorization|credential|erpCookie/i;

const REDACTED = '[REDACTED]';

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[MaxDepth]';
  }

  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.length > 500) {
      return `${value.slice(0, 500)}…(${value.length} chars)`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key) ? REDACTED : redactForLog(nested, depth + 1);
    }
    return result;
  }

  return String(value);
}
