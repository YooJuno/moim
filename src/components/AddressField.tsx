import { useI18n } from "../lib/preferences";
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, MapPin, Search } from 'lucide-react';
import { errorMessage } from '../lib/utils';
import { formatPostcodeAddress, loadAddressSearch } from '../lib/address-search';
import { isPlaceSearchReady, searchPlaces } from '../lib/place-search';
import type { PlaceSearchResult } from '../lib/place-search';
import { Button, Field, Modal } from './ui';
import './address-field.css';
export interface AddressFieldProps {
    value: string;
    onChange: (address: string) => void;
    label?: string;
    required?: boolean;
    disabled?: boolean;
    maxLength?: number;
    placeholder?: string;
    autoFocus?: boolean;
    searchName?: string;
    includePlaceName?: boolean;
    onPlaceSelect?: (place: PlaceSearchResult) => void;
}
export function AddressField({ value, onChange, label = '주소', required, disabled, maxLength = 300, placeholder = '주소 또는 위치', autoFocus, searchName, includePlaceName, onPlaceSelect }: AddressFieldProps) {
    const { t } = useI18n();
    const [searching, setSearching] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    return <>
    <Field label={t(label)} required={required}><div className="address-field"><input ref={input} aria-label={t(label)} value={value} onChange={event => onChange(event.target.value)} placeholder={t(placeholder)} maxLength={maxLength} required={required} disabled={disabled} autoFocus={autoFocus}/><button ref={trigger} type="button" className="button button-secondary button-md" disabled={disabled} onClick={() => setSearching(true)}><Search size={17}/>{t("주소 검색")}</button></div></Field>
    {searching && <PlaceSearch initialValue={searchName || value} maxLength={maxLength} includePlaceName={includePlaceName} onClose={() => { setSearching(false); requestAnimationFrame(() => trigger.current?.focus()); }} onSelect={(address, place) => { onChange(address); if (place) onPlaceSelect?.(place); setSearching(false); requestAnimationFrame(() => input.current?.focus()); }}/>}
  </>;
}

function PlaceSearch({ initialValue, maxLength, includePlaceName, onClose, onSelect }: {
    initialValue: string;
    maxLength: number;
    includePlaceName?: boolean;
    onClose: () => void;
    onSelect: (address: string, place?: PlaceSearchResult) => void;
}) {
    const { t } = useI18n();
    const [query, setQuery] = useState(initialValue.slice(0, 120));
    const [ready, setReady] = useState<boolean | null>(null);
    const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [postcode, setPostcode] = useState(false);
    const pending = useRef<AbortController | null>(null);
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        void isPlaceSearchReady(controller.signal).then(value => { if (active) setReady(value); }).catch(() => { if (active) setReady(false); });
        return () => { active = false; controller.abort(); pending.current?.abort(); };
    }, []);
    const search = async () => {
        if (!query.trim() || loading || !ready) return;
        const controller = new AbortController();
        pending.current?.abort(); pending.current = controller;
        setLoading(true); setError(null); setResults(null);
        try {
            const places = await searchPlaces(query, controller.signal);
            if (!controller.signal.aborted) setResults(places);
        } catch (reason) {
            if (!controller.signal.aborted) setError(errorMessage(reason));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };
    const choose = (place: PlaceSearchResult) => {
        const address = place.roadAddress || place.address;
        const value = includePlaceName ? `${place.name} · ${address}` : address;
        if (value.length > maxLength) { setError('주소가 너무 길어요. 주소를 직접 입력해 주세요.'); return; }
        onSelect(value, place);
    };
    return <>
      <Modal title={t('장소 검색')} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{t('닫기')}</Button>}>
        <form className="place-search-form" onSubmit={event => { event.preventDefault(); void search(); }}>
          <Field label={t('장소 이름 또는 주소')}><input autoFocus value={query} aria-label={t('장소 이름 또는 주소')} onChange={event => { pending.current?.abort(); setLoading(false); setResults(null); setError(null); setQuery(event.target.value); }} maxLength={120} placeholder={t('농구장, 식당 이름으로 검색')}/></Field>
          {ready && <Button type="submit" icon={Search} loading={loading} disabled={!query.trim()}>{t('검색')}</Button>}
        </form>
        {ready === null && <p className="place-search-status" role="status">{t('검색을 준비하고 있어요.')} </p>}
        {ready === false && <p className="place-search-status">{t('네이버지도에서 주소를 확인한 뒤 직접 입력해 주세요.')}</p>}
        {error && <p className="place-search-error" role="alert">{t(error)}</p>}
        {results && <div className="place-search-results" aria-live="polite">{results.length === 0 ? <p className="place-search-status">{t('검색 결과가 없어요. 지역과 장소 이름을 함께 입력해 주세요.')}</p> : results.map(place => <button key={place.id} type="button" onClick={() => choose(place)}><MapPin size={20}/><span><strong>{place.name}</strong><small>{place.roadAddress || place.address}</small></span></button>)}{results.length > 0 && <small className="place-search-credit">{t('네이버 지역 검색')}</small>}</div>}
        <div className="place-search-alternatives">
          {query.trim() && <a href={`https://map.naver.com/p/search/${encodeURIComponent(query.trim())}`} target="_blank" rel="noopener noreferrer">{t('네이버지도에서 검색')}<ArrowUpRight size={15}/></a>}
          <Button variant="secondary" icon={Search} onClick={() => setPostcode(true)}>{t('도로명 주소 검색')}</Button>
        </div>
      </Modal>
      {postcode && <AddressSearch initialValue={query} maxLength={maxLength} onClose={() => setPostcode(false)} onSelect={address => onSelect(address)}/>}
    </>;
}
function AddressSearch({ initialValue, maxLength, onClose, onSelect }: {
    initialValue: string;
    maxLength: number;
    onClose: () => void;
    onSelect: (value: string) => void;
}) {
    const { t } = useI18n();
    const container = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    useEffect(() => {
        let active = true;
        void loadAddressSearch().then(Postcode => {
            if (!active || !container.current)
                return;
            new Postcode({ width: '100%', height: '100%', minWidth: 240, theme: { searchBgColor: '#246bfd', queryTextColor: '#ffffff' }, oncomplete: data => {
                    if (!active)
                        return;
                    const address = formatPostcodeAddress(data);
                    if (!address || address.length > maxLength) {
                        setError('주소를 확인하지 못했어요. 주소를 직접 입력해 주세요.');
                        return;
                    }
                    onSelectRef.current(address);
                } }).embed(container.current, { autoClose: false, ...(initialValue.trim() ? { q: initialValue.trim() } : {}) });
            setLoading(false);
        }).catch(reason => { if (active) {
            setError(errorMessage(reason));
            setLoading(false);
        } });
        return () => { active = false; };
    }, [initialValue, maxLength]);
    return <Modal title={t("주소 검색")} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{error ? t("직접 입력하기") : t("닫기")}</Button>}><div className="address-search-panel">{loading && <div className="address-search-loading" role="status"><LoaderCircle size={23} className="spin"/><span>{t("주소 검색을 불러오는 중이에요.")}</span></div>}{error && <div className="address-search-error" role="alert"><Search size={25}/><p>{error}</p></div>}<div ref={container} className="address-search-frame" hidden={!!error} aria-label={t("주소 검색 창")}/></div></Modal>;
}
