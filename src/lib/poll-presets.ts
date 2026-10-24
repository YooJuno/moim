import { getHoliday, hasHolidayData } from './holidays';

export function nextPollMonth(date = new Date()): string {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function monthlyPollTitle(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return `${year}년 ${number}월 일정 취합`;
}

/** Holidays are selected only for years covered by the bundled Korean holiday data. */
export function monthlyPollDates(month: string, minDate = ''): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('취합할 월을 골라 주세요.');
  const [year, number] = month.split('-').map(Number);
  if (!hasHolidayData(year)) throw new Error('이 연도의 공휴일 정보가 아직 없어요. 날짜를 직접 골라 주세요.');
  const days = new Date(year, number, 0).getDate();
  const dates: string[] = [];
  for (let day = 1; day <= days; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(year, number - 1, day).getDay();
    if (date >= minDate && (weekday === 0 || weekday === 6 || getHoliday(date))) dates.push(date);
  }
  return dates;
}
