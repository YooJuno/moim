import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useApp } from '../lib/store';
import { Button, IconButton } from './ui';
import './guided-tour.css';

type Step={id:string;title:string;body:string;selectors:string[]};
type Layout={spotlight:{left:number;top:number;width:number;height:number}|null;left:number;top:number;width:number};
const disabled=import.meta.env.VITE_DISABLE_TOUR==='true';
const keyFor=(id:string)=>`moim-tour-v1:${id}`;
const clamp=(value:number,min:number,max:number)=>Math.min(Math.max(value,min),Math.max(min,max));
function targetFor(step:Step){for(const selector of step.selectors){const target=document.querySelector<HTMLElement>(selector);if(!target)continue;const rect=target.getBoundingClientRect();const style=getComputedStyle(target);if(rect.width>0&&rect.height>0&&style.display!=='none'&&style.visibility!=='hidden')return target;}return null;}
function stepsFor(admin:boolean):Step[]{return [
  {id:'home',title:'모임 홈',body:'예정된 모임과 진행 중인 투표, 새 소식을 한눈에 확인해요.',selectors:['[data-tour="home"]']},
  {id:'group',title:'모임 정보',body:admin?'모임 이름과 인원을 확인해요. 누르면 모임 설정으로 이동해요.':'모임 이름과 함께하는 인원을 확인해요.',selectors:['[data-tour="group"]']},
  {id:'polls',title:'일정 투표',body:'시간표에서 가능한 시간을 1시간 단위로 누르거나 드래그해 선택해요.',selectors:['[data-tour="nav-polls"]','[data-tour="mobile-nav-polls"]']},
  {id:'calendar',title:'모임 캘린더',body:'모임별 참석 여부를 등록하고 장소 투표에 참여해요. MVP 투표는 모임 종료 10분 전부터 열려요.',selectors:['[data-tour="nav-calendar"]','[data-tour="mobile-nav-calendar"]']},
  {id:'board',title:'게시판',body:'공지사항, 자유게시판, 정보 나눔과 사진첩에서 글과 사진을 나눠요.',selectors:['[data-tour="nav-board"]','[data-tour="mobile-nav-board"]']},
  {id:'members',title:'멤버',body:admin?'멤버 명단과 직책을 관리하고 가입 계정을 기존 명단에 연결해요.':'멤버와 직책을 확인해요.',selectors:['[data-tour="nav-members"]']},
  {id:'more',title:'더보기',body:`멤버, 회칙, 회계 장부는 여기에서 열어요.${admin?' 모임 설정도 여기에서 관리해요.':''}`,selectors:['[data-tour="mobile-more"]']},
  {id:'invite',title:'모임 초대',body:'모임 링크를 복사하거나 카카오톡으로 공유해요.',selectors:['[data-tour="invite"]']},
  {id:'profile',title:'내 정보',body:'이름, 연락처와 생일을 수정하고 로그아웃할 수 있어요. 화면 안내도 다시 볼 수 있어요.',selectors:['[data-tour="profile"]']},
  ...(admin?[{id:'settings',title:'모임 설정',body:'모임 이름과 대표 사진, 자주 가는 장소를 관리해요.',selectors:['[data-tour="settings"]']}]:[]),
];}

