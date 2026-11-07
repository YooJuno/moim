import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { clearServiceConfigCache, getServiceConfig } from '../src/lib/service-config';
const flags = {providers:{kakao:true,naver:false},calendar:{kakao:true},notifications:{sms:true},places:{naver:true}};
const response = () => new Response(JSON.stringify(flags));
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => { clearServiceConfigCache(); vi.stubEnv('VITE_AUTH_API_URL','https://auth.example.test/'); fetcher=vi.fn().mockImplementation(async()=>response()); vi.stubGlobal('fetch',fetcher); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('shares concurrent public flags and reuses them for sixty seconds across screens', async()=>{
  vi.useFakeTimers();const [one,two,three]=await Promise.all([getServiceConfig(),getServiceConfig(),getServiceConfig()]);
  expect(one).toEqual(flags);expect(two).toBe(one);expect(three).toBe(one);expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await getServiceConfig()).toBe(one);expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
  await vi.advanceTimersByTimeAsync(60001);expect(await getServiceConfig()).toEqual(flags);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not cancel another consumer when one screen is closed',async()=>{
  let finish!:()=>void;fetcher.mockImplementation(()=>new Promise(resolve=>{finish=()=>resolve(response());}));
  const controller=new AbortController();const cancelled=expect(getServiceConfig(controller.signal)).rejects.toMatchObject({name:'AbortError'});const remaining=getServiceConfig();
  await Promise.resolve();controller.abort();await cancelled;expect(fetcher.mock.calls[0][1].signal.aborted).toBe(false);
  finish();expect(await remaining).toEqual(flags);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not cache failures and retries only when called again',async()=>{
  fetcher.mockRejectedValueOnce(new TypeError('offline'));await expect(getServiceConfig()).rejects.toThrow();
  expect(await getServiceConfig()).toEqual(flags);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('validates booleans and isolates flags by API origin',async()=>{
  fetcher.mockImplementation(async()=>new Response(JSON.stringify({providers:{kakao:'true'},places:{naver:true}})));
  expect((await getServiceConfig())?.providers.kakao).toBe(false);
  vi.stubEnv('VITE_AUTH_API_URL','https://other.example.test/');await getServiceConfig();expect(fetcher).toHaveBeenCalledTimes(2);
  expect(String(fetcher.mock.calls[1][0])).toBe('https://other.example.test/config');
});
it('returns a deadline error when the transport hangs and sends nothing for an already cancelled caller',async()=>{
  vi.useFakeTimers();fetcher.mockImplementation(()=>new Promise(()=>{}));
  const failed=expect(getServiceConfig()).rejects.toThrow();await vi.advanceTimersByTimeAsync(10000);await failed;
  const controller=new AbortController();controller.abort();await expect(getServiceConfig(controller.signal)).rejects.toMatchObject({name:'AbortError'});expect(fetcher).toHaveBeenCalledTimes(1);
});
