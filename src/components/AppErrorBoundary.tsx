import { Component } from 'react';
import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { translate } from '../lib/i18n';
import { reportError } from '../lib/telemetry';
import './app-error-boundary.css';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { reportError(error, { kind: 'render', context: 'render' }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-recovery" role="alert"><div><RefreshCw size={30}/><h1>{translate('화면을 불러오지 못했어요.')}</h1><p>{translate('새로고침 후 다시 시도해 주세요.')}</p><button className="button button-primary button-md" onClick={() => window.location.reload()}>{translate('다시 불러오기')}</button></div></main>;
  }
}
