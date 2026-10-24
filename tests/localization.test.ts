import { afterEach, describe, expect, it, vi } from 'vitest';
import { messagesEn } from '../src/lib/messages.en';
import { setLanguage, translate } from '../src/lib/i18n';
import { categoryLabels, errorMessage, formatDate, relativeDate, roleLabels } from '../src/lib/utils';
import { formatPollDuration } from '../src/lib/poll-results';

afterEach(() => { setLanguage('ko'); vi.useRealTimers(); });

describe('English interface copy', () => {
  it('keeps every variable placeholder and interpolates translated action labels', () => {
    for (const [key, value] of Object.entries(messagesEn)) {
      const placeholders = (text:string) => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
      expect(placeholders(value), key).toEqual(placeholders(key));
    }
    expect(translate('{0}, {1}명 가능{2}', 'en', {'0':'Oct 31, 18:00–19:00','1':3,'2':translate(', 선택됨','en')}))
      .toBe('Oct 31, 18:00–19:00, 3 available, selected');
  });

  it('localizes display helpers and errors while keeping stored category and permission values', () => {
    setLanguage('en');
    expect(translate(categoryLabels.chat)).toBe('Chat');
    expect(translate(roleLabels.treasurer)).toBe('Accountant');
    expect(categoryLabels.chat).toBe('자유게시판');
    expect(roleLabels.treasurer).toBe('회계 담당');
    expect(formatDate('2026-10-31',{year:'numeric',month:'long'})).toBe('October 2026');
    expect(formatPollDuration(150)).toBe('2h 30m');
    expect(errorMessage(new Error('permission-denied'))).toBe('You do not have permission to do this.');
    expect(errorMessage(new Error('승인된 멤버만 사용할 수 있어요.'))).toBe('Only approved members can use this feature.');
    setLanguage('ko');
    expect(formatPollDuration(150)).toBe('2시간 30분');
    expect(errorMessage(new Error('permission-denied'))).toBe('이 작업을 할 권한이 없어요.');
  });

  it('uses English relative time after an account language change', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
    setLanguage('en');
    expect(relativeDate('2026-10-24T11:58:00Z')).toBe('2 minutes ago');
    setLanguage('ko');
    expect(relativeDate('2026-10-24T11:58:00Z')).toBe('2분 전');
  });
});
