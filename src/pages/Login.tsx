import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Button, IconButton } from '../components/ui';
import './login.css';

const slides = [
  { id:'poll', title:'일정 투표', description:'날짜별 가능한 시간을 1시간 단위로 선택해요.', alt:'날짜별 시간과 참여 가능한 인원을 표시한 일정 투표 화면' },
  { id:'calendar', title:'모임 일정', description:'날짜와 장소를 확인하고 참석 여부를 알려요.', alt:'공휴일과 모임 일정을 표시한 월별 캘린더 화면' },
  { id:'board', title:'게시판', description:'공지와 이야기를 나누고 사진을 모아요.', alt:'공지사항과 멤버들의 글을 모아 보여 주는 게시판 화면' },
  { id:'ledger', title:'회계 장부', description:'회비와 지출, 영수증을 확인해요.', alt:'잔액과 수입·지출 내역을 표시한 회계 장부 화면' },
];

export function LoginScreen({ onLogin, loading, isDemo, error }: { onLogin: () => void; loading: boolean; isDemo: boolean; error: string | null }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [announcement, setAnnouncement] = useState('');
  const touch = useRef<{ x:number; y:number; pointerId:number } | null>(null);
  const slide = slides[index];
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(media.matches);
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); };
  }, []);
  useEffect(() => {
    if (hovered || focused || paused || hidden || reducedMotion) return;
    const timer = window.setTimeout(() => setIndex(current => (current + 1) % slides.length), 5000);
    return () => window.clearTimeout(timer);
  }, [index, hovered, focused, paused, hidden, reducedMotion]);
  const navigate = (next: number) => {
    const position = (next + slides.length) % slides.length;
    setIndex(position); setAnnouncement(`${position + 1} / ${slides.length}, ${slides[position].title}`);
  };

  return <main className="login-screen">
    <header className="login-top"><a className="brand login-brand" href="/" aria-label="moim 홈"><span className="brand-mark"><i /><i /><i /><i /></span><span>moim<span className="brand-period">.</span></span></a></header>
    <div className="login-content">
      <section className="login-carousel" aria-label="주요 기능 미리보기" aria-roledescription="캐러셀" tabIndex={0} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); navigate(index + 1); } else if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(index - 1); } }}>
        <div className="login-feature-copy"><h2>{slide.title}</h2><p>{slide.description}</p></div>
        <div className="login-preview-stage" onPointerDown={event => { if (event.pointerType !== 'touch') return; touch.current = { x:event.clientX, y:event.clientY, pointerId:event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={event => { const start = touch.current; touch.current = null; if (!start || start.pointerId !== event.pointerId) return; const dx = event.clientX - start.x; const dy = event.clientY - start.y; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) navigate(index + (dx < 0 ? 1 : -1)); }} onPointerCancel={() => { touch.current = null; }}>
          <figure key={slide.id} className={`login-preview login-preview-${slide.id}`} role="group" aria-roledescription="슬라이드" aria-label={`${index + 1} / ${slides.length}: ${slide.title}`}><img src={`/onboarding/${slide.id}.png`} alt={slide.alt} draggable={false} /></figure>
        </div>
        <div className="login-carousel-controls"><div className="login-slide-dots">{slides.map((item, position) => <button key={item.id} type="button" aria-label={`${item.title} 보기`} aria-pressed={index === position} onClick={() => navigate(position)}><span /></button>)}</div><span className="login-slide-position" aria-hidden="true">{index + 1} / {slides.length}</span><div className="login-slide-arrows">{!reducedMotion && <IconButton label={paused ? '자동 넘김 재생' : '자동 넘김 일시정지'} icon={paused ? Play : Pause} onClick={() => setPaused(!paused)} aria-pressed={paused} />}<IconButton label="이전 기능" icon={ChevronLeft} onClick={() => navigate(index - 1)} /><IconButton label="다음 기능" icon={ChevronRight} onClick={() => navigate(index + 1)} /></div></div>
        <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
      </section>
      <section className="login-panel" aria-labelledby="login-title"><h1 id="login-title">로그인</h1><Button variant="secondary" className="login-google-button" onClick={onLogin} loading={loading}>{!isDemo && !loading && <GoogleLogo />}{isDemo ? '데모 둘러보기' : 'Google로 로그인'}</Button><p className="login-approval-note">로그인 후 관리자 승인이 필요해요.</p>{error && <p className="login-error" role="alert">{error}</p>}</section>
    </div>
  </main>;
}

function GoogleLogo() {
  return <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.7 2.9-4.2 2.9-7.5Z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10.1 10.1 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.4H3a10 10 0 0 0 0 9.2l3.4-2.7Z" /><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.4l3.4 2.7C7.2 7.8 9.4 6 12 6Z" /></svg>;
}
