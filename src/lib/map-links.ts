export interface PlaceMapLinks {search:string;directions:string}
export type MapAction = 'map' | 'directions';
export type MapProvider = 'naver' | 'kakao' | 'google';
export interface MapProviderOption {id:MapProvider;label:string;href:string;selectPlaceFirst:boolean}

/** Event locations may contain a saved "place name · address" snapshot. */
export function addressForMap(location:string,name = ''):string {
  const address = location.trim();
  if (!address) return name.trim();
  const region = /^(?:서울(?:특별시)?|부산(?:광역시)?|대구(?:광역시)?|인천(?:광역시)?|광주(?:광역시)?|대전(?:광역시)?|울산(?:광역시)?|세종(?:특별자치시)?|경기(?:도)?|강원(?:특별자치도|도)?|충북|충청북도|충남|충청남도|전북(?:특별자치도)?|전라북도|전남|전라남도|경북|경상북도|경남|경상남도|제주(?:특별자치도|도)?)\s+/;
  // Keep an address's own commas and details intact; only remove a leading place label.
  if (region.test(address)) return address;
  for (const separator of address.matchAll(/\s+·\s+|,\s*/g)) {
    const candidate = address.slice(separator.index! + separator[0].length).trim();
    if (region.test(candidate)) return candidate;
  }
  return address;
}

/** Maps URLs need no API key. A free-form location stays a search query, never a URL or coordinates. */
export function mapLinks(location:string,name = ''):PlaceMapLinks | null {
  const query = addressForMap(location,name);
  if (!query) return null;
  const search = new URL('https://www.google.com/maps/search/');
  search.searchParams.set('api','1'); search.searchParams.set('query',query);
  const directions = new URL('https://www.google.com/maps/dir/');
  directions.searchParams.set('api','1'); directions.searchParams.set('destination',query);
  // Maps URLs have a 2,048-character limit; keep saved location text intact instead of truncating it.
  if (search.href.length > 2048 || directions.href.length > 2048) return null;
  return {search:search.href,directions:directions.href};
}

/** Naver and Kakao require coordinates or a place ID for direct routes; address-only records open place search first. */
export function mapProviderOptions(location:string,name = '',action:MapAction = 'map'):MapProviderOption[] {
  const google = mapLinks(location,name);
  if (!google) return [];
  const query = encodeURIComponent(addressForMap(location,name));
  return [
    {id:'naver',label:'네이버지도',href:`https://map.naver.com/p/search/${query}`,selectPlaceFirst:action==='directions'},
    {id:'kakao',label:'카카오맵',href:`https://map.kakao.com/link/search/${query}`,selectPlaceFirst:action==='directions'},
    {id:'google',label:'Google 지도',href:action==='directions'?google.directions:google.search,selectPlaceFirst:false},
  ];
}
