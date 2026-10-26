// Development-only UI harness. Its provider uses demo data; callbacks never invoke an identity provider.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from '../../src/lib/store';
import { PreferencesProvider } from '../../src/lib/preferences';
import { ToastProvider } from '../../src/components/ui';
import { LoginScreen } from '../../src/pages/Login';
import '../../src/styles.css';
import '../../src/themes.css';

function Harness() {
  const [calls, setCalls] = useState(0);
  return <div className="login-auth-shell"><LoginScreen isDemo={false} loading={false} error={null} onLogin={() => setCalls(count => count + 1)}/><output hidden data-testid="login-calls">{calls}</output></div>;
}
createRoot(document.getElementById('root')!).render(<AppProvider><PreferencesProvider><ToastProvider><Harness/></ToastProvider></PreferencesProvider></AppProvider>);
