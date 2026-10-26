import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './lib/store';
import { PreferencesProvider } from './lib/preferences';
import { ToastProvider } from './components/ui';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import App from './App';

export function mountApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><AppProvider><PreferencesProvider><ToastProvider><BrowserRouter><App/></BrowserRouter></ToastProvider></PreferencesProvider></AppProvider></AppErrorBoundary></React.StrictMode>);
}
