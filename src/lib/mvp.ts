import type { MoimEvent } from './types';
export function mvpWindow(event:MoimEvent,now=Date.now()){
  const end=new Date(`${event.date}T${event.end}:00+09:00`).getTime();
  const opens=end-10*60*1000,closes=end+24*60*60*1000;
  return {opens,closes,isOpen:now>=opens&&now<closes,isClosed:now>=closes};
}
