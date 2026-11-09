import { JsonObject, JsonValue } from '../common/types/json-value.type';

const SENSITIVE_KEY = /pass(?:word)?|token|secret|authorization|cookie|credential|e-?mail|phone|jwt|api[-_]?key/i;
const MAX_KEYS = 30;
const MAX_ARRAY = 20;
const MAX_STRING = 300;

/**
 * Keeps diagnostic metadata small and free of credentials or direct contact
 * data. Passwords, tokens, cookies and request bodies never reach this helper.
 */
export function sanitizeMetadata(value: unknown, depth = 0): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 3) return null;
  const result: JsonObject = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(result).length >= MAX_KEYS) break;
    const key = rawKey.slice(0, 64);
    if (!key || SENSITIVE_KEY.test(key)) continue;
    const sanitized = sanitizeValue(rawValue, depth + 1);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return Object.keys(result).length ? result : null;
}

function sanitizeValue(value: unknown, depth: number): JsonValue | undefined {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  if (Array.isArray(value)) {
    if (depth > 3) return undefined;
    return value.slice(0, MAX_ARRAY).flatMap(item => {
      const sanitized = sanitizeValue(item, depth + 1);
      return sanitized === undefined ? [] : [sanitized];
    });
  }
  if (typeof value === 'object') {
    const nested = sanitizeMetadata(value, depth);
    return nested ?? undefined;
  }
  return undefined;
}

/** Replaces identifiers so feature popularity groups by route instead of by row. */
export function normalizePath(path: string): string {
  return path
    .split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d{2,}(?=\/|$)/g, '/:n')
    .slice(0, 300);
}
