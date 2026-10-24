import { useI18n } from "../lib/preferences";
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { useApp } from '../lib/store';
import { errorMessage } from '../lib/utils';
import { Avatar, useToast } from './ui';
export function ProfileMenu() {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => { setOpen(false); }, [location.pathname]);
    useEffect(() => {
        if (!open)
            return;
        container.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]')?.focus();
        const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node))
            setOpen(false); };
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                trigger.current?.focus();
                return;
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
                return;
            const items = [...container.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []];
            if (!items.length)
                return;
            event.preventDefault();
            const current = items.indexOf(document.activeElement as HTMLElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
            items[next].focus();
        };
        document.addEventListener('pointerdown', outside);
        container.current?.addEventListener('keydown', keyboard);
        const element = container.current;
        return () => { document.removeEventListener('pointerdown', outside); element?.removeEventListener('keydown', keyboard); };
    }, [open]);
    async function logout() {
        if (busy)
            return;
        setBusy(true);
        try {
            await app.logout();
            setOpen(false);
        }
        catch (problem) {
            toast(errorMessage(problem), 'error');
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="profile-menu-container" ref={container} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node))
        setOpen(false); }}><button ref={trigger} type="button" className="top-avatar profile-menu-trigger" data-tour="profile" aria-label={t("내 프로필")} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'profile-menu' : undefined} onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
    } }}><Avatar member={app.user ?? undefined} size={33}/></button>{open && <div id="profile-menu" className="profile-menu" role="menu" aria-label={t("계정 메뉴")}><Link role="menuitem" to="/profile" onClick={() => setOpen(false)}><UserRound size={17}/>{t("내 정보")}</Link><button type="button" role="menuitem" disabled={busy} onClick={() => void logout()}><LogOut size={17}/>{t("로그아웃")}</button></div>}</div>;
}
