import { installErrorReporting, reportError } from './lib/telemetry';
import { translate } from './lib/i18n';
import './styles.css';
import './themes.css';
import './components/app-error-boundary.css';
installErrorReporting();
void import('./bootstrap').then(({ mountApp }) => mountApp()).catch(error => {
  reportError(error, { kind: 'runtime', context: 'render' });
  const container = document.createElement('main');
  container.className = 'app-recovery';
  container.setAttribute('role', 'alert');
  const content = document.createElement('div');
  const title = document.createElement('h1'); title.textContent = translate('화면을 불러오지 못했어요.');
  const hint = document.createElement('p'); hint.textContent = translate('새로고침 후 다시 시도해 주세요.');
  const retry = document.createElement('button'); retry.className = 'button button-primary button-md'; retry.textContent = translate('다시 불러오기');
  retry.onclick = () => window.location.reload();
  content.append(title, hint, retry); container.append(content);
  document.getElementById('root')?.replaceChildren(container);
});
