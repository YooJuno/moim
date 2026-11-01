import {useEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import {Bell,CalendarPlus,ChevronRight,Megaphone} from 'lucide-react';
import {useApp} from '../lib/store';
import {useI18n} from '../lib/preferences';
import {formatDate} from '../lib/utils';
import {pendingEventInvitations} from '../lib/event-invitations';
import './event-invitations.css';

export function Notifications(){
  const app=useApp(),{t}=useI18n(),root=useRef<HTMLDetailsElement>(null);
  const invitations=pendingEventInvitations(app.events,app.rsvps,app.user?.id);
  const close=()=>{if(root.current)root.current.open=false;};
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close();};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&root.current?.open){event.preventDefault();close();root.current.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
  return <details ref={root} className="notifications"><summary aria-label={t('알림')} title={t('알림')}><Bell size={20}/>{invitations.length>0&&<span className="notification-count">{invitations.length}</span>}</summary>
    <div className="notification-panel" role="region" aria-label={t('알림')}><h3>{t('일정 초대')}</h3>
      {invitations.length?invitations.map(event=><Link key={event.id} to={`/calendar?event=${encodeURIComponent(event.id)}`} onClick={close} className="notification-event"><CalendarPlus size={19}/><span><strong>{event.title}</strong><small>{formatDate(event.date)} · {event.start}–{event.end}</small></span><ChevronRight size={15}/></Link>):<p>{t('초대된 일정이 없어요.')}</p>}
      <Link to="/board?category=notice" className="notification-notices" onClick={close}><Megaphone size={16}/>{t('공지사항')}<ChevronRight size={14}/></Link>
    </div>
  </details>;
}
