/** Official Kakao (formerly Daum) Postcode embed; loaded only after the search button is clicked. */
export const POSTCODE_SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
export interface PostcodeAddress { address?:string; roadAddress?:string; jibunAddress?:string; userSelectedType?:'R'|'J'; buildingName?:string }
export interface PostcodeOptions { oncomplete:(address:PostcodeAddress) => void; width:string; height:string; minWidth:number; theme?:Record<string,string> }
export interface PostcodeInstance { embed:(container:HTMLElement, options?:{autoClose?:boolean;q?:string}) => void }
export type PostcodeConstructor = new(options:PostcodeOptions) => PostcodeInstance;
type PostcodeWindow = Window & {kakao?:{Postcode?:PostcodeConstructor};daum?:{Postcode?:PostcodeConstructor}};
let pending:Promise<PostcodeConstructor> | null = null;
const existing = () => { const browser = window as PostcodeWindow; return browser.kakao?.Postcode ?? browser.daum?.Postcode; };

export function formatPostcodeAddress(data:PostcodeAddress):string {
  const base = (data.userSelectedType === 'J' ? data.jibunAddress || data.address : data.roadAddress || data.address || data.jibunAddress)?.trim() ?? '';
  const building = data.buildingName?.trim();
  return base && building && !base.includes(building) ? `${base} (${building})` : base;
}

export function loadAddressSearch():Promise<PostcodeConstructor> {
  const loaded = existing();
  if (loaded) return Promise.resolve(loaded);
  if (pending) return pending;
  const task = new Promise<PostcodeConstructor>((resolve,reject) => {
    const script = document.createElement('script');
    script.src = POSTCODE_SCRIPT_URL; script.async = true; script.dataset.moimPostcode = 'true';
    const finish = (error?:Error) => {
      clearTimeout(timeout); script.onload = null; script.onerror = null;
      const Postcode = existing();
      if (error || !Postcode) { script.remove(); reject(error ?? new Error('주소 검색을 불러오지 못했어요. 주소를 직접 입력해 주세요.')); }
      else resolve(Postcode);
    };
    const timeout = setTimeout(() => finish(new Error('주소 검색 연결이 지연돼요. 주소를 직접 입력해 주세요.')),15000);
    script.onload = () => finish();
    script.onerror = () => finish(new Error('주소 검색을 불러오지 못했어요. 주소를 직접 입력해 주세요.'));
    document.head.appendChild(script);
  });
  pending = task;
  void task.catch(() => { if (pending === task) pending = null; });
  return task;
}
