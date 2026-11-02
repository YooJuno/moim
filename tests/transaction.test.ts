import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
const sdk = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('firebase/firestore', () => ({ runTransaction: sdk.run }));
import { runAppTransaction } from '../src/lib/transaction';
const database = {} as Firestore;
const failure = (code: string) => Object.assign(new Error('safe test error'), { name: 'FirebaseError', code });
beforeEach(() => { sdk.run.mockReset(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe('atomic application transactions', () => {
  it('returns Auth network failures promptly without invoking the SDK retry classifier', async () => {
    const error = failure('auth/network-request-failed');
    sdk.run.mockRejectedValue(error);
    await expect(runAppTransaction(database, async () => 'saved')).rejects.toBe(error);
    expect(sdk.run).toHaveBeenCalledTimes(1);
    expect(sdk.run.mock.calls[0][2]).toEqual({ maxAttempts: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('reruns a whole atomic transaction after a real Firestore conflict and returns its result', async () => {
    sdk.run.mockRejectedValueOnce(failure('aborted')).mockRejectedValueOnce(failure('unavailable')).mockResolvedValueOnce('committed');
    const update = vi.fn();
    const result = runAppTransaction(database, update);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('committed');
    expect(sdk.run).toHaveBeenCalledTimes(3);
    expect(sdk.run.mock.calls.every(call => call[0] === database && call[1] === update && call[2].maxAttempts === 1)).toBe(true);
  });
  it('caps retries at five and preserves the final Firestore failure', async () => {
    const error = failure('deadline-exceeded'); sdk.run.mockRejectedValue(error);
    const result = expect(runAppTransaction(database, async () => undefined)).rejects.toBe(error);
    await vi.runAllTimersAsync(); await result;
    expect(sdk.run).toHaveBeenCalledTimes(5);
  });
  it.each([failure('permission-denied'), failure('auth/user-disabled'), failure('unexpected-code'), new Error('validation error')])('does not retry denied, invalid or application failures', async error => {
    sdk.run.mockRejectedValue(error);
    await expect(runAppTransaction(database, async () => undefined)).rejects.toBe(error);
    expect(sdk.run).toHaveBeenCalledTimes(1);
  });
});
