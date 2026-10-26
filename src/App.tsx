import { useI18n } from "./lib/preferences";
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Vote, Bell, BookOpen, CalendarDays, Check, ChevronRight, CircleHelp, House, LoaderCircle, LogOut, Menu, MapPin, UserRound, Settings as SettingsIcon, ShieldCheck, Users, Wallet, UserPlus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from './lib/store';
import { LoginScreen } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { BoardIcon } from './components/BoardIcon';
import { InviteShare } from './components/InviteShare';
import { GuidedTour } from './components/GuidedTour';
import { ProfileMenu } from './components/ProfileMenu';
import { DonateButton } from './components/DonateButton';
import { MvpNotifications } from './components/MvpVoting';
import { Avatar, Badge, Button, Field, IconButton, useToast } from './components/ui';
import { errorMessage } from './lib/utils';
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Polls = lazy(() => import('./pages/Polls').then(module => ({ default: module.Polls })));
const Calendar = lazy(() => import('./pages/Calendar').then(module => ({ default: module.Calendar })));
const Board = lazy(() => import('./pages/Board').then(module => ({ default: module.Board })));
const Places = lazy(() => import('./pages/Places').then(module => ({ default: module.Places })));
const Members = lazy(() => import('./pages/Members').then(module => ({ default: module.Members })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Rules = lazy(() => import('./pages/Rules').then(module => ({ default: module.Rules })));
const Ledger = lazy(() => import('./pages/Ledger').then(module => ({ default: module.Ledger })));
const navItems: {
    to: string;
    label: string;
    icon: LucideIcon;
}[] = [{ to: '/', label: '모임 홈', icon: House }, { to: '/polls', label: '일정 투표', icon: Vote }, { to: '/calendar', label: '모임 캘린더', icon: CalendarDays }, { to: '/board', label: '게시판', icon: BoardIcon }, { to: '/members', label: '멤버', icon: Users }, { to: '/places', label: '자주 가는 장소', icon: MapPin }, { to: '/rules', label: '모임 회칙', icon: BookOpen }, { to: '/ledger', label: '회계 장부', icon: Wallet }];
function SiteFooter() { const { t } = useI18n(); return <footer className="site-footer"><span>© 2026 Yoo Junho. All rights reserved.</span><a href="/third-party-licenses.txt" target="_blank" rel="noopener noreferrer">{t("오픈소스 고지")}</a><DonateButton /></footer>; }
export function Brand() { return <span className="brand"><span className="brand-mark"><i /><i /><i /><i /></span><span>moim<span className="brand-period">.</span></span></span>; }
export default function App() {
    const { t } = useI18n();
    const app = useApp();
    const location = useLocation();
    const [more, setMore] = useState(false), [inviteOpen, setInviteOpen] = useState(false);
    useEffect(() => { setMore(false); window.scrollTo(0, 0); }, [location.pathname]);
    if (location.pathname === '/auth/callback')
        return <AuthCallback />;
    if (app.loading)
        return <div className="app-loading"><Brand /><LoaderCircle className="spin" size={27}/><p>{t("모임을 불러오는 중")}</p></div>;
    if (!app.user || app.user.status === 'rejected')
        return <AuthScreen />;
    const current = navItems.find(n => n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to));
    const pending = app.members.filter(m => m.status === 'pending').length;
    const activePolls = app.polls.filter(p => p.status === 'open' && (!p.deadline || new Date(p.deadline) > new Date()) && !app.votes.some(v => v.pollId === p.id && v.memberId === app.user?.id)).length;
    return <div className="app-shell"><GuidedTour /><a className="skip-link" href="#main-content">{t("본문으로 이동")}</a><aside className="sidebar"><Link to="/" aria-label={t("모임 홈")}><Brand /></Link><Link className="group-switch" data-tour="group" to={app.isAdmin ? "/settings" : "/"}><span className="group-symbol">{app.settings.photoURL ? <img src={app.settings.photoURL} alt={t("모임 사진")}/> : app.settings.name.charAt(0)}</span><div><strong>{app.settings.name}</strong><span>{app.members.filter(member => member.status === 'active').length}{t("명")}</span></div>{app.isAdmin && <SettingsIcon size={15}/>}</Link><div className="nav-section-label">{t("우리 모임")}</div><nav className="desktop-nav">{navItems.map(({ to, label, icon: Icon }, i) => <NavLink key={to} to={to} end={to === '/'} data-tour={`nav-${to.slice(1) || 'home'}`} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${i === 4 ? 'nav-link-divider' : ''}`}><Icon size={20}/><span>{t(label)}</span>{to === '/polls' && activePolls > 0 && <span className="nav-count">{activePolls}</span>}{to === '/members' && app.isAdmin && pending > 0 && <span className="pending-nav-dot"/>}</NavLink>)}</nav><div className="sidebar-bottom">{app.isDemo && <Link to={app.isAdmin ? "/settings" : "/profile"} className="demo-mode"><span /><div><strong>{t("데모 모드")}</strong><span>{t("브라우저에 저장")}</span></div></Link>}{app.isAdmin && <NavLink to="/settings" data-tour="settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><SettingsIcon size={19}/><span>{t("모임 설정")}</span></NavLink>}<Link to="/profile" className="sidebar-profile"><Avatar member={app.user} size={36}/><div><strong>{app.user.name}</strong><span>{app.isAdmin ? t("관리자") : app.user.role === 'treasurer' ? t("회계 담당") : t("일반")}</span></div><ChevronRight size={17}/></Link></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><span>{app.settings.name}</span><ChevronRight size={14}/><strong>{(current?.label && t(current.label)) || (location.pathname === '/profile' ? t("내 정보") : t("모임 설정"))}</strong></div><Link to="/" className="mobile-brand"><Brand /></Link><div className="topbar-actions"><Button data-tour="invite" variant="ghost" size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>{t("초대")}</Button>{app.isDemo && <span className="top-demo-label">DEMO</span>}<Link className="notification-link" to="/board?category=notice" aria-label={t("공지사항 확인")}><Bell size={20}/>{app.posts.some(p => p.category === 'notice' && p.pinned) && <i />}</Link><ProfileMenu /></div></header>
    <main id="main-content">{app.user.status === 'pending' && <div className="pending-access" role="status"><Badge tone="orange">{t("승인 대기")}</Badge><span>{t("지금은 둘러보기만 가능해요. 글쓰기와 투표는 승인 후 사용할 수 있어요.")}</span><Link to="/profile">{t("내 정보")}</Link></div>}<MvpNotifications />{app.error && <div className="data-error" role="alert"><CircleHelp size={18}/>{t(app.error)}</div>}<Suspense fallback={<div className="route-loading"><LoaderCircle size={24} className="spin"/></div>}><Routes><Route path="/" element={<Home />}/><Route path="/polls" element={<Polls />}/><Route path="/calendar" element={<Calendar />}/><Route path="/board" element={<Board />}/><Route path="/members" element={<Members />}/><Route path="/profile" element={<Profile />}/><Route path="/settings" element={app.isAdmin ? <Settings /> : <Navigate to="/" replace/>}/><Route path="/places" element={<Places />}/><Route path="/rules" element={<Rules />}/><Route path="/ledger" element={<Ledger />}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense></main><SiteFooter /></div>
    <nav className="mobile-nav" aria-label={t("주 탐색")}>{navItems.slice(0, 4).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} data-tour={`mobile-nav-${to.slice(1) || 'home'}`} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={21}/><span>{label === "모임 캘린더" ? t("캘린더") : label === "일정 투표" ? t("투표") : label === "모임 홈" ? t("홈") : t(label)}</span></NavLink>)}<button data-tour="mobile-more" onClick={() => setMore(!more)} className={more || ['/members', '/places', '/rules', '/ledger', '/settings', '/profile'].includes(location.pathname) ? 'active' : ''} aria-expanded={more} aria-label={t("더보기")}><Menu size={21}/><span>{t("더보기")}</span></button></nav>{more && <div className="mobile-more"><div className="section-head"><strong>{t("우리 모임")}</strong><IconButton label={t("메뉴 닫기")} icon={X} onClick={() => setMore(false)}/></div>{[...navItems.slice(4), { to: '/profile', label: t("내 정보"), icon: UserRound }, ...(app.isAdmin ? [{ to: '/settings', label: t("모임 설정"), icon: SettingsIcon }] : [])].map(({ to, label, icon: Icon }) => <Link to={to} key={to} onClick={() => setMore(false)}><Icon size={21}/>{t(label)}<ChevronRight size={17}/></Link>)}</div>}{inviteOpen && <InviteShare onClose={() => setInviteOpen(false)}/>}</div>;
}
function AuthScreen() {
    const { t } = useI18n();
    const app = useApp(), toast = useToast();
    const [busy, setBusy] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [name, setName] = useState(app.user?.name || ''), [phone, setPhone] = useState(''), [area, setArea] = useState('');
    const pending = app.user?.status === 'pending';
    const ownProfile = app.profiles.find(profile => profile.id === app.user?.id);
    useEffect(() => { setName(app.user?.name || ''); }, [app.user?.id, app.user?.name]);
    useEffect(() => {
        if (ownProfile) {
            setPhone(ownProfile.phone);
            setArea(ownProfile.area);
        }
    }, [ownProfile?.id, ownProfile?.phone, ownProfile?.area]);
    const login = async (forceAccountPicker = false) => {
        if (busy) return;
        setLoginError('');
        setBusy(true);
        try {
            await app.login(forceAccountPicker);
        }
        catch (e) {
            setLoginError(errorMessage(e));
        }
        finally {
            setBusy(false);
        }
    };
    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!app.user)
            return;
        setBusy(true);
        try {
            await app.saveProfile(app.user.id, { name, phone, area });
            toast('가입 정보를 저장했어요.');
        }
        catch (e) {
            toast(errorMessage(e), 'error');
        }
        finally {
            setBusy(false);
        }
    };
    if (!app.user)
        return <div className="login-auth-shell"><LoginScreen onLogin={() => void login()} onChangeAccount={() => void login(true)} loading={busy} isDemo={app.isDemo} error={loginError || app.error}/><SiteFooter /></div>;
    return <div className="auth-screen"><Link to="/"><Brand /></Link><div className="auth-card"><h1>{pending ? t("가입 승인 대기") : app.user ? t("가입 승인 거절") : t("로그인")}</h1>{app.user && <p>{pending ? t("가입 정보를 입력해 주세요.") : t("관리자에게 문의해 주세요.")}</p>}{!app.user ? <><Button className="google-button" variant="secondary" loading={busy} onClick={() => void login()}><svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.7 2.9-4.2 2.9-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10.1 10.1 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.4H3a10 10 0 0 0 0 9.2l3.4-2.7Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.4l3.4 2.7C7.2 7.8 9.4 6 12 6Z"/></svg>{app.isDemo ? t("데모 둘러보기") : t("Google로 시작하기")}</Button><div className="auth-note"><ShieldCheck size={15}/>{t("관리자 승인 후 이용 가능")}</div></> : <><Badge tone={pending ? 'orange' : 'red'}>{pending ? t("승인 대기") : t("승인 거절")}</Badge>{pending && <form className="stack auth-form" onSubmit={save}><Field label={t("이름")} required><input required value={name} onChange={e => setName(e.target.value)} maxLength={30}/></Field><Field label={t("전화번호")}><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} placeholder="010-0000-0000"/></Field><Field label={t("거주 지역")}><input value={area} onChange={e => setArea(e.target.value)} maxLength={50} placeholder={t("서울 중랑구")}/></Field><Button type="submit" icon={Check} loading={busy}>{t("가입 정보 저장")}</Button></form>}<Button variant="ghost" icon={LogOut} onClick={() => void app.logout()}>{t("로그아웃")}</Button></>}{app.error && <p className="auth-error" role="alert">{t(app.error)}</p>}</div><SiteFooter /></div>;
}
