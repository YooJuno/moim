import { Languages, Monitor, Moon, Sun } from 'lucide-react';
import { useI18n, usePreferences } from '../lib/preferences';
import { translate } from '../lib/i18n';
import type { UserPreferences } from '../lib/types';
import { errorMessage } from '../lib/utils';
import { Field, useToast } from './ui';
import './preferences.css';

export function PreferencesPanel(){
  const {language,theme,saving,setPreferences}=usePreferences();const {t}=useI18n();const toast=useToast();
  async function save(patch:Partial<UserPreferences>){try{await setPreferences(patch);toast(translate('설정을 저장했어요.',patch.language??language));}catch(error){toast(t(errorMessage(error)),'error');}}
  return <section className="card settings-section preferences-panel" aria-label={t('화면 설정')}><div className="settings-section-title"><span className="settings-icon"><Languages size={21}/></span><h2>{t('화면 설정')}</h2></div><fieldset disabled={saving} className="preferences-fields"><Field label={t('언어')}><select value={language} onChange={event=>void save({language:event.target.value as UserPreferences['language']})}><option value="ko">한국어</option><option value="en">English</option></select></Field><div className="preferences-theme"><span className="field-label">{t('테마')}</span><div className="preferences-theme-options" role="group" aria-label={t('테마')}>{([{value:'system',label:'시스템 설정',icon:Monitor},{value:'light',label:'라이트',icon:Sun},{value:'dark',label:'다크',icon:Moon}] as const).map(({value,label,icon:Icon})=><button type="button" key={value} className={theme===value?'is-selected':''} aria-pressed={theme===value} onClick={()=>void save({theme:value})}><Icon size={20}/><span>{t(label)}</span></button>)}</div></div></fieldset></section>;
}
