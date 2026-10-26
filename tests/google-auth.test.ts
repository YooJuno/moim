import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth, User, UserCredential } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Member } from '../src/lib/types';

const mocks = vi.hoisted(() => ({
  popup: vi.fn(), authObserver: vi.fn(), transaction: vi.fn(), snapshot: vi.fn(), report: vi.fn(), parameters: vi.fn(),
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class { setCustomParameters = mocks.parameters; },
  signInWithPopup: mocks.popup, onAuthStateChanged: mocks.authObserver,
}));
vi.mock('firebase/firestore', () => ({
  doc: (_database: unknown, collection: string, id: string) => ({ path: `${collection}/${id}`, id }),
  runTransaction: mocks.transaction, onSnapshot: mocks.snapshot,
}));
vi.mock('../src/lib/telemetry', () => ({ reportError: mocks.report }));

import { AUTH_RECOVERY_TIMEOUT_MS, ensureMemberProfile, observeAuthSession, signInWithGoogle } from '../src/lib/google-auth';
import type { AuthSessionState } from '../src/lib/google-auth';

const actor = { uid: 'test-google-user', displayName: '가입 테스트', email: 'auth-test@example.com', photoURL: 'https://example.com/avatar.png' } as User;
const database = {} as Firestore;
const member = { id: actor.uid, name: '기존 이름', email: actor.email, role: 'leader', status: 'active', canCreatePoll: true, position: '회장', joinedAt: '2026-01-01T00:00:00Z' } as Member;
let records: Map<string, unknown>;
let writes: ReturnType<typeof vi.fn>;
let authChanged: (user: User | null) => void;
let stopAuth: ReturnType<typeof vi.fn>;
let stopMember: ReturnType<typeof vi.fn>;
const cleanups: (() => void)[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function snapshot(id: string, data: unknown) { return { id, exists: () => data !== undefined, data: () => data }; }
function session() {
  const current = { currentUser: actor as User | null };
  return { current, auth: current as Auth };
}
function observe(auth: Auth) {
  const states: AuthSessionState[] = [];
  const stop = observeAuthSession(auth, database, state => states.push(state));
  cleanups.push(stop);
  return { states, stop };
}
async function memberListener() {
  await vi.waitFor(() => expect(mocks.snapshot).toHaveBeenCalled());
  return mocks.snapshot.mock.calls.at(-1)![1] as (value: ReturnType<typeof snapshot>) => void;
}

beforeEach(() => {
  vi.clearAllMocks();
  records = new Map(); writes = vi.fn(); stopAuth = vi.fn(); stopMember = vi.fn();
  mocks.authObserver.mockImplementation((_auth, next) => { authChanged = next; return stopAuth; });
  mocks.snapshot.mockImplementation(() => stopMember);
  mocks.transaction.mockImplementation(async (_database, update) => {
    const staged: [string, unknown][] = [];
    await update({
      get: async (reference: { path: string; id: string }) => snapshot(reference.id, records.get(reference.path)),
      set: (reference: { path: string }, value: unknown) => { writes(reference.path, value); staged.push([reference.path, value]); },
    });
    for (const [path, value] of staged) records.set(path, value);
  });
});
afterEach(() => {
  for (const stop of cleanups.splice(0)) stop();
  vi.clearAllTimers(); vi.useRealTimers();
});

describe('Google popup', () => {
  it('opens immediately in the click gesture and shares one pending popup', async () => {
    const { auth } = session(); const waiting = deferred<UserCredential>();
    mocks.popup.mockReturnValueOnce(waiting.promise);
    const first = signInWithGoogle(auth); const second = signInWithGoogle(auth);
    expect(mocks.popup).toHaveBeenCalledTimes(1); expect(second).toBe(first);
    expect(mocks.parameters).toHaveBeenCalledWith({ prompt: 'select_account' });
    const result = { user: actor } as UserCredential;
    waiting.resolve(result); await expect(first).resolves.toBe(result);
  });

  it('keeps the Firebase error code, records the failure and permits an explicit retry', async () => {
    const { auth } = session();
    const error = Object.assign(new Error('popup blocked'), { code: 'auth/popup-blocked' });
    mocks.popup.mockRejectedValueOnce(error).mockResolvedValueOnce({ user: actor });
    await expect(signInWithGoogle(auth)).rejects.toBe(error);
    expect(mocks.report).toHaveBeenCalledWith(error, { context: 'google-signin', kind: 'auth' });
    await expect(signInWithGoogle(auth)).resolves.toMatchObject({ user: actor });
    expect(mocks.popup).toHaveBeenCalledTimes(2);
  });
});

describe('interrupted member bootstrap', () => {
  it('creates only a pending ordinary member and an empty private profile for a restored Auth session', async () => {
    const { auth } = session();
    await ensureMemberProfile(auth, database, actor);
    expect(records.get(`members/${actor.uid}`)).toMatchObject({ id: actor.uid, name: actor.displayName, email: actor.email, role: 'member', status: 'pending', canCreatePoll: false });
    expect(records.get(`profiles/${actor.uid}`)).toEqual({ id: actor.uid, phone: '', area: '' });
  });

  it.each(['active', 'pending', 'rejected'] as const)('preserves an existing %s member and their personal information', async status => {
    const { auth } = session();
    const existing = { ...member, status };
    const profile = { id: actor.uid, phone: '010-0000-9901', area: '서울 중랑구', birthday: '02-20', language: 'en', theme: 'dark' };
    records.set(`members/${actor.uid}`, existing); records.set(`profiles/${actor.uid}`, profile);
    await ensureMemberProfile(auth, database, actor);
    expect(writes).not.toHaveBeenCalled();
    expect(records.get(`members/${actor.uid}`)).toEqual(existing);
    expect(records.get(`profiles/${actor.uid}`)).toEqual(profile);
  });

  it('repairs a missing private profile without changing an approved role', async () => {
    const { auth } = session(); records.set(`members/${actor.uid}`, member);
    await ensureMemberProfile(auth, database, actor);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes).toHaveBeenCalledWith(`profiles/${actor.uid}`, { id: actor.uid, phone: '', area: '' });
  });

  it('keeps an existing orphaned profile when recovering its missing member', async () => {
    const { auth } = session(); const profile = { id: actor.uid, phone: '010-0000-9902', area: '서울 중랑구' };
    records.set(`profiles/${actor.uid}`, profile);
    await ensureMemberProfile(auth, database, actor);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(records.get(`profiles/${actor.uid}`)).toEqual(profile);
  });

  it('does not write a previous account after the authenticated user changes during the reads', async () => {
    const { auth, current } = session();
    mocks.transaction.mockImplementationOnce(async (_database, update) => update({
      get: async (reference: { id: string }) => { current.currentUser = null; return snapshot(reference.id, undefined); }, set: writes,
    }));
    await expect(ensureMemberProfile(auth, database, actor)).rejects.toMatchObject({ code: 'auth/session-changed' });
    expect(writes).not.toHaveBeenCalled();
  });
});

