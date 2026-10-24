import { useI18n } from "../lib/preferences";
import { useRef, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store';
import type { SavedPlace } from '../lib/types';
import { errorMessage, uid } from '../lib/utils';
import { Button, EmptyState, Field, IconButton, Modal, useToast } from './ui';
import { AddressField } from './AddressField';
import { MapLinks } from './MapLinks';
import './saved-places.css';
export function SavedPlacesManager() {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [editing, setEditing] = useState<SavedPlace | 'new' | null>(null);
    const [deleting, setDeleting] = useState<SavedPlace | null>(null);
    const [busy, setBusy] = useState(false);
    const places = [...app.places].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    async function remove() { if (!deleting || busy)
        return; setBusy(true); try {
        await app.deletePlace(deleting.id);
        setDeleting(null);
        toast('장소를 삭제했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    } }
    if (!app.isAdmin)
        return null;
    return <section className="card saved-places" aria-label={t("자주 가는 장소")}><div className="saved-places-heading"><span className="saved-places-heading-icon"><MapPin size={20}/></span><h2>{t("자주 가는 장소")}</h2><Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing('new')}>{t("장소 추가")}</Button></div>
    {places.length > 0 ? <div className="saved-places-list">{places.map(place => <div className="saved-place-row" key={place.id}><span className="saved-place-icon"><MapPin size={17}/></span><div className="saved-place-info"><strong>{place.name}</strong><span>{place.address}</span><MapLinks location={place.address} name={place.name} compact/></div><div className="saved-place-actions"><IconButton label={t("{0} 수정", { "0": place.name })} icon={Pencil} onClick={() => setEditing(place)}/><IconButton label={t("{0} 삭제", { "0": place.name })} icon={Trash2} onClick={() => setDeleting(place)}/></div></div>)}</div> : <EmptyState icon={MapPin} title={t("저장된 장소가 없어요")}/>}
    {editing && <PlaceEditor place={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}/>}
    {deleting && <Modal title={t("장소를 삭제할까요?")} onClose={() => !busy && setDeleting(null)} footer={<><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>{t("취소")}</Button><Button variant="danger" icon={Trash2} loading={busy} onClick={() => void remove()}>{t("삭제")}</Button></>}><div className="saved-place-delete-preview"><MapPin size={20}/><div><strong>{deleting.name}</strong><span>{deleting.address}</span></div></div></Modal>}
  </section>;
}
function PlaceEditor({ place, onClose }: {
    place?: SavedPlace;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [name, setName] = useState(place?.name ?? '');
    const [address, setAddress] = useState(place?.address ?? '');
    const [saving, setSaving] = useState(false);
    const id = useRef(place?.id ?? uid());
    const createdAt = useRef(place?.createdAt ?? new Date().toISOString());
    async function save(event: React.FormEvent) { event.preventDefault(); if (saving)
        return; if (!name.trim() || !address.trim()) {
        toast('장소 이름과 주소를 입력해 주세요.', 'error');
        return;
    } setSaving(true); try {
        await app.savePlace({ id: id.current, name: name.trim(), address: address.trim(), createdAt: createdAt.current, updatedAt: place?.updatedAt ?? new Date().toISOString() });
        toast(place ? '장소를 수정했어요.' : '장소를 추가했어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    return <Modal title={place ? t("장소 수정") : t("장소 추가")} onClose={() => !saving && onClose()} footer={<><Button variant="secondary" disabled={saving} onClick={onClose}>{t("취소")}</Button><Button form="saved-place-form" type="submit" loading={saving}>{t("저장")}</Button></>}><form id="saved-place-form" className="stack" onSubmit={save}><Field label={t("장소 이름")} required><input value={name} onChange={event => setName(event.target.value)} maxLength={80} required autoFocus/></Field><AddressField value={address} onChange={setAddress} required disabled={saving}/></form></Modal>;
}
