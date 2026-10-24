import { useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useI18n } from '../lib/preferences';
import { formatI18nDate, getLanguage } from '../lib/i18n';
import { Button, Field, IconButton } from './ui';
import './birthday-field.css';

export function isValidBirthday(value:string) {
  if(!value)return true;
  if(!/^\d{2}-\d{2}$/.test(value))return false;
  const [month,day]=value.split('-').map(Number);const date=new Date(Date.UTC(2000,month-1,day));
  return date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
const daysInMonth=(month:number)=>new Date(2000,month,0).getDate();
const birthdayValue=(month:number,day:number)=>`${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

export function BirthdayField({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const {t,formatDate}=useI18n();const [open,setOpen]=useState(false);const [month,setMonth]=useState(value?Number(value.slice(0,2)):new Date().getMonth()+1);const [day,setDay]=useState(value?Number(value.slice(3)):1);const [position,setPosition]=useState({left:16,top:16,width:320});const input=useRef<HTMLInputElement>(null);const popup=useRef<HTMLDivElement>(null);const monthInput=useRef<HTMLSelectElement>(null);
  function close(restore=true){setOpen(false);if(restore)requestAnimationFrame(()=>input.current?.focus());}
  function show(){if(input.current?.matches(':disabled'))return;setMonth(value?Number(value.slice(0,2)):new Date().getMonth()+1);setDay(value?Number(value.slice(3)):1);setOpen(true);}
  function changeMonth(next:number){setMonth(next);setDay(current=>Math.min(current,daysInMonth(next)));}
  function commit(selected=day){onChange(birthdayValue(month,selected));close();}
  useLayoutEffect(()=>{if(!open||!popup.current)return;const panel=popup.current;panel.showPopover();const measure=()=>{const anchor=input.current?.getBoundingClientRect();if(!anchor)return;const width=Math.min(328,window.innerWidth-32),height=panel.offsetHeight;const left=Math.max(16,Math.min(anchor.left,window.innerWidth-width-16));const below=anchor.bottom+9;const top=below+height<window.innerHeight-16?below:Math.max(16,anchor.top-height-9);setPosition({left,top,width});};measure();monthInput.current?.focus();window.addEventListener('resize',measure);document.addEventListener('scroll',measure,true);return()=>{window.removeEventListener('resize',measure);document.removeEventListener('scroll',measure,true);};},[open]);
  return <div className="birthday-field"><Field label={t('생일')} hint={t('월-일 · 생일은 모임 캘린더에 표시돼요.')}><div className="birthday-value"><input ref={input} aria-label={t('생일')} value={value} readOnly placeholder={t('생일 선택')} aria-haspopup="dialog" aria-expanded={open} onClick={show} onKeyDown={event=>{if(['Enter',' ','ArrowDown'].includes(event.key)){event.preventDefault();show();}if((event.key==='Backspace'||event.key==='Delete')&&value){event.preventDefault();onChange('');}}}/><IconButton label={t('달력 열기')} icon={CalendarDays} onClick={event=>{event.preventDefault();show();}}/>{value&&<IconButton label={t('생일 지우기')} icon={X} onClick={event=>{event.preventDefault();event.stopPropagation();onChange('');}}/>}</div></Field>
    {open&&<div ref={popup} popover="auto" role="dialog" aria-label={t('생일 선택')} className="birthday-picker" style={position} onToggle={event=>{if((event.nativeEvent as ToggleEvent).newState==='closed')setOpen(false);}} onBlurCapture={event=>{if(event.relatedTarget instanceof HTMLElement&&!event.currentTarget.contains(event.relatedTarget))close(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
      <div className="birthday-picker-heading"><strong>{t('생일 선택')}</strong><IconButton label={t('닫기')} icon={X} onClick={()=>close()}/></div>
      <div className="birthday-picker-selects"><label><span>{t('월 선택')}</span><select ref={monthInput} aria-label={t('월 선택')} value={month} onChange={event=>changeMonth(Number(event.target.value))}>{Array.from({length:12},(_,index)=>index+1).map(value=><option key={value} value={value}>{formatDate(`2000-${String(value).padStart(2,'0')}-01`,{month:'long'})}</option>)}</select></label><label><span>{t('일 선택')}</span><select aria-label={t('일 선택')} value={day} onChange={event=>setDay(Number(event.target.value))}>{Array.from({length:daysInMonth(month)},(_,index)=>index+1).map(value=><option key={value} value={value}>{value}</option>)}</select></label></div>
      <div className="birthday-picker-month"><IconButton label={t('이전 달')} icon={ChevronLeft} onClick={()=>changeMonth(month===1?12:month-1)}/><strong>{formatDate(`2000-${String(month).padStart(2,'0')}-01`,{month:'long'})}</strong><IconButton label={t('다음 달')} icon={ChevronRight} onClick={()=>changeMonth(month===12?1:month+1)}/></div>
      <div className="birthday-picker-days" role="group" aria-label={t('생일 날짜')}>{Array.from({length:daysInMonth(month)},(_,index)=>index+1).map(value=><button type="button" key={value} data-birthday-day={value} tabIndex={day===value?0:-1} aria-label={formatDate(`2000-${birthdayValue(month,value)}`,{month:'long',day:'numeric'})} aria-pressed={day===value} onClick={()=>commit(value)} onKeyDown={event=>{const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};const offset=offsets[event.key];if(offset!==undefined||event.key==='Home'||event.key==='End'){event.preventDefault();const next=event.key==='Home'?1:event.key==='End'?daysInMonth(month):Math.max(1,Math.min(daysInMonth(month),value+offset!));setDay(next);popup.current?.querySelector<HTMLButtonElement>(`[data-birthday-day="${next}"]`)?.focus();}}}>{value}</button>)}</div>
      <div className="birthday-picker-actions">{value&&<Button variant="ghost" size="sm" onClick={()=>{onChange('');close();}}>{t('지우기')}</Button>}<Button size="sm" onClick={()=>commit()}>{t('선택')}</Button></div>
    </div>}
  </div>;
}
export function birthdayLabel(value:string){return formatI18nDate(`2000-${value}`,getLanguage());}
