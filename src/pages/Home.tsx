import { Link } from 'react-router-dom';
import { ArrowRight, Cake, Check, ChevronRight, Clock3, MapPin, Plus, Users, Vote } from 'lucide-react';
import { MapLinks } from '../components/MapLinks';
import { Avatar, Button, PageHeader } from '../components/ui';
import { useApp } from '../lib/store';
import { useI18n } from '../lib/preferences';
import { formatDate, formatTime, relativeDate, today } from '../lib/utils';
import { upcomingBirthdays } from '../lib/birthdays';
import { addressForMap } from '../lib/map-links';
import './home.css';

export function Home() {
  const { t } = useI18n();
  const app = useApp();
  const active = app.members.filter(member => member.status === 'active');
  const activeIds = new Set(active.map(member => member.id));
  const now = today();
  const birthdays = upcomingBirthdays(active, now).slice(0, 4);
  const events = app.events
    .filter(event => `${event.date}T${event.end}` >= `${now}T${new Date().toTimeString().slice(0, 5)}`)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const next = events[0];
  const nextAddress = next ? addressForMap(next.location) : '';
  const nextPlace = next && nextAddress !== next.location.trim()
    ? next.location.trim().slice(0, -nextAddress.length).replace(/[\s·,]+$/, '') : '';
  const days = next ? Math.round((new Date(`${next.date}T12:00:00`).getTime() - new Date(`${now}T12:00:00`).getTime()) / 86400000) : 0;
  const attendees = next ? app.rsvps.filter(rsvp => rsvp.eventId === next.id && rsvp.status === 'going' && activeIds.has(rsvp.memberId)) : [];
  const responded = new Set(app.votes.filter(vote => vote.memberId === app.user?.id).map(vote => vote.pollId));
  const needsResponse = (id: string) => app.canParticipate && !responded.has(id);
  const openPolls = app.polls
    .filter(poll => poll.status === 'open' && (!poll.deadline || new Date(poll.deadline) > new Date()))
    .sort((a, b) => Number(needsResponse(b.id)) - Number(needsResponse(a.id))
      || (a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity)
      || b.createdAt.localeCompare(a.createdAt));
  const unansweredCount = openPolls.filter(poll => needsResponse(poll.id)).length;
  const notices = app.posts.filter(post => post.category === 'notice')
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  return <div className="page home-page">
    <PageHeader tourId="home" title={app.settings.name}
      description={formatDate(new Date().toISOString(), { month: 'long', day: 'numeric', weekday: 'long' })}
      action={app.canCreatePoll ? <Link to="/polls?create=1"><Button iconOnly variant="secondary" icon={Plus}>{t('투표 만들기')}</Button></Link> : undefined}/>

    <div className="home-dashboard">
      <section className="home-panel home-polls-panel" aria-label={t('진행 중인 투표')}>
        <div className="home-panel-heading">
          <div className="home-poll-heading"><h2>{t('진행 중인 투표')}<span className="home-section-count">{openPolls.length}</span></h2>
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
              <span className={`home-poll-action ${voted ? 'is-complete' : ''}`}>
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
        <div className="home-panel-heading"><h2>{t('다가오는 모임')}</h2>{next && <span className="home-event-dday">{days === 0 ? t('오늘') : `D-${days}`}</span>}</div>
        {next ? <>
          <h3 className="home-event-title">{next.title}</h3>
          <div className="home-event-details">
            <div><Clock3 size={17}/><span>{formatDate(next.date)}<strong>{next.start}–{next.end}</strong></span></div>
            <div><MapPin size={17}/><div className="hero-location-copy"><strong>{nextPlace || next.location || t('장소 미정')}</strong>{nextPlace && <small>{nextAddress}</small>}
              {next.location && <div className="hero-location-links"><MapLinks location={next.location} compact/></div>}
            </div></div>
          </div>
          <div className="home-event-footer"><div className="hero-attendees"><Users size={14}/><span>{attendees.length}{t('명 참여')}</span></div>
            <Link to={`/calendar?event=${encodeURIComponent(next.id)}`} className="home-event-open">{t('일정 확인')}<ArrowRight size={15}/></Link>
          </div>
        </> : <div className="home-panel-empty"><p>{t('예정된 일정이 없어요.')}</p><Link className="home-more" to="/calendar">{t('캘린더 열기')}<ChevronRight size={14}/></Link></div>}
      </section>

      <section className="home-panel home-notices-panel" aria-label={t('공지사항')}>
        <div className="home-panel-heading"><h2>{t('공지사항')}</h2><Link to="/board?category=notice" className="home-more">{t('전체 보기')}<ChevronRight size={14}/></Link></div>
        {notices.length ? <div className="home-notice-list">{notices.map(post => <Link key={post.id} to={`/board?category=notice&post=${encodeURIComponent(post.id)}`} className="home-notice-row">
          <strong>{post.title}</strong><time dateTime={post.createdAt}>{relativeDate(post.createdAt)}</time><ChevronRight size={15}/>
        </Link>)}</div> : <p className="home-empty-line">{t('등록된 공지가 없어요.')}</p>}
      </section>

      <section className="home-panel home-birthdays-panel" aria-label={t('다가오는 생일')}>
        <div className="home-panel-heading"><h2><Cake size={16}/>{t('다가오는 생일')}</h2></div>
        {birthdays.length ? <div className="home-birthday-list">{birthdays.map(({ member, date, daysUntil }) => <Link to={`/calendar?date=${date}`} key={member.id} className="home-birthday-row">
          <Avatar member={member} size={30}/><strong>{member.name}</strong><span>{formatDate(date, { month: 'numeric', day: 'numeric' })}</span>
          <small className={daysUntil === 0 ? 'is-today' : undefined}>{daysUntil === 0 ? t('오늘') : `D-${daysUntil}`}</small>
        </Link>)}</div> : <p className="home-empty-line">{t('등록된 생일이 없어요.')}</p>}
      </section>
    </div>
  </div>;
}
