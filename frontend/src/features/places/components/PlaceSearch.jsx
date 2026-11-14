import { useEffect, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Beer, Compass, Hotel, Landmark, LoaderCircle, Search, ShoppingBag, Utensils, X } from 'lucide-react';
import { searchPlaces } from '../api/placesApi';
import GoogleGMark from '../../../shared/components/google-g-mark/GoogleGMark';

/**
 * SearchBar — Phase 10: AI-powered natural language search.
 * Can be dropped into any page. Results link directly to place data.
 */
export default function SearchBar({ destinationSlug, onResultClick, inlineResults = false, category, fast = false, placeholder, compact = false, googleSearch = false, destinationName = '', locationBias = null }) {
  const placesLibrary = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const runGoogleSearch = async (event) => {
    event?.preventDefault();
    const text = query.trim();
    if (!placesLibrary?.Place?.searchByText || text.length < 2 || loading) return;
    setLoading(true);
    setOpen(false);
    setSearchError(false);
    try {
      const categoryHint = category === 'restaurant' ? 'restaurants, cafes, and coffee shops' : category ? `${category} places` : 'places to visit, restaurants, and activities';
      const response = await placesLibrary.Place.searchByText({
        textQuery: `${text} ${categoryHint} in ${destinationName}`.trim(),
        ...(locationBias && { locationBias: { center: locationBias, radius: 25000 } }),
        maxResultCount: 8,
        fields: ['id', 'displayName', 'location'],
      });
      const found = (response.places || []).filter(place => place.id && place.location).map(place => ({
        id: place.id,
        google_place_id: place.id,
        name: typeof place.displayName === 'string' ? place.displayName : place.displayName?.text || 'Place',
        category: category || 'attraction',
        latitude: place.location.lat(),
        longitude: place.location.lng(),
        destination_name: destinationName,
        source: 'google',
      }));
      setResults(found);
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(true);
      setSearchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleSearch || query.trim().length < 2) return undefined;

    let current = true;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchPlaces(query, destinationSlug, category, fast);
        if (current) {
          setResults(data);
          setOpen(true);
          setSearchError(false);
        }
      } catch {
        if (current) {
          setResults([]);
          setOpen(true);
          setSearchError(true);
        }
      } finally {
        if (current) setLoading(false);
      }
    }, 300);

    return () => {
      current = false;
      window.clearTimeout(timeoutId);
    };
  }, [query, destinationSlug, category, fast, googleSearch]);

  const categoryIcons = {
    attraction: Landmark,
    restaurant: Utensils,
    cafe: Utensils,
    bar: Beer,
    hotel: Hotel,
    activity: Compass,
    bar: Beer,
    shop: ShoppingBag,
  };

  return (
    <div className="relative w-full max-w-lg">
      <form onSubmit={googleSearch ? runGoogleSearch : event => event.preventDefault()} className={`flex items-center gap-2.5 rounded-lg border border-[#d7dfd9] bg-white transition focus-within:border-green-medium focus-within:ring-2 focus-within:ring-green-medium/15 ${compact ? 'min-h-10 px-3' : 'min-h-14 gap-3 px-4'}`}>
        {loading ? <LoaderCircle size={compact ? 16 : 19} className="animate-spin text-pine" /> : <Search size={compact ? 16 : 19} className="text-[#56655c]" />}
        <input
          type="text"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setLoading(false); setOpen(false); setSearchError(false); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          disabled={googleSearch && !placesLibrary}
          placeholder={placeholder || (category === 'restaurant' ? 'Search restaurants and cafes' : 'Search places to visit')}
          className={`min-w-0 flex-grow bg-transparent text-pine outline-none focus-visible:outline-none placeholder:text-[#7b8980] ${compact ? 'text-xs' : 'text-sm'}`}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="grid h-8 w-8 place-items-center rounded-full text-[#627168] hover:bg-[#f2f5f2]" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
        {googleSearch && <button type="submit" disabled={query.trim().length < 2 || loading || !placesLibrary} aria-label="Search Google Maps" title={placesLibrary ? 'Search places near your trip destination' : 'Map search is loading'} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pine text-white transition hover:bg-[#145b3d] disabled:opacity-40"><Search size={13} /></button>}
      </form>

      {open && query.trim().length >= 2 && results.length > 0 && (
        <div className={`app-scrollbar ${inlineResults ? 'relative mt-1' : 'absolute left-0 right-0 top-full z-50 mt-2'} max-h-72 overflow-y-auto rounded-lg border border-[#e3e9e5] bg-white shadow-[0_14px_40px_rgba(18,44,32,0.16)]`}>
          {results.map(place => (
            <button
              key={place.id}
              type="button"
              onClick={() => { onResultClick?.(place); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 border-b border-[#edf0ed] text-left transition hover:bg-[#f5faf6] last:border-0 ${compact ? 'px-3 py-2' : 'gap-3 px-4 py-3'}`}
            >
              {(() => { const Icon = categoryIcons[place.category] || Compass; return <Icon size={compact ? 15 : 18} className="shrink-0 text-pine" />; })()}
              <div>
                <p className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-pine`}>{place.name}</p>
                <p className="text-[10px] capitalize text-[#718077]">{place.category} · {place.destination_name}</p>
              </div>
            </button>
          ))}
          {googleSearch && <div className="flex items-center justify-end gap-1 border-t border-[#edf0ed] px-3 py-1 text-[10px] text-[#718077]"><GoogleGMark className="h-3.5 w-3.5" title="Google Maps search results" />Maps</div>}
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div className={`${inlineResults ? 'relative mt-1' : 'absolute left-0 right-0 top-full z-50 mt-2'} rounded-lg border border-[#e3e9e5] bg-white p-3 text-center text-xs text-[#66736b] shadow-[0_14px_40px_rgba(18,44,32,0.16)]`}>
          {searchError ? 'Search is unavailable right now. Please try again.' : <>No places found for <strong className="text-pine">“{query}”</strong></>}
        </div>
      )}
    </div>
  );
}
