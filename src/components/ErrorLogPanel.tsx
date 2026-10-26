import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Stethoscope } from 'lucide-react';
import type { ErrorLogEntry } from '../../shared/error-telemetry';
import { useI18n } from '../lib/preferences';
import { getErrorLogs } from '../lib/error-logs';
import { formatDate } from '../lib/utils';
import { useApp } from '../lib/store';
import { Button } from './ui';
import './error-log-panel.css';

export function ErrorLogPanel() {
  const { t } = useI18n();
  const app = useApp();
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function load() {
    if (loading) return;
    const controller = new AbortController(); pending.current?.abort(); pending.current = controller;
    setLoaded(true); setLoading(true); setError('');
    if (app.isDemo) { setError('운영 사이트에서 오류 기록을 확인할 수 있어요.'); setLoading(false); return; }
    try {
      const data = await getErrorLogs(controller.signal);
      if (!controller.signal.aborted) { setEntries(data.errors); if (!data.enabled) setError('오류 기록을 사용할 수 없어요.'); }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '오류 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  if (!app.isAdmin) return null;
  return <details className="card error-log-panel" onToggle={event => { if (event.currentTarget.open && !loaded) void load(); }}>
    <summary><span className="settings-icon violet"><Stethoscope size={20}/></span><h2>{t('오류 기록')}</h2><small>{t('최근 7일')}</small><ChevronDown size={17}/></summary>
    <div className="error-log-content"><div className="error-log-toolbar"><span>{entries.length ? t('{0}개 기록', { '0': entries.length }) : ''}</span><Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={() => void load()}>{t('새로고침')}</Button></div>
      {error ? <p className="error-log-empty" role="status">{t(error)}</p> : loaded && !loading && entries.length === 0 ? <p className="error-log-empty">{t('기록된 오류가 없어요.')}</p> : null}
      <div className="error-log-list">{entries.map(entry => <details className="error-log-row" key={entry.id}><summary><span className={`error-log-kind ${entry.source}`} aria-label={t(entry.source === 'server' ? '서버' : '브라우저')}>{entry.source === 'server' ? t('서버') : t('브라우저')}</span><span className="error-log-title"><strong>{entry.code}</strong><small>{entry.route} · {formatDate(entry.lastSeenAt, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></span>{entry.count > 1 && <span className="error-log-count">×{entry.count}</span>}<ChevronDown size={15}/></summary><div className="error-log-detail"><dl><dt>{t('위치')}</dt><dd>{entry.context}</dd><dt>{t('배포 버전')}</dt><dd>{entry.release}</dd>{entry.httpStatus && <><dt>HTTP</dt><dd>{entry.httpStatus}</dd></>}{entry.browser && <><dt>{t('브라우저')}</dt><dd>{entry.browser} · {entry.device}</dd></>}</dl>{entry.frames?.length ? <pre>{entry.frames.map(frame => `${frame.file}:${frame.line}:${frame.column}`).join('\n')}</pre> : null}</div></details>)}</div>
    </div>
  </details>;
}
