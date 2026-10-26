import { TELEMETRY_CODES, TELEMETRY_CONTEXTS, TELEMETRY_KINDS, TELEMETRY_UI_ROUTES } from '../../shared/error-telemetry';
import type { TelemetryBrowser, TelemetryContext, TelemetryFrame, TelemetryKind, TelemetryReport } from '../../shared/error-telemetry';
import { getAuthAPIURL } from './api-url';

const allowedCodes = new Set(TELEMETRY_CODES);
const seen = new WeakSet<object>();
const recent = new Map<string, number>();
let sent = 0;
let windowStarted = 0;
let windowCount = 0;

export function errorCode(error: unknown): string {
  const value = error && typeof error === 'object' ? error as { code?: unknown; name?: unknown; message?: unknown } : {};
  if (typeof value.code === 'string' && allowedCodes.has(value.code)) return value.code;
  const message = typeof value.message === 'string' ? value.message : '';
  const embedded = message.match(/\b(?:auth|firestore)\/[a-z-]+\b/)?.[0];
  if (embedded && allowedCodes.has(embedded)) return embedded;
  if (allowedCodes.has(message)) return message;
  if (/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .+ failed|error loading dynamically imported module/i.test(message)) return 'chunk-load-failed';
  const names: Record<string, string> = { TypeError: 'type-error', ReferenceError: 'reference-error', SyntaxError: 'syntax-error', RangeError: 'range-error', Error: 'application-error' };
  return typeof value.name === 'string' ? names[value.name] ?? 'unknown-error' : 'unknown-error';
}

export function errorFrames(error: unknown, origin: string): TelemetryFrame[] {
  const stack = error && typeof error === 'object' && 'stack' in error && typeof error.stack === 'string' ? error.stack : '';
  const frames: TelemetryFrame[] = [];
  for (const line of stack.split('\n').slice(1, 30)) {
    const match = line.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
    if (!match) continue;
    try {
      const url = new URL(match[1]);
      if (url.origin !== origin || url.username || url.password || url.search || url.hash) continue;
      if (!/^\/(?:assets\/[-A-Za-z0-9_]+\.js|src\/(?:[-A-Za-z0-9_]+\/)*[-A-Za-z0-9_]+\.(?:tsx|ts))$/.test(url.pathname)) continue;
      const file = url.pathname.split('/').at(-1)!;
      if (file.length > 100) continue;
      const row = Number(match[2]), column = Number(match[3]);
      if (row < 1 || row > 10000000 || column < 1 || column > 10000000) continue;
      if (!frames.some(frame => frame.file === file && frame.line === row && frame.column === column)) frames.push({ file, line: row, column });
      if (frames.length === 5) break;
    } catch { /* Keep only same-site asset locations, never source text or URLs. */ }
  }
  return frames;
}

export function makeErrorReport(error: unknown, options: { kind?: TelemetryKind; context?: TelemetryContext } = {}): TelemetryReport {
  const path = window.location.pathname;
  const route = TELEMETRY_UI_ROUTES.find(candidate => candidate === path) ?? 'unknown';
  const ua = navigator.userAgent;
  const browser: TelemetryBrowser = /\bKAKAOTALK\b/i.test(ua) ? 'kakao' : /Edg\//.test(ua) ? 'edge' : /SamsungBrowser\//.test(ua) ? 'samsung' : /Firefox\/|FxiOS\//.test(ua) ? 'firefox' : /Chrome\/|CriOS\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other';
  const build = typeof __APP_RELEASE__ === 'string' ? __APP_RELEASE__ : 'dev';
  const release = /^(?:[a-f0-9]{7,40}(?:-\d{8}T\d{6}Z)?|dev|unknown)$/.test(build) ? build : 'unknown';
  return { kind: options.kind && TELEMETRY_KINDS.includes(options.kind) ? options.kind : 'handled', code: errorCode(error),
    context: options.context && TELEMETRY_CONTEXTS.includes(options.context) ? options.context : 'operation', route, release,
    frames: errorFrames(error, window.location.origin), browser, device: /Android|iPhone|iPad|iPod|Mobile/.test(ua) ? 'mobile' : 'desktop' };
}

/** Best effort only. No raw messages, user identifiers, request data, URLs, or tokens leave the browser. */
export function reportError(error: unknown, options: { kind?: TelemetryKind; context?: TelemetryContext } = {}): void {
  try {
    if (typeof window === 'undefined' || !import.meta.env.PROD || import.meta.env.VITE_DEMO_MODE === 'true') return;
    const base = getAuthAPIURL();
    if (!base || sent >= 20) return;
    const now = Date.now();
    if (now - windowStarted >= 60000) { windowStarted = now; windowCount = 0; }
    if (windowCount >= 5 || error && typeof error === 'object' && seen.has(error)) return;
    const report = makeErrorReport(error, options);
    const key = JSON.stringify([report.kind, report.code, report.context, report.route, report.frames]);
    if (now - (recent.get(key) ?? -Infinity) < 600000) return;
    if (error && typeof error === 'object') seen.add(error);
    recent.set(key, now); sent++; windowCount++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    void fetch(new URL('telemetry/errors', base), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report), credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, signal: controller.signal,
    }).catch(() => { /* Reporting must never block login or report its own failures. */ }).finally(() => clearTimeout(timer));
  } catch { /* Error reporting must also tolerate blocked storage and malformed error objects. */ }
}

export function installErrorReporting(): () => void {
  const runtime = (event: Event) => {
    if (event instanceof ErrorEvent) {
      reportError(event.error ?? { stack: `Error\n at ${event.filename}:${event.lineno}:${event.colno}` }, { kind: 'runtime', context: 'window-error' });
    } else if (event.target instanceof HTMLScriptElement || event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet') {
      reportError({ code: 'chunk-load-failed' }, { kind: 'resource', context: 'asset-load' });
    }
  };
  const rejection = (event: PromiseRejectionEvent) => reportError(event.reason, { kind: 'promise', context: 'unhandled-rejection' });
  const preload = (event: Event) => reportError('payload' in event ? event.payload : { code: 'chunk-load-failed' }, { kind: 'resource', context: 'asset-load' });
  window.addEventListener('error', runtime, true);
  window.addEventListener('unhandledrejection', rejection);
  window.addEventListener('vite:preloadError', preload);
  return () => { window.removeEventListener('error', runtime, true); window.removeEventListener('unhandledrejection', rejection); window.removeEventListener('vite:preloadError', preload); };
}
