import {describe,expect,it,vi} from 'vitest';
import {parseJsonBody} from '../src/json-body';

const request=(body:string,contentType='application/json')=>new Request('https://auth.test/oauth/exchange',{method:'POST',headers:{'Content-Type':contentType},body});

describe('bounded OAuth and SMS JSON bodies',()=>{
 it('accepts JSON objects with a charset parameter and rejects misleading media types',async()=>{
  expect(await parseJsonBody(request('{"code":"ok"}','Application/JSON; charset=utf-8'))).toEqual({code:'ok'});
  await expect(parseJsonBody(request('{}','application/jsonp'))).rejects.toMatchObject({status:415,code:'json_required'});
 });
 it('counts UTF-8 bytes rather than JavaScript character length',async()=>{
  const text=JSON.stringify({text:'가'.repeat(6000)});expect(text.length).toBeLessThan(16384);
  await expect(parseJsonBody(request(text))).rejects.toMatchObject({status:413,code:'body_too_large'});
  expect(await parseJsonBody(request('{"text":"'+'a'.repeat(16373)+'"}'))).toEqual({text:'a'.repeat(16373)});
 });
 it('cancels an oversized chunked request before reading the entire stream',async()=>{
  const cancel=vi.fn();let pulls=0;
  const stream=new ReadableStream<Uint8Array>({pull(controller){pulls++;controller.enqueue(new Uint8Array(8192));},cancel},{highWaterMark:0});
  const incoming=new Request('https://auth.test/oauth/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:stream,duplex:'half'} as RequestInit);
  await expect(parseJsonBody(incoming)).rejects.toMatchObject({status:413,code:'body_too_large'});
  expect(pulls).toBe(3);expect(cancel).toHaveBeenCalledOnce();expect(incoming.body!.locked).toBe(false);
 });
 it('does not consume a body already declared too large and rejects invalid JSON objects',async()=>{
  const cancel=vi.fn(),pull=vi.fn();
  const stream=new ReadableStream<Uint8Array>({pull,cancel},{highWaterMark:0});
  const incoming=new Request('https://auth.test/oauth/exchange',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'20000'},body:stream,duplex:'half'} as RequestInit);
  await expect(parseJsonBody(incoming)).rejects.toMatchObject({status:413});expect(pull).not.toHaveBeenCalled();expect(cancel).toHaveBeenCalledOnce();
  for(const invalid of ['null','[]','true','{',''])await expect(parseJsonBody(request(invalid))).rejects.toMatchObject({status:400,code:'invalid_json'});
 });
 it('rejects broken UTF-8 rather than replacing bytes in an OAuth value',async()=>{
  const incoming=new Request('https://auth.test/oauth/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:new Uint8Array([123,34,120,34,58,34,255,34,125])});
  await expect(parseJsonBody(incoming)).rejects.toMatchObject({status:400,code:'invalid_json'});
 });
});
