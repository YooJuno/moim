import { messagesEn } from './messages.en';
export type Language='ko'|'en';
let currentLanguage:Language='ko';
export const getLanguage=()=>currentLanguage;
export function setLanguage(language:Language){currentLanguage=language==='en'?'en':'ko';}
export const localeFor=(language:Language)=>language==='en'?'en-US':'ko-KR';
export const getLocale=()=>localeFor(currentLanguage);
const english:Record<string,string>={
  '생일 선택':'Choose birthday','달력 열기':'Open calendar','생일 지우기':'Clear birthday','월 선택':'Birth month','일 선택':'Birth day','생일 날짜':'Birthday date','지우기':'Clear','선택':'Select','이전 달':'Previous month','다음 달':'Next month','내 정보':'My profile','프로필':'Profile','이름':'Name','전화번호':'Phone number','거주 지역':'Area','생일':'Birthday','직책':'Position','직책 없음':'No position','회장':'President','부회장':'Vice president','총무':'Treasurer','관리자':'Administrator','일반':'Member','멤버':'Members','회계 담당':'Accountant','회계담당':'Accountant',
  '월-일 · 생일은 모임 캘린더에 표시돼요.':'MM-DD · Birthdays appear on the group calendar.','전화번호와 거주 지역은 본인과 관리자만 볼 수 있어요.':'Only you and administrators can view your phone number and area.','연락처와 거주 지역은 본인과 관리자만 볼 수 있어요.':'Only you and administrators can view your contact details and area.',
  '계정':'Account','연결':'Connect','연결됨':'Connected','확인 중':'Checking','확인 필요':'Check connection','카카오':'Kakao','네이버':'Naver','데모':'Demo','기존 계정은 로그인 후 연결해 주세요.':'Sign in to your existing account before connecting another login.','다시 확인':'Check again',
  '저장하기':'Save','저장':'Save','취소':'Cancel','닫기':'Close','로그아웃':'Sign out','로그아웃할까요?':'Sign out?','샘플 계정으로 다시 둘러볼 수 있어요.':'You can sign in to the demo again.','같은 계정으로 다시 로그인할 수 있어요.':'You can sign in again with the same account.',
  '내 정보를 저장했어요.':'Your profile has been saved.','생일을 월-일 형식으로 확인해 주세요.':'Enter a valid birthday in MM-DD format.','설정을 저장했어요.':'Your preferences have been saved.','설정을 저장하지 못했어요. 다시 시도해 주세요.':'Could not save your preferences. Please try again.','먼저 로그인해 주세요.':'Please sign in first.',
  '화면 설정':'Appearance and language','언어':'Language','한국어':'한국어','테마':'Theme','시스템 설정':'System','라이트':'Light','다크':'Dark',
};
export function registerEnglishMessages(messages:Record<string,string>){Object.assign(english,messages);}
export function translate(text:string,language:Language=getLanguage(),values?:Record<string,string|number>){let result=language==='en'?english[text]??text:text;if(values)for(const [key,value]of Object.entries(values))result=result.replaceAll(`{${key}}`,String(value));return result;}
export function formatI18nDate(value:Date|string|number,language:Language,options:Intl.DateTimeFormatOptions={month:'long',day:'numeric'}){const date=value instanceof Date?value:new Date(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T12:00:00+09:00`:value);return new Intl.DateTimeFormat(localeFor(language),{timeZone:'Asia/Seoul',...options}).format(date);}
export function formatI18nNumber(value:number,language:Language,options?:Intl.NumberFormatOptions){return new Intl.NumberFormat(localeFor(language),options).format(value);}
export function formatI18nCurrency(value:number,language:Language){return formatI18nNumber(value,language,{style:'currency',currency:'KRW',maximumFractionDigits:0});}

registerEnglishMessages(messagesEn);
