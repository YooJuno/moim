import type {Env} from './types';
export function calendarAllowed(env:Env,uid:string){if(env.KAKAO_CALENDAR_ENABLED!=='true')return false;const restricted=env.KAKAO_CALENDAR_TEST_ONLY==='true'||env.KAKAO_CALENDAR_TEST_UIDS!==undefined;return !restricted || env.KAKAO_CALENDAR_TEST_UIDS?.split(',').map(value=>value.trim()).includes(uid)===true;}
