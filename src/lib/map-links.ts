export interface PlaceMapLinks {search:string;directions:string}

/** Maps URLs need no API key. A free-form location stays a search query, never a URL or coordinates. */
export function mapLinks(location:string,name = ''):PlaceMapLinks | null {
  const address = location.trim(); const place = name.trim();
  const query = [place && !address.includes(place) ? place : '',address].filter(Boolean).join(', ');
  if (!query) return null;
  const search = new URL('https://www.google.com/maps/search/');
  search.searchParams.set('api','1'); search.searchParams.set('query',query);
  const directions = new URL('https://www.google.com/maps/dir/');
  directions.searchParams.set('api','1'); directions.searchParams.set('destination',query);
  // Maps URLs have a 2,048-character limit; keep saved location text intact instead of truncating it.
  if (search.href.length > 2048 || directions.href.length > 2048) return null;
  return {search:search.href,directions:directions.href};
}
