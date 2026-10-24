export interface PlaceMapLinks {search:string;directions:string}
export type MapAction = 'map' | 'directions';
export type MapProvider = 'naver' | 'kakao' | 'google';
export interface MapProviderOption {id:MapProvider;label:string;href:string;selectPlaceFirst:boolean}

function mapQuery(location:string,name:string) {
  const address = location.trim(); const place = name.trim();
  return [place && !address.includes(place) ? place : '',address].filter(Boolean).join(', ');
}

/** Maps URLs need no API key. A free-form location stays a search query, never a URL or coordinates. */
export function mapLinks(location:string,name = ''):PlaceMapLinks | null {
  const query = mapQuery(location,name);
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
  const query = encodeURIComponent(mapQuery(location,name));
  return [
    {id:'naver',label:'네이버지도',href:`https://map.naver.com/p/search/${query}`,selectPlaceFirst:action==='directions'},
    {id:'kakao',label:'카카오맵',href:`https://map.kakao.com/link/search/${query}`,selectPlaceFirst:action==='directions'},
    {id:'google',label:'Google 지도',href:action==='directions'?google.directions:google.search,selectPlaceFirst:false},
  ];
}