export function GuidedTour(){
  const app=useApp();const userId=app.user?.id;const active=app.user?.status==='active';
  const [open,setOpen]=useState(false);const [steps,setSteps]=useState<Step[]>([]);const [index,setIndex]=useState(0);const [layout,setLayout]=useState<Layout>({spotlight:null,left:16,top:16,width:320});
  const panel=useRef<HTMLDivElement>(null);const previousFocus=useRef<HTMLElement|null>(null);const isOpen=useRef(false);isOpen.current=open;
  const headingId=useId();const descriptionId=useId();
  const start=useCallback(()=>{if(disabled||!active||!userId)return;if(!isOpen.current)previousFocus.current=document.activeElement as HTMLElement|null;const available=stepsFor(app.isAdmin).filter(step=>step.id==='home'||targetFor(step));setSteps(available);setIndex(0);setOpen(true);},[active,userId,app.isAdmin]);
  const close=useCallback(()=>{if(userId)try{localStorage.setItem(keyFor(userId),'1');}catch{/* Unavailable browser storage does not prevent closing. */}setOpen(false);},[userId]);
  const next=useCallback(()=>{if(index>=steps.length-1)close();else setIndex(current=>current+1);},[index,steps.length,close]);

  useEffect(()=>{if(disabled||!active||!userId)return;window.addEventListener('moim:start-tour',start);return()=>window.removeEventListener('moim:start-tour',start);},[active,userId,start]);
  useEffect(()=>{if(disabled||!active||!userId||app.isDemo)return;let timer:ReturnType<typeof setTimeout>;let attempts=0;const tryStart=()=>{try{if(localStorage.getItem(keyFor(userId)))return;}catch{/* Show the first-use guide if storage is unavailable. */}if(isOpen.current)return;if(document.querySelector('[role="dialog"]')){if(++attempts<60)timer=setTimeout(tryStart,1000);return;}start();};timer=setTimeout(tryStart,600);return()=>clearTimeout(timer);},[active,userId,app.isDemo,start]);
  useEffect(()=>{if(!active)setOpen(false);},[active,userId]);
  useEffect(()=>{if(!open)return;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;const target=previousFocus.current;if(target?.isConnected)requestAnimationFrame(()=>target.focus());};},[open]);

  useLayoutEffect(()=>{
    if(!open||!steps[index])return;const step=steps[index];const target=targetFor(step);target?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
    let frame=0;
    const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const width=window.innerWidth,height=window.innerHeight,tipWidth=Math.min(340,width-32),tipHeight=panel.current?.offsetHeight??210;const current=targetFor(step);const rect=current?.getBoundingClientRect();
      let spotlight:Layout['spotlight']=null;let left=(width-tipWidth)/2,top=(height-tipHeight)/2;
      if(rect){const leftEdge=clamp(rect.left-6,8,width-8),topEdge=clamp(rect.top-6,8,height-8);spotlight={left:leftEdge,top:topEdge,width:Math.max(0,Math.min(width-8,rect.right+6)-leftEdge),height:Math.max(0,Math.min(height-8,rect.bottom+6)-topEdge)};
        if(width>=720&&rect.right<270){left=rect.right+20;top=rect.top+(rect.height-tipHeight)/2;}
        else if(rect.bottom+tipHeight+24<height){left=rect.left+(rect.width-tipWidth)/2;top=rect.bottom+18;}
        else if(rect.top-tipHeight-18>=16){left=rect.left+(rect.width-tipWidth)/2;top=rect.top-tipHeight-18;}
        else if(rect.right+tipWidth+24<width){left=rect.right+18;top=rect.top;}
      }
      setLayout({spotlight,left:clamp(left,16,width-tipWidth-16),top:clamp(top,16,height-tipHeight-16),width:tipWidth});
    });};
    measure();const timer=setTimeout(measure,100);window.addEventListener('resize',measure);document.addEventListener('scroll',measure,true);const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;if(target)observer?.observe(target);if(panel.current)observer?.observe(panel.current);
    return()=>{cancelAnimationFrame(frame);clearTimeout(timer);window.removeEventListener('resize',measure);document.removeEventListener('scroll',measure,true);observer?.disconnect();};
  },[open,index,steps]);

  useEffect(()=>{if(!open)return;const frame=requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('[data-tour-next]')?.focus());const onKey=(event:KeyboardEvent)=>{
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
    if(event.key==='ArrowRight'){event.preventDefault();event.stopImmediatePropagation();next();return;}
    if(event.key==='ArrowLeft'){event.preventDefault();event.stopImmediatePropagation();setIndex(current=>Math.max(0,current-1));return;}
    if(event.key!=='Tab')return;const buttons=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);if(!buttons.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&(document.activeElement===first||!panel.current?.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!panel.current?.contains(document.activeElement))){event.preventDefault();first.focus();}event.stopPropagation();
  };document.addEventListener('keydown',onKey,true);return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',onKey,true);};},[open,index,close,next]);

  if(disabled||!open||!active||!steps[index])return null;
  const step=steps[index];
  return createPortal(<div className="guided-tour-overlay"><div className="guided-tour-spotlight" aria-hidden="true" style={layout.spotlight??{left:'50%',top:'50%',width:0,height:0}}/><div ref={panel} className="guided-tour-tooltip" role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId} data-tour-step={step.id} style={{left:layout.left,top:layout.top,width:layout.width}}><div className="guided-tour-heading"><span id={headingId}>화면 안내</span><span>{index+1} / {steps.length}</span><IconButton label="화면 안내 닫기" icon={X} onClick={close}/></div><h2>{step.title}</h2><p id={descriptionId}>{step.body}</p><div className="guided-tour-actions"><button className="guided-tour-skip" onClick={close}>건너뛰기</button><Button variant="secondary" size="sm" icon={ArrowLeft} disabled={index===0} onClick={()=>setIndex(current=>Math.max(0,current-1))}>이전</Button><Button size="sm" icon={index===steps.length-1?Check:ArrowRight} data-tour-next onClick={next}>{index===steps.length-1?'완료':'다음'}</Button></div></div></div>,document.body);
}
