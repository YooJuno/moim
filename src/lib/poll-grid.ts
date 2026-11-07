import type { PollSlot, Vote } from './types';

export const slotPosition = (date: string, start: string, end: string) => `${date}|${start}|${end}`;

export function buildPollGridIndex(slots: PollSlot[], votes: Vote[]) {
  const slotAt = new Map<string, PollSlot>();
  const dayIds = new Map<string, string[]>();
  const voters = new Map<string, Vote[]>();
  for (const slot of slots) {
    const position = slotPosition(slot.date, slot.start, slot.end);
    if (!slotAt.has(position)) slotAt.set(position, slot);
    const day = dayIds.get(slot.date) ?? [];
    day.push(slot.id); dayIds.set(slot.date, day);
    voters.set(slot.id, []);
  }
  for (const vote of votes) for (const id of new Set(vote.slotIds)) voters.get(id)?.push(vote);
  return { slotAt, dayIds, voters,
    dates: [...dayIds.keys()].sort(),
    times: [...new Set(slots.map(slot => `${slot.start}|${slot.end}`))].sort(),
    topCount: Math.max(0, ...[...voters.values()].map(items => items.length)),
  };
}
