import { auth } from './firebase';
import { withRequestDeadline } from './request-deadline';

export async function withAuthenticatedRequest<T>(work: (token: string, signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await withRequestDeadline(async requestSignal => {
      if (!auth) throw new Error('로그인이 필요해요.');
      await auth.authStateReady();
      requestSignal.throwIfAborted();
      const user = auth.currentUser;
      if (!user) throw new Error('로그인이 필요해요.');
      const check = () => {
        requestSignal.throwIfAborted();
        if (auth?.currentUser?.uid !== user.uid) throw new Error('로그인 계정이 변경됐어요. 다시 시도해 주세요.');
      };
      const token = await user.getIdToken();
      check();
      const result = await work(token, requestSignal);
      check();
      return result;
    }, signal);
  } catch (error) {
    if (!signal?.aborted && error instanceof DOMException && error.name === 'AbortError') {
      throw Object.assign(new Error('요청 시간이 초과됐어요. 연결을 확인하고 다시 시도해 주세요.'), { code: 'network-error' });
    }
    throw error;
  }
}
