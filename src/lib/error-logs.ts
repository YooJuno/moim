import { auth } from './firebase';
import { getAuthAPIURL } from './api-url';
import { TELEMETRY_CODES, TELEMETRY_CONTEXTS, TELEMETRY_KINDS, TELEMETRY_ROUTES } from '../../shared/error-telemetry';
import type { ErrorLogEntry, ErrorLogResponse } from '../../shared/error-telemetry';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const included = (values: readonly string[], value: unknown) => typeof value === 'string' && values.includes(value);
const fail = () => new Error('오류 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');

export function parseErrorLogs(value: unknown): ErrorLogResponse {
  if (!object(value) || typeof value.enabled !== 'boolean' || !Array.isArray(value.errors) || value.errors.length > 50) throw fail();
  const errors = value.errors.map(entry => {
    if (!object(entry) || typeof entry.id !== 'string' || !/^[-a-zA-Z0-9]{1,80}$/.test(entry.id)
      || !['client', 'server'].includes(String(entry.source)) || !included(TELEMETRY_KINDS, entry.kind)
      || !included(TELEMETRY_CODES, entry.code) || !included(TELEMETRY_CONTEXTS, entry.context) || !included(TELEMETRY_ROUTES, entry.route)
      || typeof entry.release !== 'string' || !/^(?:[a-f0-9]{7,40}(?:-\d{8}T\d{6}Z)?|dev|unknown)$/.test(entry.release)
      || typeof entry.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(entry.fingerprint)
      || !Number.isInteger(entry.count) || Number(entry.count) < 1 || Number(entry.count) > 10000000
      || typeof entry.firstSeenAt !== 'string' || !Number.isFinite(Date.parse(entry.firstSeenAt))
      || typeof entry.lastSeenAt !== 'string' || !Number.isFinite(Date.parse(entry.lastSeenAt))) throw fail();
    if (entry.frames !== undefined && (!Array.isArray(entry.frames) || entry.frames.length > 5 || entry.frames.some(frame => !object(frame)
      || typeof frame.file !== 'string' || !/^[-A-Za-z0-9_]+\.(?:js|tsx|ts)$/.test(frame.file)
      || !Number.isInteger(frame.line) || Number(frame.line) < 1 || Number(frame.line) > 10000000
      || !Number.isInteger(frame.column) || Number(frame.column) < 1 || Number(frame.column) > 10000000))) throw fail();
    if (entry.httpStatus !== undefined && (!Number.isInteger(entry.httpStatus) || Number(entry.httpStatus) < 400 || Number(entry.httpStatus) > 599)) throw fail();
    return entry as unknown as ErrorLogEntry;
  });
  return { errors, enabled: value.enabled };
}

export async function getErrorLogs(signal?: AbortSignal): Promise<ErrorLogResponse> {
  const base = getAuthAPIURL();
  const user = auth?.currentUser;
  if (!base || !user) throw new Error('운영 사이트에서 오류 기록을 확인할 수 있어요.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10000);
  try {
    const token = await Promise.race([user.getIdToken(), new Promise<never>((_, reject) => {
      if (controller.signal.aborted) reject(fail());
      else controller.signal.addEventListener('abort', () => reject(fail()), { once: true });
    })]);
    if (auth?.currentUser?.uid !== user.uid || controller.signal.aborted) throw fail();
    const response = await fetch(new URL('telemetry/errors?limit=50', base), { headers: { Authorization: `Bearer ${token}` },
      credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? '관리자만 오류 기록을 확인할 수 있어요.' : fail().message);
    const result = parseErrorLogs(await response.json());
    if (auth?.currentUser?.uid !== user.uid) throw fail();
    return result;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError' && error.name !== 'TypeError' && error.name !== 'SyntaxError') throw error;
    throw fail();
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
