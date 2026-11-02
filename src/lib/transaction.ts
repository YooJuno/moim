import { runTransaction } from 'firebase/firestore';
import type { Firestore, Transaction } from 'firebase/firestore';

const retryable = new Set(['aborted', 'failed-precondition', 'already-exists', 'cancelled', 'unknown', 'deadline-exceeded', 'resource-exhausted', 'internal', 'unavailable', 'unauthenticated']);

/** Keep atomic writes, without passing Auth errors to Firestore's retry classifier. */
export async function runAppTransaction<T>(database: Firestore, update: (transaction: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      // The SDK retry classifier asserts on auth/network-request-failed. A single
      // SDK attempt lets us return Auth failures and retry only Firestore errors.
      return await runTransaction(database, update, { maxAttempts: 1 });
    } catch (error) {
      const value = error as { name?: unknown; code?: unknown } | null;
      if (attempt >= 4 || value?.name !== 'FirebaseError' || typeof value.code !== 'string' || !retryable.has(value.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(200 * 2 ** attempt, 1600) * (0.75 + Math.random() * 0.5)));
    }
  }
}
