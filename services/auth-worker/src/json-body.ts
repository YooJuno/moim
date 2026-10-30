import {HttpError} from './types';

const MAX_BODY_BYTES=16384;

/** Enforce the byte limit while reading, including requests without Content-Length. */
export async function parseJsonBody(request:Request):Promise<Record<string,unknown>> {
 if(request.headers.get('Content-Type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')throw new HttpError(415,'json_required');
 if(Number(request.headers.get('Content-Length')??0)>MAX_BODY_BYTES){void request.body?.cancel().catch(()=>{});throw new HttpError(413,'body_too_large');}
 if(!request.body)throw new HttpError(400,'invalid_json');
 const reader=request.body.getReader();
 try {
  const chunks:Uint8Array[]=[];let size=0;
  while(true){
   const next=await reader.read();if(next.done)break;
   size+=next.value.byteLength;
   if(size>MAX_BODY_BYTES){void reader.cancel().catch(()=>{});throw new HttpError(413,'body_too_large');}
   if(next.value.byteLength)chunks.push(next.value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value || typeof value!=='object' || Array.isArray(value))throw new HttpError(400,'invalid_json');
  return value as Record<string,unknown>;
 }catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'invalid_json');}
 finally{reader.releaseLock();}
}
