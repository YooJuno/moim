import { useI18n } from "../lib/preferences";
import { MapPin, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { MapLinks } from '../components/MapLinks';
import '../components/saved-places.css';
export function Places() {
    const { t } = useI18n();
    const app = useApp();
    const places = [...app.places].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return <div className="page places-page"><PageHeader title={t("자주 가는 장소")} action={app.isAdmin ? <Link to="/settings"><Button variant="secondary" icon={Settings}>{t("장소 관리")}</Button></Link> : undefined}/>{places.length ? <div className="places-directory">{places.map(place => <article className="card place-directory-card" key={place.id}><span className="feature-icon feature-icon-blue"><MapPin size={22}/></span><div className="place-directory-info"><h2>{place.name}</h2><p>{place.address}</p><MapLinks location={place.address} name={place.name}/></div></article>)}</div> : <div className="card"><EmptyState icon={MapPin} title={t("저장된 장소가 없어요")}/></div>}</div>;
}
