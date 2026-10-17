import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, LoaderCircle, MapPin, Plus, Route, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth';
import { createTrip, deleteTrip, getTrips } from '../api/tripsApi';
import { autocompleteDestinations, getDestinationPlaceDetails, resolveDestination } from '../../places/api/placesApi';
import DateRangePicker from '../../../shared/components/date-range-picker/DateRangePicker';

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPredictionLabel(prediction, fallback = '') {
  const structuredLabel = [prediction.mainText, prediction.secondaryText]
    .filter(Boolean)
    .join(', ');
  const description = prediction.description?.trim() || '';
  return structuredLabel.length >= description.length
    ? structuredLabel || fallback
    : description;
}

function TripDestinationSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [suggestionState, setSuggestionState] = useState({ query: '', status: 'idle', items: [] });
  const [selected, setSelected] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [dropdownRect, setDropdownRect] = useState(null);
  const containerRef = useRef(null);
  const sessionToken = useRef(null);
  const searchQuery = useRef('');
  const input = query.trim();
  const suggestions = suggestionState.query === input ? suggestionState.items : [];
  const loadingSuggestions = input.length >= 3 && !selected && (suggestionState.query !== input || suggestionState.status === 'loading');
  const showDropdown = input.length >= 3 && !selected && !resolving;

  useEffect(() => {
    if (!showDropdown) {
      setDropdownRect(null);
      return undefined;
    }
    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showDropdown]);

  useEffect(() => {
    if (input.length < 3 || selected) {
      if (input.length < 3) sessionToken.current = null;
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      if (active) setSuggestionState({ query: input, status: 'loading', items: [] });
      try {
        if (!sessionToken.current) sessionToken.current = crypto.randomUUID();
        searchQuery.current = input;
        const response = await autocompleteDestinations(input, sessionToken.current);
        if (active) setSuggestionState({ query: input, status: 'loaded', items: response.suggestions || [] });
      } catch (requestError) {
        if (active) {
          setSuggestionState({ query: input, status: 'failed', items: [] });
          setError(requestError.response?.data?.error || 'Google destination suggestions could not be loaded.');
        }
      }
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [input, selected]);

  const updateQuery = value => {
    setQuery(value);
    setSelected(false);
    setError('');
    onSelect(null);
    if (!value.trim()) {
      searchQuery.current = '';
      sessionToken.current = null;
    }
  };

  const chooseSuggestion = async prediction => {
    const selectedLabel = getPredictionLabel(prediction, input);
    // Reflect the clicked prediction immediately. If the local API is offline,
    // Place Details may fail before destination resolution can finish.
    setQuery(selectedLabel);
    setSelected(true);
    setResolving(true);
    setError('');
    const token = sessionToken.current;
    sessionToken.current = null;
    try {
      const place = await getDestinationPlaceDetails(prediction.placeId, token);
      const destination = await resolveDestination(searchQuery.current || input, place.placeId || prediction.placeId, place.location || undefined);
      // Keep the complete prediction label, including its location context.
      setQuery(selectedLabel || destination.name);
      onSelect(destination);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'That destination could not be selected. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  return <div className="relative mt-1.5">
    <div ref={containerRef} className="flex min-h-11 items-center gap-3 rounded-md border border-[#d6dfd8] bg-white px-3 py-2 transition focus-within:border-green-medium focus-within:ring-2 focus-within:ring-green-medium/15">
      {resolving || loadingSuggestions ? <LoaderCircle size={17} className="shrink-0 animate-spin text-pine" /> : selected ? <Check size={17} className="shrink-0 text-green-700" /> : <Search size={17} className="shrink-0 text-[#66736b]" />}
      <textarea rows={selected ? 2 : 1} value={query} onChange={event => updateQuery(event.target.value)} placeholder="Search cities, regions, or countries" autoComplete="off" disabled={resolving} className="max-h-20 min-h-6 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-0.5 text-sm font-normal leading-5 text-pine outline-none placeholder:text-[#7b8980] disabled:opacity-70" aria-label="Search destinations" aria-autocomplete="list" aria-expanded={showDropdown && (suggestions.length > 0 || loadingSuggestions)} />
    </div>
    {showDropdown && dropdownRect && createPortal(<ul role="listbox" style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 100 }} className="app-scrollbar max-h-60 overflow-y-auto rounded-lg border border-[#e3e9e5] bg-white py-1 shadow-[0_14px_40px_rgba(18,44,32,0.16)]">
      {suggestions.map(prediction => <li key={prediction.placeId} role="option" aria-selected="false">
        <button type="button" onClick={() => chooseSuggestion(prediction)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-pine hover:bg-[#f5faf6]">
          <MapPin size={17} className="shrink-0 text-pine" />
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{prediction.mainText || prediction.description}</span>{prediction.secondaryText && <span className="block truncate text-xs text-[#75847b]">{prediction.secondaryText}</span>}</span>
        </button>
      </li>)}
      {!suggestions.length && <li className="px-4 py-3 text-sm text-[#68766e]">{loadingSuggestions ? 'Searching Google destinations…' : suggestionState.status === 'failed' ? 'Google suggestions are unavailable.' : 'No matching destinations. Try another search.'}</li>}
      {suggestions.length > 0 && <li translate="no" className="border-t border-[#edf1ed] px-4 py-1.5 text-right text-xs font-normal text-[#5e5e5e]">Google Maps</li>}
    </ul>, document.body)}
    {resolving && <p role="status" className="mt-1.5 text-xs text-[#66736b]">Loading selected destination…</p>}
    {error && <p role="alert" className="mt-1.5 text-xs text-[#9b3e32]">{error}</p>}
  </div>;
}

export default function TripsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAiMode = searchParams.get('mode') === 'ai';
  const [trips, setTrips] = useState([]);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(isAiMode);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [tripToDelete, setTripToDelete] = useState(null);
  const [deletingTripId, setDeletingTripId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const loading = authLoading || Boolean(user?.id && loadedUserId !== user.id);

  useEffect(() => {
    if (authLoading || !user?.id) return undefined;

    let current = true;
    getTrips()
      .then((loadedTrips) => {
        if (!current) return;
        setTrips(loadedTrips);
      })
      .catch(() => { if (current) setError('Trips could not be loaded. Please try again.'); })
      .finally(() => { if (current) setLoadedUserId(user.id); });

    return () => { current = false; };
  }, [authLoading, user?.id]);

  const handleCreateTrip = async (event) => {
    event.preventDefault();
    if (!user?.id) return navigate('/auth/login');
    if (endDate < startDate) {
      setError('The return date must be after the departure date.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const data = await createTrip({
        destinationId: selectedDestination.id,
        destinationName: selectedDestination.name,
        title: selectedDestination.name,
        startDate,
        endDate,
      });
      if (!data.success) throw new Error(data.error || 'Trip could not be created.');
      setTrips((currentTrips) => [...currentTrips, {
        id: data.id,
        title: data.destinationName || selectedDestination.name,
        destination_name: data.destinationName || selectedDestination.name,
        start_date: startDate,
        end_date: endDate,
      }]);
      setIsModalOpen(false);
      setSelectedDestination(null);
      setStartDate('');
      setEndDate('');
      navigate(isAiMode ? `/trips/${data.id}?mode=ai` : `/trips/${data.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'Trip could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!tripToDelete || deletingTripId) return;
    setDeletingTripId(tripToDelete.id);
    setError('');
    try {
      await deleteTrip(tripToDelete.id);
      setTrips(currentTrips => currentTrips.filter(trip => trip.id !== tripToDelete.id));
      setTripToDelete(null);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'The itinerary could not be deleted.');
    } finally {
      setDeletingTripId('');
    }
  };

  if (authLoading || loading) {
    return <div className="app-container py-16 text-sm text-[#66736b]">Loading your trips…</div>;
  }

  if (!user) {
    return (
      <div className="app-container py-16">
        <section className="mx-auto max-w-xl border-y border-[#e5eae6] py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-badge-bg text-pine"><Route size={24} /></span>
          <h1 className="mt-4 text-2xl font-extrabold text-pine">Your trips start here</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#66736b]">Sign in to keep your plans, places, and day-by-day itineraries together.</p>
          <Link to="/auth/login" state={{ from: isAiMode ? '/trips?mode=ai' : '/trips' }} className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-btn-primary-bg px-6 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover">Sign in to continue</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="app-container pb-16 pt-8 sm:pt-12">
      <div className="flex flex-col justify-between gap-5 border-b border-[#e5eae6] pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold text-pine">Your travel plans</p>
          <h1 className="mt-1 text-3xl font-extrabold text-pine sm:text-4xl">My trips</h1>
          <p className="mt-2 text-sm text-[#66736b]">Keep the places, dates, and details for every getaway together.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setIsModalOpen(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-pine px-5 text-sm font-bold text-white transition hover:bg-[#203b30]">
          <Plus size={17} /> Plan a trip
        </button>
      </div>

      {error && !isModalOpen && <p role="alert" className="mt-5 rounded-lg bg-[#fff4f1] p-4 text-sm text-[#9b3e32]">{error}</p>}

      {trips.length ? (
        <div className="divide-y divide-[#e5eae6]">
          {trips.map((trip) => (
            <article key={trip.id} className="group relative flex flex-col justify-between gap-5 rounded-2xl border border-[#e5eae6] bg-white p-5 pr-14 transition duration-200 hover:border-[#cdd9d0] hover:shadow-md sm:p-6 sm:pr-16">
              <button type="button" onClick={() => { setError(''); setTripToDelete(trip); }} aria-label={`Delete ${trip.title} itinerary`} title="Delete itinerary" className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5eae6] text-[#75847b] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:right-5 sm:top-5">
                <Trash2 size={16} />
              </button>
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#edf5ef] text-pine"><MapPin size={21} /></span>
                <div className="min-w-0">
                  <h2 className="mt-1 truncate text-xl font-bold text-pine sm:text-2xl">{trip.title}</h2>
                  {trip.destination_name && trip.destination_name.trim().toLowerCase() !== trip.title?.trim().toLowerCase() && <p className="mt-1 flex items-center gap-1.5 text-sm text-[#66736b]"><MapPin size={14} className="shrink-0" />{trip.destination_name}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[#66736b]">
                    <p className="inline-flex items-center gap-1.5"><CalendarDays size={15} className="text-pine" />{formatDate(trip.start_date)} – {formatDate(trip.end_date)}</p>
                    <span className="rounded-full bg-[#f1f5f2] px-2.5 py-1 text-xs font-semibold text-pine">{Math.round((Date.parse(`${trip.end_date}T00:00:00Z`) - Date.parse(`${trip.start_date}T00:00:00Z`)) / 86400000) + 1} days</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end sm:pl-4">
                <Link to={`/trips/${trip.id}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-btn-primary-bg px-4 text-sm font-bold text-btn-primary-text transition hover:bg-btn-primary-bg-hover sm:w-auto">
                  Open itinerary <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-badge-bg text-pine"><MapPin size={23} /></span>
          <h2 className="mt-4 text-xl font-extrabold text-pine">No trips planned yet</h2>
          <p className="mt-2 text-sm text-[#66736b]">Start with a destination and build your itinerary as you go.</p>
          <button type="button" onClick={() => setIsModalOpen(true)} className="mt-5 text-sm font-bold text-pine hover:underline">Create your first trip</button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#10261f]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-trip-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-bold text-pine">Start planning</p>
              <h2 id="create-trip-title" className="mt-1 text-2xl font-extrabold text-pine">Create a trip</h2>
            </div>
            {error && <p role="alert" className="mb-4 rounded-lg bg-[#fff4f1] p-3 text-sm text-[#9b3e32]">{error}</p>}
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#35433d]">Destination</label>
                <TripDestinationSearch onSelect={setSelectedDestination} />
              </div>
              <fieldset>
                <legend className="mb-1.5 block text-sm font-semibold text-[#35433d]">How many days should we plan?</legend>
                <DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
              </fieldset>
              <div className="flex justify-end gap-3 border-t border-[#e8ede9] pt-5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="h-10 rounded-full px-4 text-sm font-bold text-[#526158] hover:bg-[#f2f5f2]">Cancel</button>
                <button type="submit" disabled={saving || !selectedDestination || !startDate || !endDate} className="h-10 rounded-full bg-btn-primary-bg px-5 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Creating…' : !selectedDestination ? 'Select destination' : !startDate || !endDate ? 'Choose dates' : 'Create trip'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {tripToDelete && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10261f]/45 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !deletingTripId) setTripToDelete(null); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-trip-title" aria-describedby="delete-trip-description" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
          <h2 id="delete-trip-title" className="text-lg font-bold text-pine">Delete this itinerary?</h2>
          <p id="delete-trip-description" className="mt-2 text-sm leading-6 text-[#66736b]">This will permanently delete <strong>{tripToDelete.title}</strong> and all its planned stops.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setTripToDelete(null)} disabled={Boolean(deletingTripId)} className="h-10 rounded-full px-4 text-sm font-bold text-[#526158] hover:bg-[#f2f5f2] disabled:opacity-50">Cancel</button>
            <button type="button" onClick={handleDeleteTrip} disabled={Boolean(deletingTripId)} className="inline-flex h-10 items-center gap-2 rounded-full bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60">{deletingTripId ? 'Deleting…' : <><Trash2 size={15} />Delete itinerary</>}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
