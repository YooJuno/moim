import { useI18n } from "../lib/preferences";
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { exchangeSocialCallback } from '../lib/social-auth';
import type { SocialAuthResult } from '../lib/social-auth';
import { errorMessage } from '../lib/utils';
import { Button } from '../components/ui';
import '../components/social-auth.css';
export function AuthCallback() {
    const { t } = useI18n();
    const navigate = useNavigate();
    const query = useRef(new URLSearchParams(window.location.search));
    const request = useRef<Promise<SocialAuthResult> | null>(null);
    const [error, setError] = useState('');
    const linking = query.current.get('intent') === 'link';
    useEffect(() => {
        // React Strict Mode may run this effect twice; the exchange itself remains one-use.
        if (!request.current) {
            window.history.replaceState(window.history.state, '', window.location.pathname);
            request.current = exchangeSocialCallback(query.current);
        }
        let active = true;
        void request.current.then(result => { if (active)
            navigate(result.intent === 'link' ? '/profile' : '/', { replace: true }); }).catch(problem => { if (active)
            setError(errorMessage(problem)); });
        return () => { active = false; };
    }, [navigate]);
    return <main className="auth-callback"><a className="auth-callback-brand" href="/">moim<span>.</span></a><section className="auth-callback-card" aria-live="polite">{error ? <><h1>{linking ? t("계정을 연결하지 못했어요") : t("로그인을 완료하지 못했어요")}</h1><p role="alert">{error}</p><Button onClick={() => navigate(linking ? '/profile' : '/', { replace: true })}>{linking ? t("내 정보로 돌아가기") : t("로그인으로 돌아가기")}</Button></> : <><LoaderCircle size={29} className="spin"/><h1>{linking ? t("계정 연결 중") : t("로그인 중")}</h1></>}</section></main>;
}
