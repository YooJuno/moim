import { CheckCheck, ChevronDown, UserPlus } from 'lucide-react';
import type { Member } from '../lib/types';
import { useI18n } from '../lib/preferences';
import { Avatar, Button } from './ui';
import './event-invitations.css';

export function EventInvitePicker({ members, selected, onChange, disabled }: { members:Member[]; selected:string[]; onChange:(ids:string[])=>void; disabled?:boolean }) {
  const {t}=useI18n();
  const everyone=members.length>0&&members.every(member=>selected.includes(member.id));
  return <details className="event-invite-picker"><summary><UserPlus size={18}/><strong>{t('멤버 초대')}</strong><span>{selected.length}/{members.length}</span><ChevronDown size={16}/></summary>
    <div className="event-invite-options"><div className="event-invite-tools"><Button variant="ghost" size="sm" icon={CheckCheck} disabled={disabled} onClick={()=>onChange(everyone?[]:members.map(member=>member.id))}>{everyone?t('선택 해제'):t('전체 선택')}</Button></div>
      <div className="event-invite-grid" role="group" aria-label={t('초대할 멤버')}>{members.map(member=><label key={member.id} className={selected.includes(member.id)?'is-selected':''}><Avatar member={member} size={28}/><span>{member.name}</span><input type="checkbox" aria-label={member.name} checked={selected.includes(member.id)} disabled={disabled} onChange={event=>onChange(event.target.checked?[...selected,member.id]:selected.filter(id=>id!==member.id))}/></label>)}</div>
    </div>
  </details>;
}
