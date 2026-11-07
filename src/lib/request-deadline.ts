/** Bound the entire operation, including SDK work that does not accept a signal. */
export async function withRequestDeadline<T>(work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal, milliseconds = 10000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let rejectAbort!: (reason: unknown) => void;
  const cancelled = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const reject = () => rejectAbort(new DOMException('Aborted', 'AbortError'));
  controller.signal.addEventListener('abort', reject, { once: true });
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, milliseconds);
  try {
    const job = Promise.resolve().then(() => { controller.signal.throwIfAborted(); return work(controller.signal); });
    return await Promise.race([job, cancelled]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', reject);
  }
}
