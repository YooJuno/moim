import { describe, expect, it } from 'vitest';
import { getHoliday, hasHolidayData, isHoliday } from '../src/lib/holidays';
describe('대한민국 공휴일',()=>{
  it('설날과 추석 음력 연휴를 포함한다',()=>{expect(getHoliday('2026-02-17')).toBe('설날');expect(getHoliday('2026-09-25')).toBe('추석');});
  it('대체공휴일과 선거일을 포함한다',()=>{expect(getHoliday('2026-10-05')).toContain('대체공휴일');expect(getHoliday('2026-06-03')).toContain('선거');});
  it('같은 날 겹친 공휴일 이름을 모두 보존한다',()=>{expect(getHoliday('2025-05-05')).toContain('어린이날');expect(getHoliday('2025-05-05')).toContain('부처님');});
  it('2026년 노동절과 제헌절을 포함한다',()=>{expect(isHoliday('2026-05-01')).toBe(true);expect(isHoliday('2026-07-17')).toBe(true);expect(isHoliday('2025-07-17')).toBe(false);});
  it('평일과 미지원 연도를 구분한다',()=>{expect(getHoliday('2026-10-06')).toBeUndefined();expect(hasHolidayData(2026)).toBe(true);expect(hasHolidayData(2099)).toBe(false);});
});
