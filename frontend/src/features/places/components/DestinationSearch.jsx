import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin, Search } from 'lucide-react';
import { autocompleteDestinations, getDestinationPlaceDetails, lookupDestination, resolveDestination, startDestinationDiscovery } from '../api/placesApi';

/** Show Google Places Autocomplete predictions as the user types. */
export default function DestinationSearch({ onSearch }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [autocompleteFailed, setAutocompleteFailed] = useState(false);
  const [error, setError] = useState('');
  const sessionToken = useRef(null);
  const searchQuery = useRef('');

  useEffect(() => {
    const input = query.trim();
    if (input.length < 2 || selected) {
      setSuggestions([]);
      setAutocompleteLoading(false);
      return undefined;
    }

    let active = true;
    setAutocompleteLoading(true);
    const timer = setTimeout(async () => {
      setAutocompleteFailed(false);
      try {
        if (!sessionToken.current) sessionToken.current = crypto.randomUUID();
        searchQuery.current = input;
        const response = await autocompleteDestinations(input, sessionToken.current);
        if (active) setSuggestions(response.suggestions || []);
      } catch (requestError) {
        if (active) {
          setSuggestions([]);
          setAutocompleteFailed(true);
          setError(requestError.response?.data?.error || 'Google destination suggestions could not be loaded.');
        }
      } finally {
        if (active) setAutocompleteLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selected]);

  const openSavedDestination = (destination) => {
    onSearch?.(destination);
    startDestinationDiscovery(destination.slug).catch(() => {});
  };

  const submit = async (event) => {
    event.preventDefault();
    if (query.trim().length < 2 || loading) return;
    setLoading(true);
    setError('');

    try {
      if (!selected) {
        const cached = await lookupDestination(query.trim());
        if (cached.destination) {
          openSavedDestination(cached.destination);
          return;
        }

        if (autocompleteLoading) {
          setError('Searching for destinations… choose a suggestion when it appears.');
        } else if (suggestions.length) {
          setError('Choose a destination from the suggestions.');
        } else if (autocompleteFailed) {
          setError('No saved destinations match, and Google suggestions could not load. Check your connection and Maps API key settings.');
        } else {
          setError('No matching destination found. Try a city, region, state, or country.');
        }
        return;
      }

      // Resolve the prediction and complete its Google session through the API.
      const token = sessionToken.current;
      sessionToken.current = null;
      const place = await getDestinationPlaceDetails(selected.placeId, token);
      const destination = await resolveDestination(searchQuery.current || query.trim(), place.placeId || selected.placeId, place.location || undefined);
      onSearch?.(destination);
      startDestinationDiscovery(destination.slug).catch(() => {});
    } catch {
      setError('Search could not be completed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateQuery = (value) => {
    setQuery(value);
    setSelected(null);
    setSuggestions([]);
    setError('');
    setAutocompleteFailed(false);
    if (!value.trim()) {
      searchQuery.current = '';
      sessionToken.current = null;
    }
  };

  const showDropdown = query.trim().length >= 2 && !selected;
  const hasSuggestions = suggestions.length > 0;

  return (
    <form onSubmit={submit} className="relative flex w-full items-center gap-2">
      <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg border border-[#d7dfd9] bg-white px-4 transition focus-within:border-green-medium focus-within:ring-2 focus-within:ring-green-medium/15">
        {loading || autocompleteLoading ? <LoaderCircle size={19} className="shrink-0 animate-spin text-pine" /> : <Search size={19} className="shrink-0 text-[#56655c]" />}
        <input
          type="text"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Search destinations, countries, regions"
          autoComplete="off"
          className="min-w-0 flex-grow bg-transparent text-sm text-pine outline-none placeholder:text-[#7b8980]"
          aria-label="Search destinations"
          aria-autocomplete="list"
          aria-expanded={showDropdown && (hasSuggestions || autocompleteLoading)}
        />
      </div>
      <button
        type="submit"
        disabled={query.trim().length < 2 || loading || (autocompleteLoading && !selected)}
        className="inline-flex h-14 shrink-0 items-center gap-2 rounded-lg bg-btn-primary-bg px-5 text-sm font-bold text-btn-primary-text transition hover:bg-btn-primary-bg-hover disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:bg-btn-primary-bg"
      >
        {loading ? 'Searching…' : <><Search size={16} /> Search</>}
      </button>

      {showDropdown && <ul className="absolute left-0 right-28 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-lg border border-[#e3e9e5] bg-white py-1 shadow-[0_14px_40px_rgba(18,44,32,0.16)]" role="listbox">
        {suggestions.map((prediction) => (
          <li key={prediction.placeId}>
            <button type="button" onClick={() => { setSelected(prediction); setSuggestions([]); setError(''); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-pine hover:bg-[#f5faf6]">
              <MapPin size={17} className="shrink-0 text-pine" />
              <span className="min-w-0 flex-1 truncate">{prediction.description || prediction.mainText || ''}</span>
            </button>
          </li>
        ))}
        {!hasSuggestions && <li className="px-4 py-3 text-sm text-[#68766e]">
          {autocompleteLoading ? 'Searching Google destinations…' : autocompleteFailed ? 'Google suggestions are unavailable. Check your connection and Places API settings.' : 'No Google suggestions yet. Keep typing or try another spelling.'}
        </li>}
        {hasSuggestions && <li className="border-t border-[#edf1ed] px-4 py-1.5 text-right text-[11px] font-semibold text-[#68766e]">Google Maps</li>}
      </ul>}

      {selected && <p className="absolute left-3 right-28 top-full z-40 mt-2 rounded-lg border border-[#dce8df] bg-white px-4 py-3 text-sm text-[#34443a] shadow-sm">Selected: <strong>{selected.description || selected.mainText}</strong>. Click Search or press Enter to open.</p>}
      {error && <p role="alert" className="absolute left-3 right-28 top-full z-40 mt-2 rounded-lg bg-white px-4 py-3 text-sm text-[#9b3e32] shadow">{error}</p>}
    </form>
  );
}
