import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import type { Auth, Unsubscribe, User, UserCredential } from 'firebase/auth';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Member } from './types';
import { reportError } from './telemetry';

export const AUTH_RECOVERY_TIMEOUT_MS = 20_000;
const popupRequests = new WeakMap<Auth, Promise<UserCredential>>();

function authError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

/** Open the popup in the button's user gesture, before any asynchronous setup. */
export function signInWithGoogle(auth: Auth): Promise<UserCredential> {
  const pending = popupRequests.get(auth);
  if (pending) return pending;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let request: Promise<UserCredential>;
  try { request = signInWithPopup(auth, provider); }
  catch (error) {
    reportError(error, { context: 'google-signin', kind: 'auth' });
    return Promise.reject(error);
  }
  const result = request.catch(error => {
    reportError(error, { context: 'google-signin', kind: 'auth' });
    throw error;
  }).finally(() => popupRequests.delete(auth));
  popupRequests.set(auth, result);
  return result;
}

/** Repair an interrupted first sign-in without replacing saved roles or personal data. */
export async function ensureMemberProfile(auth: Auth, database: Firestore, actor: User): Promise<void> {
  const assertSession = () => {
    if (auth.currentUser?.uid !== actor.uid) throw authError('auth/session-changed', '로그인 계정이 변경됐어요. 다시 시도해 주세요.');
  };
  assertSession();
  await runTransaction(database, async transaction => {
    const memberRef = doc(database, 'members', actor.uid);
    const profileRef = doc(database, 'profiles', actor.uid);
    const [member, profile] = await Promise.all([transaction.get(memberRef), transaction.get(profileRef)]);
    assertSession();
    if (!member.exists()) {
      const next: Member = {
        id: actor.uid, name: actor.displayName?.slice(0, 30) || '새 멤버', email: actor.email || '',
        ...(actor.photoURL ? { photoURL: actor.photoURL } : {}),
        role: 'member', status: 'pending', canCreatePoll: false, joinedAt: new Date().toISOString(),
      };
      transaction.set(memberRef, next);
    }
    if (!profile.exists()) transaction.set(profileRef, { id: actor.uid, phone: '', area: '' });
  });
}

export interface AuthSessionState {
  uid: string | null;
  member: Member | null;
  loading: boolean;
  error: unknown | null;
}

/** The observer also bootstraps persisted sessions, not just a successful popup. */
export function observeAuthSession(auth: Auth, database: Firestore, onChange: (state: AuthSessionState) => void): Unsubscribe {
  let state: AuthSessionState = { uid: null, member: null, loading: true, error: null };
  let stopped = false;
  let generation = 0;
  let memberSubscription: Unsubscribe | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = () => { if (!stopped) onChange({ ...state }); };
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const fail = (error: unknown, expected: number) => {
    if (stopped || generation !== expected) return;
    clearTimer();
    reportError(error, { context: 'member-bootstrap', kind: 'auth' });
    state = { ...state, member: null, loading: false, error };
    publish();
  };
  timer = setTimeout(() => fail(authError('auth/auth-state-timeout', '로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.'), generation), AUTH_RECOVERY_TIMEOUT_MS);
  publish();
  const unsubscribe = onAuthStateChanged(auth, actor => {
    if (stopped) return;
    const expected = ++generation;
    clearTimer(); memberSubscription?.(); memberSubscription = undefined;
    state = { uid: actor?.uid ?? null, member: null, loading: !!actor, error: null };
    publish();
    if (!actor) return;
    timer = setTimeout(() => fail(authError('auth/member-load-timeout', '로그인 정보를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'), expected), AUTH_RECOVERY_TIMEOUT_MS);
    void ensureMemberProfile(auth, database, actor).then(() => {
      if (stopped || generation !== expected || auth.currentUser?.uid !== actor.uid) return;
      memberSubscription = onSnapshot(doc(database, 'members', actor.uid), snapshot => {
        if (stopped || generation !== expected || auth.currentUser?.uid !== actor.uid) return;
        if (!snapshot.exists()) {
          fail(authError('auth/user-not-found', '가입 정보를 찾을 수 없어요. 다시 로그인해 주세요.'), expected);
          return;
        }
        clearTimer();
        state = { uid: actor.uid, member: { ...snapshot.data(), id: snapshot.id } as Member, loading: false, error: null };
        publish();
      }, error => fail(error, expected));
    }).catch(error => fail(error, expected));
  }, error => fail(error, generation));
  return () => {
    stopped = true; generation++; clearTimer(); memberSubscription?.(); unsubscribe();
  };
}
