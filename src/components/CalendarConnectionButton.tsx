import { CalendarDays, Check, ChevronRight, MessageCircle, RefreshCw } from 'lucide-react';
import { useId } from 'react';
import { useI18n } from '../lib/preferences';
import './calendar-connections.css';

export function CalendarConnectionButton({ provider, state, onClick }: {
  provider: 'google' | 'kakao';
  state?: 'connected' | 'changed';
  onClick: () => void;
}) {
  const { t } = useI18n();
  const statusId = useId();
  const label = provider === 'google' ? 'Google 캘린더' : '카카오 캘린더';
  const Icon = provider === 'google' ? CalendarDays : MessageCircle;
  return <button type="button" className="calendar-connection-action" aria-label={t(label)} aria-describedby={state ? statusId : undefined} onClick={onClick}>
    <span className={`calendar-connection-provider ${provider}`} aria-hidden="true"><Icon size={19}/></span>
    <span className="calendar-connection-label">{t(label)}</span>
    {state && <span id={statusId} className={`calendar-connection-state ${state}`}>{state === 'connected' ? <Check size={12} aria-hidden="true"/> : <RefreshCw size={12} aria-hidden="true"/>}{t(state === 'connected' ? '연결됨' : '변경사항 있음')}</span>}
    <ChevronRight size={16} className="calendar-connection-arrow" aria-hidden="true"/>
  </button>;
}
