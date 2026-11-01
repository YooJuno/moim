import type { MoimEvent, Rsvp } from './types';
import { localDate } from './utils';

export function pendingEventInvitations(events: MoimEvent[], rsvps: Rsvp[], memberId: string | undefined, now = new Date()): MoimEvent[] {
  if (!memberId) return [];
  const responded = new Set(rsvps.filter(rsvp => rsvp.memberId === memberId).map(rsvp => rsvp.eventId));
  const current = `${localDate(now)}T${now.toTimeString().slice(0, 5)}`;
  return events.filter(event => event.invitedMemberIds?.includes(memberId) && !responded.has(event.id) && `${event.date}T${event.end}` >= current)
    .slice().sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}
