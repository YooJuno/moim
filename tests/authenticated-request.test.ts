import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const sdk=vi.hoisted(()=>({auth:{currentUser:null as null|{uid:string;getIdToken:ReturnType<typeof vi.fn>},authStateReady:vi.fn()}}));
vi.mock('../src/lib/firebase',()=>({auth:sdk.auth}));
import { withAuthenticatedRequest } from '../src/lib/authenticated-request';
beforeEach(()=>{sdk.auth.currentUser={uid:'member',getIdToken:vi.fn().mockResolvedValue('test-token')};sdk.auth.authStateReady.mockReset().mockResolvedValue(undefined);});
afterEach(()=>vi.useRealTimers());
it.each(['initialization','token'])('times out hung %s and never starts a late mutation',async stage=>{
  vi.useFakeTimers();let finish!:(value?:unknown)=>void;const hanging=new Promise(resolve=>{finish=resolve;});
  if(stage==='initialization')sdk.auth.authStateReady.mockReturnValue(hanging);else sdk.auth.currentUser!.getIdToken.mockReturnValue(hanging);
  const work=vi.fn();const failure=expect(withAuthenticatedRequest(work)).rejects.toThrow('요청 시간이 초과');
  await vi.advanceTimersByTimeAsync(10000);await failure;finish('late-token');await Promise.resolve();await Promise.resolve();expect(work).not.toHaveBeenCalled();
});
it('bounds a hung API response and does not retry a write',async()=>{
  vi.useFakeTimers();const work=vi.fn().mockReturnValue(new Promise(()=>{}));const failure=expect(withAuthenticatedRequest(work)).rejects.toThrow('요청 시간이 초과');
  await vi.advanceTimersByTimeAsync(10000);await failure;expect(work).toHaveBeenCalledTimes(1);expect(work.mock.calls[0][1].aborted).toBe(true);
});
it('honors cancellation before token lookup and checks the account before and after a response',async()=>{
  const work=vi.fn().mockResolvedValue('data');const controller=new AbortController();controller.abort();
  await expect(withAuthenticatedRequest(work,controller.signal)).rejects.toMatchObject({name:'AbortError'});expect(sdk.auth.authStateReady).not.toHaveBeenCalled();
  sdk.auth.currentUser!.getIdToken.mockImplementation(async()=>{sdk.auth.currentUser=null;return'old-token';});await expect(withAuthenticatedRequest(work)).rejects.toThrow('계정이 변경');expect(work).not.toHaveBeenCalled();
  sdk.auth.currentUser={uid:'member',getIdToken:vi.fn().mockResolvedValue('test-token')};work.mockImplementation(async()=>{sdk.auth.currentUser=null;return'data';});await expect(withAuthenticatedRequest(work)).rejects.toThrow('계정이 변경');
});
