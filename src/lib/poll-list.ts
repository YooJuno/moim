import type { Poll, Vote } from './types';

export const isPollOpen = (poll: Poll, now = Date.now()) => poll.status === 'open' && (!poll.deadline || Date.parse(poll.deadline) > now);

/** Unanswered polls first, then the nearest deadline. Keep the home and list in the same order. */
export function sortOpenPolls(polls: Poll[], votes: Vote[], userId: string | undefined, canParticipate: boolean, now: number): Poll[] {
  const responded = new Set(votes.filter(vote => vote.memberId === userId).map(vote => vote.pollId));
  const needsResponse = (id: string) => canParticipate && !responded.has(id);
  return polls.filter(poll => isPollOpen(poll, now)).sort((a, b) => Number(needsResponse(b.id)) - Number(needsResponse(a.id))
    || (a.deadline ? Date.parse(a.deadline) : Infinity) - (b.deadline ? Date.parse(b.deadline) : Infinity)
    || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
