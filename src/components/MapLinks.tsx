import { useI18n } from "../lib/preferences";
import { useId, useState } from 'react';
import { ArrowUpRight, Map, MapPin, Navigation } from 'lucide-react';
import { mapProviderOptions } from '../lib/map-links';
import type { MapAction } from '../lib/map-links';
import { Modal } from './ui';
import './address-field.css';
export function MapLinks({ location, name, compact = false }: {
    location: string;
    name?: string;
    compact?: boolean;
}) {
    const { t } = useI18n();
    const [action,setAction] = useState<MapAction|null>(null);
    const hintId = useId();
    const options = mapProviderOptions(location,name,action??'map');
    if (!options.length)
        return null;
    return <>
      <div className={`map-links ${compact ? 'is-compact' : ''}`}>
        <button type="button" onClick={()=>setAction('map')}><Map size={14}/>{t("지도 보기")}</button>
        <button type="button" onClick={()=>setAction('directions')}><Navigation size={14}/>{t("길찾기")}</button>
      </div>
      {action&&<Modal title={t(action==='map'?'지도 앱 선택':'길찾기 앱 선택')} onClose={()=>setAction(null)}>
        <div className="map-choice-place">{name&&<strong>{name}</strong>}<p>{location.trim()||name}</p></div>
        <div className="map-provider-choices">{options.map(provider=>
          <a key={provider.id} href={provider.href} target="_blank" rel="noopener noreferrer" aria-label={t(provider.label)} aria-describedby={provider.selectPlaceFirst?`${hintId}-${provider.id}`:undefined} onClick={()=>setAction(null)}>
            <span className={`map-provider-mark is-${provider.id}`} aria-hidden="true">{provider.id==='naver'?'N':provider.id==='kakao'?<MapPin size={23}/>:<Map size={23}/>}</span>
            <span className="map-provider-label"><strong>{t(provider.label)}</strong>{provider.selectPlaceFirst&&<small id={`${hintId}-${provider.id}`}>{t('장소 선택 후 길찾기')}</small>}</span>
            <ArrowUpRight size={18}/>
          </a>
        )}</div>
      </Modal>}
    </>;
}
