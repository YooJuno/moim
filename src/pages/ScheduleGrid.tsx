import { getLocale } from "../lib/i18n";
import { useI18n } from "../lib/preferences";
import { useLayoutEffect, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { Cake, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Member, MoimEvent } from '../lib/types';
import { formatDate, localDate, today } from '../lib/utils';
import { birthdaysOnDate } from '../lib/birthdays';
import { getHoliday, hasHolidayData } from '../lib/holidays';
import { IconButton } from '../components/ui';
import './scroll-calendar.css';
export const shiftMonth = (date: Date, offset: number) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
export function MonthNavigation({ month, onChange, compact = false }: {
    month: Date;
    onChange: (date: Date) => void;
    compact?: boolean;
}) {
    const { t } = useI18n();
    return <div className={`schedule-month-nav ${compact ? 'compact' : ''}`}><strong>{formatDate(localDate(month), {year:"numeric",month:"long"})}</strong><div><IconButton label={t("이전 달")} icon={ChevronLeft} onClick={() => onChange(shiftMonth(month, -1))} type="button"/><IconButton label={t("다음 달")} icon={ChevronRight} onClick={() => onChange(shiftMonth(month, 1))} type="button"/></div></div>;
}
export function MonthGrid({ month, selectedDates = [], onSelect, events = [], minDate, compact = false, hideOutside = false, birthdayMembers = [] }: {
    birthdayMembers?: Member[];
    month: Date;
    selectedDates?: string[];
    onSelect: (date: string) => void;
    events?: MoimEvent[];
    minDate?: string;
    compact?: boolean;
    hideOutside?: boolean;
}) {
    const { t } = useI18n();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const dayCount = hideOutside ? Math.ceil((first.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 : 42;
    const days = Array.from({ length: dayCount }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
    return <div className={`schedule-month-grid ${compact ? 'is-compact' : ''}`}>
    <div className="schedule-weekdays">{[t("일"), t("월"), t("화"), t("수"), t("목"), t("금"), t("토")].map((day, index) => <span key={day} className={index === 0 ? 'is-sunday' : index === 6 ? 'is-saturday' : ''}>{day}</span>)}</div>
    <div className="schedule-days">{days.map(date => {
            const key = localDate(date);
            const holiday = getHoliday(key);
            const outside = date.getMonth() !== month.getMonth();
            const dayEvents = events.filter(event => event.date === key);
            const selected = selectedDates.includes(key);
            const birthdays = birthdaysOnDate(birthdayMembers, key);
            if (hideOutside && outside)
                return <span key={key} className="schedule-day-empty" aria-hidden="true"/>;
            return <button type="button" data-date={key} key={key} disabled={!!minDate && key < minDate} className={`schedule-day ${outside ? 'is-outside' : ''} ${date.getDay() === 0 || holiday ? 'is-holiday' : date.getDay() === 6 ? 'is-saturday' : ''} ${selected ? 'is-selected' : ''} ${key === today() ? 'is-today' : ''}`} onClick={() => onSelect(key)} aria-label={`${formatDate(key, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}${holiday ? `, ${t(holiday)}` : ''}${dayEvents.length ? t(", 일정 {0}개", { "0": dayEvents.length }) : ''}${birthdays.length ? t(", 생일 {0}", { "0": birthdays.map(member => member.name).join(', ') }) : ''}${selected ? t(", 선택됨") : ''}`} aria-pressed={selected} title={holiday ? t(holiday) : undefined}><span className="schedule-day-number">{date.getDate()}</span>{holiday && <span className="schedule-holiday-label">{t(holiday)}</span>}{!compact && birthdays.slice(0, 2).map(member => <span className="schedule-birthday-label" key={`birthday-${member.id}`}><Cake size={10}/>{member.name}</span>)}{!compact && birthdays.length > 2 && <span className="schedule-birthday-more">{t("생일 +")}{birthdays.length - 2}{t("명")}</span>}{!compact && dayEvents.slice(0, 2).map(event => <span className="schedule-event-label" key={event.id}>{event.title}</span>)}{!compact && dayEvents.length > 2 && <span className="schedule-event-more">+{dayEvents.length - 2}{t("개")}</span>}{compact && selected && <i className="schedule-selected-dot"/>}</button>;
        })}</div>
    {!hasHolidayData(month.getFullYear()) && <p className="schedule-holiday-unavailable">{t("이 연도의 공휴일 정보가 아직 없어요.")}</p>}
  </div>;
}
interface ScrollingCalendarProps {
    month: Date;
    onMonthChange?: (month: Date) => void;
    selectedDates?: string[];
    onSelect: (date: string) => void;
    events?: MoimEvent[];
    minDate?: string;
    compact?: boolean;
}
const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();
const dateForMonth = (index: number) => new Date(Math.floor(index / 12), index % 12, 1);
const monthKey = (index: number) => { const date = dateForMonth(index); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
export function ScrollingCalendar({ month, onMonthChange, selectedDates = [], onSelect, events = [], minDate, compact = false }: ScrollingCalendarProps) {
    const { t } = useI18n();
    const target = monthIndex(month);
    const [range, setRange] = useState(() => ({ start: target - 2, end: target + 6 }));
    const viewport = useRef<HTMLDivElement>(null);
    const monthElements = useRef(new Map<number, HTMLElement>());
    const lastNavigation = useRef<Date | null>(null);
    const selectionMonth = useRef<number | null>(null);
    const passiveMonth = useRef<number | null>(null);
    const lastReportedMonth = useRef(target);
    const extending = useRef(false);
    const heightBeforePrepend = useRef<number | null>(null);
    useLayoutEffect(() => {
        const element = viewport.current;
        if (element && heightBeforePrepend.current !== null) {
            element.scrollTop += element.scrollHeight - heightBeforePrepend.current;
            heightBeforePrepend.current = null;
        }
        extending.current = false;
    }, [range.start, range.end]);
    useLayoutEffect(() => {
        if (lastNavigation.current === month)
            return;
        if (target < range.start || target > range.end) {
            setRange(current => ({ start: Math.min(current.start, target - 2), end: Math.max(current.end, target + 6) }));
            return;
        }
        const element = viewport.current;
        const destination = monthElements.current.get(target);
        if (!element || !destination)
            return;
        lastNavigation.current = month;
        lastReportedMonth.current = target;
        // Selecting a date already in view should keep both sides of a month boundary in place.
        if (selectionMonth.current === target || passiveMonth.current === target) {
            selectionMonth.current = null;
            passiveMonth.current = null;
            return;
        }
        selectionMonth.current = null;
        passiveMonth.current = null;
        element.scrollTop = destination.offsetTop;
    }, [month, target, range.start, range.end]);
    function handleScroll(event: UIEvent<HTMLDivElement>) {
        const element = event.currentTarget;
        if (onMonthChange) {
            let visible = range.start;
            for (const [index, section] of monthElements.current) {
                if (section.offsetTop <= element.scrollTop + 48)
                    visible = Math.max(visible, index);
            }
            if (visible !== lastReportedMonth.current) {
                lastReportedMonth.current = visible;
                passiveMonth.current = visible;
                onMonthChange(dateForMonth(visible));
            }
        }
        if (extending.current)
            return;
        if (element.scrollTop < 140) {
            extending.current = true;
            heightBeforePrepend.current = element.scrollHeight;
            setRange(current => ({ ...current, start: current.start - 3 }));
        }
        else if (element.scrollHeight - element.scrollTop - element.clientHeight < 220) {
            extending.current = true;
            setRange(current => ({ ...current, end: current.end + 3 }));
        }
    }
    const months = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
    return <div className={`scroll-calendar ${compact ? 'is-compact' : ''}`}>
    <div ref={viewport} className="scroll-calendar-viewport" role="region" aria-label={compact ? t("후보 날짜 선택 달력") : t("모임 일정 달력")} tabIndex={0} onScroll={handleScroll}>
      {months.map(index => {
            const date = dateForMonth(index);
            return <section key={index} className="scroll-calendar-month" data-month={monthKey(index)} ref={element => { if (element)
                monthElements.current.set(index, element);
            else
                monthElements.current.delete(index); }} aria-label={new Intl.DateTimeFormat(getLocale(), {year:"numeric",month:"long"}).format(date)}>
        <h4 className="scroll-calendar-month-heading">{formatDate(localDate(date), {year:"numeric",month:"long"})}</h4>
        <MonthGrid month={date} selectedDates={selectedDates} onSelect={value => { selectionMonth.current = monthIndex(new Date(`${value}T12:00:00`)); onSelect(value); }} events={events} minDate={minDate} compact={compact} hideOutside/>
      </section>;
        })}
    </div>
  </div>;
}
