import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from './store';
import type { UserPreferences } from './types';
import { formatI18nCurrency, formatI18nDate, formatI18nNumber, localeFor, setLanguage, translate } from './i18n';
import type { Language } from './i18n';

export type ThemeMode=UserPreferences['theme'];
export const DEFAULT_PREFERENCES:UserPreferences={language:'ko',theme:'system'};
export const preferencesCacheKey=(uid:string)=>`moim-preferences-v1:${uid}`;
export function normalizePreferences(value:unknown):UserPreferences{const data=value&&typeof value==='object'?value as Record<string,unknown>:{};return {language:data.language==='en'?'en':'ko',theme:data.theme==='light'||data.theme==='dark'?data.theme:'system'};}
function readCache(uid:string|null){if(!uid)return {...DEFAULT_PREFERENCES};try{const value=localStorage.getItem(preferencesCacheKey(uid));return value?normalizePreferences(JSON.parse(value)):{...DEFAULT_PREFERENCES};}catch{return {...DEFAULT_PREFERENCES};}}
function writeCache(uid:string,value:UserPreferences){try{localStorage.setItem(preferencesCacheKey(uid),JSON.stringify(value));}catch{/* Preferences still persist remotely when browser storage is unavailable. */}}
const equal=(a:UserPreferences,b:UserPreferences)=>a.language===b.language&&a.theme===b.theme;
interface PreferenceContext extends UserPreferences {resolvedTheme:'light'|'dark';saving:boolean;setPreferences:(patch:Partial<UserPreferences>)=>Promise<void>}
const Context=createContext<PreferenceContext>({...DEFAULT_PREFERENCES,resolvedTheme:'light',saving:false,async setPreferences(){throw new Error('먼저 로그인해 주세요.');}});

export function PreferencesProvider({children}:{children:ReactNode}){
  const app=useApp();const uid=app.user?.id??null;const profile=app.profiles.find(value=>value.id===uid);const cached=useMemo(()=>readCache(uid),[uid]);
  const [stored,setStored]=useState<{uid:string|null;value:UserPreferences}>(()=>({uid,value:cached}));const [saving,setSaving]=useState(false);const [systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches);
  const current=stored.uid===uid?stored.value:cached;setLanguage(current.language);const uidRef=useRef(uid);uidRef.current=uid;const currentRef=useRef(current);currentRef.current=current;const pending=useRef<{id:number;uid:string}|null>(null);const sequence=useRef(0);
  useLayoutEffect(()=>{if(stored.uid===uid)return;pending.current=null;setSaving(false);setStored({uid,value:cached});},[uid,cached,stored.uid]);
  useLayoutEffect(()=>{if(!uid||!profile||pending.current?.uid===uid)return;const remote=normalizePreferences(profile);setStored(previous=>previous.uid===uid&&equal(previous.value,remote)?previous:{uid,value:remote});writeCache(uid,remote);},[uid,profile?.id,profile?.language,profile?.theme]);
  useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const changed=()=>setSystemDark(media.matches);media.addEventListener('change',changed);changed();return()=>media.removeEventListener('change',changed);},[]);
  const resolvedTheme=current.theme==='system'?(systemDark?'dark':'light'):current.theme;
  useLayoutEffect(()=>{const root=document.documentElement;root.dataset.theme=resolvedTheme;root.lang=current.language;root.style.colorScheme=resolvedTheme;},[resolvedTheme,current.language]);
  const value=useMemo<PreferenceContext>(()=>({...current,resolvedTheme,saving,async setPreferences(patch){const targetUID=uid;if(!targetUID||uidRef.current!==targetUID||!app.user||!['active','pending'].includes(app.user.status))throw new Error('먼저 로그인해 주세요.');if(pending.current)throw new Error('설정을 저장하지 못했어요. 다시 시도해 주세요.');const previous={...currentRef.current};const next=normalizePreferences({...previous,...patch});if(equal(previous,next))return;const id=++sequence.current;pending.current={id,uid:targetUID};setLanguage(next.language);setSaving(true);setStored({uid:targetUID,value:next});writeCache(targetUID,next);try{await app.savePreferences(next);}catch(error){writeCache(targetUID,previous);if(uidRef.current===targetUID){setLanguage(previous.language);setStored({uid:targetUID,value:previous});}throw error;}finally{if(pending.current?.id===id){pending.current=null;if(uidRef.current===targetUID)setSaving(false);}}}}),[current,resolvedTheme,saving,uid,app.user?.status,app.savePreferences]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const usePreferences=()=>useContext(Context);
export function useI18n(){const {language}=usePreferences();return useMemo(()=>({language,locale:localeFor(language),t:(text:string,values?:Record<string,string|number>)=>translate(text,language,values),formatDate:(value:Date|string|number,options?:Intl.DateTimeFormatOptions)=>formatI18nDate(value,language,options),formatNumber:(value:number,options?:Intl.NumberFormatOptions)=>formatI18nNumber(value,language,options),formatCurrency:(value:number)=>formatI18nCurrency(value,language)}),[language]);}
export type { Language };
