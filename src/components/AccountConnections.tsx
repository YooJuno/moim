import { useI18n } from "../lib/preferences";
import { useCallback, useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { useApp } from '../lib/store';
import { auth } from '../lib/firebase';
import { getAccountProviders, linkGoogleAccount, startSocialAuth, useAuthProviderConfig } from '../lib/social-auth';
import type { AccountProviders, SocialProvider } from '../lib/social-auth';
import { errorMessage } from '../lib/utils';
import { Badge, Button, useToast } from './ui';
import './social-auth.css';
export function AccountConnections() {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const config = useAuthProviderConfig();
    const [providers, setProviders] = useState<AccountProviders | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<'google' | SocialProvider | null>(null);
    const [revision, setRevision] = useState(0);
    const [google, setGoogle] = useState(() => !!auth?.currentUser?.providerData.some(provider => provider.providerId === 'google.com'));
    const refresh = useCallback(() => { setRevision(value => value + 1); }, []);
    useEffect(() => { setGoogle(!!auth?.currentUser?.providerData.some(provider => provider.providerId === 'google.com')); if (app.isDemo || !config.enabled || !auth?.currentUser || auth.currentUser.uid !== app.user?.id)
        return; let active = true; setLoading(true); setError(''); void getAccountProviders().then(result => { if (active)
        setProviders(result); }).catch(problem => { if (active) {
        setProviders(null);
        setError(errorMessage(problem));
    } }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [app.isDemo, app.user?.id, config.enabled, revision]);
    async function connect(provider: 'google' | SocialProvider) { if (busy || !app.user)
        return; setBusy(provider); try {
        if (provider === 'google') {
            await linkGoogleAccount(app.user.id);
            setGoogle(true);
            toast('Google 계정을 연결했어요.');
            refresh();
        }
        else
            await startSocialAuth(provider, 'link');
    }
    catch (problem) {
        toast(errorMessage(problem), 'error');
        setBusy(null);
    }
    finally {
        if (provider === 'google')
            setBusy(null);
    } }
    const googleEmail = auth?.currentUser?.providerData.find(provider => provider.providerId === 'google.com')?.email;
    return <div className="account-connections"><div className="account-connection"><span className="account-provider-icon google">G</span><div><strong>Google</strong>{googleEmail && <small>{googleEmail}</small>}</div>{app.isDemo ? <Badge tone="gray">{t("데모")}</Badge> : google ? <Badge tone="green">{t("연결됨")}</Badge> : <Button size="sm" variant="secondary" icon={Link2} loading={busy === 'google'} disabled={!!busy} onClick={() => void connect('google')}>{t("연결")}</Button>}</div>
    {!app.isDemo && config.enabled && (['kakao', 'naver'] as const).filter(provider => config.providers[provider]).map(provider => <div className="account-connection" key={provider}><span className={`account-provider-icon ${provider}`}>{provider === 'kakao' ? <KakaoMark /> : 'N'}</span><div><strong>{provider === 'kakao' ? t("카카오") : t("네이버")}</strong></div>{loading ? <Badge tone="gray">{t("확인 중")}</Badge> : providers?.[provider] ? <Badge tone="green">{t("연결됨")}</Badge> : error ? <Badge tone="gray">{t("확인 필요")}</Badge> : <Button size="sm" variant="secondary" icon={Link2} loading={busy === provider} disabled={!!busy || !providers} onClick={() => void connect(provider)}>{t("연결")}</Button>}</div>)}
    {!app.isDemo && config.enabled && <p className="account-connection-note">{t("기존 계정은 로그인 후 연결해 주세요.")}</p>}{error && <div className="account-connection-error"><p role="alert">{error}</p><Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>{t("다시 확인")}</Button></div>}
  </div>;
}
export function KakaoMark() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4C6.48 4 2 7.36 2 11.5c0 2.66 1.85 5 4.65 6.33l-.88 3.23a.32.32 0 0 0 .49.34l3.85-2.58c.61.11 1.24.18 1.89.18 5.52 0 10-3.36 10-7.5S17.52 4 12 4Z"/></svg>; }