describe('restored authentication lifecycle', () => {
  it('bootstraps before listening to the member, so an initial missing snapshot cannot send the user back to login', async () => {
    const { auth } = session(); const { states } = observe(auth);
    authChanged(actor);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    const next = await memberListener();
    expect(records.get(`members/${actor.uid}`)).toBeDefined();
    next(snapshot(actor.uid, records.get(`members/${actor.uid}`)));
    expect(states.at(-1)).toMatchObject({ uid: actor.uid, member: { status: 'pending' }, loading: false, error: null });
    expect(mocks.popup).not.toHaveBeenCalled();
  });

  it('ends the spinner if Auth initialization never responds, and accepts a later response', async () => {
    vi.useFakeTimers(); const { auth } = session(); const { states } = observe(auth);
    await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_TIMEOUT_MS);
    expect(states.at(-1)).toMatchObject({ member: null, loading: false, error: { code: 'auth/auth-state-timeout' } });
    authChanged(null);
    expect(states.at(-1)).toEqual({ uid: null, member: null, loading: false, error: null });
  });

  it('ends a stalled member spinner and can recover when the member arrives later', async () => {
    vi.useFakeTimers(); const { auth } = session(); const { states } = observe(auth);
    authChanged(actor); const next = await memberListener();
    await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_TIMEOUT_MS);
    expect(states.at(-1)).toMatchObject({ member: null, loading: false, error: { code: 'auth/member-load-timeout' } });
    next(snapshot(actor.uid, member));
    expect(states.at(-1)).toEqual({ uid: actor.uid, member, loading: false, error: null });
  });

  it('surfaces a bootstrap permission error without a retry loop, then recovers on a new subscription without a popup', async () => {
    const { auth } = session(); const failure = Object.assign(new Error('denied'), { code: 'permission-denied' });
    mocks.transaction.mockRejectedValueOnce(failure);
    const first = observe(auth); authChanged(actor);
    await vi.waitFor(() => expect(first.states.at(-1)?.error).toBe(failure));
    expect(first.states.at(-1)?.loading).toBe(false); expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    first.stop();
    const second = observe(auth); authChanged(actor); const next = await memberListener();
    next(snapshot(actor.uid, member));
    expect(second.states.at(-1)).toMatchObject({ member, loading: false, error: null });
    expect(mocks.popup).not.toHaveBeenCalled();
  });

  it('ignores a bootstrap that completes after sign-out and cleans up the subscriptions', async () => {
    const { auth, current } = session(); const pending = deferred<void>();
    mocks.transaction.mockReturnValueOnce(pending.promise);
    const { states, stop } = observe(auth); authChanged(actor);
    current.currentUser = null; authChanged(null);
    pending.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(states.at(-1)).toEqual({ uid: null, member: null, loading: false, error: null });
    expect(mocks.snapshot).not.toHaveBeenCalled();
    stop(); expect(stopAuth).toHaveBeenCalled();
  });

  it('cleans up a member listener and ignores its late data after unmount', async () => {
    const { auth } = session(); const { states, stop } = observe(auth);
    authChanged(actor); const next = await memberListener();
    stop(); const count = states.length;
    next(snapshot(actor.uid, member));
    expect(states).toHaveLength(count); expect(stopMember).toHaveBeenCalled();
  });
});
