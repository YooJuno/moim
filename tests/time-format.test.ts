import { afterEach, describe, expect, it } from 'vitest';
import { normalizeTimeInput } from '../src/components/TimeInput';
import { formatI18nDate, setLanguage } from '../src/lib/i18n';
import { formatDate, formatTime } from '../src/lib/utils';

afterEach(() => setLanguage('ko'));

describe('24-hour times', () => {
  it('keeps both languages on 00–23 even if a caller requests a 12-hour clock', () => {
    for (const language of ['ko', 'en'] as const) {
      expect(formatI18nDate('2026-10-24T00:05:00+09:00', language, { hour: '2-digit', minute: '2-digit', hour12: true })).toBe('00:05');
      expect(formatI18nDate('2026-10-24T18:35:00+09:00', language, { hour: '2-digit', minute: '2-digit' })).toBe('18:35');
      setLanguage(language);
      expect(formatTime('2026-10-24T00:00:00+09:00')).toBe('00:00');
      expect(formatDate('2026-10-24T18:35:00+09:00', { hour: '2-digit', minute: '2-digit' })).toBe('18:35');
    }
  });

  it('normalizes convenient numeric input while reserving 24:00 for the end of a day', () => {
    for (const [input, result] of [['8', '08:00'], ['800', '08:00'], ['0800', '08:00'], ['8:5', '08:05'], ['1835', '18:35'], ['23:59', '23:59']]) {
      expect(normalizeTimeInput(input)).toBe(result);
    }
    expect(normalizeTimeInput('24:00')).toBeNull();
    expect(normalizeTimeInput('24:00', true)).toBe('24:00');
    for (const invalid of ['', '24:01', '25:00', '23:60', 'AM 8:00']) expect(normalizeTimeInput(invalid, true)).toBeNull();
  });
});
