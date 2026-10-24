import { useI18n } from "../lib/preferences";
import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { Field } from './ui';
/** Location text is a snapshot, so changing a saved place never rewrites old events. */
export function PlacePicker({ value, onChange, disabled = false }: {
    value: string;
    onChange: (location: string) => void;
    disabled?: boolean;
}) {
    const { t } = useI18n();
    const { places } = useApp();
    const matching = places.find(place => `${place.name} · ${place.address}` === value);
    const [selectedId, setSelectedId] = useState(matching?.id ?? '');
    useEffect(() => { setSelectedId(matching?.id ?? ''); }, [value, matching?.id]);
    if (!places.length)
        return null;
    return <Field label={t("저장한 장소")}><select aria-label={t("저장한 장소")} value={selectedId} disabled={disabled} onChange={event => {
            const id = event.target.value;
            setSelectedId(id);
            const place = places.find(item => item.id === id);
            if (place)
                onChange(`${place.name} · ${place.address}`);
        }}><option value="">{t("직접 입력")}</option>{places.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(place => <option value={place.id} key={place.id}>{place.name} ({place.address})</option>)}</select></Field>;
}
