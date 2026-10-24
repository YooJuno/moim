import holidays from '../data/holidays-kr.json';
const data: Record<string, Record<string,string[]>> = holidays;
export const holidayYears=Object.keys(data).map(Number).sort((a,b)=>a-b);
export const MIN_HOLIDAY_YEAR=holidayYears[0];
export const MAX_HOLIDAY_YEAR=holidayYears[holidayYears.length-1];
export const hasHolidayData=(year:number)=>String(year) in data;
/** Korea's gazette-based public holidays; Sunday styling is handled separately. */
export const getHoliday=(date:string):string|undefined=>data[date.slice(0,4)]?.[date]?.join(' · ');
export const isHoliday=(date:string)=>Boolean(getHoliday(date));
