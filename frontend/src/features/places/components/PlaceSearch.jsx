import { useEffect, useState } from 'react';
import { Beer, Compass, Hotel, Landmark, LoaderCircle, Search, ShoppingBag, Utensils, X } from 'lucide-react';
import { searchPlaces } from '../api/placesApi';

/**
 * SearchBar — Phase 10: AI-powered natural language search.
 * Can be dropped into any page. Results link directly to place data.
 */
export default function SearchBar({ destinationSlug, onResultClick, inlineResults = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return undefined;

    let current = true;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchPlaces(query, destinationSlug);
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
  }, [query, destinationSlug]);

  const categoryIcons = {
    attraction: Landmark,
    restaurant: Utensils,
    hotel: Hotel,
    activity: Compass,
    bar: Beer,
    shop: ShoppingBag,
  };

  return (
    <div className="relative w-full max-w-lg">
      <div className="flex min-h-14 items-center gap-3 rounded-lg border border-[#d7dfd9] bg-white px-4 transition focus-within:border-green-medium focus-within:ring-2 focus-within:ring-green-medium/15">
        {loading ? <LoaderCircle size={19} className="animate-spin text-pine" /> : <Search size={19} className="text-[#56655c]" />}
        <input
          type="text"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setLoading(false); setOpen(false); setSearchError(false); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Where to go"
          className="min-w-0 flex-grow bg-transparent text-sm text-pine outline-none placeholder:text-[#7b8980]"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="grid h-8 w-8 place-items-center rounded-full text-[#627168] hover:bg-[#f2f5f2]" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && results.length > 0 && (
        <div className={`${inlineResults ? 'relative mt-2' : 'absolute left-0 right-0 top-full z-50 mt-2'} max-h-72 overflow-y-auto rounded-lg border border-[#e3e9e5] bg-white shadow-[0_14px_40px_rgba(18,44,32,0.16)]`}>
          {results.map(place => (
            <button
              key={place.id}
              type="button"
              onClick={() => { onResultClick?.(place); setOpen(false); }}
              className="flex w-full items-center gap-3 border-b border-[#edf0ed] px-4 py-3 text-left transition hover:bg-[#f5faf6] last:border-0"
            >
              {(() => { const Icon = categoryIcons[place.category] || Compass; return <Icon size={18} className="shrink-0 text-pine" />; })()}
              <div>
                <p className="text-sm font-bold text-pine">{place.name}</p>
                <p className="text-xs capitalize text-[#718077]">{place.category} · {place.destination_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div className={`${inlineResults ? 'relative mt-2' : 'absolute left-0 right-0 top-full z-50 mt-2'} rounded-lg border border-[#e3e9e5] bg-white p-4 text-center text-sm text-[#66736b] shadow-[0_14px_40px_rgba(18,44,32,0.16)]`}>
          {searchError ? 'Search is unavailable right now. Please try again.' : <>No places found for <strong className="text-pine">“{query}”</strong></>}
        </div>
      )}
    </div>
  );
}
