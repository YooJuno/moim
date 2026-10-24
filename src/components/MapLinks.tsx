import { useI18n } from "../lib/preferences";
import { Map, Navigation } from 'lucide-react';
import { mapLinks } from '../lib/map-links';
import './address-field.css';
export function MapLinks({ location, name, compact = false }: {
    location: string;
    name?: string;
    compact?: boolean;
}) {
    const { t } = useI18n();
    const links = mapLinks(location, name);
    if (!links)
        return null;
    return <div className={`map-links ${compact ? 'is-compact' : ''}`}><a href={links.search} target="_blank" rel="noopener noreferrer"><Map size={14}/>{t("지도 보기")}</a><a href={links.directions} target="_blank" rel="noopener noreferrer"><Navigation size={14}/>{t("길찾기")}</a></div>;
}
