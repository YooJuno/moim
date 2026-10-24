import { useI18n } from "../lib/preferences";
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { errorMessage } from '../lib/utils';
import { formatPostcodeAddress, loadAddressSearch } from '../lib/address-search';
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
}
export function AddressField({ value, onChange, label = '주소', required, disabled, maxLength = 300, placeholder = '주소 또는 위치', autoFocus }: AddressFieldProps) {
    const { t } = useI18n();
    const [searching, setSearching] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    return <>
    <Field label={t(label)} required={required}><div className="address-field"><input ref={input} aria-label={t(label)} value={value} onChange={event => onChange(event.target.value)} placeholder={t(placeholder)} maxLength={maxLength} required={required} disabled={disabled} autoFocus={autoFocus}/><Button type="button" variant="secondary" icon={Search} disabled={disabled} onClick={() => setSearching(true)}>{t("주소 검색")}</Button></div></Field>
    {searching && <AddressSearch initialValue={value} maxLength={maxLength} onClose={() => setSearching(false)} onSelect={address => { onChange(address); setSearching(false); requestAnimationFrame(() => input.current?.focus()); }}/>}
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
