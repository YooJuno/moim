import { describe, expect, it } from 'vitest';
import { sharedDestination, validSharedDestination } from '../src/lib/share-target';

describe('shared poll and event login destinations', () => {
  it('preserves the selected record and removes unrelated parameters', () => {
    expect(sharedDestination('/polls', '?poll=poll-weekend&token=private&create=1')).toBe('/polls?poll=poll-weekend');
    expect(sharedDestination('/calendar', '?event=event-coffee&kakao=1')).toBe('/calendar?event=event-coffee');
    expect(validSharedDestination('/polls?poll=poll-weekend')).toBe(true);
  });
  it('rejects arbitrary destinations and ambiguous or invalid IDs', () => {
    for (const value of ['https://evil.test/polls?poll=x', '//evil.test?poll=x', '/profile?poll=x', '/polls?poll=x&poll=y', '/polls?poll=../private', '/polls?poll=x#token', '/polls?poll=x&token=private']) expect(validSharedDestination(value)).toBe(false);
  });
});
