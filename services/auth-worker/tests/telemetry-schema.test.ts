import { describe, expect, it, vi } from 'vitest';
import { normalizeServerCode, normalizeTelemetryReport, parseTelemetryRequest, SAFE_SERVER_CODES, sanitizeStoredError } from '../src/telemetry-schema';

const report = {
  kind: 'auth', code: 'auth/popup-blocked', context: 'google-signin', route: '/login', release: 'abcdef0-20261026T120000Z',
  frames: [{ file: 'index-Abc123.js', line: 12, column: 42 }], browser: 'chrome', device: 'mobile',
};
const request = (body: string, type = 'application/json') => new Request('https://worker.test/errors', { method: 'POST', headers: { 'Content-Type': type }, body });
const now = Date.parse('2026-10-26T12:00:00.000Z');
const entry = { ...report, id: 'slot-255', source: 'client', fingerprint: 'a'.repeat(64), count: 3, firstSeenAt: '2026-10-26T10:00:00.000Z', lastSeenAt: '2026-10-26T11:59:00.000Z' };

describe('privacy-safe telemetry reports', () => {
  it('accepts selected fields and maps arbitrary code text to a fixed code', async () => {
    expect(await parseTelemetryRequest(request(JSON.stringify(report), 'application/json; charset=utf-8'))).toEqual(report);
    expect(normalizeTelemetryReport({ ...report, code: 'user@example.com failed' }).code).toBe('unknown-error');
    for (const release of ['dev', 'unknown', 'abcdef0', 'abcdef0123456789']) expect(normalizeTelemetryReport({ ...report, release }).release).toBe(release);
  });

  it('rejects raw message, stack, URL, identifiers, unknown nested fields and unsafe locations', () => {
    for (const field of ['message', 'stack', 'url', 'uid', 'email', 'phone', '__proto__']) {
      const value = JSON.parse(JSON.stringify(report));
      Object.defineProperty(value, field, { value: 'secret@example.com', enumerable: true });
      expect(() => normalizeTelemetryReport(value)).toThrow('telemetry_invalid_report');
    }
    for (const frames of [
      [{ file: 'https://app.test/index.js?token=secret', line: 1, column: 1 }],
      [{ file: 'src/index.ts', line: 1, column: 1 }],
      [{ file: 'index.js\n', line: 1, column: 1 }],
      [{ file: 'index.js', line: 0, column: 1 }],
      [{ file: 'index.js', line: 1.5, column: 1 }],
      [{ file: 'index.js', line: 1, column: 10000001 }],
      [{ file: 'index.js', line: 1, column: 1, message: 'private' }],
      Array.from({ length: 6 }, () => report.frames[0]),
    ]) expect(() => normalizeTelemetryReport({ ...report, frames })).toThrow('telemetry_invalid_report');
  });

  it('rejects invalid enums, missing fields, arbitrary releases, oversized codes and malformed JSON', async () => {
    for (const change of [{ kind: 'custom' }, { route: '/board?token=private' }, { context: 'private-name' }, { release: 'private@example.com' }, { release: 'abcdef0-20261026T120000Z-extra' }, { release: 'abcdef0\n' }, { browser: 'user agent string' }, { device: 'tablet' }, { code: 'x'.repeat(161) }, { code: 3 }]) {
      expect(() => normalizeTelemetryReport({ ...report, ...change })).toThrow('telemetry_invalid_report');
    }
    for (const value of [null, [], {}, { ...report, release: undefined }]) expect(() => normalizeTelemetryReport(value)).toThrow('telemetry_invalid_report');
    await expect(parseTelemetryRequest(request('{invalid'))).rejects.toMatchObject({ status: 400, code: 'telemetry_invalid_report' });
    for (const type of ['text/plain', 'application/jsonp', 'application/ld+json']) await expect(parseTelemetryRequest(request('{}', type))).rejects.toMatchObject({ status: 415, code: 'json_required' });
  });

  it('caps UTF-8 bytes rather than characters and cancels an oversized stream before reading the rest', async () => {
    await expect(parseTelemetryRequest(request(JSON.stringify({ ...report, code: '가'.repeat(1500) })))).rejects.toMatchObject({ status: 413, code: 'telemetry_body_too_large' });
    let reads = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(3000)); },
      cancel,
    }, { highWaterMark: 0 });
    const input = new Request('https://worker.test/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half' } as RequestInit);
    await expect(parseTelemetryRequest(input)).rejects.toMatchObject({ status: 413, code: 'telemetry_body_too_large' });
    expect(reads).toBe(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    const short = request('{}');
    short.headers.set('Content-Length', '4097');
    await expect(parseTelemetryRequest(short)).rejects.toMatchObject({ status: 413, code: 'telemetry_body_too_large' });
  });

  it('accepts an exact 4096-byte report and rejects invalid UTF-8 without exposing text', async () => {
    const body = JSON.stringify(report);
    const exact = body + ' '.repeat(4096 - new TextEncoder().encode(body).byteLength);
    expect(await parseTelemetryRequest(request(exact))).toEqual(report);
    await expect(parseTelemetryRequest(request(exact + ' '))).rejects.toMatchObject({ status: 413, code: 'telemetry_body_too_large' });
    const invalidUtf8 = new Request('https://worker.test/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0xff]) });
    await expect(parseTelemetryRequest(invalidUtf8)).rejects.toMatchObject({ status: 400, code: 'telemetry_invalid_report' });
  });
});

describe('stored error response sanitization', () => {
  it('retains bounded valid aggregates and the separate fixed server-code vocabulary', () => {
    expect(sanitizeStoredError(entry, now)).toEqual(entry);
    const server = { ...entry, source: 'server', kind: 'server', context: 'server-request', route: '/places/search', code: 'naver_search_failed', httpStatus: 502 };
    expect(sanitizeStoredError(server, now)?.code).toBe('naver_search_failed');
    expect(sanitizeStoredError({ ...server, code: 'secret upstream payload' }, now)?.code).toBe('internal_error');
    expect(sanitizeStoredError({ ...entry, code: 'secret@example.com' }, now)?.code).toBe('unknown-error');
    for (const code of SAFE_SERVER_CODES) expect(normalizeServerCode(code)).toBe(code);
    for (const code of [undefined, null, 3, 'private@example.com', 'https://private.test']) expect(normalizeServerCode(code)).toBe('internal_error');
  });

  it('drops extra fields, invalid slots, fingerprints, counts, dates, stale and future entries', () => {
    for (const change of [
      { message: 'secret' }, { stack: 'private' }, { id: 'slot-256' }, { id: 'slot-1' }, { fingerprint: 'g'.repeat(64) },
      { id: 'slot-001\n' }, { fingerprint: 'a'.repeat(64) + '\n' },
      { count: 0 }, { count: 200001 }, { count: 1.5 }, { source: 'custom' }, { httpStatus: 600 },
      { firstSeenAt: '2026-10-18T00:00:00.000Z' }, { firstSeenAt: '2026-10-26T12:00:00.000Z' },
      { firstSeenAt: '2026-02-30T00:00:00.000Z' }, { lastSeenAt: '2026-10-26T12:01:01.000Z' },
      { lastSeenAt: 'private text' }, { route: '/profile/private-person' },
    ]) expect(sanitizeStoredError({ ...entry, ...change }, now), JSON.stringify(change)).toBeNull();
    expect(sanitizeStoredError(null, now)).toBeNull();
    expect(sanitizeStoredError(entry, Number.NaN)).toBeNull();
  });
});
