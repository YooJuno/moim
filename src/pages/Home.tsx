import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Cake, CalendarDays, Check, ChevronRight, Clock3, ListChecks, MapPin, Users, Vote } from 'lucide-react';
import { MapLinks } from '../components/MapLinks';
import { Avatar, PageHeader } from '../components/ui';
import { useApp } from '../lib/store';
import { useI18n } from '../lib/preferences';
import { formatDate, formatTime, today } from '../lib/utils';
import { upcomingBirthdays } from '../lib/birthdays';
import { addressForMap } from '../lib/map-links';
import { sortOpenPolls } from '../lib/poll-list';
import './home.css';

export function Home() {
  const { t } = useI18n();
  const app = useApp();
  const active = app.members.filter(member => member.status === 'active');
  const activeIds = new Set(active.map(member => member.id));
  const now = today();
  const birthdays = upcomingBirthdays(active, now).slice(0, 2);
  const events = app.events
    .filter(event => new Date(`${event.date}T${event.end}:00+09:00`).getTime() > app.now)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const next = events[0];
  const nextAddress = next ? addressForMap(next.location) : '';
  const nextPlace = next && nextAddress !== next.location.trim()
    ? next.location.trim().slice(0, -nextAddress.length).replace(/[\s·,]+$/, '') : '';
  const days = next ? Math.round((new Date(`${next.date}T12:00:00`).getTime() - new Date(`${now}T12:00:00`).getTime()) / 86400000) : 0;
  const attendees = next ? app.rsvps.filter(rsvp => rsvp.eventId === next.id && rsvp.status === 'going' && activeIds.has(rsvp.memberId)) : [];
  const responded = new Set(app.votes.filter(vote => vote.memberId === app.user?.id).map(vote => vote.pollId));
  const needsResponse = (id: string) => app.canParticipate && !responded.has(id);
  const openPolls = useMemo(() => sortOpenPolls(app.polls, app.votes, app.user?.id, app.canParticipate, app.now), [app.polls, app.votes, app.user?.id, app.canParticipate, app.now]);
  const unansweredCount = openPolls.filter(poll => needsResponse(poll.id)).length;

  return <div className="page home-page">
    <PageHeader tourId="home" title={app.settings.name}/>

    <div className="home-dashboard">
      <section className="home-panel home-polls-panel" aria-label={t('진행 중인 투표')}>
        <div className="home-panel-heading">
          <div className="home-poll-heading"><h2><span className="home-section-icon"><ListChecks size={17} aria-hidden="true"/></span>{t('진행 중인 투표')}<span className="home-section-count">{openPolls.length}</span></h2>
            {unansweredCount > 0 && <p className="home-poll-pending"><span aria-hidden="true"/>{t('응답할 투표')} {unansweredCount}</p>}
          </div>
          <Link to="/polls" className="home-more">{t('전체 보기')}<ChevronRight size={14}/></Link>
        </div>
        <div className="home-poll-list">
          {openPolls.slice(0, 3).map(poll => {
            const votes = app.votes.filter(vote => vote.pollId === poll.id && activeIds.has(vote.memberId));
            const voted = responded.has(poll.id);
            const pending = needsResponse(poll.id);
            const urgent = !!poll.deadline && new Date(poll.deadline).getTime() - Date.now() <= 86400000;
            return <Link key={poll.id} to={`/polls?poll=${encodeURIComponent(poll.id)}`}
              className={`home-poll-row ${pending ? 'needs-response' : ''}`}>
              <div className="home-poll-copy">
                <h3>{poll.title}</h3>
                <div className="home-poll-meta">
                  <span className={urgent ? 'is-urgent' : undefined}>{poll.deadline
                    ? `${formatDate(poll.deadline, { month: 'numeric', day: 'numeric' })} ${formatTime(poll.deadline)} ${t('마감')}`
                    : t('마감 없음')}</span>
                  <span className="home-poll-response">{t('{0}/{1} 응답', { '0': votes.length, '1': active.length })}</span>
                </div>
              </div>
              <span className={`home-poll-action ${pending ? 'button button-primary button-sm' : voted ? 'is-complete' : ''}`}>
                {voted && <Check size={14}/>}
                {pending ? t('시간 선택하기') : voted ? t('참여 완료') : t('결과 보기')}
                {!voted && <ChevronRight size={15}/>}
              </span>
            </Link>;
          })}
          {!openPolls.length && <div className="home-panel-empty"><Vote size={22}/><p>{t('진행 중인 투표가 없어요.')}</p></div>}
        </div>
      </section>

      <section className="home-panel home-next-event" aria-label={t('다가오는 모임')}>
        <div className="home-panel-heading"><h2><span className="home-section-icon"><CalendarDays size={17} aria-hidden="true"/></span>{t('다가오는 모임')}</h2>{next && <span className="home-event-dday">{days === 0 ? t('오늘') : `D-${days}`}</span>}</div>
        {next ? <>
          <div className="home-event-summary">
            <div className="home-event-date" aria-hidden="true"><span>{formatDate(next.date, {month:'short'})}</span><strong>{new Date(`${next.date}T12:00:00`).getDate()}</strong></div>
            <div className="home-event-summary-copy"><h3 className="home-event-title">{next.title}</h3>
              <p className="home-event-time"><Clock3 size={14} aria-hidden="true"/>{formatDate(next.date)}<strong>{next.start}–{next.end}</strong></p>
            </div>
          </div>
          <div className="home-event-details">
            <div><MapPin size={17}/><div className="hero-location-copy"><strong>{nextPlace || next.location || t('장소 미정')}</strong>{nextPlace && <small>{nextAddress}</small>}
            </div>{next.location && <div className="hero-location-links"><MapLinks location={next.location}/></div>}</div>
          </div>
          <div className="home-event-footer"><div className="hero-attendees"><Users size={14}/><span>{attendees.length}{t('명 참여')}</span></div>
            <Link to={`/calendar?event=${encodeURIComponent(next.id)}`} className="home-event-open button button-secondary button-sm">{t('일정 확인')}<ArrowRight size={15}/></Link>
          </div>
        </> : <div className="home-panel-empty"><p>{t('예정된 일정이 없어요.')}</p><Link className="home-more" to="/calendar">{t('캘린더 열기')}<ChevronRight size={14}/></Link></div>}
      </section>

      <section className="home-panel home-birthdays-panel" aria-label={t('다가오는 생일')}>
        <div className="home-panel-heading"><h2><span className="home-section-icon"><Cake size={17} aria-hidden="true"/></span>{t('다가오는 생일')}</h2></div>
        {birthdays.length ? <div className="home-birthday-list">{birthdays.map(({ member, date, daysUntil }) => <Link to={`/calendar?date=${date}`} key={member.id} className="home-birthday-row">
          <Avatar member={member} size={30}/><strong>{member.name}</strong><span>{formatDate(date, { month: 'numeric', day: 'numeric' })}</span>
          <small className={daysUntil === 0 ? 'is-today' : undefined}>{daysUntil === 0 ? t('오늘') : `D-${daysUntil}`}</small>
        </Link>)}</div> : <p className="home-empty-line">{t('등록된 생일이 없어요.')}</p>}
      </section>
    </div>
  </div>;
}
