import {
  TELEMETRY_SERVER_CODES, TELEMETRY_BROWSERS, TELEMETRY_CODES, TELEMETRY_CONTEXTS, TELEMETRY_DEVICES, TELEMETRY_KINDS, TELEMETRY_ROUTES,
} from '../../../shared/error-telemetry';
import type { ErrorLogEntry, TelemetryFrame, TelemetryReport } from '../../../shared/error-telemetry';
import { HttpError } from './types';

const MAX_BODY_BYTES = 4096;
const REPORT_KEYS = ['kind', 'code', 'context', 'route', 'release', 'frames', 'browser', 'device'];
const ENTRY_KEYS = [...REPORT_KEYS, 'id', 'source', 'fingerprint', 'count', 'firstSeenAt', 'lastSeenAt', 'httpStatus'];
const RELEASE = /^(?:[a-f0-9]{7,40}-\d{8}T\d{6}Z|[a-f0-9]{7,40}|dev|unknown)$/;
const FILE = /^[-A-Za-z0-9_]+\.(?:js|tsx|ts)$/;
const invalid = () => new HttpError(400, 'telemetry_invalid_report');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const includes = (values: readonly unknown[], value: unknown) => values.includes(value);
const only = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
const fullMatch = (pattern: RegExp, value: string) => pattern.exec(value)?.[0] === value;

// Fixed application codes only. Never put an upstream message, request URL, or exception text here.
export const SAFE_SERVER_CODES: readonly string[] = TELEMETRY_SERVER_CODES;

export function normalizeServerCode(code: unknown): string {
  return typeof code === 'string' && SAFE_SERVER_CODES.includes(code) ? code : 'internal_error';
}

function normalizeReport(value: unknown, server: boolean): TelemetryReport {
  if (!object(value) || !only(value, REPORT_KEYS)
    || !includes(TELEMETRY_KINDS, value.kind) || !includes(TELEMETRY_CONTEXTS, value.context)
    || !includes(TELEMETRY_ROUTES, value.route) || typeof value.release !== 'string' || value.release.length > 80 || !fullMatch(RELEASE, value.release)
    || typeof value.code !== 'string' || value.code.length > 160) throw invalid();
  const result = {
    kind: value.kind,
    context: value.context,
    route: value.route,
    release: value.release,
    code: server ? normalizeServerCode(value.code) : TELEMETRY_CODES.includes(value.code) ? value.code : 'unknown-error',
  } as TelemetryReport;
  if ('frames' in value) {
    if (!Array.isArray(value.frames) || value.frames.length > 5) throw invalid();
    result.frames = value.frames.map((frame): TelemetryFrame => {
      if (!object(frame) || !only(frame, ['file', 'line', 'column']) || typeof frame.file !== 'string'
        || frame.file.length > 100 || !fullMatch(FILE, frame.file)
        || !Number.isInteger(frame.line) || Number(frame.line) < 1 || Number(frame.line) > 10000000
        || !Number.isInteger(frame.column) || Number(frame.column) < 1 || Number(frame.column) > 10000000) throw invalid();
      return { file: frame.file, line: frame.line as number, column: frame.column as number };
    });
  }
  if ('browser' in value) {
    if (!includes(TELEMETRY_BROWSERS, value.browser)) throw invalid();
    result.browser = value.browser as TelemetryReport['browser'];
  }
  if ('device' in value) {
    if (!includes(TELEMETRY_DEVICES, value.device)) throw invalid();
    result.device = value.device as TelemetryReport['device'];
  }
  return result;
}

export const normalizeTelemetryReport = (value: unknown): TelemetryReport => normalizeReport(value, false);

export async function parseTelemetryRequest(request: Request): Promise<TelemetryReport> {
  if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'json_required');
  const length = request.headers.get('Content-Length');
  if (length !== null && Number(length) > MAX_BODY_BYTES) {
    void request.body?.cancel().catch(() => {});
    throw new HttpError(413, 'telemetry_body_too_large');
  }
  if (!request.body) throw invalid();
  const reader = request.body.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        throw new HttpError(413, 'telemetry_body_too_large');
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return normalizeTelemetryReport(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw invalid();
  } finally {
    reader.releaseLock();
  }
}

function isoDate(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const canonical = new Date(time).toISOString();
  return canonical === value || canonical.replace('.000Z', 'Z') === value ? time : null;
}

export function sanitizeStoredError(value: unknown, now: number): ErrorLogEntry | null {
  try {
    if (!object(value) || !only(value, ENTRY_KEYS) || !Number.isFinite(now)
      || typeof value.id !== 'string' || !fullMatch(/^slot-\d{3}$/, value.id) || Number(value.id.slice(5)) > 255
      || !includes(['client', 'server'], value.source) || typeof value.fingerprint !== 'string' || !fullMatch(/^[a-f0-9]{64}$/, value.fingerprint)
      || !Number.isInteger(value.count) || Number(value.count) < 1 || Number(value.count) > 200000) return null;
    const first = isoDate(value.firstSeenAt), last = isoDate(value.lastSeenAt);
    if (first === null || last === null || first > last || first < now - 7 * 86400000 || last > now + 60000) return null;
    const fields: Record<string, unknown> = {};
    for (const key of REPORT_KEYS) if (Object.hasOwn(value, key)) fields[key] = value[key];
    const report = normalizeReport(fields, value.source === 'server');
    const result: ErrorLogEntry = {
      ...report, id: value.id, source: value.source as 'client' | 'server', fingerprint: value.fingerprint,
      count: value.count as number, firstSeenAt: new Date(first).toISOString(), lastSeenAt: new Date(last).toISOString(),
    };
    if ('httpStatus' in value) {
      if (!Number.isInteger(value.httpStatus) || Number(value.httpStatus) < 100 || Number(value.httpStatus) > 599) return null;
      result.httpStatus = value.httpStatus as number;
    }
    return result;
  } catch {
    return null;
  }
}
